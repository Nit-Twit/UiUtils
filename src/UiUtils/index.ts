/// <reference types="@rbxts/types" />
//
// ┌─────────────────────────────────────────────────────┐
// │                                                     │
// │  ██╗   ██╗██╗██╗   ██╗████████╗██╗██╗     ███████╗  │
// │  ██║   ██║██║██║   ██║╚══██╔══╝██║██║     ██╔════╝  │
// │  ██║   ██║██║██║   ██║   ██║   ██║██║     ███████╗  │
// │  ██║   ██║██║██║   ██║   ██║   ██║██║     ╚════██║  │
// │  ╚██████╔╝██║╚██████╔╝   ██║   ██║███████╗███████║  │
// │   ╚═════╝ ╚═╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝  │
// │                                                     │
// │                      v3.1.2                         │
// │            Various tools for UI Design              │
// │   Developed and maintained by Pandaerock/NitTwit_   │
// │                                                     │
// └─────────────────────────────────────────────────────┘
//

import { Event } from "./Event/index";
const TweenService = game.GetService("TweenService");
const CollectionService = game.GetService("CollectionService");

let registry = new Map<Instance, UiUtils>();
let registryAdded = new Instance("BindableEvent");

export function registerTagged(tag: string) {
	const player = game.GetService("Players").LocalPlayer;
	const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

	const register = (inst: Instance) => {
		if (inst.IsDescendantOf(playerGui) && inst.IsA("GuiObject")) {
			inst.RemoveTag(tag);
			UiUtils.from(inst);
		}
	};

	CollectionService.GetTagged(tag).forEach(register);

	CollectionService.GetInstanceAddedSignal(tag).Connect(register);
}

export class UiUtils {
	private instance: GuiObject;
	private connections: RBXScriptConnection[] = [];
	private UUID: string;
	private internalCall = false;
	private destroyed = false;

	/** Fired when the instance is clicked or activated. */
	public onClick: Event = new Event();
	/** Fired when the mouse enters the instance. */
	public mouseEnter: Event = new Event();
	/** Fired when the mouse leaves the instance. */
	public mouseLeave: Event = new Event();

	/**
	 * Creates a new UiUtils wrapper around a GuiObject.
	 * Registers the instance, binds events, and fires `registryAdded`.
	 * @param inst - The GuiObject to wrap.
	 */
	private constructor(inst: GuiObject) {
		this.UUID = this.generateUUID();
		inst.SetAttribute("__uiutils.uuid", this.UUID);
		this.instance = inst;

		registry.set(inst, this);
		this.bindEvents();
		registryAdded.Fire(inst);

		const d = inst.Destroying.Connect(() => {
			if (this.destroyed) return;

			this.destroyed = true;
			this.disconnectAll();
			this.cleanupRecurse(this.instance);
		});
		this.connections.push(d);
	}

	/**
	 * Destroys the wrapper, disconnects all events, removes from registry,
	 * and destroys the underlying Roblox instance.
	 */
	public destroy() {
		if (this.destroyed) return;
		this.destroyed = true;

		this.disconnectAll();
		this.cleanupRecurse(this.instance);

		if (this.instance.Parent) {
			this.instance.Destroy();
		}
	}

	/**
	 * Returns an existing UiUtils wrapper for the given instance,
	 * or creates a new one if none exists.
	 * @param inst - The GuiObject to wrap or retrieve.
	 */
	public static from(inst: GuiObject): UiUtils {
		const existing = registry.get(inst);

		if (existing && !existing.destroyed) {
			return existing;
		}
		return new UiUtils(inst);
	}

	/** @internal Generates a random UUID v4 string. */
	private generateUUID(): string {
		const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
		const [result] = string.gsub(template, "[xy]", (c) => {
			let r = math.random(0, 15);
			if (c === "y") {
				r = bit32.bor(bit32.band(r, 0x3), 0x8);
			}
			return string.format("%x", r);
		});

		return result;
	}

	/**
	 * Recursively removes instances from the registry.
	 * Skips instances without a UUID attribute.
	 * @param inst - The root instance to start cleanup from.
	 * @returns `true` if the instance was in the registry, `false` otherwise.
	 */
	private cleanupRecurse(inst: Instance): boolean {
		if (!inst.GetAttribute("__uiutils.uuid")) {
			inst.GetChildren().forEach((child) => this.cleanupRecurse(child));
			return false;
		}

		registry.delete(inst);
		inst.GetChildren().forEach((child) => this.cleanupRecurse(child));
		return true;
	}

	/**
	 * Recursively sets the transparency of an instance and its descendants.
	 * Respects `__uiutils.nofade` and `__uiutils.fadethis` tags.
	 * @param inst - The root instance.
	 * @param val - Transparency value (0 = fully visible, 1 = fully transparent).
	 * @param ignoreBackground - If `true`, skips background transparency on Images/Text. Defaults to `true`.
	 */
	private setOpacityRecurse(inst: Instance, val: number, t: "out" | "in" | "single", ignoreBackground: boolean = true) {
		if (this.destroyed) return;

		if (t === "out") {
			const maxOpacity = inst.GetAttribute("__uiutils.maxOpacity") as number || 1
			if (val >= maxOpacity) {
				return;
			}
		} else if (t === "in") {
			const minOpacity = inst.GetAttribute("__uiutils.minOpacity") as number || 0
			if (val <= minOpacity) {
				return;
			}
		}

		const noFade = inst.HasTag("__uiutils.nofade");
		const shouldFade = inst.HasTag("__uiutils.fadethis");
		const textOnly = inst.HasTag("__uiutils.textOnly");

		const isGuiObject = inst.IsA("GuiObject");
		const isImageLabel = inst.IsA("ImageLabel");
		const isImageButton = inst.IsA("ImageButton");
		const isTextLabel = inst.IsA("TextLabel");
		const isTextButton = inst.IsA("TextButton");

		const shouldIgnoreBackgroundFade =
			ignoreBackground && (isImageLabel || isImageButton || isTextLabel || isTextButton) && !shouldFade;
		if (!noFade) {
			if (isGuiObject && !shouldIgnoreBackgroundFade && !textOnly) {
				inst.BackgroundTransparency = val;
			}

			if (isTextLabel || isTextButton) {
				inst.TextTransparency = val;
			}

			if ((isImageLabel || isImageButton) && !textOnly) inst.ImageTransparency = val;

			const stroke = inst.FindFirstChildOfClass("UIStroke");
			if (stroke && !textOnly) stroke.Transparency = val;
		}

		const children = inst.GetChildren();

		children.forEach((child) => {
			this.setOpacityRecurse(child, val, t);
		});
	}

	/** @internal Disconnects and clears all stored RBXScriptConnections. */
	private disconnectAll() {
		this.connections.forEach((c: RBXScriptConnection) => {
			if (c && c.Connected) {
				c.Disconnect();
			}
		});

		this.connections.clear();
	}

	/** @internal Binds click, MouseEnter, and MouseLeave events to the instance. */
	private bindEvents() {
		if (this.instance.IsA("TextButton") || this.instance.IsA("ImageButton")) {
			const c = this.instance.Activated.Connect(() => {
				this.onClick.Fire(this);
			});
			this.connections.push(c);
		}

		if (this.instance.IsA("GuiObject")) {
			const e = this.instance.MouseEnter.Connect(() => {
				this.mouseEnter.Fire(this);
			});

			const l = this.instance.MouseLeave.Connect(() => {
				this.mouseLeave.Fire(this);
			});

			this.connections.push(e);
			this.connections.push(l);
		}
	}

	/**
	 * Sets a property on the underlying instance.
	 * Must be called within `withInternal()`, otherwise logs a warning.
	 * @param prop - The property name to set.
	 * @param value - The value to assign.
	 */
	private setProperty<K extends string>(prop: K, value: unknown) {
		if (!this.internalCall) {
			return warn(
				"⚠️ UIUTILS — Direct property manipulation is discouraged. Use UIUtils methods or wrap changes in _WithInternal() to suppress this warning.",
			);
		}

		(this.instance as never as Record<string, unknown>)[prop] = value;
	}

	/**
	 * Gets a property from the underlying instance.
	 * @param prop - The property name to retrieve.
	 * @returns The property value.
	 */
	private getProperty(prop: unknown) {
		return (this.instance as unknown as Record<string, unknown>)[prop as string];
	}

	/**
	 * Runs a callback with internal property access enabled.
	 * Allows `setProperty` to bypass the manipulation warning.
	 * @param callback - The function to run internally.
	 */
	private withInternal(callback: Callback) {
		this.internalCall = true;

		const [success, result] = pcall(callback);

		this.internalCall = false;

		if (!success) {
			error(result);
		}
	}

	/**
	 * Recursively traverses an instance hierarchy and collects all descendants
	 * with the specified CollectionService tag into the provided results array.
	 * Tagged instances are wrapped in `UiUtils` and have the tag removed after collection.
	 *
	 * @param root - The root instance to begin recursive traversal from.
	 * @param tag - The CollectionService tag to search for.
	 * @param results - The array that collected `UiUtils` wrappers are pushed into.
	 */
	private static collectChildren(root: Instance, tag: string, results: UiUtils[]) {
		for (const child of root.GetChildren()) {
			const hasTag = child.HasTag(tag);

			if (hasTag && child.IsA("GuiObject")) {
				results.push(UiUtils.from(child));
				child.RemoveTag(tag);
			}

			UiUtils.collectChildren(child, tag, results);
		}
	}

	/**
	 * Searches the registry for a wrapper whose instance name matches the given string.
	 * Polls every frame for up to ~5 seconds before timing out.
	 * @param name - The instance name to search for.
	 * @returns The matching `UiUtils` wrapper, or `undefined` if not found.
	 */
	public static fromName(name: string): UiUtils | undefined {
		for (const [, item] of registry) {
			if (item.instance.Name === name) {
				return item;
			}
		}

		for (let i = 0; i < 300; i++) {
			registryAdded.Event.Wait();

			for (const [, item] of registry) {
				if (item.instance.Name === name) {
					return item;
				}
			}
		}

		warn("fromName timed out:", name);
		return undefined;
	}

	/**
	 * Finds a direct child of this instance by name and returns a UiUtils wrapper.
	 * @param name - The child instance name.
	 * @returns A `UiUtils` wrapper, or `undefined` if not found.
	 */
	public fromChild(name: string): UiUtils | undefined {
		const child = this.instance.FindFirstChild(name) as GuiObject;
		return child ? UiUtils.from(child) : undefined;
	}

	/**
	 * Recursively finds all descendants with a given CollectionService tag
	 * and returns UiUtils wrappers for each. Removes the tag after collection.
	 * @param tag - The CollectionService tag to search for.
	 * @returns An array of `UiUtils` wrappers.
	 */
	public fromChildren(tag: string): UiUtils[] {
		const results: UiUtils[] = [];

		UiUtils.collectChildren(this.instance, tag, results);

		return results;
	}

	/**
	 * Searchs every roblox Instance under PlayerGui for a given CollectionService tag
	 * and returns either it's wrapper or a new UiUtils wrapper.
	 * @param tag - The CollectionService tag to search for.
	 * @returns An array of `UiUtils` wrappers, all containing the given CollectionService tag
	 */
	public static fromTagged(tag: string): Array<UiUtils> {
		const player = game.GetService("Players").LocalPlayer;
		const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
		let temp: Array<UiUtils> = [];

		const register = (inst: Instance) => {
			if (inst.IsDescendantOf(playerGui) && inst.IsA("GuiObject")) {
				temp.push(UiUtils.from(inst));
			}
		};

		const tagged = CollectionService.GetTagged(tag) as GuiObject[]
		for (let i = 0; i < tagged.size(); i++) {
			register(tagged[i])
		}

		return temp;
	}

	/**
	 * Sets the `Visible` property of the instance.
	 * @param val - `true` to show, `false` to hide.
	 */
	public setVisible(val: boolean) {
		this.withInternal(() => {
			this.setProperty("Visible", val);
		});
	}

	/** @returns Whether the instance is currently visible. */
	public isVisible(): boolean {
		return this.getProperty("Visible") as boolean;
	}

	/**
	 * Sets the transparency of the instance and all its descendants.
	 * @param val - Transparency value (0 = fully visible, 1 = fully transparent).
	 */
	public setOpacity(val: number) {
		this.setOpacityRecurse(this.instance, val, "single");
	}

	/**
	 * Tweens the instance and descendants from transparent to visible.
	 * @param maxOpacity - Starting transparency value. Defaults to `0` (fully visible).
	 * @param tweenInfo - TweenInfo to use. Defaults to 0.25s Cubic Out.
	 * @returns The playing `Tween`.
	 */
	public fadeIn(
		maxOpacity: number = 0,
		tweenInfo: TweenInfo = new TweenInfo(0.25, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out, 0, false, 0),
	): Tween {
		this.setOpacity(maxOpacity);
		this.setVisible(true);

		const proxy = new Instance("NumberValue");
		proxy.Value = 1;

		const tween = TweenService.Create(proxy, tweenInfo, {
			Value: 0,
		});

		const c = proxy.GetPropertyChangedSignal("Value").Connect(() => {
			this.setOpacityRecurse(this.instance, proxy.Value, "in");
		});

		tween.Completed.Connect(() => {
			c.Disconnect();
			proxy.Destroy();
		});

		tween.Play();
		return tween;
	}

	/**
	 * Tweens the instance and descendants from visible to transparent, then hides it.
	 * @param tweenInfo - TweenInfo to use. Defaults to 0.25s Cubic Out.
	 * @returns The playing `Tween`.
	 */
	public fadeOut(
		tweenInfo: TweenInfo = new TweenInfo(0.25, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out, 0, false, 0),
	): Tween {
		const proxy = new Instance("NumberValue");
		proxy.Value = 0;

		const tween = TweenService.Create(proxy, tweenInfo, {
			Value: 1,
		});

		const c = proxy.GetPropertyChangedSignal("Value").Connect(() => {
			this.setOpacityRecurse(this.instance, proxy.Value, "out");
		});

		tween.Completed.Connect(() => {
			c.Disconnect();
			this.setVisible(false);
			proxy.Destroy();
		});

		tween.Play();
		return tween;
	}

	/**
	 * Tweens the `BackgroundColor3` of the instance to a target color.
	 * @param color - The target `Color3`.
	 * @param tweenInfo - TweenInfo to use. Defaults to 0.25s Cubic Out.
	 * @returns The playing `Tween`.
	 */
	public fadeColor(
		color: Color3,
		tweenInfo: TweenInfo = new TweenInfo(0.25, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out, 0, false, 0),
	) {
		if (!color) return error("❌ UIUTILS — Missing color parameter");

		const tween = TweenService.Create(this.instance as GuiObject, tweenInfo, { BackgroundColor3: color });
		tween.Play();
		return tween;
	}

	/**
	 * Tweens the `Position` of the instance to a target `UDim2`.
	 * @param position - The target `UDim2` position.
	 * @param tweenInfo - TweenInfo to use. Defaults to 0.25s Cubic Out.
	 * @returns The playing `Tween`.
	 */
	public slide(
		position: UDim2,
		tweenInfo: TweenInfo = new TweenInfo(0.25, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out, 0, false, 0),
	) {
		if (!position) return error("❌ UIUTILS — Missing position parameter");

		const tween = TweenService.Create(this.instance, tweenInfo, { Position: position });
		tween.Play();
		return tween;
	}

	/**
	 * Tweens the `Size` of the instance to a target `UDim2`.
	 * @param size - The target `UDim2` size.
	 * @param tweenInfo - TweenInfo to use. Defaults to 0.25s Cubic Out.
	 * @returns The playing `Tween`.
	 */
	public transformScale(
		size: UDim2,
		tweenInfo: TweenInfo = new TweenInfo(0.25, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out, 0, false, 0),
	) {
		if (!size) return error("❌ UIUTILS — Missing size parameter");

		const tween = TweenService.Create(this.instance, tweenInfo, { Size: size });
		tween.Play();
		return tween;
	}

	/**
	 * Sets the `Position` of the instance.
	 * @param pos - The target `UDim2` position.
	 */
	public setPosition(pos: UDim2) {
		this.withInternal(() => {
			this.setProperty("Position", pos);
		});
	}

	/**
	 * Sets the `Size` of the instance.
	 * @param size - The target `UDim2` size.
	 */
	public setSize(size: UDim2) {
		this.withInternal(() => {
			this.setProperty("Size", size);
		});
	}

	/**
	 * Sets the `Text` property of the instance.
	 * Only valid for TextLabel, TextButton, or TextBox.
	 * @param text - The string to set.
	 */
	public setText(text: string) {
		if (!(this.instance.IsA("TextLabel") || this.instance.IsA("TextButton") || this.instance.IsA("TextBox"))) {
			return error(`❌ UIUTILS — Given instance ${this.instance} does not contain a text property`);
		}

		this.withInternal(() => {
			this.setProperty("Text", text);
		});
	}

	/**
	 * Sets the `Image` property of the instance.
	 * Automatically prepends `rbxassetid://` if not already present.
	 * Only valid for ImageLabel or ImageButton.
	 * @param imageId - The asset ID or full `rbxassetid://` string.
	 */
	public setImage(imageId: string) {
		if (!(this.instance.IsA("ImageLabel") || this.instance.IsA("ImageButton"))) {
			return error(`❌ UIUTILS — Given instance ${this.instance} does not contain an image property`);
		}

		if (string.find(imageId, "rbxassetid://", 1, true) !== undefined) {
			this.withInternal(() => {
				this.setProperty("Image", imageId);
			});
		} else {
			this.withInternal(() => {
				this.setProperty("Image", `rbxassetid://${imageId}`);
			});
		}
	}

	/**
	 * Sets the `ImageColor3` property of the instance.
	 * Only valid for ImageLabel or ImageButton.
	 * @param color - The target `Color3`.
	 */
	public setImageColor(color: Color3) {
		if (!(this.instance.IsA("ImageLabel") || this.instance.IsA("ImageButton"))) {
			return error(`❌ UIUTILS — Given instance ${this.instance} does not have an image`);
		}

		this.withInternal(() => {
			this.setProperty("ImageColor3", color);
		});
	}

	/**
	 * Sets the `BackgroundColor3` of the instance.
	 * @param color - The target `Color3`.
	 */
	public setBackgroundColor(color: Color3) {
		this.withInternal(() => {
			this.setProperty("BackgroundColor3", color);
		});
	}

	/**
	 * Sets a custom attribute on the instance.
	 * @param key - The attribute name.
	 * @param value - The attribute value.
	 */
	public setAttribute(key: string, value: AttributeValue) {
		this.instance.SetAttribute(key, value);
	}

	/** @returns The current `Position` of the instance. */
	public getPosition(): UDim2 {
		return this.getProperty("Position") as UDim2;
	}

	/** @returns The current `Size` of the instance. */
	public getSize(): UDim2 {
		return this.getProperty("Size") as UDim2;
	}

	/**
	 * Gets a custom attribute from the instance.
	 * @param key - The attribute name.
	 * @returns The attribute value.
	 */
	public getAttribute(key: string): AttributeValue {
		return this.instance.GetAttribute(key) as AttributeValue;
	}

	/**
	 * Gets the `Text` property of the instance.
	 * Only valid for TextLabel, TextButton, or TextBox.
	 * @returns The text string.
	 */
	public getText(): string {
		if (!(this.instance.IsA("TextLabel") || this.instance.IsA("TextButton") || this.instance.IsA("TextBox"))) {
			return error(`❌ UIUTILS — Given instance ${this.instance} does not contain a text property`);
		}

		return this.getProperty("Text") as string;
	}

	/** @returns The absolute screen position of the instance as a `Vector2`. */
	public getAbsolutePosition(): Vector2 {
		return this.instance.AbsolutePosition;
	}

	/** @returns The absolute screen size of the instance as a `Vector2`. */
	public getAbsoluteSize(): Vector2 {
		return this.instance.AbsoluteSize;
	}

	/**
	 * Waits for and returns a child instance by name.
	 * @param name - The child name to wait for.
	 * @returns The child `Instance`.
	 */
	public getChildInstance(name: string): Instance | undefined {
		return this.instance.WaitForChild(name);
	}

	/** @returns The underlying Roblox `GuiObject`. */
	public getInstance(): GuiObject {
		return this.instance;
	}
}

export type UiUtilsType = UiUtils;

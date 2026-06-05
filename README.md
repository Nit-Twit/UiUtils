# UiUtils

> A fluent wrapper for any Roblox `GuiObject` — with tweens, opacity, events, and a global registry to access any UI instance from anywhere in your project.

---

## Installation

```bash
npm install @rbxts/uiutils
```

### ⚠️ Not yet on npm (as of 05-29-2026)

Pending an invite to the @rbxts organization. In the meantime, you can install it manually:

### 1. Download the bundled package from the [releases](https://github.com/Nit-Twit/UiUtils/releases/) page

### 2. Navigate to your project's root directory

### 4. Install bundled package

```bash
npm i <PATH TO PACKAGE>.tgz
```

Apologies for the inconvenience. this is the best available option until the package is published.

##

## Features

- 🎬 **Tweening** — fade in/out, slide, scale, and color transitions out of the box
- 👁️ **Opacity** — recursively set transparency across an entire UI hierarchy
- 🖱️ **Events** — `onClick`, `mouseEnter`, and `mouseLeave` wrappers with a clean event API
- 🗂️ **Global Registry** — look up any wrapped instance by name or CollectionService tag from anywhere in your project
- 🏷️ **Tag Support** — auto-register instances via CollectionService tags using `registerTagged`
- 🔒 **Safe Destruction** — automatic cleanup of connections and registry entries on instance destroy

---

## Quick Start

```ts
import { UiUtils } from "@rbxts/uiutils";

const button = UiUtils.from(someGuiObject);

button.onClick.Connect(() => {
	print("Clicked!");
});

button.fadeIn();
```

---

## API

### Static Methods

#### `UiUtils.from(inst: GuiObject): UiUtils`

Returns an existing wrapper for the instance, or creates a new one. This is the primary way to get a `UiUtils` instance.

```ts
const ui = UiUtils.from(myFrame);
```

#### `UiUtils.fromName(name: string): UiUtils | undefined`

Searches the **global registry** for a wrapped instance by name. Polls for up to ~5 seconds before timing out.

```ts
const hud = UiUtils.fromName("HudFrame");
```

#### `registerTagged(tag: string)`

Auto-wraps all current and future `GuiObject`s with the given CollectionService tag under `PlayerGui`.

```ts
registerTagged("UiUtils");
```

---

### Instance Methods

#### Traversal

| Method              | Description                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `fromChild(name)`   | Find and wrap a direct child by name                                                              |
| `fromChildren(tag)` | Recursively find and wrap all descendants with a given<br> CollectionService tag                  |
| `fromTagged(tag)`   | Find any `GuiObject` that has a given CollectionService<br>tag. Returns a Map of UiUtils wrappers |

#### Visibility & Opacity

| Method            | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `setVisible(val)` | Show or hide the instance                                   |
| `isVisible()`     | Returns current visibility                                  |
| `setOpacity(val)` | Recursively set transparency (0 = visible, 1 = transparent) |

#### Tweening

| Method                             | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `fadeIn(maxOpacity?, tweenInfo?)`  | Tween from transparent to visible            |
| `fadeOut(tweenInfo?)`              | Tween from visible to transparent, then hide |
| `fadeColor(color, tweenInfo?)`     | Tween `BackgroundColor3` to a target color   |
| `slide(position, tweenInfo?)`      | Tween `Position` to a target `UDim2`         |
| `transformScale(size, tweenInfo?)` | Tween `Size` to a target `UDim2`             |

All tween methods default to `0.25s Cubic Out` and return the playing `Tween`.

#### Setters

| Method                      | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `setPosition(pos)`          | Set `Position`                                       |
| `setSize(size)`             | Set `Size`                                           |
| `setText(text)`             | Set `Text` (TextLabel, TextButton, TextBox only)     |
| `setImage(imageId)`         | Set `Image`, auto-prepends `rbxassetid://` if needed |
| `setImageColor(color)`      | Set `ImageColor3`                                    |
| `setBackgroundColor(color)` | Set `BackgroundColor3`                               |
| `setAttribute(key, value)`  | Set a custom instance attribute                      |

#### Getters

| Method                   | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `getPosition()`          | Get current `Position`                           |
| `getSize()`              | Get current `Size`                               |
| `getText()`              | Get `Text` (TextLabel, TextButton, TextBox only) |
| `getAttribute(key)`      | Get a custom instance attribute                  |
| `getAbsolutePosition()`  | Get absolute screen position as `Vector2`        |
| `getAbsoluteSize()`      | Get absolute screen size as `Vector2`            |
| `getChildInstance(name)` | `WaitForChild` wrapper                           |
| `getInstance()`          | Returns the underlying `GuiObject`               |

<!-- #### Misc

| Method | Description |
| ------ | ----------- |
| `isInstanceOf()`  -->

#### Events

```ts
ui.onClick.Connect((sender) => { ... });
ui.mouseEnter.Connect((sender) => { ... });
ui.mouseLeave.Connect((sender) => { ... });
```

#### Destruction

```ts
ui.destroy(); // Disconnects all events, removes from registry, and destroys the instance
```

---

## Tags

You can control recursive opacity behavior with CollectionService tags:

| Tag                  | Effect                                                        |
| -------------------- | ------------------------------------------------------------- |
| `__uiutils.nofade`   | Excludes an instance and its descendants from opacity changes |
| `__uiutils.fadethis` | Forces opacity on ImageButtons (background included)          |
| `__uiutils.textOnly` | Fades only the text in a TextBox / TextLabel                  |

---

## Attributes

You can control recursive opacity behavior with Attributes:

| Attribute              | Effect                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| `__uiutils.minOpacity` | Sets the minimum opacity an Instance can have when fading in. Defaults to `0`  |
| `__uiutils.maxOpacity` | Sets the maximum opacity an Instance can have when fading out. Defaults to `1` |

---

## License

MIT — Developed and maintained by **Pandaerock / NitTwit\_**

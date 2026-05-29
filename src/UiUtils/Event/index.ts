export class Event {
    private _callbacks: Array<(...args: unknown[]) => void> = [];

    Connect(callback: (...args: unknown[]) => void) {
        this._callbacks.push(callback);
        return {
            Disconnect: () => {
                this._callbacks = this._callbacks.filter(cb => cb !== callback);
            }
        };
    }

    Fire(...args: unknown[]) {
        for (const callback of this._callbacks) {
            task.spawn(callback, ...args);
        }
    }
}

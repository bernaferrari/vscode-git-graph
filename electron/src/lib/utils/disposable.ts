/**
 * Disposable Pattern Implementation
 * Ported from git-graph/src/utils/disposable.ts
 */

export interface IDisposable {
	dispose(): void;
}

/**
 * Base class for resources that need to be disposed.
 */
export class Disposable implements IDisposable {
	private disposables: IDisposable[] = [];
	private disposed = false;

	/**
	 * Disposes the resources used by the subclass.
	 */
	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		for (const disposable of this.disposables) {
			try {
				disposable.dispose();
			} catch {
				// Ignore errors during disposal
			}
		}
		this.disposables = [];
	}

	/**
	 * Register a single disposable.
	 */
	protected registerDisposable(disposable: IDisposable): void {
		if (this.disposed) {
			try {
				disposable.dispose();
			} catch {
				// Ignore
			}
			return;
		}
		this.disposables.push(disposable);
	}

	/**
	 * Register multiple disposables.
	 */
	protected registerDisposables(...disposables: IDisposable[]): void {
		for (const disposable of disposables) {
			this.registerDisposable(disposable);
		}
	}

	/**
	 * Check if the Disposable has been disposed.
	 */
	protected isDisposed(): boolean {
		return this.disposed;
	}
}

/**
 * Create a disposable from a cleanup function.
 */
export function toDisposable(fn: () => void): IDisposable {
	return { dispose: fn };
}

/**
 * Combine multiple disposables into one.
 */
export function combineDisposables(...disposables: IDisposable[]): IDisposable {
	return toDisposable(() => {
		for (const disposable of disposables) {
			try {
				disposable.dispose();
			} catch {
				// Ignore errors during disposal
			}
		}
	});
}

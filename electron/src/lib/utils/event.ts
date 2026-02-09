/**
 * Event Emitter Implementation
 * Ported from git-graph/src/utils/event.ts
 */

import type { IDisposable } from './disposable';

/**
 * A function used by a subscriber to process an event.
 */
type EventListener<T> = (event: T) => void;

/**
 * A function used to subscribe to an EventEmitter.
 */
export type Event<T> = (listener: EventListener<T>) => IDisposable;

/**
 * Represents an EventEmitter, which delivers events to subscribers.
 * Implements the observer pattern.
 */
export class EventEmitter<T> implements IDisposable {
	private listeners: EventListener<T>[] = [];
	private event: Event<T>;

	constructor() {
		this.event = (listener: EventListener<T>): IDisposable => {
			this.listeners.push(listener);
			return {
				dispose: () => {
					const index = this.listeners.indexOf(listener);
					if (index > -1) {
						this.listeners.splice(index, 1);
					}
				},
			};
		};
	}

	/**
	 * Disposes the resources used by the EventEmitter.
	 */
	public dispose(): void {
		this.listeners = [];
	}

	/**
	 * Emit an event to all subscribers.
	 */
	public emit(event: T): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch {
				// Ignore errors in listeners
			}
		}
	}

	/**
	 * Check if there are any registered listeners.
	 */
	public hasSubscribers(): boolean {
		return this.listeners.length > 0;
	}

	/**
	 * Get the Event subscription function.
	 */
	get subscribe(): Event<T> {
		return this.event;
	}
}

/**
 * Create a promise that resolves when an event is emitted.
 */
export function eventToPromise<T>(event: Event<T>): Promise<T> {
	return new Promise((resolve) => {
		const disposable = event((value) => {
			disposable.dispose();
			resolve(value);
		});
	});
}

/**
 * Debounce an event - only emit after no events for `delay` ms.
 */
export function debounceEvent<T>(event: Event<T>, delay: number): Event<T> {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let lastDisposable: IDisposable | null = null;

	return (listener: EventListener<T>): IDisposable => {
		if (lastDisposable) {
			lastDisposable.dispose();
		}

		lastDisposable = event((value) => {
			if (timeout) {
				clearTimeout(timeout);
			}
			timeout = setTimeout(() => {
				listener(value);
				timeout = null;
			}, delay);
		});

		return {
			dispose: () => {
				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}
				if (lastDisposable) {
					lastDisposable.dispose();
					lastDisposable = null;
				}
			},
		};
	};
}

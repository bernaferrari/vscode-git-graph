/**
 * Buffered Queue Implementation
 * Ported from git-graph/src/utils/bufferedQueue.ts
 */

import { Disposable, toDisposable } from './disposable';

/**
 * A queue that buffers items for a short period before processing them.
 */
export class BufferedQueue<T> extends Disposable {
	private readonly queue: T[] = [];
	private timeout: ReturnType<typeof setTimeout> | null = null;
	private processing = false;

	private readonly bufferDuration: number;
	private readonly onItem: (item: T) => Promise<boolean>;
	private readonly onChanges: () => void;

	/**
	 * Constructs a BufferedQueue instance.
	 * @param onItem Callback invoked to process an item. Returns true if a change occurred.
	 * @param onChanges Callback invoked when changes occurred during processing.
	 * @param bufferDuration Milliseconds to buffer items before processing.
	 */
	constructor(
		onItem: (item: T) => Promise<boolean>,
		onChanges: () => void,
		bufferDuration: number = 1000
	) {
		super();
		this.bufferDuration = bufferDuration;
		this.onItem = onItem;
		this.onChanges = onChanges;

		this.registerDisposable(
			toDisposable(() => {
				if (this.timeout !== null) {
					clearTimeout(this.timeout);
					this.timeout = null;
				}
			})
		);
	}

	/**
	 * Enqueue an item if it doesn't already exist in the queue.
	 */
	public enqueue(item: T): void {
		// Remove existing instance if present
		const existingIndex = this.queue.indexOf(item);
		if (existingIndex > -1) {
			this.queue.splice(existingIndex, 1);
		}
		this.queue.push(item);

		if (!this.processing) {
			if (this.timeout !== null) {
				clearTimeout(this.timeout);
			}
			this.timeout = setTimeout(() => {
				this.timeout = null;
				void this.run();
			}, this.bufferDuration);
		}
	}

	/**
	 * Process all queued items.
	 */
	private async run(): Promise<void> {
		this.processing = true;
		let changes = false;

		let item: T | undefined;
		while ((item = this.queue.shift())) {
			try {
				if (await this.onItem(item)) {
					changes = true;
				}
			} catch {
				// Ignore errors during processing
			}
		}

		this.processing = false;
		if (changes) {
			this.onChanges();
		}
	}

	/**
	 * Check if the queue is currently processing.
	 */
	public isProcessing(): boolean {
		return this.processing;
	}

	/**
	 * Get the current queue length.
	 */
	public get length(): number {
		return this.queue.length;
	}
}

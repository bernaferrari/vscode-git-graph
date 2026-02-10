/**
 * Tests for Event Emitter utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter, debounceEvent, eventToPromise } from './event';

describe('EventEmitter', () => {
	let emitter: EventEmitter<string>;

	beforeEach(() => {
		emitter = new EventEmitter<string>();
	});

	it('should emit events to subscribers', () => {
		const received: string[] = [];

		emitter.subscribe((event) => {
			received.push(event);
		});

		emitter.emit('hello');
		emitter.emit('world');

		expect(received).toEqual(['hello', 'world']);
	});

	it('should handle multiple subscribers', () => {
		const received1: string[] = [];
		const received2: string[] = [];

		emitter.subscribe((event) => {
			received1.push(event);
		});

		emitter.subscribe((event) => {
			received2.push(event);
		});

		emitter.emit('test');

		expect(received1).toEqual(['test']);
		expect(received2).toEqual(['test']);
	});

	it('should dispose subscriptions', () => {
		const received: string[] = [];

		const disposable = emitter.subscribe((event) => {
			received.push(event);
		});

		emitter.emit('first');
		disposable.dispose();
		emitter.emit('second');

		expect(received).toEqual(['first']);
	});

	it('should check for subscribers', () => {
		expect(emitter.hasSubscribers()).toBe(false);

		const disposable = emitter.subscribe(() => {});
		expect(emitter.hasSubscribers()).toBe(true);

		disposable.dispose();
		expect(emitter.hasSubscribers()).toBe(false);
	});

	it('should clear all subscribers on dispose', () => {
		emitter.subscribe(() => {});
		emitter.subscribe(() => {});

		expect(emitter.hasSubscribers()).toBe(true);
		emitter.dispose();
		expect(emitter.hasSubscribers()).toBe(false);
	});
});

describe('eventToPromise', () => {
	it('should resolve when event is emitted', async () => {
		const emitter = new EventEmitter<string>();

		const promise = eventToPromise(emitter.subscribe);
		emitter.emit('hello');

		const result = await promise;
		expect(result).toBe('hello');
	});
});

describe('debounceEvent', () => {
	it('should debounce events', async () => {
		const emitter = new EventEmitter<string>();
		const debouncedSubscribe = debounceEvent(emitter.subscribe, 50);

		const received: string[] = [];
		debouncedSubscribe((event) => {
			received.push(event);
		});

		emitter.emit('first');
		emitter.emit('second');
		emitter.emit('third');

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(received).toEqual(['third']);
	});
});

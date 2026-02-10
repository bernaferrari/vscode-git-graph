/**
 * Tests for Disposable utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Disposable, toDisposable, combineDisposables } from './disposable';

describe('Disposable', () => {
	it('should dispose child disposables', () => {
		let child1Disposed = false;
		let child2Disposed = false;

		class TestDisposable extends Disposable {
			constructor() {
				super();
				this.registerDisposable(toDisposable(() => { child1Disposed = true; }));
				this.registerDisposable(toDisposable(() => { child2Disposed = true; }));
			}
		}

		const parent = new TestDisposable();

		expect(child1Disposed).toBe(false);
		expect(child2Disposed).toBe(false);

		parent.dispose();

		expect(child1Disposed).toBe(true);
		expect(child2Disposed).toBe(true);
	});

	it('should only dispose once', () => {
		let count = 0;

		class TestDisposable extends Disposable {
			constructor() {
				super();
				this.registerDisposable(toDisposable(() => { count++; }));
			}
		}

		const disposable = new TestDisposable();

		disposable.dispose();
		disposable.dispose();
		disposable.dispose();

		expect(count).toBe(1);
	});

	it('should immediately dispose if already disposed', () => {
		let disposed = false;

		class TestDisposable extends Disposable {}
		const parent = new TestDisposable();
		parent.dispose();

		parent.registerDisposable(toDisposable(() => { disposed = true; }));

		expect(disposed).toBe(true);
	});
});

describe('toDisposable', () => {
	it('should create a disposable from a callback', () => {
		let called = false;
		const disposable = toDisposable(() => {
			called = true;
		});

		expect(called).toBe(false);
		disposable.dispose();
		expect(called).toBe(true);
	});
});

describe('combineDisposables', () => {
	it('should combine multiple disposables', () => {
		let count = 0;

		const combined = combineDisposables(
			toDisposable(() => { count++; }),
			toDisposable(() => { count++; }),
			toDisposable(() => { count++; }),
		);

		combined.dispose();

		expect(count).toBe(3);
	});

	it('should handle empty arguments', () => {
		expect(() => combineDisposables().dispose()).not.toThrow();
	});
});

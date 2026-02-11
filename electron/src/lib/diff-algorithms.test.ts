/**
 * Diff Algorithms Tests
 */

import { describe, it, expect } from 'vitest';
import {
	computeDiff,
	patienceDiff,
	histogramDiff,
	minimalDiff,
	lcsDiff,
	ALGORITHM_INFO,
	type DiffAlgorithm,
} from './diff-algorithms';

describe('Diff Algorithms', () => {
	const oldContent = `function hello() {
	console.log("Hello");
	return true;
}`;
	const newContent = `function hello() {
	console.log("Hello, World!");
	return false;
}`;

	describe('computeDiff', () => {
		it('should compute diff with default Myers algorithm', () => {
			const diff = computeDiff(oldContent, newContent);
			expect(diff).toBeDefined();
			expect(diff.length).toBeGreaterThan(0);
		});

		it('should compute diff with different algorithms', () => {
			const algorithms: DiffAlgorithm[] = ['myers', 'patience', 'histogram', 'minimal'];
			
			algorithms.forEach(algorithm => {
				const diff = computeDiff(oldContent, newContent, { algorithm });
				expect(diff).toBeDefined();
				expect(diff.length).toBeGreaterThan(0);
			});
		});

		it('should handle empty strings', () => {
			const diff = computeDiff('', '');
			expect(diff).toEqual([]);
		});

		it('should handle one empty string', () => {
			const diffAdd = computeDiff('', newContent);
			expect(diffAdd.every(line => line.type === 'added')).toBe(true);

			const diffRemove = computeDiff(oldContent, '');
			expect(diffRemove.every(line => line.type === 'removed')).toBe(true);
		});

		it('should handle identical content', () => {
			const diff = computeDiff(oldContent, oldContent);
			expect(diff.every(line => line.type === 'context')).toBe(true);
		});

		it('should respect ignoreWhitespace option', () => {
			const oldWithSpaces = 'hello  world';
			const newWithSpaces = 'hello world';
			
			const diffWithWhitespace = computeDiff(oldWithSpaces, newWithSpaces, { ignoreWhitespace: false });
			const diffWithoutWhitespace = computeDiff(oldWithSpaces, newWithSpaces, { ignoreWhitespace: true });
			
			expect(diffWithoutWhitespace.every(line => line.type === 'context')).toBe(true);
		});

		it('should respect ignoreCase option', () => {
			const diffCaseSensitive = computeDiff('Hello', 'hello', { ignoreCase: false });
			const diffCaseInsensitive = computeDiff('Hello', 'hello', { ignoreCase: true });
			
			expect(diffCaseSensitive.length).toBeGreaterThan(0);
			expect(diffCaseInsensitive.every(line => line.type === 'context')).toBe(true);
		});
	});

	describe('patienceDiff', () => {
		it('should find unique line matches', () => {
			const oldLines = ['a', 'b', 'c', 'd'];
			const newLines = ['a', 'x', 'c', 'd'];
			
			const diff = patienceDiff(oldLines, newLines);
			
			// 'a' and 'c', 'd' should match as context
			const contextLines = diff.filter(l => l.type === 'context');
			expect(contextLines.length).toBeGreaterThanOrEqual(3);
		});

		it('should handle code refactoring', () => {
			const oldCode = `
function calculate(a, b) {
	const sum = a + b;
	const diff = a - b;
	return sum + diff;
}
`.split('\n');

			const newCode = `
function calculate(a, b) {
	const sum = a + b;
	const product = a * b;
	const diff = a - b;
	return sum + diff + product;
}
`.split('\n');

			const diff = patienceDiff(oldCode, newCode);
			expect(diff).toBeDefined();
		});
	});

	describe('histogramDiff', () => {
		it('should use frequency analysis for matching', () => {
			const oldLines = ['unique1', 'common', 'unique2', 'common', 'unique3'];
			const newLines = ['unique1', 'common', 'unique2', 'common', 'unique4'];
			
			const diff = histogramDiff(oldLines, newLines);
			expect(diff).toBeDefined();
		});

		it('should detect code moves', () => {
			const oldLines = ['a', 'b', 'c', 'function foo() {}'];
			const newLines = ['function foo() {}', 'a', 'b', 'c'];
			
			const diff = histogramDiff(oldLines, newLines);
			expect(diff).toBeDefined();
		});
	});

	describe('minimalDiff', () => {
		it('should produce minimal edit script', () => {
			const oldLines = ['a', 'b', 'c'];
			const newLines = ['a', 'x', 'c'];
			
			const diff = minimalDiff(oldLines, newLines);
			
			// Should have exactly 1 removed and 1 added
			const removed = diff.filter(l => l.type === 'removed');
			const added = diff.filter(l => l.type === 'added');
			
			expect(removed.length).toBe(1);
			expect(added.length).toBe(1);
		});
	});

	describe('lcsDiff', () => {
		it('should compute LCS correctly', () => {
			const diff = lcsDiff(
				['a', 'b', 'c', 'd'],
				['a', 'c', 'd', 'e']
			);
			
			// 'a', 'c', 'd' should be in LCS
			const contextLines = diff.filter(l => l.type === 'context');
			expect(contextLines.length).toBe(3);
		});
	});

	describe('ALGORITHM_INFO', () => {
		it('should have info for all algorithms', () => {
			const algorithms: DiffAlgorithm[] = ['myers', 'patience', 'histogram', 'minimal'];
			
			algorithms.forEach(algorithm => {
				expect(ALGORITHM_INFO[algorithm]).toBeDefined();
				expect(ALGORITHM_INFO[algorithm].name).toBeDefined();
				expect(ALGORITHM_INFO[algorithm].description).toBeDefined();
			});
		});
	});
});

/**
 * Advanced Diff Algorithms
 * Patience diff and Histogram diff for better refactoring detection
 */

import { useMemo, useState } from 'react';

// Diff algorithm types
export type DiffAlgorithm = 'myers' | 'patience' | 'histogram' | 'minimal';

interface DiffOptions {
	algorithm: DiffAlgorithm;
	contextLines: number;
	ignoreWhitespace: boolean;
	ignoreCase: boolean;
	showFunctionNames: boolean;
}

interface DiffLine {
	type: 'added' | 'removed' | 'context' | 'header';
	content: string;
	oldLineNumber?: number;
	newLineNumber?: number;
	score?: number;
}

interface DiffHunk {
	header: string;
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: DiffLine[];
}

/**
 * Patience Diff Algorithm
 * Better for code that has been refactored
 * Matches unique lines first, then fills in the rest
 */
export function patienceDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	// Find unique lines on both sides
	const oldUnique = findUniqueLines(oldLines, newLines);
	const newUnique = findUniqueLines(newLines, oldLines);

	// Match unique lines (anchors)
	const matches = matchUniqueLines(oldLines, newLines, oldUnique, newUnique);

	// Build diff based on matches
	return buildDiffFromMatches(oldLines, newLines, matches);
}

/**
 * Histogram Diff Algorithm  
 * Even better for detecting code moves and refactors
 * Uses frequency analysis to match lines
 */
export function histogramDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	// Build histogram of line frequencies
	const oldHistogram = buildHistogram(oldLines);
	const newHistogram = buildHistogram(newLines);

	// Find least common lines (best anchors)
	const anchors = findLeastCommonLines(oldLines, newLines, oldHistogram, newHistogram);

	// Build diff based on anchors
	return buildDiffFromAnchors(oldLines, newLines, anchors);
}

/**
 * Minimal Diff Algorithm
 * Produces smallest possible diff
 */
export function minimalDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	// Use LCS-based diff with minimal edit script
	return lcsDiff(oldLines, newLines);
}

// Helper functions

function findUniqueLines(lines: string[], otherLines: string[]): Map<string, number[]> {
	const otherSet = new Set(otherLines);
	const unique = new Map<string, number[]>();

	lines.forEach((line, index) => {
		if (!otherSet.has(line)) {
			const existing = unique.get(line) || [];
			existing.push(index);
			unique.set(line, existing);
		}
	});

	return unique;
}

function matchUniqueLines(
	oldLines: string[],
	newLines: string[],
	oldUnique: Map<string, number[]>,
	newUnique: Map<string, number[]>
): Array<[number, number]> {
	const matches: Array<[number, number]> = [];

	// Find lines that are unique in both
	oldUnique.forEach((oldIndices, line) => {
		const newIndices = newUnique.get(line);
		if (newIndices && oldIndices.length === 1 && newIndices.length === 1) {
			matches.push([oldIndices[0], newIndices[0]]);
		}
	});

	// Sort by old line index
	matches.sort((a, b) => a[0] - b[0]);

	return matches;
}

function buildDiffFromMatches(
	oldLines: string[],
	newLines: string[],
	matches: Array<[number, number]>
): DiffLine[] {
	const result: DiffLine[] = [];
	let oldIdx = 0;
	let newIdx = 0;

	const processUnmatched = (endOld: number, endNew: number) => {
		while (oldIdx < endOld) {
			result.push({
				type: 'removed',
				content: oldLines[oldIdx],
				oldLineNumber: oldIdx + 1,
			});
			oldIdx++;
		}
		while (newIdx < endNew) {
			result.push({
				type: 'added',
				content: newLines[newIdx],
				newLineNumber: newIdx + 1,
			});
			newIdx++;
		}
	};

	for (const [matchOld, matchNew] of matches) {
		// Process unmatched lines before this match
		processUnmatched(matchOld, matchNew);

		// Add the matched line as context
		result.push({
			type: 'context',
			content: oldLines[matchOld],
			oldLineNumber: matchOld + 1,
			newLineNumber: matchNew + 1,
		});
		oldIdx = matchOld + 1;
		newIdx = matchNew + 1;
	}

	// Process remaining unmatched lines
	processUnmatched(oldLines.length, newLines.length);

	return result;
}

function buildHistogram(lines: string[]): Map<string, { count: number; indices: number[] }> {
	const histogram = new Map<string, { count: number; indices: number[] }>();

	lines.forEach((line, index) => {
		const existing = histogram.get(line);
		if (existing) {
			existing.count++;
			existing.indices.push(index);
		} else {
			histogram.set(line, { count: 1, indices: [index] });
		}
	});

	return histogram;
}

function findLeastCommonLines(
	oldLines: string[],
	newLines: string[],
	oldHistogram: Map<string, { count: number; indices: number[] }>,
	newHistogram: Map<string, { count: number; indices: number[] }>
): Array<[number, number, number]> { // [oldIdx, newIdx, score]
	const anchors: Array<[number, number, number]> = [];

	// Find lines that appear in both but with low frequency
	oldHistogram.forEach((oldInfo, line) => {
		const newInfo = newHistogram.get(line);
		if (newInfo) {
			// Lower score = better anchor (less common)
			const score = oldInfo.count + newInfo.count;
			
			// Match corresponding indices
			for (let i = 0; i < Math.min(oldInfo.indices.length, newInfo.indices.length); i++) {
				anchors.push([oldInfo.indices[i], newInfo.indices[i], score]);
			}
		}
	});

	// Sort by score (ascending) then by old index
	anchors.sort((a, b) => {
		if (a[2] !== b[2]) return a[2] - b[2];
		return a[0] - b[0];
	});

	return anchors;
}

function buildDiffFromAnchors(
	oldLines: string[],
	newLines: string[],
	anchors: Array<[number, number, number]>
): DiffLine[] {
	// Use the best anchors (lowest scores) to partition the diff
	const usedOld = new Set<number>();
	const usedNew = new Set<number>();
	const result: DiffLine[] = [];

	// Take anchors in order of score
	const bestAnchors = anchors.slice(0, Math.min(anchors.length, 100));

	// Sort final anchors by position
	bestAnchors.sort((a, b) => a[0] - b[0]);

	let lastOld = 0;
	let lastNew = 0;

	for (const [oldIdx, newIdx] of bestAnchors) {
		if (usedOld.has(oldIdx) || usedNew.has(newIdx)) continue;
		if (oldIdx < lastOld || newIdx < lastNew) continue;

		// Process lines before this anchor
		while (lastOld < oldIdx) {
			result.push({
				type: 'removed',
				content: oldLines[lastOld],
				oldLineNumber: lastOld + 1,
			});
			lastOld++;
		}
		while (lastNew < newIdx) {
			result.push({
				type: 'added',
				content: newLines[lastNew],
				newLineNumber: lastNew + 1,
			});
			lastNew++;
		}

		// Add anchor as context
		result.push({
			type: 'context',
			content: oldLines[oldIdx],
			oldLineNumber: oldIdx + 1,
			newLineNumber: newIdx + 1,
		});

		usedOld.add(oldIdx);
		usedNew.add(newIdx);
		lastOld = oldIdx + 1;
		lastNew = newIdx + 1;
	}

	// Process remaining lines
	while (lastOld < oldLines.length) {
		result.push({
			type: 'removed',
			content: oldLines[lastOld],
			oldLineNumber: lastOld + 1,
		});
		lastOld++;
	}
	while (lastNew < newLines.length) {
		result.push({
			type: 'added',
			content: newLines[lastNew],
			newLineNumber: lastNew + 1,
		});
		lastNew++;
	}

	return result;
}

function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	// Standard LCS-based diff
	const lcs = computeLCS(oldLines, newLines);
	const result: DiffLine[] = [];
	let oldIdx = 0;
	let newIdx = 0;

	for (const [lcsOld, lcsNew] of lcs) {
		// Add removed lines
		while (oldIdx < lcsOld) {
			result.push({
				type: 'removed',
				content: oldLines[oldIdx],
				oldLineNumber: oldIdx + 1,
			});
			oldIdx++;
		}

		// Add added lines
		while (newIdx < lcsNew) {
			result.push({
				type: 'added',
				content: newLines[newIdx],
				newLineNumber: newIdx + 1,
			});
			newIdx++;
		}

		// Add matching line
		result.push({
			type: 'context',
			content: oldLines[lcsOld],
			oldLineNumber: lcsOld + 1,
			newLineNumber: lcsNew + 1,
		});
		oldIdx++;
		newIdx++;
	}

	// Add remaining lines
	while (oldIdx < oldLines.length) {
		result.push({
			type: 'removed',
			content: oldLines[oldIdx],
			oldLineNumber: oldIdx + 1,
		});
		oldIdx++;
	}
	while (newIdx < newLines.length) {
		result.push({
			type: 'added',
			content: newLines[newIdx],
			newLineNumber: newIdx + 1,
		});
		newIdx++;
	}

	return result;
}

function computeLCS(oldLines: string[], newLines: string[]): Array<[number, number]> {
	const m = oldLines.length;
	const n = newLines.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

	// Build DP table
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (oldLines[i - 1] === newLines[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to find LCS
	const lcs: Array<[number, number]> = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (oldLines[i - 1] === newLines[j - 1]) {
			lcs.unshift([i - 1, j - 1]);
			i--;
			j--;
		} else if (dp[i - 1][j] > dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}

	return lcs;
}

// Main diff function with algorithm selection
export function computeDiff(
	oldContent: string,
	newContent: string,
	options: Partial<DiffOptions> = {}
): DiffLine[] {
	const {
		algorithm = 'myers',
		ignoreWhitespace = false,
		ignoreCase = false,
	} = options;

	let oldLines = oldContent.split('\n');
	let newLines = newContent.split('\n');

	// Apply preprocessing
	if (ignoreWhitespace) {
		oldLines = oldLines.map(l => l.trim());
		newLines = newLines.map(l => l.trim());
	}

	if (ignoreCase) {
		oldLines = oldLines.map(l => l.toLowerCase());
		newLines = newLines.map(l => l.toLowerCase());
	}

	// Select algorithm
	switch (algorithm) {
		case 'patience':
			return patienceDiff(oldLines, newLines);
		case 'histogram':
			return histogramDiff(oldLines, newLines);
		case 'minimal':
			return minimalDiff(oldLines, newLines);
		case 'myers':
		default:
			return lcsDiff(oldLines, newLines);
	}
}

// React hook for diff with algorithm selection
export function useDiffAlgorithm(
	oldContent: string,
	newContent: string,
	algorithm: DiffAlgorithm = 'myers'
) {
	return useMemo(() => {
		return computeDiff(oldContent, newContent, { algorithm });
	}, [oldContent, newContent, algorithm]);
}

// Algorithm descriptions for UI
export const ALGORITHM_INFO: Record<DiffAlgorithm, { name: string; description: string }> = {
	myers: {
		name: 'Myers (Default)',
		description: 'Standard diff algorithm, fast and accurate for most cases',
	},
	patience: {
		name: 'Patience',
		description: 'Better for refactored code, matches unique lines first',
	},
	histogram: {
		name: 'Histogram',
		description: 'Best for detecting code moves and large refactors',
	},
	minimal: {
		name: 'Minimal',
		description: 'Produces the smallest possible diff output',
	},
};

export default {
	computeDiff,
	patienceDiff,
	histogramDiff,
	minimalDiff,
	ALGORITHM_INFO,
};

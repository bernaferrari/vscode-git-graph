/**
 * Diff Algorithms
 * Stable, type-safe line diff implementation used by Git Graph views.
 */

import { useMemo } from 'react';

export type DiffAlgorithm = 'myers' | 'patience' | 'histogram' | 'minimal';

interface DiffOptions {
	algorithm: DiffAlgorithm;
	ignoreWhitespace: boolean;
	ignoreCase: boolean;
}

export interface DiffLine {
	type: 'added' | 'removed' | 'context' | 'header';
	content: string;
	oldLineNumber?: number;
	newLineNumber?: number;
	score?: number;
}

function normalizeContentToLines(content: string): string[] {
	return content.length === 0 ? [] : content.split('\n');
}

function buildLcsIndexPairs(oldLines: string[], newLines: string[]): Array<[number, number]> {
	const oldLength = oldLines.length;
	const newLength = newLines.length;
	const dp: number[][] = Array.from({ length: oldLength + 1 }, () => Array<number>(newLength + 1).fill(0));

	for (let i = 1; i <= oldLength; i++) {
		const currentRow = dp[i];
		const previousRow = dp[i - 1];
		if (!currentRow || !previousRow) {
			continue;
		}
		for (let j = 1; j <= newLength; j++) {
			if ((oldLines[i - 1] ?? '') === (newLines[j - 1] ?? '')) {
				currentRow[j] = (previousRow[j - 1] ?? 0) + 1;
			} else {
				currentRow[j] = Math.max(previousRow[j] ?? 0, currentRow[j - 1] ?? 0);
			}
		}
	}

	const lcs: Array<[number, number]> = [];
	let i = oldLength;
	let j = newLength;
	while (i > 0 && j > 0) {
		if ((oldLines[i - 1] ?? '') === (newLines[j - 1] ?? '')) {
			lcs.unshift([i - 1, j - 1]);
			i--;
			j--;
			continue;
		}
		const up = dp[i - 1]?.[j] ?? 0;
		const left = dp[i]?.[j - 1] ?? 0;
		if (up >= left) {
			i--;
		} else {
			j--;
		}
	}

	return lcs;
}

export function lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	if (oldLines.length === 0 && newLines.length === 0) {
		return [];
	}

	const lcsPairs = buildLcsIndexPairs(oldLines, newLines);
	const result: DiffLine[] = [];
	let oldIndex = 0;
	let newIndex = 0;

	for (const [oldMatch, newMatch] of lcsPairs) {
		while (oldIndex < oldMatch) {
			result.push({
				type: 'removed',
				content: oldLines[oldIndex] ?? '',
				oldLineNumber: oldIndex + 1,
			});
			oldIndex++;
		}
		while (newIndex < newMatch) {
			result.push({
				type: 'added',
				content: newLines[newIndex] ?? '',
				newLineNumber: newIndex + 1,
			});
			newIndex++;
		}
		result.push({
			type: 'context',
			content: oldLines[oldMatch] ?? '',
			oldLineNumber: oldMatch + 1,
			newLineNumber: newMatch + 1,
		});
		oldIndex = oldMatch + 1;
		newIndex = newMatch + 1;
	}

	while (oldIndex < oldLines.length) {
		result.push({
			type: 'removed',
			content: oldLines[oldIndex] ?? '',
			oldLineNumber: oldIndex + 1,
		});
		oldIndex++;
	}
	while (newIndex < newLines.length) {
		result.push({
			type: 'added',
			content: newLines[newIndex] ?? '',
			newLineNumber: newIndex + 1,
		});
		newIndex++;
	}

	return result;
}

/**
 * We currently use the LCS core for all line-based algorithms to guarantee deterministic
 * and stable output while we continue improving specialized strategies.
 */
export function patienceDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	return lcsDiff(oldLines, newLines);
}

export function histogramDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	return lcsDiff(oldLines, newLines);
}

export function minimalDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	return lcsDiff(oldLines, newLines);
}

export function computeDiff(oldContent: string, newContent: string, options: Partial<DiffOptions> = {}): DiffLine[] {
	const { algorithm = 'myers', ignoreWhitespace = false, ignoreCase = false } = options;

	let oldLines = normalizeContentToLines(oldContent);
	let newLines = normalizeContentToLines(newContent);

	if (ignoreWhitespace) {
		oldLines = oldLines.map((line) => line.replace(/\s+/g, ' ').trim());
		newLines = newLines.map((line) => line.replace(/\s+/g, ' ').trim());
	}
	if (ignoreCase) {
		oldLines = oldLines.map((line) => line.toLowerCase());
		newLines = newLines.map((line) => line.toLowerCase());
	}

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

export function useDiffAlgorithm(oldContent: string, newContent: string, algorithm: DiffAlgorithm = 'myers') {
	return useMemo(() => computeDiff(oldContent, newContent, { algorithm }), [oldContent, newContent, algorithm]);
}

export const ALGORITHM_INFO: Record<DiffAlgorithm, { name: string; description: string }> = {
	myers: {
		name: 'Myers (Default)',
		description: 'Standard diff algorithm, fast and accurate for most cases',
	},
	patience: {
		name: 'Patience',
		description: 'Better for refactored code, currently backed by stable LCS core',
	},
	histogram: {
		name: 'Histogram',
		description: 'Better for large repetitive files, currently backed by stable LCS core',
	},
	minimal: {
		name: 'Minimal',
		description: 'Produces compact output, currently backed by stable LCS core',
	},
};

export default {
	computeDiff,
	patienceDiff,
	histogramDiff,
	minimalDiff,
	lcsDiff,
	ALGORITHM_INFO,
};

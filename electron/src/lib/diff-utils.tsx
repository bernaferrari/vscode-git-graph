/* eslint-disable react-refresh/only-export-components */
/**
 * Word/Character Level Diff Utilities
 * Implements precise character-level diffing similar to Sublime Merge
 */

// Types for diff results
export interface DiffChar {
	char: string;
	type: 'added' | 'removed' | 'unchanged';
}

export interface DiffWord {
	text: string;
	type: 'added' | 'removed' | 'unchanged';
}

export interface InlineDiff {
	chars: DiffChar[];
	html: string;
}

export interface LineDiff {
	left: InlineDiff | null;
	right: InlineDiff | null;
	leftLineNum: number;
	rightLineNum: number;
	type: 'context' | 'removed' | 'added' | 'modified';
}

/**
 * Compute the Longest Common Subsequence (LCS) between two arrays
 * Using Myers' diff algorithm for optimal performance
 */
function lcs<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean = (x, y) => x === y): [number, number][] {
	const m = a.length;
	const n = b.length;

	// Use dynamic programming with optimization for space
	const dp: number[][] = Array.from({ length: m + 1 }, (): number[] => Array<number>(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		const previousRow = dp[i - 1] as number[];
		const currentRow = dp[i] as number[];
		for (let j = 1; j <= n; j++) {
		const left = a[i - 1] as T;
		const right = b[j - 1] as T;
		if (equals(left, right)) {
			currentRow[j] = previousRow[j - 1] as number + 1;
		} else {
			currentRow[j] = Math.max(previousRow[j] as number, currentRow[j - 1] as number);
			}
		}
	}

	// Backtrack to find the LCS
	const result: [number, number][] = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		const previousRow = dp[i - 1] as number[];
		const currentRow = dp[i] as number[];
		const left = a[i - 1] as T;
		const right = b[j - 1] as T;
		if (equals(left, right)) {
			result.unshift([i - 1, j - 1]);
			i--;
			j--;
		} else if ((previousRow[j] as number) > (currentRow[j - 1] as number)) {
			i--;
		} else {
			j--;
		}
	}

	return result;
}

/**
 * Split text into words while preserving whitespace and punctuation
 * This provides better visual diffs than simple character splitting
 */
export function tokenizeText(text: string): string[] {
	if (!text) return [];

	// Split into tokens: words, whitespace, punctuation
	const tokens: string[] = [];
	let current = '';
	let currentType: 'word' | 'space' | 'punct' | 'other' = 'other';

	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		const charType: 'word' | 'space' | 'punct' | 'other' =
			/[a-zA-Z0-9]/.test(char) ? 'word' :
			/\s/.test(char) ? 'space' :
			/[.,;:!?'"()[\]{}<>@#$%^&*+=|\\/~`-]/.test(char) ? 'punct' :
			'other';

		if (current && charType !== currentType &&
			!(currentType === 'word' && charType === 'punct' && /[_.-]/.test(char))) {
			tokens.push(current);
			current = '';
		}

		current += char;
		currentType = charType;
	}

	if (current) tokens.push(current);
	return tokens;
}

/**
 * Compute character-level diff between two strings
 * Returns array of characters with their diff type
 */
export function diffChars(oldStr: string, newStr: string): { old: DiffChar[]; new: DiffChar[] } {
	const oldChars = oldStr.split('');
	const newChars = newStr.split('');
	const common = lcs(oldChars, newChars);

	const oldResult: DiffChar[] = [];
	const newResult: DiffChar[] = [];

	let oldIdx = 0;
	let newIdx = 0;
	let commonIdx = 0;

	while (oldIdx < oldChars.length || newIdx < newChars.length) {
		const commonPair = common[commonIdx];
		if (commonPair && oldIdx === commonPair[0] && newIdx === commonPair[1]) {
			// Match found
			const oldChar = oldChars[oldIdx] as string;
			const newChar = newChars[newIdx] as string;
			oldResult.push({ char: oldChar, type: 'unchanged' });
			newResult.push({ char: newChar, type: 'unchanged' });
			oldIdx++;
			newIdx++;
			commonIdx++;
		} else if (oldIdx < oldChars.length && (!commonPair || oldIdx < commonPair[0])) {
			// Character removed
			oldResult.push({ char: oldChars[oldIdx] as string, type: 'removed' });
			oldIdx++;
		} else if (newIdx < newChars.length) {
			// Character added
			newResult.push({ char: newChars[newIdx] as string, type: 'added' });
			newIdx++;
		}
	}

	return { old: oldResult, new: newResult };
}

/**
 * Compute word-level diff between two strings
 * Returns array of words with their diff type
 */
export function diffWords(oldStr: string, newStr: string): { old: DiffWord[]; new: DiffWord[] } {
	const oldWords = tokenizeText(oldStr);
	const newWords = tokenizeText(newStr);
	const common = lcs(oldWords, newWords);

	const oldResult: DiffWord[] = [];
	const newResult: DiffWord[] = [];

	let oldIdx = 0;
	let newIdx = 0;
	let commonIdx = 0;

	while (oldIdx < oldWords.length || newIdx < newWords.length) {
		const commonPair = common[commonIdx];
		if (commonPair && oldIdx === commonPair[0] && newIdx === commonPair[1]) {
			// Match found
			oldResult.push({ text: oldWords[oldIdx] as string, type: 'unchanged' });
			newResult.push({ text: newWords[newIdx] as string, type: 'unchanged' });
			oldIdx++;
			newIdx++;
			commonIdx++;
		} else if (oldIdx < oldWords.length && (!commonPair || oldIdx < commonPair[0])) {
			// Word removed
			oldResult.push({ text: oldWords[oldIdx] as string, type: 'removed' });
			oldIdx++;
		} else if (newIdx < newWords.length) {
			// Word added
			newResult.push({ text: newWords[newIdx] as string, type: 'added' });
			newIdx++;
		}
	}

	return { old: oldResult, new: newResult };
}

/**
 * Generate inline diff with character-level precision for a pair of lines
 * This is the key function for Sublime Merge-style diffs
 */
export function computeInlineDiff(removedLine: string, addedLine: string): {
	removed: InlineDiff;
	added: InlineDiff;
	} {
		// First, try word-level diff
		const wordDiff = diffWords(removedLine, addedLine);

		// For each changed word, compute character-level diff
		const removedChars: DiffChar[] = [];
		const addedChars: DiffChar[] = [];

		const oldWords = wordDiff.old;
		const newWords = wordDiff.new;
		const pushChars = (target: DiffChar[], text: string, type: DiffChar['type']): void => {
			for (const char of text) {
				target.push({ char, type });
			}
		};

		let oldIndex = 0;
		let newIndex = 0;
		while (oldIndex < oldWords.length || newIndex < newWords.length) {
			const oldWord = oldWords[oldIndex];
			const newWord = newWords[newIndex];

			if (!oldWord) {
				// Only new words left
				pushChars(addedChars, (newWord as DiffWord).text, 'added');
				newIndex++;
			} else if (!newWord) {
				// Only old words left
				pushChars(removedChars, oldWord.text, 'removed');
				oldIndex++;
			} else if (oldWord.type === 'unchanged' && newWord.type === 'unchanged') {
				// Both unchanged
				pushChars(removedChars, oldWord.text, 'unchanged');
				pushChars(addedChars, newWord.text, 'unchanged');
				oldIndex++;
				newIndex++;
			} else if (oldWord.type === 'removed') {
				if (newWord.type === 'added') {
					// Pair of removed/added - compute char diff
					const charDiff = diffChars(oldWord.text, newWord.text);
					removedChars.push(...charDiff.old);
					addedChars.push(...charDiff.new);
					oldIndex++;
					newIndex++;
				} else {
					// Just removed
					pushChars(removedChars, oldWord.text, 'removed');
					oldIndex++;
				}
			} else if (newWord.type === 'added') {
				// Just added
				pushChars(addedChars, newWord.text, 'added');
				newIndex++;
			} else {
				// Unchanged words
				pushChars(removedChars, oldWord.text, 'unchanged');
				pushChars(addedChars, newWord.text, 'unchanged');
				oldIndex++;
				newIndex++;
			}
		}

	return {
		removed: {
			chars: removedChars,
			html: renderInlineDiff(removedChars, 'removed'),
		},
		added: {
			chars: addedChars,
			html: renderInlineDiff(addedChars, 'added'),
		},
	};
}

/**
 * Render inline diff as HTML with highlighting
 */
export function renderInlineDiff(chars: DiffChar[], lineType: 'removed' | 'added'): string {
	let html = '';
	let currentType: 'removed' | 'added' | 'unchanged' | null = null;
	let currentText = '';

	const flush = () => {
		if (!currentType || !currentText) return;

		const escaped = currentText
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		if (currentType === 'unchanged') {
			html += escaped;
		} else if (lineType === 'removed') {
			if (currentType === 'removed') {
				// Darker red for removed chars within removed line
				html += `<span class="diff-char-removed">${escaped}</span>`;
			} else {
				html += escaped;
			}
		} else {
			if (currentType === 'added') {
				// Darker green for added chars within added line
				html += `<span class="diff-char-added">${escaped}</span>`;
			} else {
				html += escaped;
			}
		}

		currentText = '';
	};

	for (const char of chars) {
		if (char.type !== currentType) {
			flush();
			currentType = char.type;
		}
		currentText += char.char;
	}
	flush();

	return html;
}

/**
 * Compute diff for a pair of lines (removed + added)
 * Returns true if the lines are a "modified" pair
 */
export function isModifiedPair(removedLine: string, addedLine: string): boolean {
	// Simple heuristic: if lines share significant content, they're a modification pair
	const oldWords = new Set(tokenizeText(removedLine).filter(w => w.trim().length > 1));
	const newWords = new Set(tokenizeText(addedLine).filter(w => w.trim().length > 1));

	if (oldWords.size === 0 || newWords.size === 0) return false;

	let common = 0;
	for (const word of oldWords) {
		if (newWords.has(word)) common++;
	}

	// If at least 30% of words match, consider it a modification
	return common / Math.min(oldWords.size, newWords.size) >= 0.3;
}

/**
 * Parse unified diff and compute inline diffs for modified lines
 */
export function parseDiffWithInlineDiffs(diffText: string): LineDiff[] {
	const lines = diffText.split('\n');
	const result: LineDiff[] = [];

	let leftLineNum = 0;
	let rightLineNum = 0;
	let pendingRemoved: { line: string; lineNum: number } | null = null;

	for (const line of lines) {
		if (line.startsWith('@@')) {
			// Flush any pending removed line
			if (pendingRemoved) {
				result.push({
					left: {
						chars: pendingRemoved.line.split('').map(c => ({ char: c, type: 'removed' as const })),
						html: pendingRemoved.line,
					},
					right: null,
					leftLineNum: pendingRemoved.lineNum,
					rightLineNum: 0,
					type: 'removed',
				});
				pendingRemoved = null;
			}

			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			if (match) {
				const leftMatch = match[1];
				const rightMatch = match[2];
				if (leftMatch !== undefined && rightMatch !== undefined) {
					leftLineNum = Number.parseInt(leftMatch, 10);
					rightLineNum = Number.parseInt(rightMatch, 10);
				}
			}
			continue;
		}

		if (line.startsWith('---') || line.startsWith('+++')) {
			continue;
		}

		if (line.startsWith('-')) {
			if (pendingRemoved) {
				// Flush previous removed line
				result.push({
					left: {
						chars: pendingRemoved.line.split('').map(c => ({ char: c, type: 'removed' as const })),
						html: pendingRemoved.line,
					},
					right: null,
					leftLineNum: pendingRemoved.lineNum,
					rightLineNum: 0,
					type: 'removed',
				});
			}
			pendingRemoved = { line: line.slice(1), lineNum: leftLineNum };
			leftLineNum++;
		} else if (line.startsWith('+')) {
			const addedLine = line.slice(1);

			if (pendingRemoved && isModifiedPair(pendingRemoved.line, addedLine)) {
				// Compute inline diff for the pair
				const inlineDiff = computeInlineDiff(pendingRemoved.line, addedLine);
				result.push({
					left: inlineDiff.removed,
					right: inlineDiff.added,
					leftLineNum: pendingRemoved.lineNum,
					rightLineNum,
					type: 'modified',
				});
				pendingRemoved = null;
			} else {
				// Flush any pending removed line
				if (pendingRemoved) {
					result.push({
						left: {
							chars: pendingRemoved.line.split('').map(c => ({ char: c, type: 'removed' as const })),
							html: pendingRemoved.line,
						},
						right: null,
						leftLineNum: pendingRemoved.lineNum,
						rightLineNum: 0,
						type: 'removed',
					});
					pendingRemoved = null;
				}

				result.push({
					left: null,
					right: {
						chars: addedLine.split('').map(c => ({ char: c, type: 'added' as const })),
						html: addedLine,
					},
					leftLineNum: 0,
					rightLineNum,
					type: 'added',
				});
			}
			rightLineNum++;
		} else {
			// Flush any pending removed line
			if (pendingRemoved) {
				result.push({
					left: {
						chars: pendingRemoved.line.split('').map(c => ({ char: c, type: 'removed' as const })),
						html: pendingRemoved.line,
					},
					right: null,
					leftLineNum: pendingRemoved.lineNum,
					rightLineNum: 0,
					type: 'removed',
				});
				pendingRemoved = null;
			}

			const content = line.startsWith(' ') ? line.slice(1) : line;
			result.push({
				left: {
					chars: content.split('').map(c => ({ char: c, type: 'unchanged' as const })),
					html: content,
				},
				right: {
					chars: content.split('').map(c => ({ char: c, type: 'unchanged' as const })),
					html: content,
				},
				leftLineNum,
				rightLineNum,
				type: 'context',
			});
			leftLineNum++;
			rightLineNum++;
		}
	}

	// Flush final pending removed line
	if (pendingRemoved) {
		result.push({
			left: {
				chars: pendingRemoved.line.split('').map(c => ({ char: c, type: 'removed' as const })),
				html: pendingRemoved.line,
			},
			right: null,
			leftLineNum: pendingRemoved.lineNum,
			rightLineNum: 0,
			type: 'removed',
		});
	}

	return result;
}

/**
 * React component helper: render diff chars with proper highlighting
 */
export function DiffCharRenderer({ chars, baseClass }: { chars: DiffChar[]; baseClass: 'removed' | 'added' }) {
	const segments: { text: string; type: 'removed' | 'added' | 'unchanged' }[] = [];
	let currentSegment: { text: string; type: 'removed' | 'added' | 'unchanged' } | null = null;

	for (const char of chars) {
		if (!currentSegment || currentSegment.type !== char.type) {
			if (currentSegment) segments.push(currentSegment);
			currentSegment = { text: char.char, type: char.type };
		} else {
			currentSegment.text += char.char;
		}
	}
	if (currentSegment) segments.push(currentSegment);

	return (
		<>
			{segments.map((seg, i) => {
				if (seg.type === 'unchanged') {
					return <span key={i}>{seg.text}</span>;
				}
				return (
					<span
						key={i}
						className={baseClass === 'removed'
							? 'bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] text-destructive dark:text-destructive'
							: 'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_15%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'
						}
					>
						{seg.text}
					</span>
				);
			})}
		</>
	);
}

export default {
	diffChars,
	diffWords,
	computeInlineDiff,
	parseDiffWithInlineDiffs,
	DiffCharRenderer,
};

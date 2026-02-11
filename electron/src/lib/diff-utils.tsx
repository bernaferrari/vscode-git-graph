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
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
	
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (equals(a[i - 1], b[j - 1])) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}
	
	// Backtrack to find the LCS
	const result: [number, number][] = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (equals(a[i - 1], b[j - 1])) {
			result.unshift([i - 1, j - 1]);
			i--;
			j--;
		} else if (dp[i - 1][j] > dp[i][j - 1]) {
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
		const char = text[i];
		const charType: 'word' | 'space' | 'punct' | 'other' = 
			/[a-zA-Z0-9]/.test(char) ? 'word' :
			/\s/.test(char) ? 'space' :
			/[.,;:!?'"()\[\]{}<>@#$%^&*+=|\\\/~`-]/.test(char) ? 'punct' :
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
		if (commonIdx < common.length && 
			oldIdx === common[commonIdx][0] && 
			newIdx === common[commonIdx][1]) {
			// Match found
			oldResult.push({ char: oldChars[oldIdx], type: 'unchanged' });
			newResult.push({ char: newChars[newIdx], type: 'unchanged' });
			oldIdx++;
			newIdx++;
			commonIdx++;
		} else if (oldIdx < oldChars.length && 
			(commonIdx >= common.length || oldIdx < common[commonIdx][0])) {
			// Character removed
			oldResult.push({ char: oldChars[oldIdx], type: 'removed' });
			oldIdx++;
		} else if (newIdx < newChars.length) {
			// Character added
			newResult.push({ char: newChars[newIdx], type: 'added' });
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
		if (commonIdx < common.length && 
			oldIdx === common[commonIdx][0] && 
			newIdx === common[commonIdx][1]) {
			// Match found
			oldResult.push({ text: oldWords[oldIdx], type: 'unchanged' });
			newResult.push({ text: newWords[newIdx], type: 'unchanged' });
			oldIdx++;
			newIdx++;
			commonIdx++;
		} else if (oldIdx < oldWords.length && 
			(commonIdx >= common.length || oldIdx < common[commonIdx][0])) {
			// Word removed
			oldResult.push({ text: oldWords[oldIdx], type: 'removed' });
			oldIdx++;
		} else if (newIdx < newWords.length) {
			// Word added
			newResult.push({ text: newWords[newIdx], type: 'added' });
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
	
	let oldWords = wordDiff.old;
	let newWords = wordDiff.new;
	
	// Align words for comparison
	const oldIter = oldWords[Symbol.iterator]();
	const newIter = newWords[Symbol.iterator]();
	
	let oldWord = oldIter.next();
	let newWord = newIter.next();
	
	while (!oldWord.done || !newWord.done) {
		if (oldWord.done) {
			// Only new words left
			addedChars.push(...newWord.value.text.split('').map(c => ({ char: c, type: 'added' as const })));
			newWord = newIter.next();
		} else if (newWord.done) {
			// Only old words left
			removedChars.push(...oldWord.value.text.split('').map(c => ({ char: c, type: 'removed' as const })));
			oldWord = oldIter.next();
		} else if (oldWord.value.type === 'unchanged' && newWord.value.type === 'unchanged') {
			// Both unchanged
			removedChars.push(...oldWord.value.text.split('').map(c => ({ char: c, type: 'unchanged' as const })));
			addedChars.push(...newWord.value.text.split('').map(c => ({ char: c, type: 'unchanged' as const })));
			oldWord = oldIter.next();
			newWord = newIter.next();
		} else if (oldWord.value.type === 'removed') {
			if (newWord.value.type === 'added') {
				// Pair of removed/added - compute char diff
				const charDiff = diffChars(oldWord.value.text, newWord.value.text);
				removedChars.push(...charDiff.old);
				addedChars.push(...charDiff.new);
				oldWord = oldIter.next();
				newWord = newIter.next();
			} else {
				// Just removed
				removedChars.push(...oldWord.value.text.split('').map(c => ({ char: c, type: 'removed' as const })));
				oldWord = oldIter.next();
			}
		} else if (newWord.value.type === 'added') {
			// Just added
			addedChars.push(...newWord.value.text.split('').map(c => ({ char: c, type: 'added' as const })));
			newWord = newIter.next();
		} else {
			// Unchanged words
			removedChars.push(...oldWord.value.text.split('').map(c => ({ char: c, type: 'unchanged' as const })));
			addedChars.push(...newWord.value.text.split('').map(c => ({ char: c, type: 'unchanged' as const })));
			oldWord = oldIter.next();
			newWord = newIter.next();
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
				leftLineNum = parseInt(match[1], 10);
				rightLineNum = parseInt(match[2], 10);
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
							? 'bg-red-300 dark:bg-red-800 text-red-900 dark:text-red-100' 
							: 'bg-green-300 dark:bg-green-800 text-green-900 dark:text-green-100'
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

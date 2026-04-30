/**
 * Common Utilities
 * Ported from git-graph/src/utils.ts
 */

// ==================== Constants ====================

export const UNCOMMITTED = '*';
export const UNABLE_TO_FIND_GIT_MSG =
	'Unable to find a Git executable. Please ensure Git is installed and available in your PATH.';

// ==================== Text Utilities ====================

/**
 * Abbreviate a commit hash to the first eight characters.
 */
export function abbrevCommit(commitHash: string): string {
	return commitHash.substring(0, 8);
}

/**
 * Abbreviate a string to the specified number of characters.
 */
export function abbrevText(text: string, toChars: number): string {
	return text.length <= toChars ? text : text.substring(0, toChars - 1) + '...';
}

/**
 * Get the relative time difference between the current time and a Unix timestamp.
 */
export function getRelativeTimeDiff(unixTimestamp: number): string {
	let diff = Math.round(Date.now() / 1000) - unixTimestamp;
	let unit: string;

	if (diff < 60) {
		unit = 'second';
	} else if (diff < 3600) {
		unit = 'minute';
		diff = Math.round(diff / 60);
	} else if (diff < 86400) {
		unit = 'hour';
		diff = Math.round(diff / 3600);
	} else if (diff < 604800) {
		unit = 'day';
		diff = Math.round(diff / 86400);
	} else if (diff < 2629800) {
		unit = 'week';
		diff = Math.round(diff / 604800);
	} else if (diff < 31557600) {
		unit = 'month';
		diff = Math.round(diff / 2629800);
	} else {
		unit = 'year';
		diff = Math.round(diff / 31557600);
	}

	return String(diff) + ' ' + unit + (diff !== 1 ? 's' : '') + ' ago';
}

/**
 * Randomly generate a nonce.
 */
export function getNonce(): string {
	let text = '';
	// eslint-disable-next-line no-secrets/no-secrets
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// ==================== Promise Utilities ====================

/**
 * Evaluate promises in parallel, with at most `maxParallel` running at any point in time.
 */
export async function evalPromises<X, Y>(
	data: X[],
	maxParallel: number,
	createPromise: (val: X) => Promise<Y>
): Promise<Y[]> {
	if (data.length === 0) {
		return [];
	}

	if (data.length === 1) {
		const firstItem = data[0];
		if (!firstItem) return [];
		return [await createPromise(firstItem)];
	}

	return new Promise((resolve, reject) => {
		const results = new Array<Y>(data.length);
		let nextPromise = 0;
		let rejected = false;
		let completed = 0;

		function startNext(): void {
			const cur = nextPromise;
			nextPromise++;

			const item = data[cur];
			if (item === undefined) return;

			createPromise(item)
				.then((result) => {
					if (!rejected) {
						results[cur] = result;
						completed++;
						if (nextPromise < data.length) {
							startNext();
						} else if (completed === data.length) {
							resolve(results);
						}
					}
				})
				.catch(() => {
					rejected = true;
					reject(new Error('Promise failed'));
				});
		}

		for (let i = 0; i < Math.min(maxParallel, data.length); i++) {
			startNext();
		}
	});
}

// ==================== Platform Utilities ====================

/**
 * Check whether the app is running on a Windows-based platform.
 */
export function isWindows(): boolean {
	return process.platform === 'win32' || process.env.OSTYPE === 'cygwin' || process.env.OSTYPE === 'msys';
}

// ==================== Date Formatting ====================

/**
 * Format a date based on the configured format type.
 */
export function formatDate(
	unixTimestamp: number,
	formatType: 'date-time' | 'date-only' | 'relative',
	iso: boolean = false
): string {
	const date = new Date(unixTimestamp * 1000);

	switch (formatType) {
		case 'relative':
			return getRelativeTimeDiff(unixTimestamp);
		case 'date-only':
			if (iso) {
				return date.toISOString().split('T')[0] ?? '';
			}
			return date.toLocaleDateString('en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
			});
		case 'date-time':
		default:
			if (iso) {
				return date.toISOString().slice(0, 16).replace('T', ' ');
			}
			return date.toLocaleDateString('en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
	}
}

import { describe, expect, it } from 'vitest';

import { parseDeepLink, toDeepLink } from './index';

describe('app deeplink helpers', () => {
	it('builds and parses valid links', () => {
		const link = toDeepLink({
			repo: '/tmp/repo',
			branch: 'feature/one',
			commit: 'abc1234',
			file: 'src/main.ts',
			panel: 'blame',
		});

		const parsed = parseDeepLink(link);
		expect(parsed.valid).toBe(true);
		expect(parsed.target).toEqual({
			repo: '/tmp/repo',
			branch: 'feature/one',
			commit: 'abc1234',
			file: 'src/main.ts',
			panel: 'blame',
		});
	});

	it('rejects unsupported protocols', () => {
		const parsed = parseDeepLink('https://example.com');
		expect(parsed.valid).toBe(false);
		expect(parsed.error).toBe('Unsupported protocol');
	});

	it('rejects unsupported routes', () => {
		const parsed = parseDeepLink('gitgraph://settings?repo=/tmp/repo');
		expect(parsed.valid).toBe(false);
		expect(parsed.error).toBe('Unsupported route');
	});

	it('rejects unsupported panels', () => {
		const parsed = parseDeepLink('gitgraph://open?repo=/tmp/repo&panel=unknown');
		expect(parsed.valid).toBe(false);
		expect(parsed.error).toBe('Unsupported panel: unknown');
	});

	it('rejects malformed links', () => {
		const parsed = parseDeepLink('not-a-valid-link');
		expect(parsed.valid).toBe(false);
		expect(parsed.target).toBeNull();
		expect(parsed.error).toBeTruthy();
	});
});

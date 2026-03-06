import { describe, expect, it } from 'vitest';

import { parseWorktreePorcelainRecords } from './worktree';

describe('parseWorktreePorcelainRecords', () => {
	it('parses locked, prunable, detached, and bare entries', () => {
		const output = [
			'worktree /repo/main',
			'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			'branch refs/heads/main',
			'',
			'worktree /repo/wt-feature',
			'HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
			'branch refs/heads/feature/x',
			'locked issue-123',
			'',
			'worktree /repo/wt-detached',
			'HEAD cccccccccccccccccccccccccccccccccccccccc',
			'detached',
			'prunable gone',
			'',
			'worktree /repo/wt-bare',
			'HEAD dddddddddddddddddddddddddddddddddddddddd',
			'bare',
			'',
		].join('\n');

		const records = parseWorktreePorcelainRecords(output);
		expect(records).toHaveLength(4);

		expect(records[0]).toMatchObject({
			path: '/repo/main',
			branchRef: 'refs/heads/main',
			detached: false,
			bare: false,
			locked: false,
			prunable: false,
		});

		expect(records[1]).toMatchObject({
			path: '/repo/wt-feature',
			branchRef: 'refs/heads/feature/x',
			locked: true,
			lockReason: 'issue-123',
			prunable: false,
		});

		expect(records[2]).toMatchObject({
			path: '/repo/wt-detached',
			detached: true,
			prunable: true,
			prunableReason: 'gone',
		});

		expect(records[3]).toMatchObject({
			path: '/repo/wt-bare',
			bare: true,
		});
	});
});

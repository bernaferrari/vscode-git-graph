import { describe, expect, it } from 'vitest';

import {
	buildCollaborationPullRequestFileTargetId,
	buildCollaborationPullRequestTargetId,
	deriveCollaborationRepoKey,
	getCollaborationReviewRootTargetId,
	isSameCollaborationReviewTarget,
	parseCollaborationReviewTargetId,
} from './collaboration-review-targets';

describe('collaboration-review-targets', () => {
	it('derives repo key from https and ssh remotes', () => {
		expect(deriveCollaborationRepoKey('https://github.com/Owner/Repo.git')).toBe('github.com/owner/repo');
		expect(deriveCollaborationRepoKey('git@github.com:Owner/Repo.git')).toBe('github.com/owner/repo');
	});

	it('normalizes azure ssh remotes to dev.azure.com repo keys', () => {
		expect(
			deriveCollaborationRepoKey('git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepo')
		).toBe('dev.azure.com/myorg/myproject/_git/myrepo');
	});

	it('builds and parses pull request root target ids', () => {
		const target = buildCollaborationPullRequestTargetId({
			provider: 'github',
			repoKey: 'github.com/org/repo',
			pullRequestNumber: 42,
		});
		expect(target).toBe('github:github.com%2Forg%2Frepo:42');

		expect(parseCollaborationReviewTargetId(target)).toEqual({
			provider: 'github',
			repoKey: 'github.com/org/repo',
			pullRequestNumber: 42,
		});
	});

	it('builds and parses file target ids with side and line', () => {
		const target = buildCollaborationPullRequestFileTargetId({
			provider: 'gitlab',
			repoKey: 'gitlab.com/org/repo',
			pullRequestNumber: 73,
			filePath: 'src/main.ts',
			side: 'right',
			line: 17,
		});

		expect(parseCollaborationReviewTargetId(target)).toEqual({
			provider: 'gitlab',
			repoKey: 'gitlab.com/org/repo',
			pullRequestNumber: 73,
			filePath: 'src/main.ts',
			side: 'right',
			line: 17,
		});
		expect(getCollaborationReviewRootTargetId(target)).toBe('gitlab:gitlab.com%2Forg%2Frepo:73');
	});

	it('parses legacy targets without repo keys', () => {
		expect(parseCollaborationReviewTargetId('github:9')).toEqual({
			provider: 'github',
			repoKey: null,
			pullRequestNumber: 9,
		});
	});

	it('returns null for malformed encoded segments instead of throwing', () => {
		expect(parseCollaborationReviewTargetId('github:%E0%A4%A:12')).toBeNull();
		expect(parseCollaborationReviewTargetId('github:github.com%2Forg%2Frepo:12:%E0%A4%A')).toBeNull();
	});

	it('matches equivalent targets', () => {
		const left = 'github:github.com%2Forg%2Frepo:12:src%2Fmain.ts:right:10';
		const right = 'github:github.com%2Forg%2Frepo:12:src%2Fmain.ts:right:10';
		const different = 'github:github.com%2Forg%2Frepo:12:src%2Fmain.ts:left:10';

		expect(isSameCollaborationReviewTarget(left, right)).toBe(true);
		expect(isSameCollaborationReviewTarget(left, different)).toBe(false);
	});
});

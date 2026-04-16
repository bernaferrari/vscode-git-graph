import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock as typeof fetch;

const {
	addPullRequestInlineComment,
	getPullRequestReviewState,
	listPullRequestComments,
	setPullRequestThreadResolved,
} = await import('./pullRequest');

describe('pull request inline comments', () => {
	beforeEach(() => {
		fetchMock.mockReset();
	});

	it('sends GitHub inline review comments with commit, path, line, and side', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: 42,
				body: 'Needs a null guard',
				html_url: 'https://github.com/acme/repo/pull/12#discussion_r42',
				created_at: '2026-03-10T12:00:00.000Z',
				updated_at: '2026-03-10T12:00:00.000Z',
				user: { login: 'ada' },
			}),
		});

		const comment = await addPullRequestInlineComment(
			'https://github.com/acme/repo.git',
			'github',
			{ githubToken: 'secret' },
			12,
			{
				body: 'Needs a null guard',
				filePath: 'src/app.ts',
				line: 41,
				side: 'right',
				headSha: 'abc123',
			}
		);

		expect(comment).toEqual(
			expect.objectContaining({
				id: '42',
				author: 'ada',
				body: 'Needs a null guard',
			})
		);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/repos/acme/repo/pulls/12/comments',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					body: 'Needs a null guard',
					commit_id: 'abc123',
					path: 'src/app.ts',
					line: 41,
					side: 'RIGHT',
				}),
			})
		);
	});

	it('sends GitLab inline discussions with diff position metadata', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: 'discussion-1',
				notes: [
					{
						id: 7,
						body: 'Please split this branch condition.',
						created_at: '2026-03-10T12:00:00.000Z',
						updated_at: '2026-03-10T12:00:00.000Z',
						author: { username: 'grace' },
					},
				],
			}),
		});

		const comment = await addPullRequestInlineComment(
			'https://gitlab.example.com/acme/repo.git',
			'gitlab',
			{ gitlabToken: 'secret' },
			9,
			{
				body: 'Please split this branch condition.',
				filePath: 'src/feature.ts',
				line: 18,
				side: 'left',
				baseSha: 'base123',
				startSha: 'start123',
				headSha: 'head123',
			}
		);

		expect(comment).toEqual(
			expect.objectContaining({
				id: '7',
				author: 'grace',
			})
		);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://gitlab.example.com/api/v4/projects/acme%2Frepo/merge_requests/9/discussions',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					body: 'Please split this branch condition.',
					position: {
						position_type: 'text',
						base_sha: 'base123',
						start_sha: 'start123',
						head_sha: 'head123',
						old_path: 'src/feature.ts',
						new_path: 'src/feature.ts',
						old_line: 18,
					},
				}),
			})
		);
	});

	it('merges GitHub issue comments with inline review comments when listing discussion', async () => {
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						id: 1,
						body: 'General PR note',
						html_url: 'https://github.com/acme/repo/pull/12#issuecomment-1',
						created_at: '2026-03-10T12:00:00.000Z',
						updated_at: '2026-03-10T12:00:00.000Z',
						user: { login: 'ada' },
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						id: 2,
						body: 'Inline review note',
						html_url: 'https://github.com/acme/repo/pull/12#discussion_r2',
						created_at: '2026-03-10T12:05:00.000Z',
						updated_at: '2026-03-10T12:05:00.000Z',
						user: { login: 'grace' },
						path: 'src/app.ts',
						line: 22,
						side: 'RIGHT',
					},
				],
			});

		const comments = await listPullRequestComments(
			'https://github.com/acme/repo.git',
			'github',
			{ githubToken: 'secret' },
			12
		);

		expect(comments).toEqual([
			expect.objectContaining({ id: '1', body: 'General PR note' }),
			expect.objectContaining({
				id: '2',
				body: 'Inline review note',
				inline: { filePath: 'src/app.ts', line: 22, side: 'right' },
			}),
		]);
	});

	it('includes GitLab discussion note positions when listing comments', async () => {
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						id: 11,
						body: 'Top-level MR comment',
						created_at: '2026-03-10T12:00:00.000Z',
						updated_at: '2026-03-10T12:00:00.000Z',
						author: { username: 'ada' },
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						id: 'discussion-1',
						notes: [
							{
								id: 12,
								body: 'Inline MR note',
								created_at: '2026-03-10T12:01:00.000Z',
								updated_at: '2026-03-10T12:01:00.000Z',
								author: { username: 'grace' },
								position: {
									old_path: 'src/feature.ts',
									new_path: 'src/feature.ts',
									new_line: 18,
								},
							},
						],
					},
				],
			});

		const comments = await listPullRequestComments(
			'https://gitlab.example.com/acme/repo.git',
			'gitlab',
			{ gitlabToken: 'secret' },
			9
		);

		expect(comments).toEqual([
			expect.objectContaining({ id: '11', body: 'Top-level MR comment' }),
			expect.objectContaining({
				id: '12',
				body: 'Inline MR note',
				thread: { id: 'discussion-1', status: 'open', canResolve: true },
				inline: { filePath: 'src/feature.ts', line: 18, side: 'right' },
			}),
		]);
	});

	it('updates a GitLab discussion thread to resolved state', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				id: 'discussion-1',
				resolved: true,
			}),
		});

		const threadState = await setPullRequestThreadResolved(
			'https://gitlab.example.com/acme/repo.git',
			'gitlab',
			{ gitlabToken: 'secret' },
			9,
			'discussion-1',
			true
		);

		expect(threadState).toEqual({ threadId: 'discussion-1', status: 'resolved' });
		expect(fetchMock).toHaveBeenCalledWith(
			'https://gitlab.example.com/api/v4/projects/acme%2Frepo/merge_requests/9/discussions/discussion-1?resolved=true',
			expect.objectContaining({ method: 'PUT' })
		);
	});

	it('summarizes GitHub requested reviewers and latest review outcomes', async () => {
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					requested_reviewers: [
						{ id: 1, login: 'ada' },
					],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						id: 10,
						state: 'APPROVED',
						submitted_at: '2026-03-10T12:00:00.000Z',
						user: { id: 2, login: 'grace' },
					},
					{
						id: 11,
						state: 'CHANGES_REQUESTED',
						submitted_at: '2026-03-10T12:05:00.000Z',
						user: { id: 3, login: 'linus' },
					},
				],
			});

		const reviewState = await getPullRequestReviewState(
			'https://github.com/acme/repo.git',
			'github',
			{ githubToken: 'secret' },
			12
		);

		expect(reviewState.overall).toBe('changes-requested');
		expect(reviewState.requestedCount).toBe(1);
		expect(reviewState.approvedCount).toBe(1);
		expect(reviewState.changesRequestedCount).toBe(1);
		expect(reviewState.reviewers).toEqual([
			expect.objectContaining({ name: 'ada', status: 'requested' }),
			expect.objectContaining({ name: 'grace', status: 'approved' }),
			expect.objectContaining({ name: 'linus', status: 'changes-requested' }),
		]);
	});

	it('maps Azure reviewer votes into normalized review states', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				value: [
					{
						id: '1',
						displayName: 'Ada',
						uniqueName: 'ada@example.com',
						vote: 10,
						isRequired: true,
						lastUpdatedDate: '2026-03-10T12:00:00.000Z',
					},
					{
						id: '2',
						displayName: 'Grace',
						uniqueName: 'grace@example.com',
						vote: -10,
						isRequired: false,
						lastUpdatedDate: '2026-03-10T12:05:00.000Z',
					},
				],
			}),
		});

		const reviewState = await getPullRequestReviewState(
			'https://dev.azure.com/acme/platform/_git/repo',
			'azure',
			{ azureToken: 'secret' },
			18
		);

		expect(reviewState.overall).toBe('changes-requested');
		expect(reviewState.reviewers).toEqual([
			expect.objectContaining({ name: 'Ada', status: 'approved', required: true }),
			expect.objectContaining({ name: 'Grace', status: 'changes-requested', required: false }),
		]);
	});
});

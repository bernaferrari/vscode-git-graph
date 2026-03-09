/**
 * Repository tRPC Router
 * Exposes repository management operations to the renderer
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import type { GitRepoState } from '@/web/lib/types';

import { appStore, instanceStore } from '@/app/backend/store';
import { listAuditEntries } from '@/app/backend/store/audit';
import {
	getCodeReviewProgress,
	resetCodeReviewProgress,
	updateCodeReviewProgress,
} from '@/app/backend/store/codeReviews';
import { getRepoPolicy, repoPolicySchema, upsertRepoPolicy } from '@/app/backend/store/repoPolicies';

import { findGit } from '../../../services/gitExecutable';
import { getGitService } from '../../../services/gitService';
import {
	listPullRequests as listRemotePullRequests,
	parseRemoteUrl as parsePullRequestRemoteUrl,
	type ProviderAuthConfig,
} from '../../../services/pullRequest';
import { getRepoManager } from '../../../services/repoManager';
import { router, publicProcedure } from '../../init';

let gitInitPromise: Promise<string | null> | null = null;

async function ensureGitInitialized(): Promise<string | null> {
	const gitService = getGitService();
	if (gitService.isGitAvailable()) {
		return null;
	}

	if (gitInitPromise === null) {
		gitInitPromise = (async () => {
			try {
				const executable = await findGit();
				gitService.setGitExecutable(executable);
				return null;
			} catch (error) {
				return error instanceof Error ? error.message : 'Failed to find Git executable';
			} finally {
				gitInitPromise = null;
			}
		})();
	}

	return gitInitPromise;
}

function getStoredProviderAuthConfig(): ProviderAuthConfig {
	const storedAuth = appStore.get('providerAuth');
	const auth: ProviderAuthConfig = {};
	if (storedAuth.githubToken.trim()) auth.githubToken = storedAuth.githubToken.trim();
	if (storedAuth.gitlabToken.trim()) auth.gitlabToken = storedAuth.gitlabToken.trim();
	if (storedAuth.bitbucketToken.trim()) auth.bitbucketToken = storedAuth.bitbucketToken.trim();
	if (storedAuth.bitbucketUsername.trim()) auth.bitbucketUsername = storedAuth.bitbucketUsername.trim();
	if (storedAuth.azureToken.trim()) auth.azureToken = storedAuth.azureToken.trim();
	return auth;
}

interface RemoteRepository {
	provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
	name: string;
	fullName: string;
	description: string;
	cloneUrl: string;
	sshUrl: string;
	webUrl: string;
	private: boolean;
	defaultBranch: string;
}

const workspaceRepoSchema = z.object({
	path: z.string().min(1),
	name: z.string().min(1),
	lastOpened: z.number().optional(),
	isFavorite: z.boolean().optional(),
});

const workspaceSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().min(1),
	repos: z.array(workspaceRepoSchema),
	createdAt: z.number(),
	updatedAt: z.number(),
});

const commitFilterStateSchema = z.object({
	repo: z.string().min(1),
	author: z.string().optional(),
	filePath: z.string().optional(),
	search: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
});

const pinnedCommitSchema = z.object({
	hash: z.string().min(1),
	message: z.string().min(1),
	author: z.string().min(1),
	date: z.string().min(1),
	branch: z.string().optional(),
	pinnedAt: z.number(),
	note: z.string().optional(),
});
const recentRepoSchema = z.object({
	path: z.string().min(1),
	name: z.string().min(1),
	lastOpened: z.number(),
	openCount: z.number(),
	pinned: z.boolean(),
	currentBranch: z.string().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback: string = ''): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return fallback;
}

function buildProviderAuthHeader(provider: 'github' | 'gitlab' | 'bitbucket'): Record<string, string> {
	const auth = getStoredProviderAuthConfig();
	if (provider === 'github') {
		if (!auth.githubToken) {
			throw new Error('GitHub token is not configured.');
		}
		return { Authorization: `Bearer ${auth.githubToken}` };
	}

	if (provider === 'gitlab') {
		if (!auth.gitlabToken) {
			throw new Error('GitLab token is not configured.');
		}
		return { 'PRIVATE-TOKEN': auth.gitlabToken };
	}

	if (!auth.bitbucketToken) {
		throw new Error('Bitbucket token is not configured.');
	}
	if (auth.bitbucketUsername) {
		const encoded = Buffer.from(`${auth.bitbucketUsername}:${auth.bitbucketToken}`).toString('base64');
		return { Authorization: `Basic ${encoded}` };
	}
	return { Authorization: `Bearer ${auth.bitbucketToken}` };
}

async function requestProviderJson<T>(url: string, headers: Record<string, string>): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'vscode-git-graph-electron',
			...headers,
		},
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`HTTP ${String(response.status)}: ${body || response.statusText}`);
	}
	return (await response.json()) as T;
}

export const repoRouter = router({
	/**
	 * Get all known repositories.
	 */
	list: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		const repos = manager.getRepos();

		return {
			repos: Object.entries(repos).map(([path, state]: [string, GitRepoState]) => ({
				path,
				name: state.name ?? path.split('/').pop() ?? path,
				state,
			})),
			numRepos: manager.getNumRepos(),
		};
	}),

	/**
	 * Get recent repositories.
	 */
	recent: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		return manager.getRecentRepos();
	}),

	/**
	 * Get the last active repository.
	 */
	lastActive: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		return manager.getLastActiveRepo();
	}),

	/**
	 * Set the last active repository.
	 */
	setLastActive: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.setActiveRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Register a new repository.
	 */
	register: publicProcedure
		.input(
			z.object({
				path: z.string(),
			})
		)
			.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					root: null,
					error: `Unable to initialize Git: ${initError}`,
				};
			}

			const manager = getRepoManager(getGitService());
			const result = await manager.registerRepo(input.path);
			return result;
		}),

	/**
	 * Remove a repository.
	 */
	remove: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.removeRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Ignore a repository.
	 */
	ignore: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			const success = manager.ignoreRepo(input.repo);
			return { success };
		}),

	/**
	 * Unignore a repository.
	 */
	unignore: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.unignoreRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Get ignored repositories.
	 */
	ignoredList: publicProcedure.query(() => {
		return instanceStore.get('ignoredRepos');
	}),

	/**
	 * Update repository state.
	 */
	updateState: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				state: z.object({
					cdvDivider: z.number().optional(),
					cdvHeight: z.number().optional(),
					columnWidths: z.array(z.number()).nullable().optional(),
					commitOrdering: z.string().optional(),
					fileViewType: z.string().optional(),
					hideRemotes: z.array(z.string()).optional(),
					includeCommitsMentionedByReflogs: z.string().optional(),
					issueLinkingConfig: z
						.object({
							issue: z.string(),
							url: z.string(),
						})
						.nullable()
						.optional(),
					name: z.string().nullable().optional(),
					onlyFollowFirstParent: z.string().optional(),
					onRepoLoadShowCheckedOutBranch: z.string().optional(),
					onRepoLoadShowSpecificBranches: z.array(z.string()).nullable().optional(),
					pullRequestConfig: z.record(z.string(), z.unknown()).nullable().optional(),
					showRemoteBranches: z.boolean().optional(),
					showRemoteBranchesV2: z.string().optional(),
					showStashes: z.string().optional(),
					showTags: z.string().optional(),
				}),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			// Strip undefined values and cast to satisfy exactOptionalPropertyTypes
			const state = Object.fromEntries(
				Object.entries(input.state).filter(([, v]) => v !== undefined)
			) as Partial<GitRepoState>;
			manager.updateRepoState(input.repo, state);
			return { success: true };
		}),

	/**
	 * Backend-managed workspace persistence.
	 */
	workspace: router({
		list: publicProcedure.query(() => {
			const workspaces = instanceStore.get('workspaces');
			return {
				workspaces: Array.isArray(workspaces) ? workspaces : [],
				error: null as string | null,
			};
		}),

		setAll: publicProcedure
			.input(
				z.object({
					workspaces: z.array(workspaceSchema),
				})
			)
			.mutation(({ input }) => {
				instanceStore.set('workspaces', input.workspaces);
				return { success: true };
			}),

		upsert: publicProcedure
			.input(workspaceSchema)
			.mutation(({ input }) => {
				const current = instanceStore.get('workspaces');
				const list = Array.isArray(current) ? [...current] : [];
				const index = list.findIndex((entry) => entry.id === input.id);
				if (index >= 0) {
					list[index] = input;
				} else {
					list.push(input);
				}
				instanceStore.set('workspaces', list);
				return { success: true, workspace: input };
			}),

		remove: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const current = instanceStore.get('workspaces');
				const list = Array.isArray(current) ? current : [];
				instanceStore.set(
					'workspaces',
					list.filter((workspace) => workspace.id !== input.id)
				);
				return { success: true };
		}),
	}),

	commitFilters: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
			})
		)
		.query(({ input }) => {
			const current = instanceStore.get('commitFiltersByRepo');
			return {
				filters: current?.[input.repo] ?? {},
			};
		}),

	setCommitFilters: publicProcedure
		.input(commitFilterStateSchema)
		.mutation(({ input }) => {
			const current = instanceStore.get('commitFiltersByRepo') ?? {};
			const { repo, ...filters } = input;
			const nextFilters = Object.fromEntries(
				Object.entries(filters).filter(([, value]) => typeof value === 'string' && value.length > 0)
			);
			instanceStore.set('commitFiltersByRepo', {
				...current,
				[repo]: nextFilters,
			});
			return {
				success: true,
				filters: nextFilters,
			};
		}),

	pinnedCommits: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
			})
		)
		.query(({ input }) => {
			const current = instanceStore.get('pinnedCommitsByRepo') ?? {};
			return {
				commits: current[input.repo] ?? [],
			};
		}),

	setPinnedCommits: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
				commits: z.array(pinnedCommitSchema),
			})
		)
		.mutation(({ input }) => {
			const current = instanceStore.get('pinnedCommitsByRepo') ?? {};
			instanceStore.set('pinnedCommitsByRepo', {
				...current,
				[input.repo]: input.commits,
			});
			return {
				success: true,
				commits: input.commits,
			};
		}),

	recentRepoDetails: publicProcedure.query(() => {
		return {
			repos: instanceStore.get('recentRepoDetails') ?? [],
		};
	}),

	setRecentRepoDetails: publicProcedure
		.input(
			z.object({
				repos: z.array(recentRepoSchema),
			})
		)
		.mutation(({ input }) => {
			instanceStore.set('recentRepoDetails', input.repos);
			return {
				success: true,
				repos: input.repos,
			};
		}),

	policy: router({
		get: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
				})
			)
			.query(({ input }) => {
				const policy = getRepoPolicy(input.repo);
				return { policy, error: null as string | null };
			}),

		set: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					policy: repoPolicySchema.partial(),
				})
			)
			.mutation(({ input }) => {
				const nextPolicy = upsertRepoPolicy(input.repo, input.policy);
				return { success: true, policy: nextPolicy };
			}),
	}),

	review: router({
		summary: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
					baseRef: z.string().min(1),
					headRef: z.string().min(1),
				})
			)
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError !== null) {
					return {
						files: [] as string[],
						progress: null,
						error: initError,
					};
				}

				const root = await getGitService().getRepoRoot(input.repo);
				if (!root) {
					return {
						files: [] as string[],
						progress: null,
						error: 'Not a Git repository.',
					};
				}

				const diffOutput = await getGitService().runGitCommandWithOutput(
					['diff', '--name-only', `${input.baseRef}...${input.headRef}`],
					root
				);
				const files = (diffOutput ?? '')
					.split('\n')
					.map((file) => file.trim())
					.filter(Boolean);
				const progress = getCodeReviewProgress(root, input.reviewId) ?? {
					lastActive: 0,
					lastViewedFile: null,
					remainingFiles: files,
				};
				const normalizedRemaining = progress.remainingFiles.filter((file) => files.includes(file));
				const effectiveRemaining = normalizedRemaining.length > 0 || files.length === 0 ? normalizedRemaining : files;

				return {
					files,
					progress: {
						lastActive: progress.lastActive,
						lastViewedFile: progress.lastViewedFile,
						remainingFiles: effectiveRemaining,
						reviewedCount: Math.max(0, files.length - effectiveRemaining.length),
						totalFiles: files.length,
					},
					error: null as string | null,
				};
			}),

		update: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
					lastViewedFile: z.string().nullable().optional(),
					remainingFiles: z.array(z.string()).optional(),
				})
			)
			.mutation(({ input }) => {
				const next = updateCodeReviewProgress(input.repo, input.reviewId, {
					...(input.lastViewedFile !== undefined ? { lastViewedFile: input.lastViewedFile } : {}),
					...(input.remainingFiles ? { remainingFiles: input.remainingFiles } : {}),
				});
				return { success: true, progress: next };
			}),

		reset: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				resetCodeReviewProgress(input.repo, input.reviewId);
				return { success: true };
			}),
	}),

	audit: router({
		list: publicProcedure
			.input(
				z.object({
					repo: z.string().nullable().optional(),
					limit: z.number().int().min(1).max(500).optional().default(100),
				})
			)
			.query(({ input }) => {
				const entries = listAuditEntries(input.repo, input.limit);
				return { entries, error: null as string | null };
			}),
	}),

	/**
	 * Search for repositories in a directory.
	 */
	search: publicProcedure
		.input(
			z.object({
				directory: z.string(),
				maxDepth: z.number().default(0),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					found: false,
					error: `Unable to initialize Git: ${initError}`,
				};
			}

			const manager = getRepoManager(getGitService());
			const found = await manager.searchDirectoryForRepos(input.directory, input.maxDepth);
			return { found };
		}),

	/**
	 * Aggregate launchpad status for multiple repositories.
	 */
	launchpad: publicProcedure
		.input(
			z.object({
				repos: z.array(z.string()).max(100),
				includePullRequests: z.boolean().optional().default(true),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			const statusMapStore = instanceStore.get('launchpadStatusMap') ?? {};
			if (initError !== null) {
				return {
					repos: input.repos.map((repoPath) => ({
						path: repoPath,
						name: repoPath.split('/').pop() ?? repoPath,
						head: null,
						dirtyCount: 0,
						ahead: 0,
						behind: 0,
						lastCommit: null,
						provider: null,
						openPullRequests: null,
						needsAttention: false,
						stale: false,
						statusSignals: [] as string[],
						mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
						error: initError,
					})),
					error: initError,
				};
			}

			const gitService = getGitService();
			const authConfig = getStoredProviderAuthConfig();

			const repos = await Promise.all(
				input.repos.map(async (repoPath) => {
					const normalizedPath = repoPath.trim();
					if (!normalizedPath) {
						return {
							path: repoPath,
							name: repoPath.split('/').pop() ?? repoPath,
							head: null as string | null,
							dirtyCount: 0,
							ahead: 0,
							behind: 0,
							lastCommit: null as {
								hash: string;
								message: string;
								author: string;
								timestamp: number;
							} | null,
							provider: null as string | null,
							openPullRequests: null as number | null,
							needsAttention: false,
							stale: false,
							statusSignals: [] as string[],
							mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
							error: 'Repository path is empty.',
						};
					}

					const root = await gitService.getRepoRoot(normalizedPath);
					if (!root) {
						return {
							path: normalizedPath,
							name: normalizedPath.split('/').pop() ?? normalizedPath,
							head: null as string | null,
							dirtyCount: 0,
							ahead: 0,
							behind: 0,
							lastCommit: null as {
								hash: string;
								message: string;
								author: string;
								timestamp: number;
							} | null,
							provider: null as string | null,
							openPullRequests: null as number | null,
							needsAttention: false,
							stale: false,
							statusSignals: [] as string[],
							mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
							error: 'Not a Git repository.',
						};
					}

					const [headRaw, statusRaw, aheadBehindRaw, lastCommitRaw, originRemoteRaw] = await Promise.all([
						gitService.runGitCommandWithOutput(['rev-parse', '--abbrev-ref', 'HEAD'], root),
						gitService.runGitCommandWithOutput(['status', '--porcelain'], root),
						gitService.runGitCommandWithOutput(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], root),
						gitService.runGitCommandWithOutput(['log', '-1', '--format=%h%x1f%s%x1f%ct%x1f%an'], root),
						gitService.runGitCommandWithOutput(['config', '--get', 'remote.origin.url'], root),
					]);

					let ahead = 0;
					let behind = 0;
					const aheadBehindMatch = aheadBehindRaw?.trim().match(/^(\d+)\s+(\d+)/);
					if (aheadBehindMatch?.[1] && aheadBehindMatch[2]) {
						ahead = parseInt(aheadBehindMatch[1], 10);
						behind = parseInt(aheadBehindMatch[2], 10);
					}

					let lastCommit: {
						hash: string;
						message: string;
						author: string;
						timestamp: number;
					} | null = null;
					const commitTokens = (lastCommitRaw ?? '').split('\x1f');
					if (
						commitTokens.length >= 4 &&
						commitTokens[0] &&
						commitTokens[1] &&
						commitTokens[2] &&
						commitTokens[3]
					) {
						lastCommit = {
							hash: commitTokens[0],
							message: commitTokens[1],
							timestamp: parseInt(commitTokens[2], 10) * 1000,
							author: commitTokens[3],
						};
					}

					const originRemote = originRemoteRaw?.trim() || null;
					const provider = originRemote ? parsePullRequestRemoteUrl(originRemote)?.provider ?? null : null;

					let openPullRequests: number | null = null;
					if (input.includePullRequests && originRemote && provider) {
						try {
							const pullRequests = await listRemotePullRequests(originRemote, provider, authConfig, 'open');
							openPullRequests = pullRequests.length;
						} catch {
							openPullRequests = null;
						}
					}

					const lastCommitAgeHours = lastCommit
						? Math.floor((Date.now() - lastCommit.timestamp) / (1000 * 60 * 60))
						: Number.POSITIVE_INFINITY;
					const stale = Number.isFinite(lastCommitAgeHours) && lastCommitAgeHours > 24 * 7;
					const statusSignals: string[] = [];
					const dirtyCount = (statusRaw ?? '')
						.split('\n')
						.map((line) => line.trim())
						.filter(Boolean).length;
					if (dirtyCount > 0) statusSignals.push('dirty');
					if (behind > 0) statusSignals.push('behind');
					if ((openPullRequests ?? 0) > 0) statusSignals.push('openPullRequests');
					if (stale) statusSignals.push('stale');
					const needsAttention = statusSignals.length > 0;

					const repoStatusMap = statusMapStore[root] ?? statusMapStore[normalizedPath] ?? {};
					const mappedStatuses = statusSignals
						.map((key) => ({ key, value: repoStatusMap[key] }))
						.filter((entry): entry is { key: string; value: { label: string; severity: 'info' | 'warn' | 'error' } } => Boolean(entry.value))
						.map((entry) => ({
							key: entry.key,
							label: entry.value.label,
							severity: entry.value.severity,
						}));

					return {
						path: root,
						name: root.split('/').pop() ?? root,
						head: headRaw?.trim() || null,
						dirtyCount,
						ahead,
						behind,
						lastCommit,
						provider,
						openPullRequests,
						needsAttention,
						stale,
						statusSignals,
						mappedStatuses,
						error: null as string | null,
					};
				})
			);

			return { repos, error: null as string | null };
		}),

	/**
	 * Fetch many repositories in batch.
	 */
	fetchMany: publicProcedure
		.input(
			z.object({
				repos: z.array(z.string()).max(100),
				prune: z.boolean().optional().default(true),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					results: input.repos.map((repoPath) => ({
						path: repoPath,
						error: initError,
					})),
					error: initError,
				};
			}

			const gitService = getGitService();
			const results = await Promise.all(
				input.repos.map(async (repoPath) => {
					const root = await gitService.getRepoRoot(repoPath);
					if (!root) {
						return {
							path: repoPath,
							error: 'Not a Git repository.',
						};
					}
					const args = ['fetch', '--all'];
					if (input.prune) {
						args.push('--prune');
					}
					const error = await gitService.runGitCommand(args, root);
					return {
						path: root,
						error,
					};
				})
			);

			return { results, error: null as string | null };
		}),

	/**
	 * List remote repositories for a provider using stored account credentials.
	 */
	listRemoteRepositories: publicProcedure
		.input(
			z.object({
				provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure']),
			})
		)
		.query(async ({ input }) => {
			try {
				if (input.provider === 'azure') {
					return {
						repositories: [] as RemoteRepository[],
						error: 'Azure DevOps repository listing requires organization/project context. Use clone URL directly.',
					};
				}

				const headers = buildProviderAuthHeader(input.provider);
				let repositories: RemoteRepository[] = [];

				if (input.provider === 'github') {
					const data = await requestProviderJson<Array<Record<string, unknown>>>(
						'https://api.github.com/user/repos?sort=updated&per_page=100',
						headers
					);
					repositories = data.map((repo) => ({
						provider: 'github',
						name: readString(repo.name),
						fullName: readString(repo.full_name, readString(repo.name)),
						description: readString(repo.description),
						cloneUrl: readString(repo.clone_url),
						sshUrl: readString(repo.ssh_url),
						webUrl: readString(repo.html_url),
						private: Boolean(repo.private),
						defaultBranch: readString(repo.default_branch, 'main'),
					}));
				}

				if (input.provider === 'gitlab') {
					const data = await requestProviderJson<Array<Record<string, unknown>>>(
						'https://gitlab.com/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&sort=desc&per_page=100',
						headers
					);
					repositories = data.map((repo) => ({
						provider: 'gitlab',
						name: readString(repo.name),
						fullName: readString(repo.path_with_namespace, readString(repo.name)),
						description: readString(repo.description),
						cloneUrl: readString(repo.http_url_to_repo),
						sshUrl: readString(repo.ssh_url_to_repo),
						webUrl: readString(repo.web_url),
						private: readString(repo.visibility) !== 'public',
						defaultBranch: readString(repo.default_branch, 'main'),
					}));
				}

				if (input.provider === 'bitbucket') {
					const data = await requestProviderJson<{ values?: Array<Record<string, unknown>> }>(
						'https://api.bitbucket.org/2.0/repositories?role=member&sort=-updated_on&pagelen=100',
						headers
					);
					repositories = (data.values ?? []).map((repo) => {
						const links = isRecord(repo.links) ? repo.links : {};
						const cloneLinks = Array.isArray(links.clone)
							? links.clone.filter((entry): entry is Record<string, unknown> => isRecord(entry))
							: [];
						const httpsLink = cloneLinks.find((entry) => readString(entry.name) === 'https');
						const sshLink = cloneLinks.find((entry) => readString(entry.name) === 'ssh');
						const htmlLink = isRecord(links.html) ? links.html : {};
						const mainBranch = isRecord(repo.mainbranch) ? repo.mainbranch : {};
						return {
							provider: 'bitbucket',
							name: readString(repo.name),
							fullName: readString(repo.full_name, readString(repo.name)),
							description: readString(repo.description),
							cloneUrl: readString(httpsLink?.href),
							sshUrl: readString(sshLink?.href),
							webUrl: readString(htmlLink.href),
							private: Boolean(repo.is_private),
							defaultBranch: readString(mainBranch.name, 'main'),
						};
					});
				}

				return { repositories, error: null as string | null };
			} catch (error) {
				return {
					repositories: [] as RemoteRepository[],
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Clone a repository into a destination directory and register it.
	 */
	clone: publicProcedure
		.input(
			z.object({
				url: z.string().min(1),
				destination: z.string().min(1),
				branch: z.string().optional(),
				depth: z.number().int().min(1).max(1000).optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return { root: null, error: `Unable to initialize Git: ${initError}` };
			}

			try {
				const destination = path.resolve(input.destination);
				const parentDir = path.dirname(destination);
				const destinationName = path.basename(destination);
				await fs.mkdir(parentDir, { recursive: true });

				const gitService = getGitService();
				const cloneArgs = ['clone'];
				if (input.branch) {
					cloneArgs.push('--branch', input.branch);
				}
				if (input.depth) {
					cloneArgs.push('--depth', String(input.depth));
				}
				cloneArgs.push(input.url, destinationName);

				const cloneError = await gitService.runGitCommand(cloneArgs, parentDir);
				if (cloneError) {
					return { root: null, error: cloneError };
				}

				const manager = getRepoManager(gitService);
				const result = await manager.registerRepo(destination);
				return {
					root: result.root ?? destination,
					error: result.error ?? null,
				};
			} catch (error) {
				return {
					root: null,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Mute file watcher (before Git operations).
	 */
	muteWatcher: publicProcedure.mutation(() => {
		const manager = getRepoManager(getGitService());
		manager.muteWatcher();
		return { success: true };
	}),

	/**
	 * Unmute file watcher (after Git operations).
	 */
	unmuteWatcher: publicProcedure.mutation(() => {
		const manager = getRepoManager(getGitService());
		manager.unmuteWatcher();
		return { success: true };
	}),
});

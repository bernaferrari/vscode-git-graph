/**
 * Repository tRPC Router
 * Exposes repository management operations to the renderer
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { router, publicProcedure } from '../../init';
import { getRepoManager } from '../../../services/repoManager';
import { getGitService } from '../../../services/gitService';
import { findGit } from '../../../services/gitExecutable';
import { appStore, instanceStore } from '@/app/backend/store';
import {
	listPullRequests as listRemotePullRequests,
	parseRemoteUrl as parsePullRequestRemoteUrl,
	type ProviderAuthConfig,
} from '../../../services/pullRequest';
import type { GitRepoState } from '@/web/lib/types';

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
	if (!storedAuth) {
		return {};
	}

	return {
		githubToken: storedAuth.githubToken || undefined,
		gitlabToken: storedAuth.gitlabToken || undefined,
		bitbucketToken: storedAuth.bitbucketToken || undefined,
		bitbucketUsername: storedAuth.bitbucketUsername || undefined,
		azureToken: storedAuth.azureToken || undefined,
	};
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
		throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
	}
	return (await response.json()) as T;
}

export const repoRouter = router({
	/**
	 * Get all known repositories.
	 */
	list: publicProcedure.query(async () => {
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
	recent: publicProcedure.query(async () => {
		const manager = getRepoManager(getGitService());
		return manager.getRecentRepos();
	}),

	/**
	 * Get the last active repository.
	 */
	lastActive: publicProcedure.query(async () => {
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
		.mutation(async ({ input }) => {
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
		.mutation(async ({ input }) => {
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
		.mutation(async ({ input }) => {
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
		.mutation(async ({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.unignoreRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Get ignored repositories.
	 */
	ignoredList: publicProcedure.query(async () => {
		return instanceStore.get('ignoredRepos') ?? [];
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
		.mutation(async ({ input }) => {
			const manager = getRepoManager(getGitService());
			// Strip undefined values and cast to satisfy exactOptionalPropertyTypes
			const state = Object.fromEntries(
				Object.entries(input.state).filter(([, v]) => v !== undefined)
			) as Partial<GitRepoState>;
			manager.updateRepoState(input.repo, state);
			return { success: true };
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

					return {
						path: root,
						name: root.split('/').pop() ?? root,
						head: headRaw?.trim() || null,
						dirtyCount: (statusRaw ?? '')
							.split('\n')
							.map((line) => line.trim())
							.filter(Boolean).length,
						ahead,
						behind,
						lastCommit,
						provider,
						openPullRequests,
						error: null as string | null,
					};
				})
			);

			return { repos, error: null as string | null };
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
						name: String(repo.name ?? ''),
						fullName: String(repo.full_name ?? repo.name ?? ''),
						description: String(repo.description ?? ''),
						cloneUrl: String(repo.clone_url ?? ''),
						sshUrl: String(repo.ssh_url ?? ''),
						webUrl: String(repo.html_url ?? ''),
						private: Boolean(repo.private),
						defaultBranch: String(repo.default_branch ?? 'main'),
					}));
				}

				if (input.provider === 'gitlab') {
					const data = await requestProviderJson<Array<Record<string, unknown>>>(
						'https://gitlab.com/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&sort=desc&per_page=100',
						headers
					);
					repositories = data.map((repo) => ({
						provider: 'gitlab',
						name: String(repo.name ?? ''),
						fullName: String(repo.path_with_namespace ?? repo.name ?? ''),
						description: String(repo.description ?? ''),
						cloneUrl: String(repo.http_url_to_repo ?? ''),
						sshUrl: String(repo.ssh_url_to_repo ?? ''),
						webUrl: String(repo.web_url ?? ''),
						private: String(repo.visibility ?? '') !== 'public',
						defaultBranch: String(repo.default_branch ?? 'main'),
					}));
				}

				if (input.provider === 'bitbucket') {
					const data = await requestProviderJson<{ values?: Array<Record<string, unknown>> }>(
						'https://api.bitbucket.org/2.0/repositories?role=member&sort=-updated_on&pagelen=100',
						headers
					);
					repositories = (data.values ?? []).map((repo) => {
						const cloneLinks = (repo.links as Record<string, any> | undefined)?.clone;
						const httpsLink =
							Array.isArray(cloneLinks) ? cloneLinks.find((entry) => entry?.name === 'https')?.href : '';
						const sshLink =
							Array.isArray(cloneLinks) ? cloneLinks.find((entry) => entry?.name === 'ssh')?.href : '';
						return {
							provider: 'bitbucket',
							name: String(repo.name ?? ''),
							fullName: String(repo.full_name ?? repo.name ?? ''),
							description: String(repo.description ?? ''),
							cloneUrl: String(httpsLink ?? ''),
							sshUrl: String(sshLink ?? ''),
							webUrl: String((repo.links as Record<string, any> | undefined)?.html?.href ?? ''),
							private: Boolean(repo.is_private),
							defaultBranch: String(
								(repo.mainbranch as Record<string, string> | undefined)?.name ?? 'main'
							),
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
	muteWatcher: publicProcedure.mutation(async () => {
		const manager = getRepoManager(getGitService());
		manager.muteWatcher();
		return { success: true };
	}),

	/**
	 * Unmute file watcher (after Git operations).
	 */
	unmuteWatcher: publicProcedure.mutation(async () => {
		const manager = getRepoManager(getGitService());
		manager.unmuteWatcher();
		return { success: true };
	}),
});

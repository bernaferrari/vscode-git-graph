/**
 * Repository tRPC Router
 * Exposes repository management operations to the renderer
 */

import { z } from 'zod';
import { router, publicProcedure } from '../../init';
import { getRepoManager } from '../../../services/repoManager';
import { getGitService } from '../../../services/gitService';
import { findGit } from '../../../services/gitExecutable';
import { instanceStore } from '@/app/backend/store';
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

/**
 * Git tRPC Router
 * Exposes Git operations as tRPC procedures
 */

import { z } from 'zod';
import { router, publicProcedure } from '../../init';
import { findGit } from '../../../services/gitExecutable';
import { GitService, type DiffNameStatusRecord, type DiffNumStatRecord } from '../../../services/gitService';

// Singleton Git service instance
let gitService: GitService | null = null;

function getGitService(): GitService {
	if (!gitService) {
		gitService = new GitService({
			dateType: 'author',
			showSignatureStatus: false,
			useMailmap: false,
			fileEncoding: 'utf8',
			signCommits: false,
			signTags: false,
			showUncommittedChanges: true,
		});
	}
	return gitService;
}

// Initialize Git on startup
let gitInitialized = false;
async function ensureGitInitialized(): Promise<string | null> {
	if (gitInitialized && gitService?.isGitAvailable()) {
		return null;
	}

	try {
		const executable = await findGit();
		getGitService().setGitExecutable(executable);
		gitInitialized = true;
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : 'Failed to find Git executable';
	}
}

export const gitRouter = router({
	// ==================== System ====================

	/**
	 * Check if Git is available and get version info.
	 */
	status: publicProcedure.query(async () => {
		const initError = await ensureGitInitialized();
		if (initError) {
			return { available: false, error: initError, version: null, path: null };
		}

		const executable = getGitService().getGitExecutable();
		return {
			available: true,
			error: null,
			version: executable?.version ?? null,
			path: executable?.path ?? null,
			supportsGpgInfo: getGitService().supportsGpgInfo(),
		};
	}),

	// ==================== Repository ====================

	/**
	 * Get the root of a repository for a given path.
	 */
	repoRoot: publicProcedure
		.input(z.object({ path: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { root: null, error: initError };

			const root = await getGitService().getRepoRoot(input.path);
			return { root, error: null };
		}),

	/**
	 * Get repository info (branches, remotes, stashes).
	 */
	repoInfo: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				showRemoteBranches: z.boolean(),
				showStashes: z.boolean(),
				hideRemotes: z.array(z.string()),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) {
				return { branches: [], head: null, remotes: [], stashes: [], error: initError };
			}

			try {
				const service = getGitService();
				const [branches, remotes, stashes] = await Promise.all([
					service.getBranches(input.repo, input.showRemoteBranches, input.hideRemotes),
					service.getRemotes(input.repo),
					input.showStashes ? service.getStashes(input.repo) : Promise.resolve([]),
				]);

				return {
					branches: branches.branches,
					head: branches.head,
					remotes,
					stashes,
					error: null,
				};
			} catch (error) {
				return {
					branches: [],
					head: null,
					remotes: [],
					stashes: [],
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	// ==================== Commits ====================

	/**
	 * Get commit log.
	 */
	commits: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branches: z.array(z.string()).nullable(),
				maxCommits: z.number(),
				order: z.enum(['date', 'author-date', 'topo']),
				onlyFollowFirstParent: z.boolean(),
				showTags: z.boolean(),
				showRemoteBranches: z.boolean(),
				hideRemotes: z.array(z.string()),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) {
				return { commits: [], head: null, tags: [], moreCommitsAvailable: false, error: initError };
			}

			try {
				const service = getGitService();
				const [commits, refs] = await Promise.all([
					service.getLog(
						input.repo,
						input.branches,
						input.maxCommits + 1,
						input.order,
						input.onlyFollowFirstParent
					),
					service.getRefs(input.repo, input.showRemoteBranches, input.hideRemotes),
				]);

				const moreCommitsAvailable = commits.length === input.maxCommits + 1;
				if (moreCommitsAvailable) commits.pop();

				// Define annotated commit type
				interface AnnotatedCommit {
					hash: string;
					parents: string[];
					author: string;
					email: string;
					date: number;
					message: string;
					heads: string[];
					tags: string[];
					remotes: string[];
				}

				// Annotate commits with refs
				const annotatedCommits: AnnotatedCommit[] = commits.map((c) => ({
					...c,
					heads: [] as string[],
					tags: [] as string[],
					remotes: [] as string[],
				}));

				const commitLookup = new Map<string, number>(annotatedCommits.map((c, i) => [c.hash, i]));

				for (const head of refs.heads) {
					const idx = commitLookup.get(head.hash);
					if (idx !== undefined) {
						annotatedCommits[idx]!.heads.push(head.name);
					}
				}

				if (input.showTags) {
					for (const tag of refs.tags) {
						const idx = commitLookup.get(tag.hash);
						if (idx !== undefined) {
							annotatedCommits[idx]!.tags.push(tag.name);
						}
					}
				}

				return {
					commits: annotatedCommits,
					head: refs.head,
					tags: refs.tags.map((t: { name: string }) => t.name),
					moreCommitsAvailable,
					error: null,
				};
			} catch (error) {
				return {
					commits: [],
					head: null,
					tags: [],
					moreCommitsAvailable: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Get commit details.
	 */
	commitDetails: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				commitHash: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { details: null, error: initError };

			try {
				const service = getGitService();
				const [details, nameStatus, numStat] = await Promise.all([
					service.getCommitDetails(input.repo, input.commitHash),
					service.getDiffNameStatus(input.repo, `${input.commitHash}^`, input.commitHash),
					service.getDiffNumStat(input.repo, `${input.commitHash}^`, input.commitHash),
				]);

				// Combine name-status and numstat
				const fileChanges = nameStatus.map((ns: DiffNameStatusRecord) => {
					const stats = numStat.find((n: DiffNumStatRecord) => n.filePath === ns.newFilePath);
					return {
						oldFilePath: ns.oldFilePath,
						newFilePath: ns.newFilePath,
						type: ns.type,
						additions: stats?.additions ?? null,
						deletions: stats?.deletions ?? null,
					};
				});

				return {
					details: { ...details, fileChanges },
					error: null,
				};
			} catch (error) {
				return {
					details: null,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	// ==================== Files ====================

	/**
	 * Get file contents at a specific revision.
	 */
	fileAtRevision: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				commitHash: z.string(),
				filePath: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { content: null, error: initError };

			try {
				const content = await getGitService().getFileAtRevision(
					input.repo,
					input.commitHash,
					input.filePath
				);
				return { content, error: null };
			} catch (error) {
				return {
					content: null,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Get diff between two revisions.
	 */
	diff: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				fromHash: z.string(),
				toHash: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { fileChanges: [], error: initError };

			try {
				const service = getGitService();
				const [nameStatus, numStat] = await Promise.all([
					service.getDiffNameStatus(input.repo, input.fromHash, input.toHash),
					service.getDiffNumStat(input.repo, input.fromHash, input.toHash),
				]);

				const fileChanges = nameStatus.map((ns: DiffNameStatusRecord) => {
					const stats = numStat.find((n: DiffNumStatRecord) => n.filePath === ns.newFilePath);
					return {
						oldFilePath: ns.oldFilePath,
						newFilePath: ns.newFilePath,
						type: ns.type,
						additions: stats?.additions ?? null,
						deletions: stats?.deletions ?? null,
					};
				});

				return { fileChanges, error: null };
			} catch (error) {
				return {
					fileChanges: [],
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	// ==================== Git Actions ====================

	/**
	 * Checkout a branch.
	 */
	checkout: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				ref: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['checkout', input.ref], input.repo);
			return { error };
		}),

	/**
	 * Create a branch.
	 */
	createBranch: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branchName: z.string(),
				commitHash: z.string(),
				checkout: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { errors: [initError] };

			const args = input.checkout
				? ['checkout', '-b', input.branchName, input.commitHash]
				: ['branch', input.branchName, input.commitHash];

			const error = await getGitService().runGitCommand(args, input.repo);
			return { errors: error ? [error] : [] };
		}),

	/**
	 * Delete a branch.
	 */
	deleteBranch: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branchName: z.string(),
				force: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(
				['branch', input.force ? '-D' : '-d', input.branchName],
				input.repo
			);
			return { error };
		}),

	/**
	 * Fetch from remote(s).
	 */
	fetch: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				remote: z.string().nullable(),
				prune: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['fetch', input.remote ?? '--all'];
			if (input.prune) args.push('--prune');

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Pull from remote.
	 */
	pull: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branchName: z.string(),
				remote: z.string(),
				noFastForward: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['pull', input.remote, input.branchName];
			if (input.noFastForward) args.push('--no-ff');

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Push to remote.
	 */
	push: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branchName: z.string(),
				remote: z.string(),
				setUpstream: z.boolean(),
				force: z.boolean(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['push', input.remote, input.branchName];
			if (input.setUpstream) args.push('--set-upstream');
			if (input.force) args.push('--force');

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Reset to commit.
	 */
	reset: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				commitHash: z.string(),
				mode: z.enum(['soft', 'mixed', 'hard']),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(
				['reset', `--${input.mode}`, input.commitHash],
				input.repo
			);
			return { error };
		}),

	/**
	 * Stash operations.
	 */
	stash: router({
		list: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { stashes: [], error: initError };

				try {
					const stashes = await getGitService().getStashes(input.repo);
					return { stashes, error: null };
				} catch (error) {
					return {
						stashes: [],
						error: error instanceof Error ? error.message : 'Unknown error',
					};
				}
			}),

		push: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					message: z.string().optional(),
					includeUntracked: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const args = ['stash', 'push'];
				if (input.includeUntracked) args.push('--include-untracked');
				if (input.message) args.push('--message', input.message);

				const error = await getGitService().runGitCommand(args, input.repo);
				return { error };
			}),

		pop: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					selector: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['stash', 'pop', input.selector],
					input.repo
				);
				return { error };
			}),

		drop: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					selector: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['stash', 'drop', input.selector],
					input.repo
				);
				return { error };
			}),
	}),

	/**
	 * Tag operations.
	 */
	tag: router({
		create: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					tagName: z.string(),
					commitHash: z.string(),
					message: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const args = input.message
					? ['tag', '-a', input.tagName, '-m', input.message, input.commitHash]
					: ['tag', input.tagName, input.commitHash];

				const error = await getGitService().runGitCommand(args, input.repo);
				return { error };
			}),

		delete: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					tagName: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['tag', '-d', input.tagName],
					input.repo
				);
				return { error };
			}),
	}),
});

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

		applyStash: publicProcedure
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
					['stash', 'apply', input.selector],
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

	/**
	 * Merge a branch.
	 */
	merge: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branch: z.string(),
				noFastForward: z.boolean().optional(),
				squash: z.boolean().optional(),
				noCommit: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['merge'];
			if (input.noFastForward) args.push('--no-ff');
			if (input.squash) args.push('--squash');
			if (input.noCommit) args.push('--no-commit');
			args.push(input.branch);

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Rebase current branch onto a commit/branch.
	 */
	rebase: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				onto: z.string(),
				interactive: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['rebase'];
			if (input.interactive) args.push('-i');
			args.push('--onto', input.onto);

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Cherry-pick a commit.
	 */
	cherryPick: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				commitHash: z.string(),
				noCommit: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['cherry-pick'];
			if (input.noCommit) args.push('--no-commit');
			args.push(input.commitHash);

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Revert a commit.
	 */
	revert: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				commitHash: z.string(),
				noCommit: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['revert'];
			if (input.noCommit) args.push('--no-commit');
			args.push(input.commitHash);

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Copy text to clipboard.
	 */
	copyToClipboard: publicProcedure
		.input(z.object({ text: z.string() }))
		.mutation(async ({ input }) => {
			// In Electron, we can use clipboard API
			const { clipboard } = await import('electron');
			clipboard.writeText(input.text);
			return { success: true };
		}),

	/**
	 * Get remote URL for a repository.
	 */
	getRemoteUrl: publicProcedure
		.input(z.object({ repo: z.string(), remote: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { url: null, error: initError };

			try {
				// Use git config to get remote URL
				const { execFile } = await import('child_process');
				const executable = getGitService().getGitExecutable();
				
				if (!executable) {
					return { url: null, error: 'Git not initialized' };
				}

				const url = await new Promise<string | null>((resolve) => {
					execFile(
						executable.path,
						['config', '--get', `remote.${input.remote}.url`],
						{ cwd: input.repo },
						(error, stdout) => {
							resolve(error ? null : stdout.trim());
						}
					);
				});

				return { url, error: null };
			} catch (error) {
				return { url: null, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Detect issue linking from remote URL.
	 */
	detectIssueLinking: publicProcedure
		.input(z.object({ repo: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { config: null, error: initError };

			try {
				// Use git config to get remote.origin.url
				const { execFile } = await import('child_process');
				const executable = getGitService().getGitExecutable();
				
				if (!executable) {
					return { config: null, error: 'Git not initialized' };
				}

				const url = await new Promise<string | null>((resolve) => {
					execFile(
						executable.path,
						['config', '--get', 'remote.origin.url'],
						{ cwd: input.repo },
						(error, stdout) => {
							resolve(error ? null : stdout.trim());
						}
					);
				});

				if (!url) {
					return { config: null, error: null };
				}

				// Detect platform from URL
				let config: { issue: string; url: string } | null = null;
				
				// Extract repo path
				const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
				const sshMatch = url.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
				const repoPath = httpsMatch?.[1] ?? sshMatch?.[1];

				if (repoPath) {
					if (url.includes('github.com')) {
						config = {
							issue: '#(\\d+)',
							url: `https://github.com/${repoPath}/issues/{issue}`,
						};
					} else if (url.includes('gitlab.com')) {
						config = {
							issue: '#(\\d+)',
							url: `https://gitlab.com/${repoPath}/-/issues/{issue}`,
						};
					} else if (url.includes('bitbucket.org')) {
						config = {
							issue: '#(\\d+)',
							url: `https://bitbucket.org/${repoPath}/issues/{issue}`,
						};
					}
				}

				return { config, error: null };
			} catch (error) {
				return { config: null, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get list of remotes with URLs.
	 */
	remotes: publicProcedure
		.input(z.object({ repo: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { remotes: [], error: initError };

			try {
				const gitService = getGitService();
				const remoteNames = await gitService.getRemotes(input.repo);
				
				// Get URL for each remote
				const remotes = await Promise.all(
					remoteNames.map(async (name) => {
						const url = await gitService.runGitCommandWithOutput(
							['config', '--get', `remote.${name}.url`],
							input.repo
						);
						const pushUrl = await gitService.runGitCommandWithOutput(
							['config', '--get', `remote.${name}.pushurl`],
							input.repo
						);
						return {
							name,
							url: url?.trim() ?? '',
							pushUrl: pushUrl?.trim() || undefined,
						};
					})
				);

				return { remotes, error: null };
			} catch (error) {
				return { remotes: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Remote operations.
	 */
	remote: router({
		add: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					name: z.string(),
					url: z.string(),
					pushUrl: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const gitService = getGitService();
				const error = await gitService.runGitCommand(
					['remote', 'add', input.name, input.url],
					input.repo
				);

				if (!error && input.pushUrl) {
					await gitService.runGitCommand(
						['remote', 'set-url', '--push', input.name, input.pushUrl],
						input.repo
					);
				}

				return { error };
			}),

		remove: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['remote', 'remove', input.name],
					input.repo
				);
				return { error };
			}),

		update: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					name: z.string(),
					url: z.string(),
					pushUrl: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const gitService = getGitService();
				
				// Update fetch URL
				const error = await gitService.runGitCommand(
					['remote', 'set-url', input.name, input.url],
					input.repo
				);

				if (!error) {
					// Update push URL if provided
					if (input.pushUrl) {
						await gitService.runGitCommand(
							['remote', 'set-url', '--push', input.name, input.pushUrl],
							input.repo
						);
					} else {
						// Clear custom push URL to use fetch URL
						await gitService.runGitCommand(
							['remote', 'set-url', '--push', input.name, input.url],
							input.repo
						);
					}
				}

				return { error };
			}),

		prune: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['remote', 'prune', input.name],
					input.repo
				);
				return { error };
			}),
	}),

	// ==================== Additional Features ====================

	/**
	 * Rename a branch.
	 */
	renameBranch: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				oldName: z.string(),
				newName: z.string(),
				force: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['branch', '-m'];
			if (input.force) args.push('-M');
			args.push(input.oldName, input.newName);

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Abort a merge.
	 */
	mergeAbort: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['merge', '--abort'], input.repo);
			return { error };
		}),

	/**
	 * Continue a merge after resolving conflicts.
	 */
	mergeContinue: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				message: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['merge', '--continue'];
			if (input.message) {
				args.push('-m', input.message);
			}

			const error = await getGitService().runGitCommand(args, input.repo);
			return { error };
		}),

	/**
	 * Abort a rebase.
	 */
	rebaseAbort: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['rebase', '--abort'], input.repo);
			return { error };
		}),

	/**
	 * Continue a rebase after resolving conflicts.
	 */
	rebaseContinue: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['rebase', '--continue'], input.repo);
			return { error };
		}),

	/**
	 * Skip current patch during rebase.
	 */
	rebaseSkip: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['rebase', '--skip'], input.repo);
			return { error };
		}),

	/**
	 * Abort a cherry-pick.
	 */
	cherryPickAbort: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['cherry-pick', '--abort'], input.repo);
			return { error };
		}),

	/**
	 * Continue a cherry-pick after resolving conflicts.
	 */
	cherryPickContinue: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['cherry-pick', '--continue'], input.repo);
			return { error };
		}),

	/**
	 * Skip current cherry-pick.
	 */
	cherryPickSkip: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['cherry-pick', '--skip'], input.repo);
			return { error };
		}),

	/**
	 * Abort a revert.
	 */
	revertAbort: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['revert', '--abort'], input.repo);
			return { error };
		}),

	/**
	 * Continue a revert after resolving conflicts.
	 */
	revertContinue: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['revert', '--continue'], input.repo);
			return { error };
		}),

	/**
	 * Quit a revert (skip current).
	 */
	revertSkip: publicProcedure
		.input(z.object({ repo: z.string() }))
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const error = await getGitService().runGitCommand(['revert', '--skip'], input.repo);
			return { error };
		}),

	/**
	 * Get current operation state (merge/rebase/cherry-pick/revert in progress).
	 */
	operationState: publicProcedure
		.input(z.object({ repo: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { state: null, error: initError };

			try {
				const gitService = getGitService();
				const fs = await import('fs');
				const path = await import('path');

				const gitDir = path.join(input.repo, '.git');

				// Check for various operation states
				const state = {
					merging: false,
					rebasing: false,
					cherryPicking: false,
					reverting: false,
					bisecting: false,
					conflicts: [] as string[],
				};

				// Check merge state
				try {
					await fs.promises.access(path.join(gitDir, 'MERGE_HEAD'));
					state.merging = true;
				} catch {}

				// Check rebase state
				try {
					await fs.promises.access(path.join(gitDir, 'rebase-merge'));
					state.rebasing = true;
				} catch {
					try {
						await fs.promises.access(path.join(gitDir, 'rebase-apply'));
						state.rebasing = true;
					} catch {}
				}

				// Check cherry-pick state
				try {
					await fs.promises.access(path.join(gitDir, 'CHERRY_PICK_HEAD'));
					state.cherryPicking = true;
				} catch {}

				// Check revert state
				try {
					await fs.promises.access(path.join(gitDir, 'REVERT_HEAD'));
					state.reverting = true;
				} catch {}

				// Check bisect state
				try {
					await fs.promises.access(path.join(gitDir, 'BISECT_LOG'));
					state.bisecting = true;
				} catch {}

				// Get conflict list
				const statusOutput = await gitService.runGitCommandWithOutput(
					['status', '--porcelain'],
					input.repo
				);

				if (statusOutput) {
					for (const line of statusOutput.split('\n').filter(Boolean)) {
						const index = line[0];
						const workTree = line[1];
						if (index === 'U' || workTree === 'U' || 
							(index === 'A' && workTree === 'A') || 
							(index === 'D' && workTree === 'D')) {
							state.conflicts.push(line.slice(3));
						}
					}
				}

				return { state, error: null };
			} catch (error) {
				return { state: null, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Resolve a merge conflict.
	 */
	resolveConflict: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				path: z.string(),
				resolution: z.enum(['ours', 'theirs', 'both']),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const gitService = getGitService();
			
			// Use git checkout to resolve
			const args = ['checkout'];
			if (input.resolution === 'ours') {
				args.push('--ours');
			} else if (input.resolution === 'theirs') {
				args.push('--theirs');
			}
			args.push('--', input.path);

			const error = await gitService.runGitCommand(args, input.repo);
			
			if (!error) {
				// Stage the resolved file
				await gitService.runGitCommand(['add', input.path], input.repo);
			}
			
			return { error };
		}),

	/**
	 * Get file blame.
	 */
	blame: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				path: z.string(),
				commitHash: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { blame: null, error: initError };

			try {
				const gitService = getGitService();
				const args = ['blame', '--line-porcelain'];
				if (input.commitHash) {
					args.push(input.commitHash);
				}
				args.push('--', input.path);

				const blame = await gitService.runGitCommandWithOutput(args, input.repo);
				return { blame, error: null };
			} catch (error) {
				return { blame: null, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get file history.
	 */
	fileHistory: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				path: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { history: [], error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['log', '--follow', '--oneline', '--numstat', '--', input.path],
					input.repo
				);
				
				// Parse the output
				const history: Array<{
					hash: string;
					author: string;
					date: string;
					message: string;
					additions: number;
					deletions: number;
				}> = [];
				
				const lines = (output ?? '').split('\n');
				for (const line of lines) {
					const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
					if (match) {
						history.push({
							hash: match[1] ?? '',
							message: match[2] ?? '',
							author: '',
							date: '',
							additions: 0,
							deletions: 0,
						});
					}
				}

				return { history, error: null };
			} catch (error) {
				return { history: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get reflog entries.
	 */
	reflog: publicProcedure
		.input(z.object({ repo: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { entries: [], error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['reflog', '--format=%H|%gd|%gs|%s|%ci'],
					input.repo
				);

				const entries = (output ?? '').split('\n').filter(Boolean).map((line) => {
					const [hash, ref, action, message, date] = line.split('|');
					return { hash, ref, action, message, date };
				});

				return { entries, error: null };
			} catch (error) {
				return { entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Create an archive.
	 */
	archive: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				ref: z.string(),
				format: z.enum(['zip', 'tar', 'tar.gz']),
				outputPath: z.string().optional(),
				prefix: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError, path: null };

			try {
				const { dialog } = await import('electron');
				
				// If no output path, show save dialog
				let outputPath = input.outputPath;
				if (!outputPath) {
					const result = await dialog.showSaveDialog({
						defaultPath: `${input.ref}.${input.format}`,
						filters: [
							{ name: 'Archive', extensions: [input.format === 'tar.gz' ? 'tar.gz' : input.format] },
						],
					});
					
					if (result.canceled || !result.filePath) {
						return { error: 'Cancelled', path: null };
					}
					outputPath = result.filePath;
				}

				const gitService = getGitService();
				const args = ['archive', `--format=${input.format}`, `--output=${outputPath}`];
				if (input.prefix) {
					args.push(`--prefix=${input.prefix}`);
				}
				args.push(input.ref);

				const error = await gitService.runGitCommand(args, input.repo);
				return { error, path: outputPath };
			} catch (error) {
				return { error: error instanceof Error ? error.message : 'Unknown error', path: null };
			}
		}),

	/**
	 * Submodule operations.
	 */
	submodule: router({
		list: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { submodules: [], error: initError };

				try {
					const gitService = getGitService();
					const output = await gitService.runGitCommandWithOutput(
						['submodule', 'status'],
						input.repo
					);

					const submodules = (output ?? '').split('\n').filter(Boolean).map((line) => {
						const match = line.match(/^\s*([+-U ])?([a-f0-9]+)\s+([^\s]+)\s+\(([^)]+)\)?/);
						if (match) {
							return {
								currentCommit: match[2],
								path: match[3],
								branch: match[4],
								status: match[1] === '+' ? 'modified' : match[1] === '-' ? 'uninitialized' : 'clean',
							};
						}
						return null;
					}).filter(Boolean);

					return { submodules, error: null };
				} catch (error) {
					return { submodules: [], error: error instanceof Error ? error.message : 'Unknown error' };
				}
			}),

		add: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					url: z.string(),
					path: z.string(),
					branch: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const args = ['submodule', 'add'];
				if (input.branch) {
					args.push('-b', input.branch);
				}
				args.push(input.url, input.path);

				const error = await getGitService().runGitCommand(args, input.repo);
				return { error };
			}),

		update: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					path: z.string().optional(),
					init: z.boolean().optional(),
					recursive: z.boolean().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const args = ['submodule', 'update'];
				if (input.init) args.push('--init');
				if (input.recursive) args.push('--recursive');
				if (input.path) args.push(input.path);

				const error = await getGitService().runGitCommand(args, input.repo);
				return { error };
			}),

		remove: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					path: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['submodule', 'deinit', '-f', input.path],
					input.repo
				);
				if (!error) {
					await getGitService().runGitCommand(
						['rm', '-f', input.path],
						input.repo
					);
				}
				return { error };
			}),
	}),

	/**
	 * Git Flow operations.
	 */
	flow: router({
		status: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { initialized: false, error: initError };

				try {
					const gitService = getGitService();
					
					// Check if git flow is initialized by looking for config
					const config = await gitService.runGitCommandWithOutput(
						['config', '--get', 'gitflow.branch.master'],
						input.repo
					);

					const initialized = !!config && !config.includes('error');
					
					return { initialized, activeBranches: {}, error: null };
				} catch {
					return { initialized: false, activeBranches: {}, error: null };
				}
			}),

		init: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					prefixes: z.object({
						feature: z.string(),
						release: z.string(),
						hotfix: z.string(),
						support: z.string(),
						versionTag: z.string().optional(),
					}),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const gitService = getGitService();
				
				// Set git flow config
				await gitService.runGitCommand(['config', 'gitflow.prefix.feature', input.prefixes.feature], input.repo);
				await gitService.runGitCommand(['config', 'gitflow.prefix.release', input.prefixes.release], input.repo);
				await gitService.runGitCommand(['config', 'gitflow.prefix.hotfix', input.prefixes.hotfix], input.repo);
				await gitService.runGitCommand(['config', 'gitflow.prefix.support', input.prefixes.support], input.repo);
				await gitService.runGitCommand(['config', 'gitflow.branch.master', 'main'], input.repo);
				await gitService.runGitCommand(['config', 'gitflow.branch.develop', 'develop'], input.repo);

				// Create develop branch if it doesn't exist
				await gitService.runGitCommand(['checkout', '-b', 'develop'], input.repo);

				return { error: null };
			}),

		start: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					type: z.enum(['feature', 'release', 'hotfix', 'support']),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				// Get prefix from config
				const gitService = getGitService();
				const prefix = await gitService.runGitCommandWithOutput(
					['config', '--get', `gitflow.prefix.${input.type}`],
					input.repo
				);

				const branchName = `${(prefix ?? '').trim()}${input.name}`;
				
				// Determine base branch
				const baseBranch = input.type === 'feature' ? 'develop' : 
								   input.type === 'release' ? 'develop' :
								   input.type === 'hotfix' ? 'main' : 'main';

				const error = await gitService.runGitCommand(
					['checkout', '-b', branchName, baseBranch],
					input.repo
				);
				return { error };
			}),

		finish: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					type: z.enum(['feature', 'release', 'hotfix', 'support']),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const gitService = getGitService();
				const prefix = await gitService.runGitCommandWithOutput(
					['config', '--get', `gitflow.prefix.${input.type}`],
					input.repo
				);

				const branchName = `${(prefix ?? '').trim()}${input.name}`;

				if (input.type === 'feature') {
					// Merge back to develop
					await gitService.runGitCommand(['checkout', 'develop'], input.repo);
					const error = await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
					if (!error) {
						await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
					}
					return { error };
				} else if (input.type === 'release') {
					// Merge to main and develop
					await gitService.runGitCommand(['checkout', 'main'], input.repo);
					await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
					await gitService.runGitCommand(['checkout', 'develop'], input.repo);
					await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
					await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
					return { error: null };
				} else if (input.type === 'hotfix') {
					// Merge to main and develop
					await gitService.runGitCommand(['checkout', 'main'], input.repo);
					await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
					await gitService.runGitCommand(['checkout', 'develop'], input.repo);
					await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
					await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
					return { error: null };
				}

				return { error: 'Unknown branch type' };
			}),
	}),

	/**
	 * Worktree operations.
	 */
	worktree: router({
		list: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { worktrees: [], error: initError };

				try {
					const gitService = getGitService();
					const output = await gitService.runGitCommandWithOutput(
						['worktree', 'list', '--porcelain'],
						input.repo
					);

					const worktrees: Array<{
						path: string;
						branch: string;
						commit: string;
						isMain: boolean;
					}> = [];

					const lines = (output ?? '').split('\n');
					let currentWorktree: Partial<typeof worktrees[0]> = {};

					for (const line of lines) {
						if (line.startsWith('worktree ')) {
							if (currentWorktree.path) {
								worktrees.push({
									path: currentWorktree.path,
									branch: currentWorktree.branch ?? '',
									commit: currentWorktree.commit ?? '',
									isMain: worktrees.length === 0,
								});
							}
							currentWorktree = { path: line.replace('worktree ', '') };
						} else if (line.startsWith('HEAD ')) {
							currentWorktree.commit = line.replace('HEAD ', '');
						} else if (line.startsWith('branch ')) {
							currentWorktree.branch = line.replace('branch ', '');
						}
					}

					if (currentWorktree.path) {
						worktrees.push({
							path: currentWorktree.path,
							branch: currentWorktree.branch ?? '',
							commit: currentWorktree.commit ?? '',
							isMain: worktrees.length === 0,
						});
					}

					return { worktrees, error: null };
				} catch (error) {
					return { worktrees: [], error: error instanceof Error ? error.message : 'Unknown error' };
				}
			}),

		add: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					path: z.string(),
					branch: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['worktree', 'add', input.path, input.branch],
					input.repo
				);
				return { error };
			}),

		remove: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					path: z.string(),
					force: z.boolean().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const args = ['worktree', 'remove'];
				if (input.force) args.push('--force');
				args.push(input.path);

				const error = await getGitService().runGitCommand(args, input.repo);
				return { error };
			}),

		prune: publicProcedure
			.input(z.object({ repo: z.string() }))
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(['worktree', 'prune'], input.repo);
				return { error };
			}),
	}),

	/**
	 * Get working directory status (including conflicts).
	 */
	workingDirectoryStatus: publicProcedure
		.input(z.object({ repo: z.string() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { staged: [], unstaged: [], conflicted: [], error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['status', '--porcelain'],
					input.repo
				);

				const staged: string[] = [];
				const unstaged: string[] = [];
				const conflicted: string[] = [];

				for (const line of (output ?? '').split('\n').filter(Boolean)) {
					const index = line[0];
					const workTree = line[1];
					const path = line.slice(3);

					if (index === 'U' || workTree === 'U' || index === 'A' && workTree === 'A' || index === 'D' && workTree === 'D') {
						conflicted.push(path);
					} else {
						if (index !== ' ' && index !== '?') {
							staged.push(path);
						}
						if (workTree !== ' ') {
							unstaged.push(path);
						}
					}
				}

				return { staged, unstaged, conflicted, error: null };
			} catch (error) {
				return { staged: [], unstaged: [], conflicted: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Write resolved file content.
	 */
	writeFile: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				path: z.string(),
				content: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const fs = await import('fs');
				const path = await import('path');
				const fullPath = path.join(input.repo, input.path);
				await fs.promises.writeFile(fullPath, input.content, 'utf-8');
				return { error: null };
			} catch (error) {
				return { error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * LFS operations.
	 */
	lfs: router({
		status: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { installed: false, tracking: [], error: initError };

				try {
					const gitService = getGitService();
					const output = await gitService.runGitCommandWithOutput(
						['lfs', 'ls-files'],
						input.repo
					);

					const files = (output ?? '').split('\n').filter(Boolean);
					return { installed: true, tracking: files, error: null };
				} catch {
					return { installed: false, tracking: [], error: null };
				}
			}),

		track: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					pattern: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['lfs', 'track', input.pattern],
					input.repo
				);
				return { error };
			}),

		untrack: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					pattern: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['lfs', 'untrack', input.pattern],
					input.repo
				);
				return { error };
			}),

		pull: publicProcedure
			.input(z.object({ repo: z.string() }))
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['lfs', 'pull'],
					input.repo
				);
				return { error };
			}),

		push: publicProcedure
			.input(z.object({ repo: z.string() }))
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['lfs', 'push', '--all', 'origin'],
					input.repo
				);
				return { error };
			}),

		prune: publicProcedure
			.input(z.object({ repo: z.string() }))
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const error = await getGitService().runGitCommand(
					['lfs', 'prune'],
					input.repo
				);
				return { error };
			}),
	}),

	/**
	 * Launch external diff tool.
	 */
	launchDiffTool: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				filePath: z.string(),
				oldHash: z.string().optional(),
				newHash: z.string().optional(),
				tool: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			try {
				const gitService = getGitService();
				
				// Set diff tool if specified
				if (input.tool) {
					await gitService.runGitCommand(
						['config', 'diff.guitool', input.tool],
						input.repo
					);
				}

				// Build difftool command
				const args = ['difftool', '--gui'];
				
				if (input.oldHash && input.newHash) {
					args.push(input.oldHash, input.newHash, '--', input.filePath);
				} else if (input.oldHash) {
					args.push(input.oldHash, '--', input.filePath);
				} else {
					args.push('--', input.filePath);
				}

				// Run without waiting (it opens a GUI)
				const { spawn } = await import('child_process');
				const executable = getGitService().getGitExecutable();
				
				if (!executable) {
					return { error: 'Git not initialized' };
				}

				spawn(executable.path, args, {
					cwd: input.repo,
					detached: true,
					stdio: 'ignore',
				}).unref();

				return { error: null };
			} catch (error) {
				return { error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get configured diff tool.
	 */
	getDiffTool: publicProcedure
		.input(z.object({ repo: z.string().optional() }))
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { tool: null, error: initError };

			try {
				const gitService = getGitService();
				const tool = await gitService.runGitCommandWithOutput(
					['config', '--get', 'diff.guitool'],
					input.repo ?? process.cwd()
				);
				return { tool: tool?.trim() ?? null, error: null };
			} catch {
				return { tool: null, error: null };
			}
		}),

	/**
	 * Set configured diff tool.
	 */
	setDiffTool: publicProcedure
		.input(
			z.object({
				repo: z.string().optional(),
				tool: z.string(),
				global: z.boolean().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			const args = ['config'];
			if (input.global) args.push('--global');
			args.push('diff.guitool', input.tool);

			const error = await getGitService().runGitCommand(
				args,
				input.repo ?? process.cwd()
			);
			return { error };
		}),

	/**
	 * Commit signing operations.
	 */
	signing: router({
		status: publicProcedure
			.input(z.object({ repo: z.string() }))
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return {
					enabled: false,
					method: null,
					key: null,
					gpgProgram: null,
					gpgKeys: [],
					error: initError,
				};

				try {
					const gitService = getGitService();
					
					// Get signing config
					const [enabledRaw, methodRaw, keyRaw, gpgProgramRaw] = await Promise.all([
						gitService.runGitCommandWithOutput(['config', '--get', 'commit.gpgsign'], input.repo),
						gitService.runGitCommandWithOutput(['config', '--get', 'gpg.format'], input.repo),
						gitService.runGitCommandWithOutput(['config', '--get', 'user.signingkey'], input.repo),
						gitService.runGitCommandWithOutput(['config', '--get', 'gpg.program'], input.repo),
					]);

					// Get GPG keys
					const gpgKeys: Array<{ id: string; userId: string }> = [];
					try {
						const { execFileSync } = await import('child_process');
						const output = execFileSync('gpg', ['--list-secret-keys', '--keyid-format=LONG'], {
							encoding: 'utf-8',
						});
						
						// Parse GPG output
						const keyRegex = /sec\s+\w+\/(\w+)\s+\d{4}-\d{2}-\d{2}\s+[^\n]+\n\s+([^\n]+)/g;
						let match;
						while ((match = keyRegex.exec(output)) !== null) {
							gpgKeys.push({
								id: match[1] ?? '',
								userId: match[2]?.trim() ?? '',
							});
						}
					} catch {
						// GPG not available
					}

					return {
						enabled: enabledRaw?.trim() === 'true',
						method: (methodRaw?.trim() as 'gpg' | 'ssh') ?? 'gpg',
						key: keyRaw?.trim() ?? null,
						gpgProgram: gpgProgramRaw?.trim() ?? null,
						gpgKeys,
						error: null,
					};
				} catch (error) {
					return {
						enabled: false,
						method: null,
						key: null,
						gpgProgram: null,
						gpgKeys: [],
						error: error instanceof Error ? error.message : 'Unknown error',
					};
				}
			}),

		configure: publicProcedure
			.input(
				z.object({
					repo: z.string(),
					enabled: z.boolean(),
					method: z.enum(['gpg', 'ssh']).optional(),
					key: z.string().optional(),
					gpgProgram: z.string().optional(),
					global: z.boolean().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) return { error: initError };

				const gitService = getGitService();
				const scope = input.global ? '--global' : '--local';

				// Set commit.gpgsign
				await gitService.runGitCommand(
					['config', scope, 'commit.gpgsign', input.enabled.toString()],
					input.repo
				);

				if (input.enabled) {
					// Set gpg.format
					if (input.method) {
						await gitService.runGitCommand(
							['config', scope, 'gpg.format', input.method],
							input.repo
						);
					}

					// Set user.signingkey
					if (input.key) {
						await gitService.runGitCommand(
							['config', scope, 'user.signingkey', input.key],
							input.repo
						);
					}

					// Set gpg.program
					if (input.gpgProgram) {
						await gitService.runGitCommand(
							['config', scope, 'gpg.program', input.gpgProgram],
							input.repo
						);
					}
				}

				return { error: null };
			}),
	}),
});

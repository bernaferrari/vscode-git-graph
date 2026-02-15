	/**
	 * Preview a rebase - shows what commits will be affected.
	 */
	rebasePreview: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branch: z.string(),
				onto: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			try {
				const gitService = getGitService();

				// Get commits that will be rebased
				const logResult = await gitService.runGitCommandWithOutput(
					['log', '--format=%H|%h|%s', `${input.onto}..${input.branch}`],
					input.repo
				);
				const commits = (logResult ?? '').split('\n').filter(Boolean).map(line => {
					const [hash, shortHash, ...msgParts] = line.split('|');
					return { hash, shortHash, message: msgParts.join('|') };
				});

				// Check for conflicts using a temporary method
				// Note: In production, you'd use git rebase --dry-run or a worktree
				const willRewriteHistory = true;
				const willForcePush = true;

				// Get the base commits that would change
				const baseLog = await gitService.runGitCommandWithOutput(
					['log', '--format=%H', '-1', input.branch],
					input.repo
				);

				return {
					commits,
					willRewriteHistory,
					willForcePush,
					warnings: willForcePush ? ['This will rewrite history. A force push may be required.'] : [],
				};
			} catch (error) {
				return {
					commits: [],
					error: error instanceof Error ? error.message : 'Unknown error',
					warnings: ['Could not preview rebase'],
				};
			}
		}),

	/**
	 * Compare two commit ranges using git range-diff.
	 */
	rangeDiff: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				range1: z.string(),
				range2: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { diff: [], error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['range-diff', input.range1, input.range2, '--format=plain'],
					input.repo
				);

				// Parse the range-diff output
				const diff = (output ?? '').split('\n').filter(Boolean);

				return { diff, error: null };
			} catch (error) {
				// range-diff might not be available in older Git versions
				return { diff: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get operation history (reflog) with undo capability.
	 */
	operationHistory: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				limit: z.number().optional().default(20),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { operations: [], error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['reflog', `--format=%H|%gd|%gs|%ci`, `-n=${input.limit}`],
					input.repo
				);

				const operations = (output ?? '').split('\n').filter(Boolean).map(line => {
					const [hash, ref, action, date] = line.split('|');
					return {
						id: hash,
						ref,
						action,
						date,
						// Determine if this operation can be undone
						canUndo: action.includes('checkout') || 
								 action.includes('reset') || 
								 action.includes('rebase') ||
								 action.includes('cherry-pick'),
					};
				});

				return { operations, error: null };
			} catch (error) {
				return { operations: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Undo a Git operation using reflog.
	 */
	undoOperation: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				ref: z.string(),
				targetHash: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { error: initError };

			try {
				const gitService = getGitService();

				// Reset the ref to the target hash
				const error = await gitService.runGitCommand(
					['reset', '--hard', input.targetHash],
					input.repo
				);

				if (error) {
					return { error };
				}

				return { error: null, success: true };
			} catch (error) {
				return { error: error instanceof Error ? error.message : 'Unknown error', success: false };
			}
		}),

	/**
	 * Get diff stats between two commits.
	 */
	diffStats: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				from: z.string(),
				to: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { stats: null, error: initError };

			try {
				const gitService = getGitService();
				const output = await gitService.runGitCommandWithOutput(
					['diff', '--stat', '--numstat', `${input.from}..${input.to}`],
					input.repo
				);

				const files = (output ?? '').split('\n').filter(Boolean).map(line => {
					const [additions, deletions, path] = line.split('\t');
					return {
						path,
						additions: parseInt(additions) || 0,
						deletions: parseInt(deletions) || 0,
					};
				});

				const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
				const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

				return {
					stats: {
						files: files.length,
						additions: totalAdditions,
						deletions: totalDeletions,
						filesList: files,
					},
					error: null,
				};
			} catch (error) {
				return { stats: null, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Check if branch is ahead/behind remote.
	 */
	aheadBehind: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				branch: z.string(),
				remote: z.string().optional().default('origin'),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { ahead: 0, behind: 0, error: initError };

			try {
				const gitService = getGitService();
				const remoteBranch = `${input.remote}/${input.branch}`;

				// Check if remote branch exists
				const remoteCheck = await gitService.runGitCommandWithOutput(
					['rev-parse', '--verify', remoteBranch],
					input.repo
				);

				if (!remoteCheck.trim()) {
					return { ahead: 0, behind: 0, error: null };
				}

				// Get ahead/behind count
				const output = await gitService.runGitCommandWithOutput(
					['rev-list', '--left-right', '--count', `${input.branch}...${remoteBranch}`],
					input.repo
				);

				const [ahead, behind] = (output ?? '0 0').split('\t').map(n => parseInt(n) || 0);

				return { ahead, behind, error: null };
			} catch (error) {
				return { ahead: 0, behind: 0, error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

	/**
	 * Get branches that would be affected by a rebase/merge.
	 */
	potentiallyAffectedBranches: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				sourceBranch: z.string(),
				targetBranch: z.string(),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError) return { branches: [], error: initError };

			try {
				const gitService = getGitService();

				// Find branches that contain commits from source but not in target
				const output = await gitService.runGitCommandWithOutput(
					['branch', '--format=%(refname:short)', `--contains=${input.sourceBranch}`],
					input.repo
				);

				const branches = (output ?? '').split('\n')
					.filter(Boolean)
					.map(b => b.trim())
					.filter(b => b && b !== input.targetBranch);

				return { branches, error: null };
			} catch (error) {
				return { branches: [], error: error instanceof Error ? error.message : 'Unknown error' };
			}
		}),

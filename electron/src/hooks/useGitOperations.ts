/**
 * Git Operations Hook
 * Provides convenient access to Git tRPC mutations
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useOperationLog, type OperationReceipt } from '@/lib/operationLog';

interface MutationResultShape {
    error?: string | null;
    errors?: string[];
}

interface GitErrorGuidanceRule {
    pattern: RegExp;
    suggestion: string;
}

type LoggedOperation = Omit<OperationReceipt, 'id' | 'timestamp'>;
let operationQueueTail: Promise<void> = Promise.resolve();

const GIT_ERROR_GUIDANCE_RULES: readonly GitErrorGuidanceRule[] = [
    {
        pattern: /non-fast-forward|fetch first|rejected/i,
        suggestion:
            'Fetch and rebase/pull before pushing again, or use force push only if rewriting branch history intentionally.',
    },
    {
        pattern: /conflict|merge conflict/i,
        suggestion: 'Open the conflict editor, resolve all files, stage them, then continue the operation.',
    },
    {
        pattern: /uncommitted changes|would be overwritten by/i,
        suggestion: 'Commit, stash, or discard local changes before retrying this operation.',
    },
    {
        pattern: /authentication failed|permission denied|publickey/i,
        suggestion: 'Verify credentials/SSH keys and remote permissions for this repository.',
    },
    {
        pattern: /could not resolve host|unable to access|failed to connect/i,
        suggestion: 'Check network connectivity and confirm the remote URL is correct.',
    },
    {
        pattern: /no upstream branch|set-upstream|has no tracking information/i,
        suggestion: 'Set the upstream branch and retry the command.',
    },
    {
        pattern: /detached head|not currently on a branch/i,
        suggestion: 'Checkout a branch before retrying operations that require a branch context.',
    },
];

export function useGitOperations() {
    const {
        activeRepo,
        beginOperation,
        endOperation,
        operationLabel,
        enqueueOperation,
        markOperationRunning,
        removeOperation,
    } = useAppStore();
    const utils = trpc.useUtils();
    const logOperation = useCallback((operation: LoggedOperation) => {
        useOperationLog.getState().addOperation(operation);
    }, []);
    const { data: repoInfo } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: false,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo }
    );
    const currentBranch = repoInfo?.head ?? null;
    const safeInvalidateRepositoryData = useCallback(async () => {
        await Promise.allSettled([
            utils.git.repoInfo.invalidate(),
            utils.git.commits.invalidate(),
            utils.git.workingTreeStatus.invalidate(),
            utils.git.workingDirectoryStatus.invalidate(),
            utils.git.aheadBehind.invalidate(),
            utils.git.aheadBehindAll.invalidate(),
            utils.git.operationState.invalidate(),
        ]);
    }, [
        utils.git.aheadBehind,
        utils.git.aheadBehindAll,
        utils.git.commits,
        utils.git.operationState,
        utils.git.repoInfo,
        utils.git.workingDirectoryStatus,
        utils.git.workingTreeStatus,
    ]);

    const safeInvalidateWorkingTreeData = useCallback(async () => {
        await Promise.allSettled([
            utils.git.workingTreeStatus.invalidate(),
            utils.git.workingDirectoryStatus.invalidate(),
            utils.git.repoInfo.invalidate(),
            utils.git.operationState.invalidate(),
        ]);
    }, [utils.git.operationState, utils.git.repoInfo, utils.git.workingDirectoryStatus, utils.git.workingTreeStatus]);

    const safeInvalidateRepoAndRemotesData = useCallback(async () => {
        await Promise.allSettled([utils.git.remotes.invalidate(), safeInvalidateRepositoryData()]);
    }, [safeInvalidateRepositoryData, utils.git.remotes]);

    const formatErrorWithGuidance = useCallback((message: string): string => {
        const trimmed = message.trim();
        if (trimmed.length === 0) {
            return 'Operation failed';
        }

        const matchingSuggestions = GIT_ERROR_GUIDANCE_RULES.filter((rule) => rule.pattern.test(trimmed)).map(
            (rule) => rule.suggestion
        );
        const uniqueSuggestions = [...new Set(matchingSuggestions)];

        if (uniqueSuggestions.length === 0) {
            return trimmed;
        }

        return `${trimmed}\n\nNext steps:\n- ${uniqueSuggestions.join('\n- ')}`;
    }, []);

    const notifyOperationError = useCallback(
        (title: string, message: string) => {
            toast.error(title, { description: formatErrorWithGuidance(message) });
        },
        [formatErrorWithGuidance]
    );

    const runTrackedOperation = useCallback(
        async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
            const operationId = `queued-op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            enqueueOperation(operationId, label);

            const execute = async (): Promise<T> => {
                const queuedEntry = useAppStore.getState().operationQueue.find((entry) => entry.id === operationId);
                if (!queuedEntry) {
                    return { error: 'Operation cancelled' } as T;
                }

                markOperationRunning(operationId);
                beginOperation(label);

                try {
                    return await operation();
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Operation failed';
                    return { error: message } as T;
                } finally {
                    endOperation();
                    removeOperation(operationId);
                }
            };

            const runPromise = operationQueueTail.then(execute, execute);
            operationQueueTail = runPromise.then(
                () => undefined,
                () => undefined
            );
            return runPromise;
        },
        [beginOperation, endOperation, enqueueOperation, markOperationRunning, removeOperation]
    );

    const getMutationError = useCallback((result: unknown): string | null => {
        if (!result || typeof result !== 'object') return null;
        const typed = result as MutationResultShape;

        if (typeof typed.error === 'string' && typed.error.trim().length > 0) {
            return typed.error;
        }

        if (Array.isArray(typed.errors) && typed.errors.length > 0) {
            const messages = typed.errors.filter(
                (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
            );
            if (messages.length > 0) return messages.join('\n');
        }

        return null;
    }, []);

    // Mutations
    const createBranch = trpc.git.createBranch.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Failed to create branch', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'branch-create',
                description: `Created branch ${variables.branchName}`,
                details: variables.branchName,
                gitCommands: [`git branch ${variables.branchName} ${variables.commitHash}`],
                undoAction: {
                    type: 'delete-branch',
                    command: variables.branchName,
                },
                affectedBranches: [variables.branchName],
                affectedCommits: [variables.commitHash],
                status: 'success',
            });
            toast.success('Branch created');
        },
        onError: (error) => {
            notifyOperationError('Failed to create branch', error.message);
        },
    });

    const deleteBranch = trpc.git.deleteBranch.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Failed to delete branch', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'branch-delete',
                description: `Deleted branch ${variables.branchName}`,
                details: variables.branchName,
                gitCommands: [`git branch ${variables.force ? '-D' : '-d'} ${variables.branchName}`],
                affectedBranches: [variables.branchName],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Branch deleted');
        },
        onError: (error) => {
            notifyOperationError('Failed to delete branch', error.message);
        },
    });

    const checkout = trpc.git.checkout.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Checkout failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'checkout',
                description: `Checked out ${variables.ref}`,
                details: variables.ref,
                gitCommands: [`git checkout ${variables.ref}`],
                ...(currentBranch && currentBranch !== variables.ref
                    ? {
                          undoAction: {
                              type: 'checkout',
                              command: currentBranch,
                          },
                      }
                    : {}),
                affectedBranches: [variables.ref],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Checked out');
        },
        onError: (error) => {
            notifyOperationError('Checkout failed', error.message);
        },
    });

    const reset = trpc.git.reset.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Reset failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'reset',
                description: `Reset ${variables.mode} to ${variables.commitHash.slice(0, 7)}`,
                details: `${variables.mode}:${variables.commitHash}`,
                gitCommands: [`git reset --${variables.mode} ${variables.commitHash}`],
                undoAction: {
                    type: 'hard-reset',
                    command: 'ORIG_HEAD',
                },
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [variables.commitHash],
                status: 'success',
            });
            toast.success('Reset successful');
        },
        onError: (error) => {
            notifyOperationError('Reset failed', error.message);
        },
    });

    const fetch = trpc.git.fetch.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Fetch failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'fetch',
                description: `Fetched ${variables.remote ?? 'all remotes'}`,
                details: variables.remote ?? 'all',
                gitCommands: [
                    `git fetch${variables.remote ? ` ${variables.remote}` : ''}${variables.prune ? ' --prune' : ''}`,
                ],
                affectedBranches: [],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Fetched from remote');
        },
        onError: (error) => {
            notifyOperationError('Fetch failed', error.message);
        },
    });

    const pull = trpc.git.pull.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Pull failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'pull',
                description: `Pulled ${variables.remote}/${variables.branchName}`,
                details: `${variables.remote}/${variables.branchName}`,
                gitCommands: [
                    `git pull${variables.fastForwardOnly ? ' --ff-only' : variables.noFastForward ? ' --no-ff' : ''} ${variables.remote} ${variables.branchName}`,
                ],
                affectedBranches: [variables.branchName],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Pulled changes');
        },
        onError: (error) => {
            notifyOperationError('Pull failed', error.message);
        },
    });

    const push = trpc.git.push.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Push failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: variables.force ? 'force-push' : 'push',
                description: `${variables.force ? 'Force pushed' : 'Pushed'} ${variables.remote}/${variables.branchName}`,
                details: `${variables.remote}/${variables.branchName}`,
                gitCommands: [
                    `git push ${variables.force ? '--force ' : ''}${variables.setUpstream ? '--set-upstream ' : ''}${variables.remote} ${variables.branchName}`.trim(),
                ],
                affectedBranches: [variables.branchName],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Pushed changes');
        },
        onError: (error) => {
            notifyOperationError('Push failed', error.message);
        },
    });

    const createTag = trpc.git.tag.create.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Failed to create tag', error);
                return;
            }
            void safeInvalidateRepositoryData();
            toast.success('Tag created');
        },
        onError: (error) => {
            notifyOperationError('Failed to create tag', error.message);
        },
    });

    const deleteTag = trpc.git.tag.delete.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Failed to delete tag', error);
                return;
            }
            void safeInvalidateRepositoryData();
            toast.success('Tag deleted');
        },
        onError: (error) => {
            notifyOperationError('Failed to delete tag', error.message);
        },
    });

    const merge = trpc.git.merge.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Merge failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'merge',
                description: `Merged ${variables.branch} into ${currentBranch ?? 'current branch'}`,
                details: variables.branch,
                gitCommands: [
                    `git merge${variables.noFastForward ? ' --no-ff' : ''}${variables.squash ? ' --squash' : ''}${variables.noCommit ? ' --no-commit' : ''} ${variables.branch}`,
                ],
                affectedBranches: [variables.branch, ...(currentBranch ? [currentBranch] : [])],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Merge successful');
        },
        onError: (error) => {
            notifyOperationError('Merge failed', error.message);
        },
    });

    const rebase = trpc.git.rebase.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Rebase failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'rebase',
                description: `Rebased ${currentBranch ?? 'current branch'} onto ${variables.onto}`,
                details: variables.onto,
                gitCommands: [`git rebase${variables.interactive ? ' -i' : ''} ${variables.onto}`],
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Rebase successful');
        },
        onError: (error) => {
            notifyOperationError('Rebase failed', error.message);
        },
    });

    const cherryPick = trpc.git.cherryPick.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Cherry-pick failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'cherry-pick',
                description: `Cherry-picked ${variables.commitHash.slice(0, 7)}`,
                details: variables.commitHash,
                gitCommands: [`git cherry-pick${variables.noCommit ? ' --no-commit' : ''} ${variables.commitHash}`],
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [variables.commitHash],
                status: 'success',
            });
            toast.success('Cherry-pick successful');
        },
        onError: (error) => {
            notifyOperationError('Cherry-pick failed', error.message);
        },
    });

    const revert = trpc.git.revert.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Revert failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'revert',
                description: `Reverted ${variables.commitHash.slice(0, 7)}`,
                details: variables.commitHash,
                gitCommands: [`git revert${variables.noCommit ? ' --no-commit' : ''} ${variables.commitHash}`],
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [variables.commitHash],
                status: 'success',
            });
            toast.success('Revert successful');
        },
        onError: (error) => {
            notifyOperationError('Revert failed', error.message);
        },
    });

    const commit = trpc.git.commit.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Commit failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: variables.amend ? 'amend' : 'commit',
                description: variables.amend ? 'Amended last commit' : 'Created commit',
                details: variables.message,
                gitCommands: [
                    `git commit${variables.amend ? ' --amend' : ''} -m "${variables.message.replaceAll('"', '\\"')}"`,
                ],
                undoAction: {
                    type: 'undo-last-commit',
                    command: variables.amend ? 'soft' : 'soft',
                },
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Committed');
        },
        onError: (error) => {
            notifyOperationError('Commit failed', error.message);
        },
    });

    const stage = trpc.git.stage.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Stage failed', error);
                return;
            }
            void safeInvalidateWorkingTreeData();
        },
        onError: (error) => {
            notifyOperationError('Stage failed', error.message);
        },
    });

    const unstage = trpc.git.unstage.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Unstage failed', error);
                return;
            }
            void safeInvalidateWorkingTreeData();
        },
        onError: (error) => {
            notifyOperationError('Unstage failed', error.message);
        },
    });

    const stashPush = trpc.git.stashPush.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Stash failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            toast.success('Stashed changes');
        },
        onError: (error) => {
            notifyOperationError('Stash failed', error.message);
        },
    });

    const stashPop = trpc.git.stashPop.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Stash pop failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            toast.success('Stash applied');
        },
        onError: (error) => {
            notifyOperationError('Stash pop failed', error.message);
        },
    });

    const stashApply = trpc.git.stashApply.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Stash apply failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
        },
        onError: (error) => {
            notifyOperationError('Stash apply failed', error.message);
        },
    });

    const stashDrop = trpc.git.stashDrop.useMutation({
        onSuccess: (result) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Stash drop failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
        },
        onError: (error) => {
            notifyOperationError('Stash drop failed', error.message);
        },
    });

    const undoLastCommit = trpc.git.undoLastCommit.useMutation({
        onSuccess: (result, variables) => {
            const error = getMutationError(result);
            if (error) {
                notifyOperationError('Undo failed', error);
                return;
            }
            void safeInvalidateRepositoryData();
            logOperation({
                type: 'reset',
                description: 'Undid last commit',
                details: variables.soft === false ? 'mixed HEAD~1' : 'soft HEAD~1',
                gitCommands: [`git reset ${variables.soft === false ? '--mixed' : '--soft'} HEAD~1`],
                affectedBranches: currentBranch ? [currentBranch] : [],
                affectedCommits: [],
                status: 'success',
            });
            toast.success('Undid last commit');
        },
        onError: (error) => {
            notifyOperationError('Undo failed', error.message);
        },
    });

    const submoduleAdd = trpc.git.submodule.add.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const submoduleUpdate = trpc.git.submodule.update.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const submoduleRemove = trpc.git.submodule.remove.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowFeatureStart = trpc.git.gitflow.feature.start.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowFeatureFinish = trpc.git.gitflow.feature.finish.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowReleaseStart = trpc.git.gitflow.release.start.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowReleaseFinish = trpc.git.gitflow.release.finish.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowHotfixStart = trpc.git.gitflow.hotfix.start.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const gitflowHotfixFinish = trpc.git.gitflow.hotfix.finish.useMutation({
        onSuccess: () => {
            void safeInvalidateRepositoryData();
        },
    });

    const remoteAdd = trpc.git.remote.add.useMutation({
        onSuccess: () => {
            void safeInvalidateRepoAndRemotesData();
        },
    });

    const remoteRemove = trpc.git.remote.remove.useMutation({
        onSuccess: () => {
            void safeInvalidateRepoAndRemotesData();
        },
    });

    const remoteUpdate = trpc.git.remote.update.useMutation({
        onSuccess: () => {
            void safeInvalidateRepoAndRemotesData();
        },
    });

    const worktreeCreate = trpc.git.worktreeManage.create.useMutation({
        onSuccess: () => {
            void Promise.allSettled([utils.git.worktree.list.invalidate(), safeInvalidateRepositoryData()]);
        },
    });

    const worktreeRemove = trpc.git.worktreeManage.remove.useMutation({
        onSuccess: () => {
            void Promise.allSettled([utils.git.worktree.list.invalidate(), safeInvalidateRepositoryData()]);
        },
    });

    const copyToClipboard = trpc.git.copyToClipboard.useMutation();

    // Wrapper functions
    const handleCreateBranch = useCallback(
        async (commitHash: string, branchName: string, checkout: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Creating branch ${branchName}`, () =>
                createBranch.mutateAsync({
                    repo: activeRepo,
                    commitHash,
                    branchName,
                    checkout,
                })
            );
        },
        [activeRepo, createBranch, runTrackedOperation]
    );

    const handleDeleteBranch = useCallback(
        async (branchName: string, force: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Deleting branch ${branchName}`, () =>
                deleteBranch.mutateAsync({
                    repo: activeRepo,
                    branchName,
                    force,
                })
            );
        },
        [activeRepo, deleteBranch, runTrackedOperation]
    );

    const handleCheckout = useCallback(
        async (ref: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Checking out ${ref}`, () =>
                checkout.mutateAsync({
                    repo: activeRepo,
                    ref,
                })
            );
        },
        [activeRepo, checkout, runTrackedOperation]
    );

    const handleReset = useCallback(
        async (commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Resetting (${mode})`, () =>
                reset.mutateAsync({
                    repo: activeRepo,
                    commitHash,
                    mode,
                })
            );
        },
        [activeRepo, reset, runTrackedOperation]
    );

    const handleFetch = useCallback(
        async (remote?: string, prune?: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Fetching ${remote ?? 'remotes'}`, () =>
                fetch.mutateAsync({
                    repo: activeRepo,
                    remote: remote ?? null,
                    prune: prune ?? false,
                })
            );
        },
        [activeRepo, fetch, runTrackedOperation]
    );

    const handlePull = useCallback(
        async (
            branchName?: string,
            remote: string = 'origin',
            noFastForward: boolean = false,
            fastForwardOnly: boolean = false
        ) => {
            if (!activeRepo) return { error: 'No active repository' };
            const resolvedBranch = branchName ?? currentBranch;
            if (!resolvedBranch) return { error: 'No current branch selected for pull' };
            if (noFastForward && fastForwardOnly) {
                return { error: 'Cannot combine no-fast-forward and fast-forward-only pull options' };
            }

            return runTrackedOperation(`Pulling ${remote}/${resolvedBranch}${fastForwardOnly ? ' (ff-only)' : ''}`, () =>
                pull.mutateAsync({
                    repo: activeRepo,
                    branchName: resolvedBranch,
                    remote,
                    noFastForward,
                    fastForwardOnly,
                })
            );
        },
        [currentBranch, activeRepo, pull, runTrackedOperation]
    );

    const handlePush = useCallback(
        async (branchName?: string, remote: string = 'origin', setUpstream: boolean = true, force: boolean = false) => {
            if (!activeRepo) return { error: 'No active repository' };
            const resolvedBranch = branchName ?? currentBranch;
            if (!resolvedBranch) return { error: 'No current branch selected for push' };
            return runTrackedOperation(`Pushing ${remote}/${resolvedBranch}`, () =>
                push.mutateAsync({
                    repo: activeRepo,
                    branchName: resolvedBranch,
                    remote,
                    setUpstream,
                    force,
                })
            );
        },
        [currentBranch, activeRepo, push, runTrackedOperation]
    );

    const handleCreateTag = useCallback(
        async (commitHash: string, tagName: string, message?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Creating tag ${tagName}`, () =>
                createTag.mutateAsync({
                    repo: activeRepo,
                    commitHash,
                    tagName,
                    message,
                })
            );
        },
        [activeRepo, createTag, runTrackedOperation]
    );

    const handleDeleteTag = useCallback(
        async (tagName: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Deleting tag ${tagName}`, () =>
                deleteTag.mutateAsync({
                    repo: activeRepo,
                    tagName,
                })
            );
        },
        [activeRepo, deleteTag, runTrackedOperation]
    );

    const handleMerge = useCallback(
        async (branch: string, options?: { noFastForward?: boolean; squash?: boolean; noCommit?: boolean }) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Merging ${branch}`, () =>
                merge.mutateAsync({
                    repo: activeRepo,
                    branch,
                    noFastForward: options?.noFastForward ?? true,
                    squash: options?.squash ?? false,
                    noCommit: options?.noCommit ?? false,
                })
            );
        },
        [activeRepo, merge, runTrackedOperation]
    );

    const handleRebase = useCallback(
        async (onto: string, interactive?: boolean, todos?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Rebasing onto ${onto}`, () =>
                rebase.mutateAsync({
                    repo: activeRepo,
                    onto,
                    interactive: interactive ?? false,
                    todos: todos,
                })
            );
        },
        [activeRepo, rebase, runTrackedOperation]
    );

    const handleCherryPick = useCallback(
        async (commitHash: string, noCommit?: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Cherry-picking ${commitHash.slice(0, 7)}`, () =>
                cherryPick.mutateAsync({
                    repo: activeRepo,
                    commitHash,
                    noCommit: noCommit ?? false,
                })
            );
        },
        [activeRepo, cherryPick, runTrackedOperation]
    );

    const handleRevert = useCallback(
        async (commitHash: string, noCommit?: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Reverting ${commitHash.slice(0, 7)}`, () =>
                revert.mutateAsync({
                    repo: activeRepo,
                    commitHash,
                    noCommit: noCommit ?? false,
                })
            );
        },
        [activeRepo, revert, runTrackedOperation]
    );

    const handleCommit = useCallback(
        async (message: string, amend?: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(amend ? 'Amending commit' : 'Creating commit', () =>
                commit.mutateAsync({
                    repo: activeRepo,
                    message,
                    amend: amend ?? false,
                })
            );
        },
        [activeRepo, commit, runTrackedOperation]
    );

    const handleStage = useCallback(
        async (files: string[]) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(files.length > 1 ? 'Staging files' : 'Staging file', () =>
                stage.mutateAsync({
                    repo: activeRepo,
                    files,
                })
            );
        },
        [activeRepo, stage, runTrackedOperation]
    );

    const handleUnstage = useCallback(
        async (files: string[]) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(files.length > 1 ? 'Unstaging files' : 'Unstaging file', () =>
                unstage.mutateAsync({
                    repo: activeRepo,
                    files,
                })
            );
        },
        [activeRepo, unstage, runTrackedOperation]
    );

    const handleStashPush = useCallback(
        async (message?: string, includeUntracked: boolean = true) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation('Creating stash', () =>
                stashPush.mutateAsync({
                    repo: activeRepo,
                    message,
                    includeUntracked,
                })
            );
        },
        [activeRepo, stashPush, runTrackedOperation]
    );

    const handleStashPop = useCallback(
        async (index: number) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Popping stash@{${index}}`, () =>
                stashPop.mutateAsync({
                    repo: activeRepo,
                    index,
                })
            );
        },
        [activeRepo, stashPop, runTrackedOperation]
    );

    const handleStashApply = useCallback(
        async (index: number) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Applying stash@{${index}}`, () =>
                stashApply.mutateAsync({
                    repo: activeRepo,
                    index,
                })
            );
        },
        [activeRepo, stashApply, runTrackedOperation]
    );

    const handleStashDrop = useCallback(
        async (index: number) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Dropping stash@{${index}}`, () =>
                stashDrop.mutateAsync({
                    repo: activeRepo,
                    index,
                })
            );
        },
        [activeRepo, stashDrop, runTrackedOperation]
    );

    const handleUndoLastCommit = useCallback(
        async (soft: boolean = true) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation('Undoing last commit', () =>
                undoLastCommit.mutateAsync({
                    repo: activeRepo,
                    soft,
                })
            );
        },
        [activeRepo, undoLastCommit, runTrackedOperation]
    );

    const handleSubmoduleAdd = useCallback(
        async (url: string, path: string, branch?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Adding submodule ${path}`, () =>
                submoduleAdd.mutateAsync({
                    repo: activeRepo,
                    url,
                    path,
                    branch,
                })
            );
        },
        [activeRepo, runTrackedOperation, submoduleAdd]
    );

    const handleSubmoduleUpdate = useCallback(
        async (path?: string, options?: { init?: boolean; recursive?: boolean }) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(path ? `Updating submodule ${path}` : 'Updating submodules', () =>
                submoduleUpdate.mutateAsync({
                    repo: activeRepo,
                    path,
                    ...options,
                })
            );
        },
        [activeRepo, runTrackedOperation, submoduleUpdate]
    );

    const handleSubmoduleRemove = useCallback(
        async (path: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Removing submodule ${path}`, () =>
                submoduleRemove.mutateAsync({
                    repo: activeRepo,
                    path,
                })
            );
        },
        [activeRepo, runTrackedOperation, submoduleRemove]
    );

    const handleGitFlowFeatureStart = useCallback(
        async (name: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Starting feature ${name}`, () =>
                gitflowFeatureStart.mutateAsync({
                    repo: activeRepo,
                    name,
                })
            );
        },
        [activeRepo, gitflowFeatureStart, runTrackedOperation]
    );

    const handleGitFlowFeatureFinish = useCallback(
        async (name: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Finishing feature ${name}`, () =>
                gitflowFeatureFinish.mutateAsync({
                    repo: activeRepo,
                    name,
                })
            );
        },
        [activeRepo, gitflowFeatureFinish, runTrackedOperation]
    );

    const handleGitFlowReleaseStart = useCallback(
        async (name: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Starting release ${name}`, () =>
                gitflowReleaseStart.mutateAsync({
                    repo: activeRepo,
                    name,
                })
            );
        },
        [activeRepo, gitflowReleaseStart, runTrackedOperation]
    );

    const handleGitFlowReleaseFinish = useCallback(
        async (name: string, tag?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Finishing release ${name}`, () =>
                gitflowReleaseFinish.mutateAsync({
                    repo: activeRepo,
                    name,
                    tag,
                })
            );
        },
        [activeRepo, gitflowReleaseFinish, runTrackedOperation]
    );

    const handleGitFlowHotfixStart = useCallback(
        async (name: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Starting hotfix ${name}`, () =>
                gitflowHotfixStart.mutateAsync({
                    repo: activeRepo,
                    name,
                })
            );
        },
        [activeRepo, gitflowHotfixStart, runTrackedOperation]
    );

    const handleGitFlowHotfixFinish = useCallback(
        async (name: string, tag?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Finishing hotfix ${name}`, () =>
                gitflowHotfixFinish.mutateAsync({
                    repo: activeRepo,
                    name,
                    tag,
                })
            );
        },
        [activeRepo, gitflowHotfixFinish, runTrackedOperation]
    );

    const handleRemoteAdd = useCallback(
        async (name: string, url: string, pushUrl?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Adding remote ${name}`, () =>
                remoteAdd.mutateAsync({
                    repo: activeRepo,
                    name,
                    url,
                    pushUrl,
                })
            );
        },
        [activeRepo, remoteAdd, runTrackedOperation]
    );

    const handleRemoteRemove = useCallback(
        async (name: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Removing remote ${name}`, () =>
                remoteRemove.mutateAsync({
                    repo: activeRepo,
                    name,
                })
            );
        },
        [activeRepo, remoteRemove, runTrackedOperation]
    );

    const handleRemoteUpdate = useCallback(
        async (name: string, url: string, pushUrl?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Updating remote ${name}`, () =>
                remoteUpdate.mutateAsync({
                    repo: activeRepo,
                    name,
                    url,
                    pushUrl,
                })
            );
        },
        [activeRepo, remoteUpdate, runTrackedOperation]
    );

    const handleWorktreeCreate = useCallback(
        async (path: string, branch?: string, commit?: string) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Creating worktree ${path.split('/').pop() ?? path}`, () =>
                worktreeCreate.mutateAsync({
                    repo: activeRepo,
                    path,
                    branch,
                    commit,
                })
            );
        },
        [activeRepo, runTrackedOperation, worktreeCreate]
    );

    const handleWorktreeRemove = useCallback(
        async (path: string, force?: boolean) => {
            if (!activeRepo) return { error: 'No active repository' };
            return runTrackedOperation(`Removing worktree ${path.split('/').pop() ?? path}`, () =>
                worktreeRemove.mutateAsync({
                    repo: activeRepo,
                    path,
                    force,
                })
            );
        },
        [activeRepo, runTrackedOperation, worktreeRemove]
    );

    const handleCopyToClipboard = useCallback(
        async (text: string) => {
            return copyToClipboard.mutateAsync({ text });
        },
        [copyToClipboard]
    );

    return {
        // State
        activeRepo,
        currentOperationLabel: operationLabel,
        isLoading:
            createBranch.isPending ||
            deleteBranch.isPending ||
            checkout.isPending ||
            reset.isPending ||
            fetch.isPending ||
            pull.isPending ||
            push.isPending ||
            createTag.isPending ||
            deleteTag.isPending ||
            merge.isPending ||
            rebase.isPending ||
            cherryPick.isPending ||
            revert.isPending ||
            commit.isPending ||
            stage.isPending ||
            unstage.isPending ||
            stashPush.isPending ||
            stashPop.isPending ||
            stashApply.isPending ||
            stashDrop.isPending ||
            undoLastCommit.isPending ||
            submoduleAdd.isPending ||
            submoduleUpdate.isPending ||
            submoduleRemove.isPending ||
            gitflowFeatureStart.isPending ||
            gitflowFeatureFinish.isPending ||
            gitflowReleaseStart.isPending ||
            gitflowReleaseFinish.isPending ||
            gitflowHotfixStart.isPending ||
            gitflowHotfixFinish.isPending ||
            remoteAdd.isPending ||
            remoteRemove.isPending ||
            remoteUpdate.isPending ||
            worktreeCreate.isPending ||
            worktreeRemove.isPending,

        // Operations
        createBranch: handleCreateBranch,
        deleteBranch: handleDeleteBranch,
        checkout: handleCheckout,
        reset: handleReset,
        fetch: handleFetch,
        pull: handlePull,
        push: handlePush,
        createTag: handleCreateTag,
        deleteTag: handleDeleteTag,
        merge: handleMerge,
        rebase: handleRebase,
        cherryPick: handleCherryPick,
        revert: handleRevert,
        commit: handleCommit,
        stage: handleStage,
        unstage: handleUnstage,
        stashPush: handleStashPush,
        stashPop: handleStashPop,
        stashApply: handleStashApply,
        stashDrop: handleStashDrop,
        undoLastCommit: handleUndoLastCommit,
        submoduleAdd: handleSubmoduleAdd,
        submoduleUpdate: handleSubmoduleUpdate,
        submoduleRemove: handleSubmoduleRemove,
        gitFlowFeatureStart: handleGitFlowFeatureStart,
        gitFlowFeatureFinish: handleGitFlowFeatureFinish,
        gitFlowReleaseStart: handleGitFlowReleaseStart,
        gitFlowReleaseFinish: handleGitFlowReleaseFinish,
        gitFlowHotfixStart: handleGitFlowHotfixStart,
        gitFlowHotfixFinish: handleGitFlowHotfixFinish,
        remoteAdd: handleRemoteAdd,
        remoteRemove: handleRemoteRemove,
        remoteUpdate: handleRemoteUpdate,
        worktreeCreate: handleWorktreeCreate,
        worktreeRemove: handleWorktreeRemove,
        copyToClipboard: handleCopyToClipboard,
    };
}

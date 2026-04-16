import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/client';

import type { ActionPreview } from '@/components/action-preview';
import type { ReactNode } from 'react';

interface CommitActionCommit {
    hash: string;
    author: string;
    date: number;
    message: string;
}

interface GitOperationControls {
    createBranch: (commitHash: string, branchName: string, checkout?: boolean) => void;
    createTag: (commitHash: string, name: string, message?: string) => void;
    reset: (commitHash: string, mode: 'soft' | 'mixed' | 'hard') => void;
    merge: (branchName: string, options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => void;
    rebase: (onto: string, interactive?: boolean, todoContent?: string) => Promise<unknown> | void;
    cherryPick: (commitHash: string, noCommit?: boolean) => void;
    revert: (commitHash: string, noCommit?: boolean) => void;
}

interface ActionPreviewController {
    showPreview: (preview: ActionPreview, onConfirm: () => void) => void;
    Dialog: ReactNode;
}

interface UseGitGraphCommitActionsOptions {
    activeRepo: string | null;
    commits: CommitActionCommit[] | undefined;
    currentHead: string;
    gitOps: GitOperationControls;
    actionPreview: ActionPreviewController;
    onRefreshAll: () => void;
}

export function useGitGraphCommitActions({
    activeRepo,
    commits,
    currentHead,
    gitOps,
    actionPreview,
    onRefreshAll,
}: UseGitGraphCommitActionsOptions) {
    const gitUtils = trpc.useUtils();
    const [createBranchOpen, setCreateBranchOpen] = useState(false);
    const [addTagOpen, setAddTagOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [rebaseOpen, setRebaseOpen] = useState(false);
    const [cherryPickOpen, setCherryPickOpen] = useState(false);
    const [revertOpen, setRevertOpen] = useState(false);
    const [interactiveRebaseOpen, setInteractiveRebaseOpen] = useState(false);
    const [targetCommit, setTargetCommit] = useState('');
    const [targetBranch, setTargetBranch] = useState('');

    const selectedCommitData = useMemo(() => {
        if (!targetCommit || !commits) {
            return null;
        }
        return commits.find((commit) => commit.hash === targetCommit) ?? null;
    }, [commits, targetCommit]);

    const interactiveRebaseCommits = useMemo(() => {
        if (!targetCommit || !commits?.length) {
            return [];
        }
        const targetIndex = commits.findIndex((commit) => commit.hash === targetCommit);
        if (targetIndex < 0) {
            return [];
        }
        return commits.slice(0, targetIndex);
    }, [commits, targetCommit]);

    const openCreateBranch = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setCreateBranchOpen(true);
    }, []);

    const openCreateTag = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setAddTagOpen(true);
    }, []);

    const openReset = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setResetOpen(true);
    }, []);

    const openMerge = useCallback((branchName: string) => {
        setTargetBranch(branchName);
        setMergeOpen(true);
    }, []);

    const openRebase = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setRebaseOpen(true);
    }, []);

    const openCherryPick = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setCherryPickOpen(true);
    }, []);

    const openRevert = useCallback((commitHash: string) => {
        setTargetCommit(commitHash);
        setRevertOpen(true);
    }, []);

    const handlePreviewedReset = useCallback(
        async (mode: 'soft' | 'mixed' | 'hard') => {
            if (!activeRepo) {
                return;
            }

            const targetIndex = commits?.findIndex((commit) => commit.hash === targetCommit) ?? -1;
            const commitDelta = targetIndex >= 0 ? targetIndex + 1 : undefined;
            const stats = await gitUtils.git.diffStats.fetch({
                repo: activeRepo,
                from: 'HEAD',
                to: targetCommit,
            });
            const fileCount = stats?.stats?.files ?? undefined;

            const modeRisk =
                mode === 'hard'
                    ? 'Hard reset will discard uncommitted changes in tracked files.'
                    : mode === 'mixed'
                      ? 'Mixed reset will unstage changes in your working tree.'
                      : 'Soft reset keeps all changes staged but rewrites commit history.';

            const preview: ActionPreview = {
                type: 'reset',
                title: `Reset ${mode} to ${targetCommit.slice(0, 7)}`,
                description: 'Reset the current branch pointer to a selected commit.',
                willChange: {
                    ...(commitDelta !== undefined ? { commits: commitDelta } : {}),
                    ...(fileCount !== undefined ? { files: fileCount } : {}),
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: [modeRisk, 'Collaborators may need to sync manually if this branch is shared.'],
                undoAvailable: true,
                gitCommands: [`git reset --${mode} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                gitOps.reset(targetCommit, mode);
                setResetOpen(false);
            });
        },
        [activeRepo, actionPreview, commits, currentHead, gitOps, gitUtils.git.diffStats, targetCommit]
    );

    const handlePreviewedMerge = useCallback(
        async (options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => {
            if (!activeRepo) {
                return;
            }

            const previewResult = await gitUtils.git.mergePreview.fetch({
                repo: activeRepo,
                source: targetBranch,
                target: currentHead,
            });
            if (previewResult && 'error' in previewResult && previewResult.error) {
                toast.error('Unable to preview merge', {
                    description: previewResult.error,
                });
                return;
            }

            const mergePreviewData =
                previewResult && 'aheadCommits' in previewResult && 'files' in previewResult ? previewResult : null;
            const previewConflicts =
                mergePreviewData && 'conflicts' in mergePreviewData && Array.isArray(mergePreviewData.conflicts)
                    ? mergePreviewData.conflicts
                    : [];

            const preview: ActionPreview = {
                type: options.squash ? 'squash' : 'merge',
                title: `Merge ${targetBranch} into ${currentHead}`,
                description: 'Review merge impact before applying it.',
                willChange: {
                    commits: mergePreviewData?.aheadCommits?.length ?? 0,
                    files: mergePreviewData?.files?.length ?? 0,
                    branches: [targetBranch, currentHead],
                },
                risks: [
                    ...(previewConflicts.length ? [`${previewConflicts.length} conflict file(s) likely.`] : []),
                    ...(options.squash ? ['Squash merge combines all commits into one.'] : []),
                    ...(options.noCommit ? ['No-commit mode stages changes without creating a commit.'] : []),
                ],
                undoAvailable: true,
                gitCommands: [
                    `git merge${options.noFastForward ? ' --no-ff' : ''}${options.squash ? ' --squash' : ''}${options.noCommit ? ' --no-commit' : ''} ${targetBranch}`,
                ],
            };

            actionPreview.showPreview(preview, () => {
                gitOps.merge(targetBranch, options);
                setMergeOpen(false);
            });
        },
        [activeRepo, actionPreview, currentHead, gitOps, gitUtils.git.mergePreview, targetBranch]
    );

    const handlePreviewedRebase = useCallback(
        async (interactive: boolean) => {
            if (!activeRepo) {
                return;
            }

            if (interactive) {
                setRebaseOpen(false);
                setInteractiveRebaseOpen(true);
                return;
            }

            const previewResult = await gitUtils.git.rebasePreview.fetch({
                repo: activeRepo,
                branch: currentHead,
                onto: targetCommit,
            });
            if ('error' in previewResult && previewResult.error) {
                toast.error('Unable to preview rebase', {
                    description: previewResult.error,
                });
                return;
            }

            const preview: ActionPreview = {
                type: 'rebase',
                title: `Rebase ${currentHead} onto ${targetCommit.slice(0, 7)}`,
                description: 'This rewrites commit hashes for rebased commits.',
                willChange: {
                    commits: previewResult?.commits?.length ?? 0,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: [...(previewResult?.warnings ?? []), 'Rebase can require conflict resolution commit-by-commit.'],
                undoAvailable: true,
                gitCommands: [`git rebase ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.rebase(targetCommit, false);
                setRebaseOpen(false);
            });
        },
        [activeRepo, actionPreview, currentHead, gitOps, gitUtils.git.rebasePreview, targetCommit]
    );

    const handlePreviewedCherryPick = useCallback(
        (noCommit: boolean) => {
            const pickedCommit = commits?.find((commit) => commit.hash === targetCommit);
            const preview: ActionPreview = {
                type: 'cherry-pick',
                title: `Cherry-pick ${targetCommit.slice(0, 7)}`,
                description: pickedCommit?.message ?? 'Apply a commit from another branch onto the current branch.',
                willChange: {
                    commits: noCommit ? 0 : 1,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: ['Cherry-pick may produce conflicts if code has diverged.'],
                undoAvailable: true,
                gitCommands: [`git cherry-pick${noCommit ? ' --no-commit' : ''} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                gitOps.cherryPick(targetCommit, noCommit);
                setCherryPickOpen(false);
            });
        },
        [actionPreview, commits, currentHead, gitOps, targetCommit]
    );

    const handlePreviewedRevert = useCallback(
        (noCommit: boolean) => {
            const revertedCommit = commits?.find((commit) => commit.hash === targetCommit);
            const preview: ActionPreview = {
                type: 'revert',
                title: `Revert ${targetCommit.slice(0, 7)}`,
                description: revertedCommit?.message ?? 'Create a new commit that reverts a previous commit.',
                willChange: {
                    commits: noCommit ? 0 : 1,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: ['Reverting can conflict if dependent commits were added later.'],
                undoAvailable: true,
                gitCommands: [`git revert${noCommit ? ' --no-commit' : ''} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                gitOps.revert(targetCommit, noCommit);
                setRevertOpen(false);
            });
        },
        [actionPreview, commits, currentHead, gitOps, targetCommit]
    );

    return {
        targetCommit,
        targetBranch,
        setTargetCommit,
        setTargetBranch,
        selectedCommitData,
        interactiveRebaseCommits,
        createBranchOpen,
        setCreateBranchOpen,
        addTagOpen,
        setAddTagOpen,
        resetOpen,
        setResetOpen,
        mergeOpen,
        setMergeOpen,
        rebaseOpen,
        setRebaseOpen,
        cherryPickOpen,
        setCherryPickOpen,
        revertOpen,
        setRevertOpen,
        interactiveRebaseOpen,
        setInteractiveRebaseOpen,
        openCreateBranch,
        openCreateTag,
        openReset,
        openMerge,
        openRebase,
        openCherryPick,
        openRevert,
        handlePreviewedReset,
        handlePreviewedMerge,
        handlePreviewedRebase,
        handlePreviewedCherryPick,
        handlePreviewedRevert,
        handleInteractiveRebaseComplete: onRefreshAll,
        actionPreviewDialog: actionPreview.Dialog,
    };
}

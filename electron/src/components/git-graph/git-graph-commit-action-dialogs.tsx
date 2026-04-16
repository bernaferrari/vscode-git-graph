import { lazy, Suspense } from 'react';

import { DialogLoadingFallback } from './git-graph-feature-dialogs';

import type { ReactNode } from 'react';


const InteractiveRebase = lazy(() =>
    import('./interactive-rebase').then((mod) => ({ default: mod.InteractiveRebase }))
);
const CreateBranchDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.CreateBranchDialog })));
const AddTagDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.AddTagDialog })));
const ResetDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.ResetDialog })));
const MergeDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.MergeDialog })));
const RebaseDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.RebaseDialog })));
const CherryPickDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.CherryPickDialog })));
const RevertDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.RevertDialog })));

interface CommitActionCommit {
    hash: string;
    message: string;
    author: string;
    date: number;
}

interface GitGraphCommitActionDialogsProps {
    createBranchOpen: boolean;
    onCreateBranchOpenChange: (open: boolean) => void;
    onCreateBranch: (name: string, checkout: boolean) => void;
    addTagOpen: boolean;
    onAddTagOpenChange: (open: boolean) => void;
    onAddTag: (name: string, type: 'annotated' | 'lightweight', push: boolean) => void;
    resetOpen: boolean;
    onResetOpenChange: (open: boolean) => void;
    onReset: (mode: 'soft' | 'mixed' | 'hard') => void;
    mergeOpen: boolean;
    onMergeOpenChange: (open: boolean) => void;
    onMerge: (options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => void;
    rebaseOpen: boolean;
    onRebaseOpenChange: (open: boolean) => void;
    onRebase: (interactive: boolean) => void;
    cherryPickOpen: boolean;
    onCherryPickOpenChange: (open: boolean) => void;
    onCherryPick: (noCommit: boolean) => void;
    revertOpen: boolean;
    onRevertOpenChange: (open: boolean) => void;
    onRevert: (noCommit: boolean) => void;
    interactiveRebaseOpen: boolean;
    onInteractiveRebaseOpenChange: (open: boolean) => void;
    targetCommit: string;
    targetBranch: string;
    interactiveRebaseCommits: CommitActionCommit[];
    onInteractiveRebaseComplete: () => void;
    actionPreviewDialog: ReactNode;
}

export function GitGraphCommitActionDialogs({
    createBranchOpen,
    onCreateBranchOpenChange,
    onCreateBranch,
    addTagOpen,
    onAddTagOpenChange,
    onAddTag,
    resetOpen,
    onResetOpenChange,
    onReset,
    mergeOpen,
    onMergeOpenChange,
    onMerge,
    rebaseOpen,
    onRebaseOpenChange,
    onRebase,
    cherryPickOpen,
    onCherryPickOpenChange,
    onCherryPick,
    revertOpen,
    onRevertOpenChange,
    onRevert,
    interactiveRebaseOpen,
    onInteractiveRebaseOpenChange,
    targetCommit,
    targetBranch,
    interactiveRebaseCommits,
    onInteractiveRebaseComplete,
    actionPreviewDialog,
}: GitGraphCommitActionDialogsProps) {
    return (
        <>
            {createBranchOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CreateBranchDialog
                        open={createBranchOpen}
                        onOpenChange={onCreateBranchOpenChange}
                        onCreate={onCreateBranch}
                        targetCommit={targetCommit}
                    />
                </Suspense>
            )}

            {addTagOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <AddTagDialog
                        open={addTagOpen}
                        onOpenChange={onAddTagOpenChange}
                        onAdd={onAddTag}
                        targetCommit={targetCommit}
                    />
                </Suspense>
            )}

            {resetOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <ResetDialog
                        open={resetOpen}
                        onOpenChange={onResetOpenChange}
                        onReset={onReset}
                        targetCommit={targetCommit}
                    />
                </Suspense>
            )}

            {mergeOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <MergeDialog
                        open={mergeOpen}
                        onOpenChange={onMergeOpenChange}
                        onMerge={onMerge}
                        branchName={targetBranch}
                    />
                </Suspense>
            )}

            {rebaseOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <RebaseDialog
                        open={rebaseOpen}
                        onOpenChange={onRebaseOpenChange}
                        onRebase={onRebase}
                        onto={targetCommit}
                    />
                </Suspense>
            )}

            {cherryPickOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CherryPickDialog
                        open={cherryPickOpen}
                        onOpenChange={onCherryPickOpenChange}
                        onCherryPick={onCherryPick}
                        commitHash={targetCommit}
                    />
                </Suspense>
            )}

            {revertOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <RevertDialog
                        open={revertOpen}
                        onOpenChange={onRevertOpenChange}
                        onRevert={onRevert}
                        commitHash={targetCommit}
                    />
                </Suspense>
            )}

            {actionPreviewDialog}

            {interactiveRebaseOpen && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <InteractiveRebase
                        open={interactiveRebaseOpen}
                        onOpenChange={onInteractiveRebaseOpenChange}
                        baseCommit={targetCommit}
                        commits={interactiveRebaseCommits}
                        onComplete={onInteractiveRebaseComplete}
                    />
                </Suspense>
            )}
        </>
    );
}

export default GitGraphCommitActionDialogs;

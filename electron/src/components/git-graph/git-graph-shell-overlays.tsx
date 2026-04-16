import { lazy, Suspense } from 'react';

import { DialogLoadingFallback } from './git-graph-feature-dialogs';

import type { Dispatch, SetStateAction } from 'react';


const Statistics = lazy(() => import('./statistics').then((mod) => ({ default: mod.Statistics })));
const MergeConflictEditor = lazy(() =>
    import('./merge-conflict-editor').then((mod) => ({ default: mod.MergeConflictEditor }))
);
const RemoteManageDialog = lazy(() =>
    import('./remote-manage-dialog').then((mod) => ({ default: mod.RemoteManageDialog }))
);
const BranchCompare = lazy(() => import('./branch-compare').then((mod) => ({ default: mod.BranchCompare })));
const HooksManageDialog = lazy(() =>
    import('./hooks-manage-dialog').then((mod) => ({ default: mod.HooksManageDialog }))
);
const TerminalPanel = lazy(() => import('./terminal-panel').then((mod) => ({ default: mod.TerminalPanel })));
const VisualRebaseTodoEditor = lazy(() =>
    import('./visual-rebase-todo').then((mod) => ({ default: mod.VisualRebaseTodoEditor }))
);
const CommitSigningDialog = lazy(() =>
    import('./commit-signing-dialog').then((mod) => ({ default: mod.CommitSigningDialog }))
);
const FuzzyFinder = lazy(() => import('./fuzzy-finder').then((mod) => ({ default: mod.FuzzyFinder })));

interface OpenState {
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>> | ((open: boolean) => void);
}

interface ConflictFileState {
    path: string;
    ours: string;
    theirs: string;
    base?: string;
}

export function GitGraphShellOverlays({
    fuzzyFinder,
    statistics,
    remoteManage,
    branchCompare,
    hooksManage,
    mergeConflict,
    terminal,
    commitSigning,
    rebaseTodo,
}: {
    fuzzyFinder: OpenState;
    statistics: { open: boolean; onClose: () => void };
    remoteManage: OpenState;
    branchCompare: OpenState & { branches: string[]; initialFrom: string };
    hooksManage: OpenState;
    mergeConflict: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        conflict: ConflictFileState | null;
        onResolve: (path: string, content: string) => void;
    };
    terminal: OpenState & { cwd?: string };
    commitSigning: OpenState;
    rebaseTodo: OpenState;
}) {
    return (
        <>
            {fuzzyFinder.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <FuzzyFinder open={fuzzyFinder.open} onOpenChange={fuzzyFinder.onOpenChange} />
                </Suspense>
            )}
            {statistics.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <Statistics open={statistics.open} onClose={statistics.onClose} />
                </Suspense>
            )}
            {remoteManage.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <RemoteManageDialog open={remoteManage.open} onOpenChange={remoteManage.onOpenChange} />
                </Suspense>
            )}
            {branchCompare.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <BranchCompare
                        open={branchCompare.open}
                        onOpenChange={branchCompare.onOpenChange}
                        branches={branchCompare.branches}
                        initialFrom={branchCompare.initialFrom}
                    />
                </Suspense>
            )}
            {hooksManage.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <HooksManageDialog open={hooksManage.open} onOpenChange={hooksManage.onOpenChange} />
                </Suspense>
            )}
            {mergeConflict.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <MergeConflictEditor
                        open={mergeConflict.open}
                        onOpenChange={mergeConflict.onOpenChange}
                        conflict={mergeConflict.conflict}
                        onResolve={mergeConflict.onResolve}
                    />
                </Suspense>
            )}
            {terminal.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <TerminalPanel
                        open={terminal.open}
                        onOpenChange={terminal.onOpenChange}
                        {...(terminal.cwd ? { cwd: terminal.cwd } : {})}
                    />
                </Suspense>
            )}
            {commitSigning.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CommitSigningDialog open={commitSigning.open} onOpenChange={commitSigning.onOpenChange} />
                </Suspense>
            )}
            {rebaseTodo.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <VisualRebaseTodoEditor open={rebaseTodo.open} onOpenChange={rebaseTodo.onOpenChange} />
                </Suspense>
            )}
        </>
    );
}

export default GitGraphShellOverlays;

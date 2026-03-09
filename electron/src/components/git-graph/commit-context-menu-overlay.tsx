import { lazy, Suspense } from 'react';

const CommitContextMenu = lazy(() =>
    import('./commit-context-menu').then((mod) => ({ default: mod.CommitContextMenu }))
);

function DialogLoadingFallback() {
    return <div className='ui-surface text-muted-foreground px-3 py-2 text-xs'>Loading menu...</div>;
}

interface SelectedCommitSummary {
    hash: string;
    message: string;
    author: string;
}

export function CommitContextMenuOverlay({
    open,
    position,
    selectedCommit,
    onClose,
    onCreateBranch,
    onCreateTag,
    onMerge,
    onRebase,
    onCherryPick,
    onRevert,
}: {
    open: boolean;
    position: { x: number; y: number };
    selectedCommit: SelectedCommitSummary | null;
    onClose: () => void;
    onCreateBranch: () => void;
    onCreateTag: () => void;
    onMerge: () => void;
    onRebase: () => void;
    onCherryPick: () => void;
    onRevert: () => void;
}) {
    if (!open || !selectedCommit) {
        return null;
    }

    return (
        <div className='fixed inset-0 z-50' onClick={onClose} onContextMenu={onClose}>
            <div className='fixed z-50' style={{ left: position.x, top: position.y }}>
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CommitContextMenu
                        commit={selectedCommit}
                        onCreateBranch={onCreateBranch}
                        onCreateTag={onCreateTag}
                        onMerge={onMerge}
                        onRebase={onRebase}
                        onCherryPick={onCherryPick}
                        onRevert={onRevert}>
                        <div />
                    </CommitContextMenu>
                </Suspense>
            </div>
        </div>
    );
}

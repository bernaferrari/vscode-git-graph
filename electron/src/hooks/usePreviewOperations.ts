/**
 * Preview Operations Hook
 * Provides access to merge/rebase previews and operation history
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface MutationErrorShape {
    message: string;
}

interface UndoOperationResult {
    success: boolean;
    error?: string | null;
}

export function usePreviewOperations() {
    const { activeRepo } = useAppStore();
    const utils = trpc.useUtils();

    // Merge preview query
    const mergePreview = trpc.git.mergePreview.useQuery(
        { repo: activeRepo ?? '', source: '', target: '' },
        { enabled: false }
    );

    // Rebase preview query
    const rebasePreview = trpc.git.rebasePreview.useQuery(
        { repo: activeRepo ?? '', branch: '', onto: '' },
        { enabled: false }
    );

    // Range diff query
    const rangeDiff = trpc.git.rangeDiff.useQuery(
        { repo: activeRepo ?? '', range1: '', range2: '' },
        { enabled: false }
    );

    // Operation history query
    const operationHistory = trpc.git.operationHistory.useQuery(
        { repo: activeRepo ?? '', limit: 20 },
        { enabled: !!activeRepo }
    );

    // Diff stats query
    const diffStats = trpc.git.diffStats.useQuery({ repo: activeRepo ?? '', from: '', to: '' }, { enabled: false });

    // Ahead/behind query
    const aheadBehind = trpc.git.aheadBehind.useQuery({ repo: activeRepo ?? '', branch: '' }, { enabled: false });

    // Potentially affected branches
    const affectedBranches = trpc.git.potentiallyAffectedBranches.useQuery(
        { repo: activeRepo ?? '', sourceBranch: '', targetBranch: '' },
        { enabled: false }
    );

    // Undo operation mutation
    const undoOperation = trpc.git.undoOperation.useMutation({
        onSuccess: (result: UndoOperationResult) => {
            if (result.success) {
                toast.success('Operation undone');
            } else {
                toast.error('Failed to undo operation', { description: result.error || 'Unknown error' });
            }
        },
        onError: (error: MutationErrorShape) => {
            toast.error('Undo failed', { description: error.message });
        },
    });

    // Helper functions
    const previewMerge = useCallback(
        async (source: string, target: string) => {
            if (!activeRepo) return null;
            return await utils.git.mergePreview.fetch({ repo: activeRepo, source, target });
        },
        [activeRepo, utils.git.mergePreview]
    );

    const previewRebase = useCallback(
        async (branch: string, onto: string) => {
            if (!activeRepo) return null;
            return await utils.git.rebasePreview.fetch({ repo: activeRepo, branch, onto });
        },
        [activeRepo, utils.git.rebasePreview]
    );

    const compareRanges = useCallback(
        async (range1: string, range2: string) => {
            if (!activeRepo) return null;
            return await utils.git.rangeDiff.fetch({ repo: activeRepo, range1, range2 });
        },
        [activeRepo, utils.git.rangeDiff]
    );

    const undoByRef = useCallback(
        async (ref: string, targetHash: string) => {
            if (!activeRepo) return;
            await undoOperation.mutateAsync({ repo: activeRepo, ref, targetHash });
        },
        [activeRepo, undoOperation]
    );

    return {
        // Queries
        mergePreview,
        rebasePreview,
        rangeDiff,
        operationHistory,
        diffStats,
        aheadBehind,
        affectedBranches,

        // Mutations
        undoOperation,

        // Helpers
        previewMerge,
        previewRebase,
        compareRanges,
        undoByRef,
    };
}

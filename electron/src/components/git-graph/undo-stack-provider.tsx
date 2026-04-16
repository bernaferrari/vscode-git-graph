import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

export type GitOperationType =
    | 'commit'
    | 'amend'
    | 'branch_create'
    | 'branch_delete'
    | 'branch_rename'
    | 'checkout'
    | 'merge'
    | 'rebase'
    | 'cherry_pick'
    | 'revert'
    | 'reset'
    | 'stash_push'
    | 'stash_pop'
    | 'stash_drop'
    | 'tag_create'
    | 'tag_delete'
    | 'push'
    | 'pull'
    | 'fetch'
    | 'remote_add'
    | 'remote_remove'
    | 'clean'
    | 'stage'
    | 'unstage';

export interface GitOperation {
    id: string;
    type: GitOperationType;
    timestamp: number;
    description: string;
    details: Record<string, unknown>;
    undoable: boolean;
    undone?: boolean;
    reflogEntry?: string;
}

interface UndoStackContextType {
    operations: GitOperation[];
    canUndo: boolean;
    canRedo: boolean;
    isUndoing: boolean;
    pushOperation: (operation: Omit<GitOperation, 'id' | 'timestamp'>) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    undoOperation: (operationId: string) => Promise<void>;
    clearHistory: () => void;
    currentIndex: number;
}

const UndoStackContext = createContext<UndoStackContextType | null>(null);

function isSupportedUndoOperation(operation: GitOperation): boolean {
    if (!operation.undoable || operation.undone) {
        return false;
    }

    switch (operation.type) {
        case 'commit':
        case 'amend':
        case 'branch_create':
        case 'checkout':
        case 'stash_push':
            return true;
        default:
            return false;
    }
}

function getCompatMutation<TInput extends Record<string, unknown>, TResult extends { error?: string | null }>(
    hookFactory: (() => { mutateAsync?: (input: TInput) => Promise<TResult> }) | undefined,
    legacyMutation?: { mutate?: (input: TInput) => TResult | Promise<TResult> }
): { mutateAsync: (input: TInput) => Promise<TResult> } {
    const hooked = hookFactory?.();
    if (hooked?.mutateAsync) {
        return { mutateAsync: hooked.mutateAsync };
    }

    return {
        mutateAsync: async (input: TInput) => {
            const result = await legacyMutation?.mutate?.(input);
            return (result ?? ({ error: null } as TResult)) as TResult;
        },
    };
}

export function UndoStackProvider({ children }: { children: ReactNode }) {
    const { activeRepo } = useAppStore();
    const [operations, setOperations] = useState<GitOperation[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isUndoing, setIsUndoing] = useState(false);
    const lastHydratedSnapshotRef = useRef<string | null>(null);
    const utils = trpc.useUtils();
    const undoHistoryQuery = trpc.repo.undoHistory.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: Boolean(activeRepo), staleTime: 10_000 }
    );
    const setUndoHistoryMutation = trpc.repo.setUndoHistory.useMutation({
        onSuccess: async () => {
            if (!activeRepo) {
                return;
            }
            await utils.repo.undoHistory.invalidate({ repo: activeRepo });
        },
    });
    const undoLastCommitMutation = getCompatMutation(
        trpc.git.undoLastCommit?.useMutation,
        trpc.git.undoLastCommit as { mutate?: (input: { repo: string; soft: boolean }) => Promise<{ error?: string | null }> }
    );
    const deleteBranchMutation = getCompatMutation(
        trpc.git.deleteBranch?.useMutation,
        trpc.git.deleteBranch as {
            mutate?: (input: { repo: string; branchName: string; force: boolean }) => Promise<{ error?: string | null }>;
        }
    );
    const checkoutMutation = getCompatMutation(
        trpc.git.checkout?.useMutation,
        trpc.git.checkout as { mutate?: (input: { repo: string; ref: string }) => Promise<{ error?: string | null }> }
    );
    const stashDropMutation = getCompatMutation(
        trpc.git.stashDrop?.useMutation,
        trpc.git.stashDrop as { mutate?: (input: { repo: string; index: number }) => Promise<{ error?: string | null }> }
    );

    useEffect(() => {
        if (!activeRepo) {
            setOperations([]);
            setCurrentIndex(-1);
            lastHydratedSnapshotRef.current = null;
            return;
        }

        const history = undoHistoryQuery.data?.history;
        if (!history) {
            setOperations([]);
            setCurrentIndex(-1);
            return;
        }

        const nextOperations = history.operations ?? [];
        const nextCurrentIndex = history.currentIndex ?? -1;
        lastHydratedSnapshotRef.current = JSON.stringify({
            operations: nextOperations,
            currentIndex: nextCurrentIndex,
        });
        setOperations(nextOperations);
        setCurrentIndex(nextCurrentIndex);
    }, [activeRepo, undoHistoryQuery.data?.history]);

    useEffect(() => {
        if (!activeRepo) {
            return;
        }

        const snapshot = JSON.stringify({ operations, currentIndex });
        if (lastHydratedSnapshotRef.current === null) {
            return;
        }
        if (snapshot === lastHydratedSnapshotRef.current) {
            return;
        }

        lastHydratedSnapshotRef.current = snapshot;
        setUndoHistoryMutation.mutate({
            repo: activeRepo,
            operations,
            currentIndex,
        });
    }, [activeRepo, currentIndex, operations, setUndoHistoryMutation]);

    const pushOperation = useCallback(
        (operation: Omit<GitOperation, 'id' | 'timestamp'>) => {
            const newOperation: GitOperation = {
                ...operation,
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
            };

            setOperations((prev) => {
                const trimmed = prev.slice(0, currentIndex + 1);
                return [...trimmed, newOperation];
            });
            setCurrentIndex((prev) => prev + 1);
        },
        [currentIndex]
    );

    const canUndo = currentIndex >= 0;
    const canRedo = currentIndex < operations.length - 1;

    const undoOperation = useCallback(
        async (operationId: string) => {
            if (!activeRepo) return;

            const operation = operations.find((op) => op.id === operationId);
            if (!operation || !isSupportedUndoOperation(operation)) {
                toast.error('This operation cannot be undone');
                return;
            }

            setIsUndoing(true);
            try {
                switch (operation.type) {
                    case 'commit':
                    case 'amend':
                        {
                            const result = await undoLastCommitMutation.mutateAsync({ repo: activeRepo, soft: true });
                            if (result.error) {
                                throw new Error(result.error);
                            }
                        }
                        break;
                    case 'branch_create':
                        {
                            const branchName = String(operation.details.branchName ?? '');
                            const result = await deleteBranchMutation.mutateAsync({
                                repo: activeRepo,
                                branchName,
                                force: true,
                            });
                            if (result.error) {
                                throw new Error(result.error);
                            }
                        }
                        break;
                    case 'checkout':
                        {
                            const previousBranch = String(operation.details.previousBranch ?? '');
                            if (!previousBranch) {
                                throw new Error('No previous branch recorded for this checkout.');
                            }
                            const result = await checkoutMutation.mutateAsync({
                                repo: activeRepo,
                                ref: previousBranch,
                            });
                            if (result.error) {
                                throw new Error(result.error);
                            }
                        }
                        break;
                    case 'stash_push':
                        {
                            const stashIndex = Number(operation.details.stashIndex);
                            if (!Number.isInteger(stashIndex) || stashIndex < 0) {
                                throw new Error('No stash index recorded for this stash operation.');
                            }
                            const result = await stashDropMutation.mutateAsync({
                                repo: activeRepo,
                                index: stashIndex,
                            });
                            if (result.error) {
                                throw new Error(result.error);
                            }
                        }
                        break;
                    default:
                        toast.error(`Undo is not supported for ${operation.type}`);
                        return;
                }

                setOperations((prev) => prev.map((op) => (op.id === operationId ? { ...op, undone: true } : op)));
                setCurrentIndex((prev) => prev - 1);
                toast.success(`Undone: ${operation.description}`);
            } catch (error) {
                toast.error('Failed to undo operation', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                setIsUndoing(false);
            }
        },
        [activeRepo, checkoutMutation, deleteBranchMutation, operations, stashDropMutation, undoLastCommitMutation]
    );

    const undo = useCallback(async () => {
        if (!canUndo) return;
        const operation = operations[currentIndex];
        if (operation) {
            await undoOperation(operation.id);
        }
    }, [canUndo, currentIndex, operations, undoOperation]);

    const redo = useCallback(async () => {
        if (!canRedo || !activeRepo) return;

        const operation = operations[currentIndex + 1];
        if (!operation) return;

        setIsUndoing(true);
        try {
            toast.info(`Redo: ${operation.description}`);
            setCurrentIndex((prev) => prev + 1);
        } catch {
            toast.error('Failed to redo operation');
        } finally {
            setIsUndoing(false);
        }
    }, [activeRepo, canRedo, currentIndex, operations]);

    const clearHistory = useCallback(() => {
        setOperations([]);
        setCurrentIndex(-1);
    }, []);

    return (
        <UndoStackContext.Provider
            value={{
                operations,
                canUndo,
                canRedo,
                isUndoing,
                pushOperation,
                undo,
                redo,
                undoOperation,
                clearHistory,
                currentIndex,
            }}>
            {children}
        </UndoStackContext.Provider>
    );
}

export function useUndoStack() {
    const context = useContext(UndoStackContext);
    if (!context) {
        throw new Error('useUndoStack must be used within UndoStackProvider');
    }
    return context;
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
    pushOperation: (operation: Omit<GitOperation, 'id' | 'timestamp'>) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    undoOperation: (operationId: string) => Promise<void>;
    clearHistory: () => void;
    currentIndex: number;
}

const UndoStackContext = createContext<UndoStackContextType | null>(null);
const STORAGE_KEY = 'git-graph-undo-stack';

export function UndoStackProvider({ children }: { children: ReactNode }) {
    const { activeRepo } = useAppStore();
    const [operations, setOperations] = useState<GitOperation[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isUndoing, setIsUndoing] = useState(false);

    useEffect(() => {
        if (!activeRepo) {
            setOperations([]);
            setCurrentIndex(-1);
            return;
        }

        const stored = localStorage.getItem(`${STORAGE_KEY}-${activeRepo}`);
        if (!stored) {
            setOperations([]);
            setCurrentIndex(-1);
            return;
        }

        try {
            const parsed = JSON.parse(stored) as { operations?: GitOperation[]; currentIndex?: number };
            setOperations(parsed.operations || []);
            setCurrentIndex(parsed.currentIndex ?? -1);
        } catch {
            setOperations([]);
            setCurrentIndex(-1);
        }
    }, [activeRepo]);

    useEffect(() => {
        if (!activeRepo) {
            return;
        }

        localStorage.setItem(`${STORAGE_KEY}-${activeRepo}`, JSON.stringify({ operations, currentIndex }));
    }, [activeRepo, currentIndex, operations]);

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
            if (!operation || !operation.undoable) {
                toast.error('This operation cannot be undone');
                return;
            }

            setIsUndoing(true);
            try {
                switch (operation.type) {
                    case 'commit':
                    case 'amend':
                        await trpc.git.reset.mutate({ repo: activeRepo, mode: 'soft', commit: 'HEAD~1' });
                        break;
                    case 'branch_create':
                        await trpc.git.deleteBranch.mutate({
                            repo: activeRepo,
                            branch: operation.details.branchName as string,
                        });
                        break;
                    case 'branch_delete':
                        if (operation.reflogEntry) {
                            await trpc.git.createBranch.mutate({
                                repo: activeRepo,
                                name: operation.details.branchName as string,
                                commitHash: operation.reflogEntry,
                            });
                        }
                        break;
                    case 'checkout':
                        await trpc.git.checkout.mutate({
                            repo: activeRepo,
                            branch: operation.details.previousBranch as string,
                        });
                        break;
                    case 'stash_push':
                        await trpc.git.stashDrop.mutate({
                            repo: activeRepo,
                            index: operation.details.stashIndex as number,
                        });
                        break;
                    case 'stash_pop':
                    case 'stash_drop':
                        toast.warning('Stash operations cannot be fully undone');
                        break;
                    case 'reset':
                        if (operation.reflogEntry) {
                            await trpc.git.reset.mutate({
                                repo: activeRepo,
                                mode: 'hard',
                                commit: operation.reflogEntry,
                            });
                        }
                        break;
                    default:
                        toast.info(`Undo for ${operation.type} uses reflog`);
                        if (operation.reflogEntry) {
                            await trpc.git.reset.mutate({
                                repo: activeRepo,
                                mode: 'mixed',
                                commit: operation.reflogEntry,
                            });
                        }
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
        [activeRepo, operations]
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

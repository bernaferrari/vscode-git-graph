/**
 * Operation Log / Timeline
 * Tracks Git operations and provides undo capabilities
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OperationType =
    | 'commit'
    | 'rebase'
    | 'merge'
    | 'cherry-pick'
    | 'revert'
    | 'reset'
    | 'checkout'
    | 'branch-create'
    | 'branch-delete'
    | 'branch-rename'
    | 'tag-create'
    | 'tag-delete'
    | 'stash'
    | 'push'
    | 'pull'
    | 'fetch'
    | 'force-push'
    | 'amend';

export interface OperationReceipt {
    id: string;
    type: OperationType;
    timestamp: number;
    description: string;
    details: string;
    gitCommands: string[];
    // For undo capability
    undoAction?: {
        type: string;
        command: string;
    };
    // Affected refs
    affectedBranches: string[];
    affectedCommits: string[];
    // Status
    status: 'success' | 'failed' | 'undone';
    error?: string;
}

interface OperationLogState {
    operations: OperationReceipt[];
    maxOperations: number;

    // Actions
    addOperation: (operation: Omit<OperationReceipt, 'id' | 'timestamp'>) => void;
    markAsUndone: (id: string) => void;
    markAsFailed: (id: string, error: string) => void;
    clearOperations: () => void;
    getRecentOperations: (count?: number) => OperationReceipt[];
}

export const useOperationLog = create<OperationLogState>()(
    persist(
        (set, get) => ({
            operations: [],
            maxOperations: 100,

            addOperation: (operation) => {
                const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const receipt: OperationReceipt = {
                    ...operation,
                    id,
                    timestamp: Date.now(),
                };

                set((state) => {
                    const newOperations = [receipt, ...state.operations];
                    // Keep only the last maxOperations
                    if (newOperations.length > state.maxOperations) {
                        newOperations.pop();
                    }
                    return { operations: newOperations };
                });

                return id;
            },

            markAsUndone: (id) => {
                set((state) => ({
                    operations: state.operations.map((op) => (op.id === id ? { ...op, status: 'undone' } : op)),
                }));
            },

            markAsFailed: (id, error) => {
                set((state) => ({
                    operations: state.operations.map((op) => (op.id === id ? { ...op, status: 'failed', error } : op)),
                }));
            },

            clearOperations: () => {
                set({ operations: [] });
            },

            getRecentOperations: (count = 10) => {
                return get().operations.slice(0, count);
            },
        }),
        {
            name: 'git-graph-operation-log',
        }
    )
);

// Helper to format operation for display
export function formatOperationDescription(receipt: OperationReceipt): string {
    switch (receipt.type) {
        case 'commit':
            return `Committed ${receipt.affectedCommits.length} change(s)`;
        case 'rebase':
            return `Rebased onto ${receipt.details}`;
        case 'merge':
            return `Merged ${receipt.details}`;
        case 'cherry-pick':
            return `Cherry-picked commit(s)`;
        case 'revert':
            return `Reverted commit(s)`;
        case 'reset':
            return `Reset to ${receipt.details}`;
        case 'checkout':
            return `Checked out "${receipt.details}"`;
        case 'branch-create':
            return `Created branch "${receipt.details}"`;
        case 'branch-delete':
            return `Deleted branch "${receipt.details}"`;
        case 'branch-rename':
            return `Renamed branch to "${receipt.details}"`;
        case 'tag-create':
            return `Created tag "${receipt.details}"`;
        case 'tag-delete':
            return `Deleted tag "${receipt.details}"`;
        case 'stash':
            return `Stashed changes`;
        case 'push':
            return `Pushed to remote`;
        case 'pull':
            return `Pulled from remote`;
        case 'fetch':
            return `Fetched from remote`;
        case 'force-push':
            return `Force pushed to remote`;
        case 'amend':
            return `Amended last commit`;
        default:
            return receipt.description;
    }
}

// Helper to get status color
export function getOperationStatusColor(status: OperationReceipt['status']): string {
    switch (status) {
        case 'success':
            return 'text-green-500';
        case 'failed':
            return 'text-red-500';
        case 'undone':
            return 'text-muted-foreground line-through';
        default:
            return '';
    }
}

/**
 * Undo Stack Tests
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line import/order
import { useAppStore } from '@/lib/store';

// eslint-disable-next-line @typescript-eslint/require-await
const invalidateUndoHistory = vi.fn(async () => undefined);
const mutateUndoHistory = vi.fn();
let undoHistoryData:
    | {
          history: {
              operations: Array<{
                  id: string;
                  type: string;
                  timestamp: number;
                  description: string;
                  details: Record<string, unknown>;
                  undoable: boolean;
              }>;
              currentIndex: number;
          };
      }
    | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            repo: {
                undoHistory: {
                    invalidate: invalidateUndoHistory,
                },
            },
        }),
        repo: {
            undoHistory: {
                useQuery: () => ({ data: undoHistoryData }),
            },
            setUndoHistory: {
                useMutation: () => ({
                    mutate: mutateUndoHistory,
                }),
            },
        },
        git: {
            reset: { mutate: vi.fn() },
            deleteBranch: { mutate: vi.fn() },
            createBranch: { mutate: vi.fn() },
            checkout: { mutate: vi.fn() },
            stashDrop: { mutate: vi.fn() },
        },
    },
}));

// eslint-disable-next-line import/order
import { UndoStackProvider, useUndoStack } from './undo-stack-provider';
// eslint-disable-next-line import/order
import { UndoRedoButtons, UndoStackDialog } from './undo-stack';

function Harness() {
    const stack = useUndoStack();
    return (
        <div>
            <button
                onClick={() =>
                    { stack.pushOperation({
                        type: 'commit',
                        description: 'Test commit',
                        details: {},
                        undoable: true,
                    }); }
                }>
                Add Operation
            </button>
            <span data-testid='operation-count'>{stack.operations.length}</span>
            <span data-testid='can-undo'>{String(stack.canUndo)}</span>
            <span data-testid='can-redo'>{String(stack.canRedo)}</span>
            <button onClick={() => { stack.clearHistory(); }}>Clear</button>
        </div>
    );
}

describe('Undo Stack', () => {
    beforeEach(() => {
        undoHistoryData = { history: { operations: [], currentIndex: -1 } };
        invalidateUndoHistory.mockClear();
        mutateUndoHistory.mockClear();
        useAppStore.setState({ activeRepo: '/tmp/repo-under-test' });
    });

    it('provides context and tracks operations', async () => {
        render(
            <UndoStackProvider>
                <Harness />
            </UndoStackProvider>
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(screen.getByTestId('operation-count')).toHaveTextContent('0');
        fireEvent.click(screen.getByText('Add Operation'));

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            expect(screen.getByTestId('operation-count')).toHaveTextContent('1');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            expect(screen.getByTestId('can-undo')).toHaveTextContent('true');
        });

        expect(mutateUndoHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                repo: '/tmp/repo-under-test',
                currentIndex: 0,
            })
        );
    });

    it('clears history', async () => {
        render(
            <UndoStackProvider>
                <Harness />
            </UndoStackProvider>
        );

        fireEvent.click(screen.getByText('Add Operation'));

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        await waitFor(() => expect(screen.getByTestId('operation-count')).toHaveTextContent('1'));

        fireEvent.click(screen.getByText('Clear'));
        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            expect(screen.getByTestId('operation-count')).toHaveTextContent('0');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            expect(screen.getByTestId('can-undo')).toHaveTextContent('false');
        });
    });

    it('renders undo/redo buttons', () => {
        render(
            <UndoStackProvider>
                <UndoRedoButtons />
            </UndoStackProvider>
        );

        expect(screen.getByTitle(/Undo/)).toBeDefined();
        expect(screen.getByTitle(/Redo/)).toBeDefined();
    });

    it('renders undo history dialog', () => {
        render(
            <UndoStackProvider>
                <UndoStackDialog open={true} onOpenChange={() => undefined} />
            </UndoStackProvider>
        );

        expect(screen.getByText('Undo History')).toBeDefined();
    });
});

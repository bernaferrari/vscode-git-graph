import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateCustomCommands = vi.fn(async () => undefined);
const mutateCustomCommands = vi.fn();
let customCommandsData:
    | {
          commands: Array<{
              id: string;
              name: string;
              command: string;
              description?: string;
              useCount: number;
              alias?: string;
              lastUsed?: number;
          }>;
      }
    | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            config: {
                customCommands: {
                    invalidate: invalidateCustomCommands,
                },
            },
        }),
        config: {
            customCommands: {
                useQuery: () => ({ data: customCommandsData }),
            },
            setCustomCommands: {
                useMutation: () => ({
                    mutate: mutateCustomCommands,
                }),
            },
        },
        git: {
            runCustomCommand: {
                mutate: vi.fn(async () => ({ output: 'ok' })),
            },
        },
    },
}));

vi.mock('@/lib/store', async () => {
    const actual = await vi.importActual<typeof import('@/lib/store')>('@/lib/store');
    return {
        ...actual,
        useAppStore: () => ({ activeRepo: '/tmp/repo-under-test' }),
    };
});

import { useCustomCommands } from './custom-commands';

function Harness() {
    const { commands, addCommand } = useCustomCommands();
    return (
        <div>
            <span data-testid='command-count'>{commands.length}</span>
            <button
                onClick={() => {
                    addCommand({ name: 'Prune', command: 'remote prune origin', description: 'desc', alias: 'prune' });
                }}>
                Add Command
            </button>
        </div>
    );
}

describe('useCustomCommands', () => {
    beforeEach(() => {
        customCommandsData = {
            commands: [{ id: 'clean', name: 'Clean', command: 'clean -n', useCount: 1 }],
        };
        invalidateCustomCommands.mockClear();
        mutateCustomCommands.mockClear();
    });

    it('hydrates from backend and persists added commands', async () => {
        render(<Harness />);

        expect(screen.getByTestId('command-count')).toHaveTextContent('1');
        fireEvent.click(screen.getByText('Add Command'));

        await waitFor(() => {
            expect(mutateCustomCommands).toHaveBeenCalledWith({
                commands: [
                    { id: 'clean', name: 'Clean', command: 'clean -n', useCount: 1 },
                    expect.objectContaining({ name: 'Prune', command: 'remote prune origin', useCount: 0 }),
                ],
            });
        });
    });
});

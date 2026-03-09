import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidatePinnedCommits = vi.fn(async () => undefined);
const mutatePinnedCommits = vi.fn();
let pinnedCommitsData: { commits: Array<{ hash: string; message: string; author: string; date: string; pinnedAt: number }> } | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            repo: {
                pinnedCommits: {
                    invalidate: invalidatePinnedCommits,
                },
            },
        }),
        repo: {
            pinnedCommits: {
                useQuery: () => ({ data: pinnedCommitsData }),
            },
            setPinnedCommits: {
                useMutation: () => ({
                    mutate: mutatePinnedCommits,
                }),
            },
        },
    },
}));

import { usePinnedCommits } from './pinned-commits';

function Harness() {
    const { pinnedCommits, pinCommit, unpinCommit } = usePinnedCommits('/tmp/repo');
    return (
        <div>
            <span data-testid='pinned-count'>{pinnedCommits.length}</span>
            <button
                onClick={() => {
                    pinCommit({ hash: 'abc123', message: 'Test', author: 'Ada', date: '2026-03-09T00:00:00.000Z' });
                }}>
                Pin Commit
            </button>
            <button onClick={() => { unpinCommit('seed'); }}>Unpin Seed</button>
        </div>
    );
}

describe('usePinnedCommits', () => {
    beforeEach(() => {
        pinnedCommitsData = {
            commits: [{ hash: 'seed', message: 'Seed', author: 'Ada', date: '2026-03-08T00:00:00.000Z', pinnedAt: 1 }],
        };
        invalidatePinnedCommits.mockClear();
        mutatePinnedCommits.mockClear();
    });

    it('hydrates from backend commits and persists pin/unpin operations', async () => {
        render(<Harness />);

        expect(screen.getByTestId('pinned-count')).toHaveTextContent('1');

        fireEvent.click(screen.getByText('Pin Commit'));
        await waitFor(() => {
            expect(mutatePinnedCommits).toHaveBeenCalledWith({
                repo: '/tmp/repo',
                commits: expect.arrayContaining([
                    expect.objectContaining({ hash: 'seed' }),
                    expect.objectContaining({ hash: 'abc123', message: 'Test' }),
                ]),
            });
        });

        fireEvent.click(screen.getByText('Unpin Seed'));
        await waitFor(() => {
            expect(mutatePinnedCommits).toHaveBeenCalledWith({
                repo: '/tmp/repo',
                commits: [expect.objectContaining({ hash: 'abc123' })],
            });
        });
    });
});

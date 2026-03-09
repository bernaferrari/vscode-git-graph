import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateRecentRepoDetails = vi.fn(async () => undefined);
const mutateRecentRepoDetails = vi.fn();
let recentRepoData: { repos: Array<{ path: string; name: string; lastOpened: number; openCount: number; pinned: boolean; currentBranch?: string }> } | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            repo: {
                recentRepoDetails: {
                    invalidate: invalidateRecentRepoDetails,
                },
            },
        }),
        repo: {
            recentRepoDetails: {
                useQuery: () => ({ data: recentRepoData }),
            },
            setRecentRepoDetails: {
                useMutation: () => ({ mutate: mutateRecentRepoDetails }),
            },
        },
    },
}));

import { useRecentRepos } from './recent-repositories';

function Harness() {
    const { recentRepos, addRecentRepo, togglePin, clearRecentRepos } = useRecentRepos();
    return (
        <div>
            <span data-testid='recent-count'>{recentRepos.length}</span>
            <button onClick={() => { addRecentRepo('/tmp/new-repo', 'main'); }}>Add Repo</button>
            <button onClick={() => { togglePin('/tmp/existing'); }}>Pin Existing</button>
            <button onClick={clearRecentRepos}>Clear Repos</button>
        </div>
    );
}

describe('useRecentRepos', () => {
    beforeEach(() => {
        recentRepoData = {
            repos: [{ path: '/tmp/existing', name: 'existing', lastOpened: 1, openCount: 1, pinned: false }],
        };
        invalidateRecentRepoDetails.mockClear();
        mutateRecentRepoDetails.mockClear();
    });

    it('persists repo additions and pin toggles through backend mutations', async () => {
        render(<Harness />);

        expect(screen.getByTestId('recent-count')).toHaveTextContent('1');

        fireEvent.click(screen.getByText('Add Repo'));
        await waitFor(() => {
            expect(mutateRecentRepoDetails).toHaveBeenCalledWith({
                repos: expect.arrayContaining([
                    expect.objectContaining({ path: '/tmp/new-repo', currentBranch: 'main' }),
                    expect.objectContaining({ path: '/tmp/existing' }),
                ]),
            });
        });

        fireEvent.click(screen.getByText('Pin Existing'));
        await waitFor(() => {
            expect(mutateRecentRepoDetails).toHaveBeenCalledWith({
                repos: expect.arrayContaining([expect.objectContaining({ path: '/tmp/existing', pinned: true })]),
            });
        });

        fireEvent.click(screen.getByText('Clear Repos'));
        await waitFor(() => {
            expect(mutateRecentRepoDetails).toHaveBeenCalledWith({ repos: [] });
        });
    });
});

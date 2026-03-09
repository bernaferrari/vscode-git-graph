import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { GitGraphToolbar } from './git-graph-toolbar';

function getToolbarProps(overrides: Partial<ComponentProps<typeof GitGraphToolbar>> = {}) {
    const props: ComponentProps<typeof GitGraphToolbar> = {
        isGuided: false,
        hasFilters: false,
        pinnedCommitCount: 0,
        leftSlots: <div>repo</div>,
        branchFilter: <div>branches</div>,
        lensSwitcher: <div>lens</div>,
        profileSwitcher: <div>profile</div>,
        operationTimeline: <div>timeline</div>,
        stackedBranches: <div>stacks</div>,
        overflowMenu: <div>overflow</div>,
        onSync: vi.fn(),
        onFetch: vi.fn(),
        onPush: vi.fn(),
        onForcePush: vi.fn(),
        onPull: vi.fn(),
        onPullFfOnly: vi.fn(),
        onCreateBranch: vi.fn(),
        onCreateTag: vi.fn(),
        onStash: vi.fn(),
        onOpenWorkspaces: vi.fn(),
        onClearFilters: vi.fn(),
        onFind: vi.fn(),
        onRefresh: vi.fn(),
        onToggleSidePanel: vi.fn(),
        onOpenPinnedCommits: vi.fn(),
        ...overrides,
    };

    return props;
}

function renderToolbar(overrides: Partial<ComponentProps<typeof GitGraphToolbar>> = {}) {
    const props = getToolbarProps(overrides);
    render(<GitGraphToolbar {...props} />);
    return props;
}

describe('GitGraphToolbar', () => {
    it('renders pinned commit count badge when present', () => {
        renderToolbar({ pinnedCommitCount: 3 });

        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('calls clear filters from the filter badge', () => {
        const onClearFilters = vi.fn();

        renderToolbar({ hasFilters: true, onClearFilters });

        fireEvent.click(screen.getByText('Filtered').nextSibling as Element);
        expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('switches between fetch and sync based on guided mode', () => {
        const onFetch = vi.fn();
        const onSync = vi.fn();

        const { rerender } = render(
            <GitGraphToolbar
                {...getToolbarProps({
                    onFetch,
                    onSync,
                })}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));
        expect(onFetch).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();

        rerender(
            <GitGraphToolbar
                {...getToolbarProps({
                    isGuided: true,
                    onFetch,
                    onSync,
                })}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
        expect(onSync).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: 'Fetch' })).toBeNull();
    });

    it('runs new-menu actions', () => {
        const onCreateBranch = vi.fn();
        const onCreateTag = vi.fn();
        const onStash = vi.fn();

        renderToolbar({ onCreateBranch, onCreateTag, onStash });

        fireEvent.click(screen.getByRole('button', { name: /new/i }));
        fireEvent.click(screen.getByText('Branch...'));
        expect(onCreateBranch).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: /new/i }));
        fireEvent.click(screen.getByText('Tag...'));
        expect(onCreateTag).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: /new/i }));
        fireEvent.click(screen.getByText('Stash'));
        expect(onStash).toHaveBeenCalledTimes(1);
    });
});

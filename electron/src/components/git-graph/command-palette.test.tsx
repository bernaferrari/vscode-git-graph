import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CommandPalette } from './command-palette';

type CommandPaletteActions = Parameters<typeof CommandPalette>[0]['actions'];

function createActions(
    overrides?: Partial<CommandPaletteActions>,
    omit: Array<keyof CommandPaletteActions> = []
) {
    const actions: CommandPaletteActions = {
        onCreateBranch: vi.fn(),
        onCreateTag: vi.fn(),
        onFetch: vi.fn(),
        onPull: vi.fn(),
        onPullFfOnly: vi.fn(),
        onPush: vi.fn(),
        onRefresh: vi.fn(),
        onSettings: vi.fn(),
        onSearch: vi.fn(),
        onTerminal: vi.fn(),
        onStash: vi.fn(),
        onCommitSigning: vi.fn(),
        onReflog: vi.fn(),
        onTemplates: vi.fn(),
        onGitignore: vi.fn(),
        onCustomCommands: vi.fn(),
        onLFS: vi.fn(),
        onPRIntegration: vi.fn(),
        onWorktrees: vi.fn(),
        onSubmodules: vi.fn(),
        onStatistics: vi.fn(),
        onRemotes: vi.fn(),
        onFilters: vi.fn(),
        onPinned: vi.fn(),
        onKeyboardHelp: vi.fn(),
        onHealthCheck: vi.fn(),
        onFuzzyFinder: vi.fn(),
        ...overrides,
    };

    for (const key of omit) {
        delete actions[key];
    }

    return actions;
}

describe('CommandPalette', () => {
    it('shows and executes the fast-forward-only pull command when provided', async () => {
        const onOpenChange = vi.fn();
        const actions = createActions();

        render(<CommandPalette open={true} onOpenChange={onOpenChange} actions={actions} />);

        const ffOnlyCommand = screen.getByText('Pull (Fast-forward only)');
        expect(ffOnlyCommand).toBeDefined();

        fireEvent.click(ffOnlyCommand);

        await waitFor(() => {
            expect(actions.onPullFfOnly).toHaveBeenCalledTimes(1);
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not render fast-forward-only pull command when action is omitted', () => {
        const onOpenChange = vi.fn();
        const actions = createActions(undefined, ['onPullFfOnly']);

        render(<CommandPalette open={true} onOpenChange={onOpenChange} actions={actions} />);

        expect(screen.queryByText('Pull (Fast-forward only)')).toBeNull();
    });

    it('does not render optional worktree/workflow commands when callbacks are omitted', () => {
        const onOpenChange = vi.fn();
        const actions = createActions(undefined, ['onWorktrees', 'onWorkflows', 'onCopyDeepLink']);

        render(<CommandPalette open={true} onOpenChange={onOpenChange} actions={actions} />);

        expect(screen.queryByText('Worktrees')).toBeNull();
        expect(screen.queryByText('Workflow Engine')).toBeNull();
        expect(screen.queryByText('Copy Deep Link')).toBeNull();
    });

    it('renders and executes optional copy deep link command when provided', async () => {
        const onOpenChange = vi.fn();
        const actions = createActions({ onCopyDeepLink: vi.fn() });

        render(<CommandPalette open={true} onOpenChange={onOpenChange} actions={actions} />);

        const deepLinkCommand = screen.getByText('Copy Deep Link');
        fireEvent.click(deepLinkCommand);

        await waitFor(() => {
            expect(actions.onCopyDeepLink).toHaveBeenCalledTimes(1);
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

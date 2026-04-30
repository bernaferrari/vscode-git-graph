import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommandPaletteActions } from './use-command-palette-actions';

describe('useCommandPaletteActions', () => {
    it('opens line staging for the first available changed file', () => {
        const setStagingFile = vi.fn();
        const setLineStagingOpen = vi.fn();
        const setAnnotationsFile = vi.fn();
        const setFileAnnotationsOpen = vi.fn();

        const { result } = renderHook(() =>
            useCommandPaletteActions({
                currentHead: 'main',
                gitOps: {
                    fetch: vi.fn(),
                    pull: vi.fn(),
                    push: vi.fn(),
                },
                terminalOpen: false,
                featureFlags: {
                    deepLinks: false,
                    worktreePro: true,
                    workflowEngine: true,
                },
                workingTreeStatus: {
                    unstaged: [{ file: 'src/app.ts' }],
                    staged: [],
                },
                openSettingsAt: vi.fn(),
                handleRefreshAll: vi.fn(),
                openers: {
                    setCreateBranchOpen: vi.fn(),
                    setAddTagOpen: vi.fn(),
                    setSearchCommitsOpen: vi.fn(),
                    setTerminalOpen: vi.fn(),
                    setCloneDialogOpen: vi.fn(),
                    handleOpenInFinder: vi.fn(),
                    handleCopyDeepLink: vi.fn(async () => {}),
                    setStashManageOpen: vi.fn(),
                    setCommitSigningOpen: vi.fn(),
                    setReflogOpen: vi.fn(),
                    setTemplatesOpen: vi.fn(),
                    setGitignoreOpen: vi.fn(),
                    setCustomCommandsOpen: vi.fn(),
                    setLfsOpen: vi.fn(),
                    setPrIntegrationOpen: vi.fn(),
                    setWorktreeOpen: vi.fn(),
                    setWorkflowOpen: vi.fn(),
                    setSubmoduleOpen: vi.fn(),
                    setStatisticsOpen: vi.fn(),
                    setRemoteManageOpen: vi.fn(),
                    setShowFiltersDialog: vi.fn(),
                    setPinnedCommitsOpen: vi.fn(),
                    setStagingFile,
                    setLineStagingOpen,
                    setWorkspacesOpen: vi.fn(),
                    setCollaborationOpen: vi.fn(),
                    setKeyboardHelpOpen: vi.fn(),
                    setKeyboardEditorOpen: vi.fn(),
                    setHealthCheckOpen: vi.fn(),
                    setFuzzyFinderOpen: vi.fn(),
                    setUndoStackOpen: vi.fn(),
                    setConfigEditorOpen: vi.fn(),
                    setExternalDiffOpen: vi.fn(),
                    setIssueTrackerOpen: vi.fn(),
                    setBulkOpsOpen: vi.fn(),
                    setAnnotationsFile,
                    setFileAnnotationsOpen,
                    setActivityHeatmapOpen: vi.fn(),
                },
            })
        );

        act(() => {
            result.current.onLineStaging?.();
        });

        expect(setStagingFile).toHaveBeenCalledWith('src/app.ts');
        expect(setLineStagingOpen).toHaveBeenCalledWith(true);

        act(() => {
            result.current.onFileAnnotations?.();
        });

        expect(setAnnotationsFile).toHaveBeenCalledWith('src/app.ts');
        expect(setFileAnnotationsOpen).toHaveBeenCalledWith(true);
    });

    it('omits deep-link action when the feature flag is disabled', () => {
        const { result } = renderHook(() =>
            useCommandPaletteActions({
                currentHead: 'main',
                gitOps: {
                    fetch: vi.fn(),
                    pull: vi.fn(),
                    push: vi.fn(),
                },
                terminalOpen: false,
                featureFlags: {
                    deepLinks: false,
                    worktreePro: false,
                    workflowEngine: false,
                },
                openSettingsAt: vi.fn(),
                handleRefreshAll: vi.fn(),
                openers: {
                    setCreateBranchOpen: vi.fn(),
                    setAddTagOpen: vi.fn(),
                    setSearchCommitsOpen: vi.fn(),
                    setTerminalOpen: vi.fn(),
                    setCloneDialogOpen: vi.fn(),
                    handleOpenInFinder: vi.fn(),
                    handleCopyDeepLink: vi.fn(async () => {}),
                    setStashManageOpen: vi.fn(),
                    setCommitSigningOpen: vi.fn(),
                    setReflogOpen: vi.fn(),
                    setTemplatesOpen: vi.fn(),
                    setGitignoreOpen: vi.fn(),
                    setCustomCommandsOpen: vi.fn(),
                    setLfsOpen: vi.fn(),
                    setPrIntegrationOpen: vi.fn(),
                    setWorktreeOpen: vi.fn(),
                    setWorkflowOpen: vi.fn(),
                    setSubmoduleOpen: vi.fn(),
                    setStatisticsOpen: vi.fn(),
                    setRemoteManageOpen: vi.fn(),
                    setShowFiltersDialog: vi.fn(),
                    setPinnedCommitsOpen: vi.fn(),
                    setStagingFile: vi.fn(),
                    setLineStagingOpen: vi.fn(),
                    setWorkspacesOpen: vi.fn(),
                    setCollaborationOpen: vi.fn(),
                    setKeyboardHelpOpen: vi.fn(),
                    setKeyboardEditorOpen: vi.fn(),
                    setHealthCheckOpen: vi.fn(),
                    setFuzzyFinderOpen: vi.fn(),
                    setUndoStackOpen: vi.fn(),
                    setConfigEditorOpen: vi.fn(),
                    setExternalDiffOpen: vi.fn(),
                    setIssueTrackerOpen: vi.fn(),
                    setBulkOpsOpen: vi.fn(),
                    setAnnotationsFile: vi.fn(),
                    setFileAnnotationsOpen: vi.fn(),
                    setActivityHeatmapOpen: vi.fn(),
                },
            })
        );

        expect(result.current.onCopyDeepLink).toBeUndefined();
        expect(result.current.onWorktrees).toBeUndefined();
        expect(result.current.onWorkflows).toBeUndefined();
    });

    it('routes targeted settings actions to the matching integrations section', () => {
        const openSettingsAt = vi.fn();

        const { result } = renderHook(() =>
            useCommandPaletteActions({
                currentHead: 'main',
                gitOps: {
                    fetch: vi.fn(),
                    pull: vi.fn(),
                    push: vi.fn(),
                },
                terminalOpen: false,
                featureFlags: {
                    deepLinks: false,
                    worktreePro: true,
                    workflowEngine: true,
                },
                openSettingsAt,
                handleRefreshAll: vi.fn(),
                openers: {
                    setCreateBranchOpen: vi.fn(),
                    setAddTagOpen: vi.fn(),
                    setSearchCommitsOpen: vi.fn(),
                    setTerminalOpen: vi.fn(),
                    setCloneDialogOpen: vi.fn(),
                    handleOpenInFinder: vi.fn(),
                    handleCopyDeepLink: vi.fn(async () => {}),
                    setStashManageOpen: vi.fn(),
                    setCommitSigningOpen: vi.fn(),
                    setReflogOpen: vi.fn(),
                    setTemplatesOpen: vi.fn(),
                    setGitignoreOpen: vi.fn(),
                    setCustomCommandsOpen: vi.fn(),
                    setLfsOpen: vi.fn(),
                    setPrIntegrationOpen: vi.fn(),
                    setWorktreeOpen: vi.fn(),
                    setWorkflowOpen: vi.fn(),
                    setSubmoduleOpen: vi.fn(),
                    setStatisticsOpen: vi.fn(),
                    setRemoteManageOpen: vi.fn(),
                    setShowFiltersDialog: vi.fn(),
                    setPinnedCommitsOpen: vi.fn(),
                    setStagingFile: vi.fn(),
                    setLineStagingOpen: vi.fn(),
                    setWorkspacesOpen: vi.fn(),
                    setCollaborationOpen: vi.fn(),
                    setKeyboardHelpOpen: vi.fn(),
                    setKeyboardEditorOpen: vi.fn(),
                    setHealthCheckOpen: vi.fn(),
                    setFuzzyFinderOpen: vi.fn(),
                    setUndoStackOpen: vi.fn(),
                    setConfigEditorOpen: vi.fn(),
                    setExternalDiffOpen: vi.fn(),
                    setIssueTrackerOpen: vi.fn(),
                    setBulkOpsOpen: vi.fn(),
                    setAnnotationsFile: vi.fn(),
                    setFileAnnotationsOpen: vi.fn(),
                    setActivityHeatmapOpen: vi.fn(),
                },
            })
        );

        act(() => {
            result.current.onRepoPolicy?.();
            result.current.onDiagnostics?.();
            result.current.onAuditLog?.();
        });

        expect(openSettingsAt).toHaveBeenNthCalledWith(1, 'integrations', 'repo-policy');
        expect(openSettingsAt).toHaveBeenNthCalledWith(2, 'integrations', 'diagnostics');
        expect(openSettingsAt).toHaveBeenNthCalledWith(3, 'integrations', 'audit-log');
    });
});

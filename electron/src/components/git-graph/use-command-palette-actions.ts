import { useMemo } from 'react';
import { toast } from 'sonner';

import type { CommandPaletteActions } from './command-palette';
import type { SettingsSection, SettingsTab } from './use-git-graph-shell-panels';

interface UseCommandPaletteActionsInput {
    currentHead: string;
    gitOps: {
        fetch: () => unknown;
        pull: (branch: string, remote: string, rebase: boolean, ffOnly?: boolean) => unknown;
        push: (branch: string, remote: string, setUpstream: boolean, mode?: 'normal' | 'force' | 'force-with-lease') => unknown;
    };
    terminalOpen: boolean;
    featureFlags: {
        deepLinks: boolean;
        worktreePro: boolean;
        workflowEngine: boolean;
    };
    workingTreeStatus?: {
        unstaged?: Array<{ file?: string }>;
        staged?: Array<{ file?: string }>;
    };
    openSettingsAt: (tab: SettingsTab, section?: SettingsSection) => void;
    openers: {
        setCreateBranchOpen: (open: boolean) => void;
        setAddTagOpen: (open: boolean) => void;
        setSearchCommitsOpen: (open: boolean) => void;
        setTerminalOpen: (open: boolean) => void;
        setCloneDialogOpen: (open: boolean) => void;
        handleOpenInFinder: () => void;
        handleCopyDeepLink: () => Promise<void>;
        setStashManageOpen: (open: boolean) => void;
        setCommitSigningOpen: (open: boolean) => void;
        setReflogOpen: (open: boolean) => void;
        setTemplatesOpen: (open: boolean) => void;
        setGitignoreOpen: (open: boolean) => void;
        setCustomCommandsOpen: (open: boolean) => void;
        setLfsOpen: (open: boolean) => void;
        setPrIntegrationOpen: (open: boolean) => void;
        setWorktreeOpen: (open: boolean) => void;
        setWorkflowOpen: (open: boolean) => void;
        setSubmoduleOpen: (open: boolean) => void;
        setStatisticsOpen: (open: boolean) => void;
        setRemoteManageOpen: (open: boolean) => void;
        setShowFiltersDialog: (open: boolean) => void;
        setPinnedCommitsOpen: (open: boolean) => void;
        setStagingFile: (file: string | null) => void;
        setLineStagingOpen: (open: boolean) => void;
        setWorkspacesOpen: (open: boolean) => void;
        setCollaborationOpen: (open: boolean) => void;
        setKeyboardHelpOpen: (open: boolean) => void;
        setKeyboardEditorOpen: (open: boolean) => void;
        setHealthCheckOpen: (open: boolean) => void;
        setFuzzyFinderOpen: (open: boolean) => void;
        setUndoStackOpen: (open: boolean) => void;
        setConfigEditorOpen: (open: boolean) => void;
        setExternalDiffOpen: (open: boolean) => void;
        setIssueTrackerOpen: (open: boolean) => void;
        setBulkOpsOpen: (open: boolean) => void;
        setAnnotationsFile: (file: string) => void;
        setFileAnnotationsOpen: (open: boolean) => void;
        setActivityHeatmapOpen: (open: boolean) => void;
    };
    handleRefreshAll: () => void;
}

function getPrimaryChangedFile(workingTreeStatus?: UseCommandPaletteActionsInput['workingTreeStatus']) {
    return workingTreeStatus?.unstaged?.[0]?.file ?? workingTreeStatus?.staged?.[0]?.file ?? null;
}

export function useCommandPaletteActions(input: UseCommandPaletteActionsInput): CommandPaletteActions {
    const {
        currentHead,
        gitOps,
        terminalOpen,
        featureFlags,
        workingTreeStatus,
        openSettingsAt,
        openers,
        handleRefreshAll,
    } = input;

    return useMemo(
        () => ({
            onCreateBranch: () => {
                openers.setCreateBranchOpen(true);
            },
            onCreateTag: () => {
                openers.setAddTagOpen(true);
            },
            onFetch: () => gitOps.fetch(),
            onPull: () => gitOps.pull(currentHead, 'origin', false),
            onPullFfOnly: () => gitOps.pull(currentHead, 'origin', false, true),
            onPush: () => gitOps.push(currentHead, 'origin', true, 'normal'),
            onRefresh: handleRefreshAll,
            onSettings: () => {
                openSettingsAt('general');
            },
            onSearch: () => {
                openers.setSearchCommitsOpen(true);
            },
            onTerminal: () => {
                openers.setTerminalOpen(!terminalOpen);
            },
            onClone: () => {
                openers.setCloneDialogOpen(true);
            },
            onOpenInFinder: () => {
                openers.handleOpenInFinder();
            },
            ...(featureFlags.deepLinks ? { onCopyDeepLink: () => openers.handleCopyDeepLink() } : {}),
            onStash: () => {
                openers.setStashManageOpen(true);
            },
            onCommitSigning: () => {
                openers.setCommitSigningOpen(true);
            },
            onReflog: () => {
                openers.setReflogOpen(true);
            },
            onTemplates: () => {
                openers.setTemplatesOpen(true);
            },
            onGitignore: () => {
                openers.setGitignoreOpen(true);
            },
            onCustomCommands: () => {
                openers.setCustomCommandsOpen(true);
            },
            onLFS: () => {
                openers.setLfsOpen(true);
            },
            onPRIntegration: () => {
                openers.setPrIntegrationOpen(true);
            },
            ...(featureFlags.worktreePro
                ? {
                      onWorktrees: () => {
                          openers.setWorktreeOpen(true);
                      },
                  }
                : {}),
            ...(featureFlags.workflowEngine
                ? {
                      onWorkflows: () => {
                          openers.setWorkflowOpen(true);
                      },
                  }
                : {}),
            onSubmodules: () => {
                openers.setSubmoduleOpen(true);
            },
            onRepoPolicy: () => {
                openSettingsAt('integrations', 'repo-policy');
            },
            onAuditLog: () => {
                openSettingsAt('integrations', 'audit-log');
            },
            onDiagnostics: () => {
                openSettingsAt('integrations', 'diagnostics');
            },
            onStatistics: () => {
                openers.setStatisticsOpen(true);
            },
            onRemotes: () => {
                openers.setRemoteManageOpen(true);
            },
            onFilters: () => {
                openers.setShowFiltersDialog(true);
            },
            onPinned: () => {
                openers.setPinnedCommitsOpen(true);
            },
            onLineStaging: () => {
                const fileForLineStaging = workingTreeStatus?.unstaged?.[0]?.file ?? workingTreeStatus?.staged?.[0]?.file;
                if (!fileForLineStaging) {
                    toast.info('No changed files available for line staging');
                    return;
                }
                openers.setStagingFile(fileForLineStaging);
                openers.setLineStagingOpen(true);
            },
            onWorkspaces: () => {
                openers.setWorkspacesOpen(true);
            },
            onCollaboration: () => {
                openers.setCollaborationOpen(true);
            },
            onKeyboardHelp: () => {
                openers.setKeyboardHelpOpen(true);
            },
            onKeyboardCustomize: () => {
                openers.setKeyboardEditorOpen(true);
            },
            onHealthCheck: () => {
                openers.setHealthCheckOpen(true);
            },
            onFuzzyFinder: () => {
                openers.setFuzzyFinderOpen(true);
            },
            onUndoStack: () => {
                openers.setUndoStackOpen(true);
            },
            onConfigEditor: () => {
                openers.setConfigEditorOpen(true);
            },
            onExternalDiff: () => {
                openers.setExternalDiffOpen(true);
            },
            onIssueTracker: () => {
                openers.setIssueTrackerOpen(true);
            },
            onBulkOps: () => {
                openers.setBulkOpsOpen(true);
            },
            onFileAnnotations: () => {
                const annotationsFile = getPrimaryChangedFile(workingTreeStatus);
                if (!annotationsFile) {
                    toast.info('No changed files available for file annotations');
                    return;
                }
                openers.setAnnotationsFile(annotationsFile);
                openers.setFileAnnotationsOpen(true);
            },
            onActivityHeatmap: () => {
                openers.setActivityHeatmapOpen(true);
            },
        }),
        [currentHead, featureFlags.deepLinks, featureFlags.workflowEngine, featureFlags.worktreePro, gitOps, handleRefreshAll, openSettingsAt, openers, terminalOpen, workingTreeStatus?.staged, workingTreeStatus?.unstaged]
    );
}

export default useCommandPaletteActions;

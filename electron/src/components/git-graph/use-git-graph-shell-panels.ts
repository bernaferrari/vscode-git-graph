import { useCallback, useState } from 'react';

import { trpc } from '@/trpc/client';

export type SettingsTab =
    | 'general'
    | 'appearance'
    | 'editor'
    | 'notifications'
    | 'performance'
    | 'integrations'
    | 'privacy';

export type SettingsSection =
    | 'feature-flags'
    | 'ai-provider'
    | 'repo-policy'
    | 'diagnostics'
    | 'audit-log';

export function useGitGraphShellPanels() {
    const utils = trpc.useUtils();
    const setOnboardingStateMutation = trpc.config.setOnboardingState.useMutation({
        onSuccess: async () => {
            await utils.config.onboardingState.invalidate();
        },
    });
    const [prIntegrationOpen, setPrIntegrationOpen] = useState(false);
    const [worktreeOpen, setWorktreeOpen] = useState(false);
    const [workflowOpen, setWorkflowOpen] = useState(false);
    const [submoduleOpen, setSubmoduleOpen] = useState(false);
    const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
    const [keyboardEditorOpen, setKeyboardEditorOpen] = useState(false);
    const [onboardingOpen, setOnboardingOpen] = useState(false);
    const [recentReposOpen, setRecentReposOpen] = useState(false);
    const [workspacesOpen, setWorkspacesOpen] = useState(false);
    const [collaborationOpen, setCollaborationOpen] = useState(false);
    const [stashManageOpen, setStashManageOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
    const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | null>(null);
    const [gitFlowOpen, setGitFlowOpen] = useState(false);
    const [healthCheckOpen, setHealthCheckOpen] = useState(false);
    const [bisectOpen, setBisectOpen] = useState(false);
    const [undoStackOpen, setUndoStackOpen] = useState(false);
    const [configEditorOpen, setConfigEditorOpen] = useState(false);
    const [externalDiffOpen, setExternalDiffOpen] = useState(false);
    const [issueTrackerOpen, setIssueTrackerOpen] = useState(false);
    const [bulkOpsOpen, setBulkOpsOpen] = useState(false);
    const [fileAnnotationsOpen, setFileAnnotationsOpen] = useState(false);
    const [activityHeatmapOpen, setActivityHeatmapOpen] = useState(false);

    const openSettingsAt = useCallback((tab: SettingsTab, section?: SettingsSection) => {
        setSettingsInitialTab(tab);
        setSettingsInitialSection(section ?? null);
        setSettingsOpen(true);
    }, []);

    const restartOnboarding = useCallback(() => {
        setOnboardingStateMutation.mutate({ gitGraphCompleted: false });
        setOnboardingOpen(true);
    }, [setOnboardingStateMutation]);

    return {
        prIntegrationOpen,
        setPrIntegrationOpen,
        worktreeOpen,
        setWorktreeOpen,
        workflowOpen,
        setWorkflowOpen,
        submoduleOpen,
        setSubmoduleOpen,
        keyboardHelpOpen,
        setKeyboardHelpOpen,
        keyboardEditorOpen,
        setKeyboardEditorOpen,
        onboardingOpen,
        setOnboardingOpen,
        recentReposOpen,
        setRecentReposOpen,
        workspacesOpen,
        setWorkspacesOpen,
        collaborationOpen,
        setCollaborationOpen,
        stashManageOpen,
        setStashManageOpen,
        settingsOpen,
        setSettingsOpen,
        settingsInitialTab,
        settingsInitialSection,
        gitFlowOpen,
        setGitFlowOpen,
        healthCheckOpen,
        setHealthCheckOpen,
        bisectOpen,
        setBisectOpen,
        undoStackOpen,
        setUndoStackOpen,
        configEditorOpen,
        setConfigEditorOpen,
        externalDiffOpen,
        setExternalDiffOpen,
        issueTrackerOpen,
        setIssueTrackerOpen,
        bulkOpsOpen,
        setBulkOpsOpen,
        fileAnnotationsOpen,
        setFileAnnotationsOpen,
        activityHeatmapOpen,
        setActivityHeatmapOpen,
        openSettingsAt,
        restartOnboarding,
    };
}

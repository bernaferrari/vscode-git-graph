import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GitGraphFeatureDialogs } from './git-graph-feature-dialogs';

vi.mock('./reflog-viewer', () => ({ ReflogViewer: () => <div>Reflog Viewer</div> }));
vi.mock('./commit-templates', () => ({ CommitTemplatesDialog: () => <div>Commit Templates</div> }));
vi.mock('./gitignore-manager', () => ({ GitignoreManager: () => <div>Gitignore Manager</div> }));
vi.mock('./custom-commands', () => ({ CustomCommands: () => <div>Custom Commands</div> }));
vi.mock('./search-commits', () => ({ SearchAllCommits: () => <div>Search Commits</div> }));
vi.mock('./lfs-support', () => ({ LFSSupport: () => <div>LFS Support</div> }));
vi.mock('./pull-request-integration', () => ({ PullRequestIntegration: () => <div>PR Integration</div> }));
vi.mock('./worktree-management', () => ({ WorktreeManagement: () => <div>Worktree Management</div> }));
vi.mock('./workflow-engine', () => ({ WorkflowEngineDialog: () => <div>Workflow Engine</div> }));
vi.mock('./submodule-management', () => ({ SubmoduleManagement: () => <div>Submodule Management</div> }));
vi.mock('./keyboard-shortcuts-help', () => ({ KeyboardShortcutsHelp: () => <div>Keyboard Help</div> }));
vi.mock('./keyboard-shortcuts-editor', () => ({ KeyboardShortcutsEditor: () => <div>Keyboard Editor</div> }));
vi.mock('./onboarding', () => ({ OnboardingDialog: () => <div>Onboarding</div> }));
vi.mock('./recent-repositories', () => ({ RecentRepositories: () => <div>Recent Repos</div> }));
vi.mock('./workspaces', () => ({ WorkspacesManager: () => <div>Workspaces</div> }));
vi.mock('./collaboration-center', () => ({ CollaborationCenter: () => <div>Collaboration Center</div> }));
vi.mock('./clone-repository-dialog', () => ({ CloneRepositoryDialog: () => <div>Clone Repository</div> }));
vi.mock('./stash-management', () => ({ StashManagement: () => <div>Stash Management</div> }));
vi.mock('./settings-dialog', () => ({ SettingsDialog: () => <div>Settings Dialog</div> }));
vi.mock('./line-staging', () => ({ LineStaging: () => <div>Line Staging</div> }));
vi.mock('./command-palette', () => ({ CommandPalette: () => <div>Command Palette</div> }));
vi.mock('./gitflow-automation', () => ({ GitFlowAutomation: () => <div>Git Flow</div> }));
vi.mock('./repo-health-check', () => ({ RepoHealthCheck: () => <div>Health Check</div> }));
vi.mock('./git-bisect-ui', () => ({ GitBisectUI: () => <div>Bisect</div> }));
vi.mock('./undo-stack', () => ({ UndoStackDialog: () => <div>Undo Stack</div> }));
vi.mock('./git-config-editor', () => ({ GitConfigEditor: () => <div>Config Editor</div> }));
vi.mock('./external-diff-tool', () => ({ ExternalDiffConfig: () => <div>External Diff</div> }));
vi.mock('./issue-tracker', () => ({ IssueTrackerSettings: () => <div>Issue Tracker</div> }));
vi.mock('./bulk-commit-operations', () => ({ BulkCommitOperations: () => <div>Bulk Ops</div> }));
vi.mock('./file-annotations-panel', () => ({ FileAnnotationsPanel: () => <div>File Annotations</div> }));
vi.mock('./activity-heatmap', () => ({ ActivityHeatmap: () => <div>Activity Heatmap</div> }));

function getOpenState(open = false) {
    return {
        open,
        onOpenChange: vi.fn(),
    };
}

describe('GitGraphFeatureDialogs', () => {
    it('renders open feature dialogs and respects feature flags', async () => {
        render(
            <GitGraphFeatureDialogs
                featureFlags={{ worktreePro: true, workflowEngine: false }}
                reflog={getOpenState(true)}
                onCreateBranchFromHash={vi.fn()}
                templates={getOpenState(false)}
                templateValues={[]}
                onTemplatesChange={vi.fn()}
                gitignore={getOpenState(false)}
                customCommands={getOpenState(false)}
                searchCommits={getOpenState(false)}
                onSelectCommit={vi.fn()}
                lfs={getOpenState(false)}
                pullRequests={getOpenState(true)}
                worktree={getOpenState(true)}
                workflow={getOpenState(true)}
                submodule={getOpenState(false)}
                keyboardHelp={getOpenState(false)}
                keyboardEditor={getOpenState(false)}
                onboarding={getOpenState(false)}
                recentRepos={getOpenState(false)}
                workspaces={getOpenState(false)}
                collaboration={getOpenState(false)}
                cloneRepository={getOpenState(false)}
                onCloned={vi.fn(async () => undefined)}
                stashManagement={getOpenState(false)}
                settings={{ ...getOpenState(false), initialTab: 'general' }}
                lineStaging={getOpenState(false)}
                stagingFile={null}
                onLineStagingChange={vi.fn()}
                onLineStaged={vi.fn()}
                commandPalette={getOpenState(false)}
                commandPaletteActions={{} as any}
                gitFlow={getOpenState(false)}
                healthCheck={getOpenState(false)}
                bisect={getOpenState(false)}
                selectedCommit={null}
                undoStack={getOpenState(false)}
                configEditor={getOpenState(false)}
                externalDiff={getOpenState(false)}
                issueTracker={getOpenState(false)}
                bulkOps={getOpenState(false)}
                bulkOpCommits={[]}
                onBulkOpsComplete={vi.fn()}
                fileAnnotations={getOpenState(false)}
                annotationsFile=''
                activityHeatmap={getOpenState(false)}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Reflog Viewer')).toBeInTheDocument();
            expect(screen.getByText('PR Integration')).toBeInTheDocument();
            expect(screen.getByText('Worktree Management')).toBeInTheDocument();
        });

        expect(screen.queryByText('Workflow Engine')).toBeNull();
    });
});

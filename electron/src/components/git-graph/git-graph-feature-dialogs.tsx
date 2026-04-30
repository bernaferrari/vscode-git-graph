import { lazy, Suspense } from 'react';


import type { CommandPaletteActions } from './command-palette';
import type { CommitTemplate } from './commit-templates';
import type { SettingsSection, SettingsTab } from './use-git-graph-shell-panels';
import type { Dispatch, SetStateAction } from 'react';

const CloneRepositoryDialog = lazy(() =>
    import('./clone-repository-dialog').then((mod) => ({ default: mod.CloneRepositoryDialog }))
);
const WorktreeManagement = lazy(() =>
    import('./worktree-management').then((mod) => ({ default: mod.WorktreeManagement }))
);
const WorkflowEngineDialog = lazy(() =>
    import('./workflow-engine').then((mod) => ({ default: mod.WorkflowEngineDialog }))
);
const SubmoduleManagement = lazy(() =>
    import('./submodule-management').then((mod) => ({ default: mod.SubmoduleManagement }))
);
const ReflogViewer = lazy(() => import('./reflog-viewer').then((mod) => ({ default: mod.ReflogViewer })));
const SearchAllCommits = lazy(() => import('./search-commits').then((mod) => ({ default: mod.SearchAllCommits })));
const GitFlowAutomation = lazy(() =>
    import('./gitflow-automation').then((mod) => ({ default: mod.GitFlowAutomation }))
);
const GitBisectUI = lazy(() => import('./git-bisect-ui').then((mod) => ({ default: mod.GitBisectUI })));
const ExternalDiffConfig = lazy(() =>
    import('./external-diff-tool').then((mod) => ({ default: mod.ExternalDiffConfig }))
);
const GitConfigEditor = lazy(() => import('./git-config-editor').then((mod) => ({ default: mod.GitConfigEditor })));
const IssueTrackerSettings = lazy(() =>
    import('./issue-tracker').then((mod) => ({ default: mod.IssueTrackerSettings }))
);
const BulkCommitOperations = lazy(() =>
    import('./bulk-commit-operations').then((mod) => ({ default: mod.BulkCommitOperations }))
);
const FileAnnotationsPanel = lazy(() =>
    import('./file-annotations-panel').then((mod) => ({ default: mod.FileAnnotationsPanel }))
);
const ActivityHeatmap = lazy(() => import('./activity-heatmap').then((mod) => ({ default: mod.ActivityHeatmap })));
const LineStaging = lazy(() => import('./line-staging').then((mod) => ({ default: mod.LineStaging })));
const CommitTemplatesDialog = lazy(() =>
    import('./commit-templates').then((mod) => ({ default: mod.CommitTemplatesDialog }))
);
const GitignoreManager = lazy(() => import('./gitignore-manager').then((mod) => ({ default: mod.GitignoreManager })));
const CustomCommands = lazy(() => import('./custom-commands').then((mod) => ({ default: mod.CustomCommands })));
const LFSSupport = lazy(() => import('./lfs-support').then((mod) => ({ default: mod.LFSSupport })));
const PullRequestIntegration = lazy(() =>
    import('./pull-request-integration').then((mod) => ({ default: mod.PullRequestIntegration }))
);
const KeyboardShortcutsHelp = lazy(() =>
    import('./keyboard-shortcuts-help').then((mod) => ({ default: mod.KeyboardShortcutsHelp }))
);
const KeyboardShortcutsEditor = lazy(() =>
    import('./keyboard-shortcuts-editor').then((mod) => ({ default: mod.KeyboardShortcutsEditor }))
);
const OnboardingDialog = lazy(() => import('./onboarding').then((mod) => ({ default: mod.OnboardingDialog })));
const RecentRepositories = lazy(() =>
    import('./recent-repositories').then((mod) => ({ default: mod.RecentRepositories }))
);
const WorkspacesManager = lazy(() => import('./workspaces').then((mod) => ({ default: mod.WorkspacesManager })));
const CollaborationCenter = lazy(() =>
    import('./collaboration-center').then((mod) => ({ default: mod.CollaborationCenter }))
);
const StashManagement = lazy(() => import('./stash-management').then((mod) => ({ default: mod.StashManagement })));
const SettingsDialog = lazy(() => import('./settings-dialog').then((mod) => ({ default: mod.SettingsDialog })));
const CommandPalette = lazy(() => import('./command-palette').then((mod) => ({ default: mod.CommandPalette })));
const RepoHealthCheck = lazy(() => import('./repo-health-check').then((mod) => ({ default: mod.RepoHealthCheck })));
const UndoStackDialog = lazy(() => import('./undo-stack').then((mod) => ({ default: mod.UndoStackDialog })));

interface FeatureFlags {
    worktreePro: boolean;
    workflowEngine: boolean;
}

interface OpenState {
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}

interface FeatureDialogCommit {
    hash: string;
    message: string;
    author: string;
    date: number;
    parents: string[];
}

export function DialogLoadingFallback() {
    return (
        <div className='pointer-events-none fixed inset-0 z-[70] flex items-center justify-center'>
            <div className='ui-surface text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs'>
                <span>Loading panel...</span>
            </div>
        </div>
    );
}

export function GitGraphFeatureDialogs({
    featureFlags,
    reflog,
    onCreateBranchFromHash,
    templates,
    templateValues,
    onTemplatesChange,
    gitignore,
    customCommands,
    searchCommits,
    onSelectCommit,
    lfs,
    pullRequests,
    worktree,
    workflow,
    submodule,
    keyboardHelp,
    keyboardEditor,
    onboarding,
    recentRepos,
    workspaces,
    collaboration,
    cloneRepository,
    onCloned,
    stashManagement,
    settings,
    lineStaging,
    stagingFile,
    onLineStagingChange,
    onLineStaged,
    commandPalette,
    commandPaletteActions,
    gitFlow,
    healthCheck,
    bisect,
    selectedCommit,
    undoStack,
    configEditor,
    externalDiff,
    issueTracker,
    bulkOps,
    bulkOpCommits,
    onBulkOpsComplete,
    fileAnnotations,
    annotationsFile,
    activityHeatmap,
}: {
    featureFlags: FeatureFlags;
    reflog: OpenState;
    onCreateBranchFromHash: (hash: string) => void;
    templates: OpenState;
    templateValues: CommitTemplate[];
    onTemplatesChange: (templates: CommitTemplate[]) => void;
    gitignore: OpenState;
    customCommands: OpenState;
    searchCommits: OpenState;
    onSelectCommit: (hash: string) => void;
    lfs: OpenState;
    pullRequests: OpenState;
    worktree: OpenState;
    workflow: OpenState;
    submodule: OpenState;
    keyboardHelp: OpenState;
    keyboardEditor: OpenState;
    onboarding: OpenState;
    recentRepos: OpenState;
    workspaces: OpenState;
    collaboration: OpenState;
    cloneRepository: OpenState;
    onCloned: (repoPath: string) => Promise<void>;
    stashManagement: OpenState;
    settings: OpenState & { initialTab: SettingsTab; initialSection: SettingsSection | null };
    lineStaging: OpenState;
    stagingFile: string | null;
    onLineStagingChange: (nextOpen: boolean) => void;
    onLineStaged: () => void;
    commandPalette: OpenState;
    commandPaletteActions: CommandPaletteActions;
    gitFlow: OpenState;
    healthCheck: OpenState;
    bisect: OpenState;
    selectedCommit: string | null;
    undoStack: OpenState;
    configEditor: OpenState;
    externalDiff: OpenState;
    issueTracker: OpenState;
    bulkOps: OpenState;
    bulkOpCommits: FeatureDialogCommit[];
    onBulkOpsComplete: () => void;
    fileAnnotations: OpenState;
    annotationsFile: string;
    activityHeatmap: OpenState;
}) {
    return (
        <>
            {reflog.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <ReflogViewer
                        open={reflog.open}
                        onOpenChange={reflog.onOpenChange}
                        onCreateBranchFromHash={onCreateBranchFromHash}
                    />
                </Suspense>
            )}
            {templates.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CommitTemplatesDialog
                        open={templates.open}
                        onOpenChange={templates.onOpenChange}
                        templates={templateValues}
                        onTemplatesChange={onTemplatesChange}
                    />
                </Suspense>
            )}
            {gitignore.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <GitignoreManager open={gitignore.open} onOpenChange={gitignore.onOpenChange} />
                </Suspense>
            )}
            {customCommands.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CustomCommands open={customCommands.open} onOpenChange={customCommands.onOpenChange} />
                </Suspense>
            )}
            {searchCommits.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <SearchAllCommits
                        open={searchCommits.open}
                        onOpenChange={searchCommits.onOpenChange}
                        onSelectCommit={onSelectCommit}
                    />
                </Suspense>
            )}
            {lfs.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <LFSSupport open={lfs.open} onOpenChange={lfs.onOpenChange} />
                </Suspense>
            )}
            {pullRequests.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <PullRequestIntegration open={pullRequests.open} onOpenChange={pullRequests.onOpenChange} />
                </Suspense>
            )}
            {featureFlags.worktreePro && worktree.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <WorktreeManagement open={worktree.open} onOpenChange={worktree.onOpenChange} />
                </Suspense>
            )}
            {featureFlags.workflowEngine && workflow.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <WorkflowEngineDialog open={workflow.open} onOpenChange={workflow.onOpenChange} />
                </Suspense>
            )}
            {submodule.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <SubmoduleManagement open={submodule.open} onOpenChange={submodule.onOpenChange} />
                </Suspense>
            )}
            {keyboardHelp.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <KeyboardShortcutsHelp open={keyboardHelp.open} onOpenChange={keyboardHelp.onOpenChange} />
                </Suspense>
            )}
            {keyboardEditor.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <KeyboardShortcutsEditor open={keyboardEditor.open} onOpenChange={keyboardEditor.onOpenChange} />
                </Suspense>
            )}
            {onboarding.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <OnboardingDialog open={onboarding.open} onOpenChange={onboarding.onOpenChange} />
                </Suspense>
            )}
            {recentRepos.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <RecentRepositories open={recentRepos.open} onOpenChange={recentRepos.onOpenChange} />
                </Suspense>
            )}
            {workspaces.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <WorkspacesManager open={workspaces.open} onOpenChange={workspaces.onOpenChange} />
                </Suspense>
            )}
            {collaboration.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CollaborationCenter
                        open={collaboration.open}
                        onOpenChange={collaboration.onOpenChange}
                    />
                </Suspense>
            )}
            {cloneRepository.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CloneRepositoryDialog
                        open={cloneRepository.open}
                        onOpenChange={cloneRepository.onOpenChange}
                        onCloned={onCloned}
                    />
                </Suspense>
            )}
            {stashManagement.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <StashManagement open={stashManagement.open} onOpenChange={stashManagement.onOpenChange} />
                </Suspense>
            )}
            {settings.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <SettingsDialog
                        open={settings.open}
                        onOpenChange={settings.onOpenChange}
                        initialTab={settings.initialTab}
                        initialSection={settings.initialSection}
                    />
                </Suspense>
            )}
            {lineStaging.open && stagingFile && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <LineStaging
                        open={lineStaging.open}
                        onOpenChange={onLineStagingChange}
                        filePath={stagingFile}
                        onStaged={onLineStaged}
                    />
                </Suspense>
            )}
            {commandPalette.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <CommandPalette
                        open={commandPalette.open}
                        onOpenChange={commandPalette.onOpenChange}
                        actions={commandPaletteActions}
                    />
                </Suspense>
            )}
            {gitFlow.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <GitFlowAutomation open={gitFlow.open} onOpenChange={gitFlow.onOpenChange} />
                </Suspense>
            )}
            {healthCheck.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <RepoHealthCheck open={healthCheck.open} onOpenChange={healthCheck.onOpenChange} />
                </Suspense>
            )}
            {bisect.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <GitBisectUI
                        open={bisect.open}
                        onOpenChange={bisect.onOpenChange}
                        {...(selectedCommit ? { currentCommitHash: selectedCommit } : {})}
                    />
                </Suspense>
            )}
            {undoStack.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <UndoStackDialog open={undoStack.open} onOpenChange={undoStack.onOpenChange} />
                </Suspense>
            )}
            {configEditor.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <GitConfigEditor open={configEditor.open} onOpenChange={configEditor.onOpenChange} />
                </Suspense>
            )}
            {externalDiff.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <ExternalDiffConfig open={externalDiff.open} onOpenChange={externalDiff.onOpenChange} />
                </Suspense>
            )}
            {issueTracker.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <IssueTrackerSettings open={issueTracker.open} onOpenChange={issueTracker.onOpenChange} />
                </Suspense>
            )}
            {bulkOps.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <BulkCommitOperations
                        open={bulkOps.open}
                        onOpenChange={bulkOps.onOpenChange}
                        commits={bulkOpCommits}
                        onComplete={onBulkOpsComplete}
                    />
                </Suspense>
            )}
            {fileAnnotations.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <FileAnnotationsPanel
                        open={fileAnnotations.open}
                        onOpenChange={fileAnnotations.onOpenChange}
                        filePath={annotationsFile}
                        commitHash={selectedCommit ?? 'HEAD'}
                    />
                </Suspense>
            )}
            {activityHeatmap.open && (
                <Suspense fallback={<DialogLoadingFallback />}>
                    <ActivityHeatmap open={activityHeatmap.open} onOpenChange={activityHeatmap.onOpenChange} />
                </Suspense>
            )}
        </>
    );
}

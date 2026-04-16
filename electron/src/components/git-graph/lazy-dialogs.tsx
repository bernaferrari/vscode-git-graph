/**
 * Lazy-loaded Dialog Components
 * Code splitting for better performance
 */

import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';

// Loading fallback component
function DialogLoader() {
	return (
		<div className="flex items-center justify-center h-48">
			<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	);
}

// Wrapper for lazy loading dialogs
function createLazyDialog<T extends object>(
	importFn: () => Promise<unknown>
) {
	const LazyComponent = lazy(importFn as () => Promise<{ default: React.ComponentType<T> }>);

	return function LazyDialog(props: T & { open: boolean }) {
		if (!props.open) return null;

		return (
			<Suspense fallback={<DialogLoader />}>
				<LazyComponent {...props} />
			</Suspense>
		);
	};
}

// Lazy loaded components
export const LazyStatistics = createLazyDialog(
	() => import('./statistics').then(m => ({ default: m.Statistics }))
);

export const LazyInteractiveRebase = createLazyDialog(
	() => import('./interactive-rebase').then(m => ({ default: m.InteractiveRebase }))
);

export const LazyMergeConflictEditor = createLazyDialog(
	() => import('./merge-conflict-editor').then(m => ({ default: m.MergeConflictEditor }))
);

export const LazyGitFlowAutomation = createLazyDialog(
	() => import('./gitflow-automation').then(m => ({ default: m.GitFlowAutomation }))
);

export const LazySubmoduleManagement = createLazyDialog(
	() => import('./submodule-management').then(m => ({ default: m.SubmoduleManagement }))
);

export const LazyWorktreeManagement = createLazyDialog(
	() => import('./worktree-management').then(m => ({ default: m.WorktreeManagement }))
);

export const LazyLFSSupport = createLazyDialog(
	() => import('./lfs-support').then(m => ({ default: m.LFSSupport }))
);

export const LazyPullRequestIntegration = createLazyDialog(
	() => import('./pull-request-integration').then(m => ({ default: m.PullRequestIntegration }))
);

export const LazyGitConfigEditor = createLazyDialog(
	() => import('./git-config-editor').then(m => ({ default: m.GitConfigEditor }))
);

export const LazyUndoStackDialog = createLazyDialog(
	() => import('./undo-stack').then(m => ({ default: m.UndoStackDialog }))
);

export const LazyExternalDiffConfig = createLazyDialog(
	() => import('./external-diff-tool').then(m => ({ default: m.ExternalDiffConfig }))
);

export const LazyIssueTrackerSettings = createLazyDialog(
	() => import('./issue-tracker').then(m => ({ default: m.IssueTrackerSettings }))
);

export const LazyBulkCommitOperations = createLazyDialog(
	() => import('./bulk-commit-operations').then(m => ({ default: m.BulkCommitOperations }))
);

export const LazyFileAnnotationsPanel = createLazyDialog(
	() => import('./file-annotations-panel').then(m => ({ default: m.FileAnnotationsPanel }))
);

export const LazyActivityHeatmap = createLazyDialog(
	() => import('./activity-heatmap').then(m => ({ default: m.ActivityHeatmap }))
);

export const LazyRepoHealthCheck = createLazyDialog(
	() => import('./repo-health-check').then(m => ({ default: m.RepoHealthCheck }))
);

export const LazyGitBisectUI = createLazyDialog(
	() => import('./git-bisect-ui').then(m => ({ default: m.GitBisectUI }))
);

export const LazySearchAllCommits = createLazyDialog(
	() => import('./search-commits').then(m => ({ default: m.SearchAllCommits }))
);

export const LazyBranchCompare = createLazyDialog(
	() => import('./branch-compare').then(m => ({ default: m.BranchCompare }))
);

export const LazyRemoteManageDialog = createLazyDialog(
	() => import('./remote-manage-dialog').then(m => ({ default: m.RemoteManageDialog }))
);

export const LazyHooksManageDialog = createLazyDialog(
	() => import('./hooks-manage-dialog').then(m => ({ default: m.HooksManageDialog }))
);

export const LazyStashManagement = createLazyDialog(
	() => import('./stash-management').then(m => ({ default: m.StashManagement }))
);

export const LazyCommitTemplatesDialog = createLazyDialog(
	() => import('./commit-templates').then(m => ({ default: m.CommitTemplatesDialog }))
);

export const LazyGitignoreManager = createLazyDialog(
	() => import('./gitignore-manager').then(m => ({ default: m.GitignoreManager }))
);

export const LazyCustomCommands = createLazyDialog(
	() => import('./custom-commands').then(m => ({ default: m.CustomCommands }))
);

export const LazyReflogViewer = createLazyDialog(
	() => import('./reflog-viewer').then(m => ({ default: m.ReflogViewer }))
);

export const LazyCommitSigningDialog = createLazyDialog(
	() => import('./commit-signing-dialog').then(m => ({ default: m.CommitSigningDialog }))
);

export const LazyRecentRepositories = createLazyDialog(
	() => import('./recent-repositories').then(m => ({ default: m.RecentRepositories }))
);

export const LazyLineStaging = createLazyDialog(
	() => import('./line-staging').then(m => ({ default: m.LineStaging }))
);

export default {
	LazyStatistics,
	LazyInteractiveRebase,
	LazyMergeConflictEditor,
	LazyGitFlowAutomation,
	LazySubmoduleManagement,
	LazyWorktreeManagement,
	LazyLFSSupport,
	LazyPullRequestIntegration,
	LazyGitConfigEditor,
	LazyUndoStackDialog,
	LazyExternalDiffConfig,
	LazyIssueTrackerSettings,
	LazyBulkCommitOperations,
	LazyFileAnnotationsPanel,
	LazyActivityHeatmap,
	LazyRepoHealthCheck,
	LazyGitBisectUI,
	LazySearchAllCommits,
	LazyBranchCompare,
	LazyRemoteManageDialog,
	LazyHooksManageDialog,
	LazyStashManagement,
	LazyCommitTemplatesDialog,
	LazyGitignoreManager,
	LazyCustomCommands,
	LazyReflogViewer,
	LazyCommitSigningDialog,
	LazyRecentRepositories,
	LazyLineStaging,
};

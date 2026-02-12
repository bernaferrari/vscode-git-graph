/**
 * Git Graph Main Component
 * GitKraken-style Git visualization
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
	Loader2,
	GitBranch,
	Upload,
	Download,
	Terminal,
	Search,
	Plus,
	RefreshCw,
	ChevronDown,
	Tag,
	Merge,
	GitCommit,
	Archive,
	MoreHorizontal,
	X,
	FileCode,
	User,
	Calendar,
	Hash,
	Globe,
	PanelLeft,
	BarChart3,
	Settings,
	Undo,
	Star,
	Key,
	Filter,
	Pin,
	History,
	FileText,
	Package,
	GitPullRequest,
	FolderGit2,
	Keyboard,
	Info,
	Activity,
	Bug,
} from 'lucide-react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { CommitGraph } from './commit-graph';
import { CommitList } from './commit-list';
import { FindWidget, type FindOptions } from './find-widget';
import { BranchDropdown } from './branch-dropdown';
import {
	CreateBranchDialog,
	AddTagDialog,
	ResetDialog,
	DeleteBranchDialog,
	MergeDialog,
	RebaseDialog,
	CherryPickDialog,
	RevertDialog,
} from './dialogs';
import { CommitDetailsPanel } from './commit-details';
import { SidePanel } from './side-panel';
import { FuzzyFinder } from './fuzzy-finder';
import { InteractiveRebase } from './interactive-rebase';
import { Statistics } from './statistics';
import { GitFlowToolbar } from './gitflow-toolbar';
import { MergeConflictEditor } from './merge-conflict-editor';
import { RemoteManageDialog } from './remote-manage-dialog';
import { BranchCompare } from './branch-compare';
import { HooksManageDialog } from './hooks-manage-dialog';
import { TerminalPanel } from './terminal-panel';
import { CommitContextMenu } from './commit-context-menu';
import { CommitHistoryFilters, type CommitFilter } from './commit-history-filters';
import { PinnedCommitsDialog, usePinnedCommits, type PinnedCommit } from './pinned-commits';
import { CommitSigningDialog } from './commit-signing-dialog';
import { LineStaging } from './line-staging';
import { ReflogViewer } from './reflog-viewer';
import { CommitTemplatesDialog, useCommitTemplates, TemplateQuickInsert } from './commit-templates';
import { GitignoreManager } from './gitignore-manager';
import { CustomCommands } from './custom-commands';
import { InlineBlame, BlamePill } from './inline-blame';
import { SearchAllCommits } from './search-commits';
import { LFSSupport } from './lfs-support';
import { PullRequestIntegration } from './pull-request-integration';
import { EnhancedCommitPanel } from './enhanced-commit-panel';
import { WorktreeManagement } from './worktree-management';
import { SubmoduleManagement } from './submodule-management';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';
import { RecentRepositories } from './recent-repositories';
import { StashManagement } from './stash-management';
import { DragDropCherryPick } from './drag-drop-cherry-pick';
import { CommitGraphLegend } from './commit-graph-legend';
import { SettingsDialog, useSettings } from './settings-dialog';
import { StatusBar } from './status-bar';
import { QuickActionsToolbar } from './quick-actions-toolbar';
import { RepoHealthCheck } from './repo-health-check';
import { Avatar, AvatarWithTooltip } from './avatar';
import { CommandPalette } from './command-palette';
import { GitFlowAutomation } from './gitflow-automation';
import { VirtualizedCommitList } from './virtualized-commit-list';
import { LaneGraph } from './lane-graph';
import { InlineStagingDiff } from './inline-staging-diff';
import { GitBisectUI } from './git-bisect-ui';
import { CIStatusBadge, CIStatusMini } from './ci-status';
import { BlameOnHover } from './blame-on-hover';
import { UndoStackProvider, UndoStackDialog, UndoRedoButtons } from './undo-stack';
import { ExternalDiffConfig, OpenInExternalDiffButton } from './external-diff-tool';
import { GitConfigEditor } from './git-config-editor';
import { IssueTrackerSettings, IssueTrackerPanel } from './issue-tracker';
import { BulkCommitOperations } from './bulk-commit-operations';
import { FileAnnotationsPanel } from './file-annotations-panel';
import { ActivityHeatmap } from './activity-heatmap';
import { QuickLookPanel, QuickLookButton, useQuickLook, useQuickLookKeyboard } from './quick-look';
import { DragCommitHandler, DraggableCommit, BranchDropZone, useDragCommit } from './drag-commit-to-branch';
import { useGitOperations } from '@/hooks/useGitOperations';
import {
	GraphLayoutCalculator,
	DEFAULT_GRAPH_CONFIG,
} from '@/lib/graph/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

// Type for commits returned by tRPC
interface ClientCommit {
	hash: string;
	parents: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	heads: string[];
	tags: string[];
	remotes: string[];
}

// Graph configuration
const GRAPH_CONFIG = DEFAULT_GRAPH_CONFIG;
const graphCalculator = new GraphLayoutCalculator(GRAPH_CONFIG, {
	mergeCommits: true,
	commitsNotAncestorsOfHead: false,
});

// Toolbar button component
function ToolbarButton({
	icon: Icon,
	label,
	shortcut,
	onClick,
	variant = 'ghost',
	disabled,
}: {
	icon: React.ElementType;
	label: string;
	shortcut?: string;
	onClick: () => void;
	variant?: 'ghost' | 'default' | 'outline';
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant={variant}
					size="sm"
					className="h-8 px-2 gap-1.5"
					onClick={onClick}
					disabled={disabled}
				>
					<Icon className="h-4 w-4" />
					<span className="hidden sm:inline">{label}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<p>{label}{shortcut && ` (${shortcut})`}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function GitGraph() {
	// App store
	const {
		activeRepo,
		selectedCommit,
		commitDetailsOpen,
		setSelectedCommit,
		setCommitDetailsOpen,
	} = useAppStore();

	// Local state
	const [expandedCommit, setExpandedCommit] = useState<number | null>(null);
	const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);
	const [findWidgetOpen, setFindWidgetOpen] = useState(false);
	const [findMatches, setFindMatches] = useState<number[]>([]);
	const [findCurrentIndex, setFindCurrentIndex] = useState(0);
	const [selectedBranches, setSelectedBranches] = useState<string[]>(['__all__']);
	const [showSidePanel, setShowSidePanel] = useState(true);
	const [layoutMode, setLayoutMode] = useState<'panel' | 'tabs'>('panel');

	// New feature states
	const [fuzzyFinderOpen, setFuzzyFinderOpen] = useState(false);
	const [interactiveRebaseOpen, setInteractiveRebaseOpen] = useState(false);
	const [statisticsOpen, setStatisticsOpen] = useState(false);
	const [terminalOpen, setTerminalOpen] = useState(false);
	const [remoteManageOpen, setRemoteManageOpen] = useState(false);
	const [branchCompareOpen, setBranchCompareOpen] = useState(false);
	const [hooksManageOpen, setHooksManageOpen] = useState(false);
	const [mergeConflictOpen, setMergeConflictOpen] = useState(false);
	const [conflictFile, setConflictFile] = useState<{ path: string; ours: string; theirs: string } | null>(null);

	// Additional feature states
	const [commitSigningOpen, setCommitSigningOpen] = useState(false);
	const [pinnedCommitsOpen, setPinnedCommitsOpen] = useState(false);
	const [commitFilters, setCommitFilters] = useState<CommitFilter>({});
	const [contextMenuOpen, setContextMenuOpen] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
	const [showFiltersDialog, setShowFiltersDialog] = useState(false);
	const [lineStagingOpen, setLineStagingOpen] = useState(false);
	const [stagingFile, setStagingFile] = useState<string | null>(null);
	const [reflogOpen, setReflogOpen] = useState(false);
	const [templatesOpen, setTemplatesOpen] = useState(false);
	const [gitignoreOpen, setGitignoreOpen] = useState(false);
	const [customCommandsOpen, setCustomCommandsOpen] = useState(false);
	const [searchCommitsOpen, setSearchCommitsOpen] = useState(false);
	const [lfsOpen, setLfsOpen] = useState(false);
	const [inlineBlameEnabled, setInlineBlameEnabled] = useState(false);
	const [prIntegrationOpen, setPrIntegrationOpen] = useState(false);
	const [worktreeOpen, setWorktreeOpen] = useState(false);
	const [submoduleOpen, setSubmoduleOpen] = useState(false);
	const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
	const [recentReposOpen, setRecentReposOpen] = useState(false);
	const [stashManageOpen, setStashManageOpen] = useState(false);
	const [graphLegendOpen, setGraphLegendOpen] = useState(false);
	const [cherryPickDialogOpen, setCherryPickDialogOpen] = useState(false);
	const [cherryPickCommit, setCherryPickCommit] = useState<{ hash: string; message: string; author: string } | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
	const [gitFlowOpen, setGitFlowOpen] = useState(false);
	const [healthCheckOpen, setHealthCheckOpen] = useState(false);
	const [bisectOpen, setBisectOpen] = useState(false);
	
	// New advanced features
	const [undoStackOpen, setUndoStackOpen] = useState(false);
	const [configEditorOpen, setConfigEditorOpen] = useState(false);
	const [externalDiffOpen, setExternalDiffOpen] = useState(false);
	const [issueTrackerOpen, setIssueTrackerOpen] = useState(false);
	const [bulkOpsOpen, setBulkOpsOpen] = useState(false);
	
	// Additional advanced features
	const [fileAnnotationsOpen, setFileAnnotationsOpen] = useState(false);
	const [annotationsFile, setAnnotationsFile] = useState<string>('');
	const [activityHeatmapOpen, setActivityHeatmapOpen] = useState(false);
	const [dragCherryPickOpen, setDragCherryPickOpen] = useState(false);
	const [dragCommit, setDragCommit] = useState<{ hash: string; message: string } | null>(null);
	const [dragTargetBranch, setDragTargetBranch] = useState('');
	
	// Quick Look hook
	useQuickLookKeyboard();

	// Graph mode: 'classic' or 'lanes'
	const [graphMode, setGraphMode] = useState<'classic' | 'lanes'>('classic');

	// Settings hook
	const { settings } = useSettings();

	// Pinned commits hook
	const { pinnedCommits, pinCommit, unpinCommit, updateNote, isPinned } = usePinnedCommits(activeRepo);
	
	// Commit templates hook
	const { templates, addTemplate, updateTemplate, deleteTemplate } = useCommitTemplates();

	// Refs
	// Note: ScrollArea handles scrolling internally

	// Dialog state
	const [createBranchOpen, setCreateBranchOpen] = useState(false);
	const [addTagOpen, setAddTagOpen] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);
	const [mergeOpen, setMergeOpen] = useState(false);
	const [rebaseOpen, setRebaseOpen] = useState(false);
	const [cherryPickOpen, setCherryPickOpen] = useState(false);
	const [revertOpen, setRevertOpen] = useState(false);
	const [targetCommit, setTargetCommit] = useState<string>('');
	const [targetBranch, _setTargetBranch] = useState<string>('');

	// Git operations hook
	const gitOps = useGitOperations();

	// Commit limit state
	const [maxCommits, setMaxCommits] = useState(500);

	// tRPC queries
	const { data: repoInfo, isLoading: repoLoading } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: true,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo }
	);

	const {
		data: commitsData,
		isLoading: commitsLoading,
		refetch: refetchCommits,
	} = trpc.git.commits.useQuery(
		{
			repo: activeRepo ?? '',
			branches: selectedBranches.includes('__all__') ? null : selectedBranches,
			maxCommits,
			order: 'date',
			onlyFollowFirstParent: false,
			showTags: true,
			showRemoteBranches: true,
			hideRemotes: [],
		},
		{
			enabled: !!activeRepo,
			refetchInterval: 30000,
			staleTime: 10000,
		}
	);

	// Load more commits handler
	const handleLoadMore = useCallback(() => {
		setMaxCommits(prev => prev + 500);
	}, []);

	// Git status check
	const { data: gitStatus } = trpc.git.status.useQuery();

	// Derive commit lookup
	const commitLookup = useMemo(() => {
		if (!commitsData?.commits) return {};
		const lookup: Record<string, number> = {};
		commitsData.commits.forEach((commit: ClientCommit, index: number) => {
			lookup[commit.hash] = index;
		});
		return lookup;
	}, [commitsData?.commits]);

	// Calculate graph layout
	const graphLayout = useMemo(() => {
		if (!commitsData?.commits) return null;
		return graphCalculator.calculate(
			commitsData.commits,
			commitsData.head,
			commitLookup,
			false
		);
	}, [commitsData, commitLookup]);

	// Branch options for dropdown
	const branchOptions = useMemo(() => {
		if (!repoInfo?.branches) return [];
		return repoInfo.branches.map((b: string) => ({
			name: b,
			value: b,
			isRemote: b.startsWith('remotes/'),
			isCurrent: b === repoInfo.head,
		}));
	}, [repoInfo]);

	// Handlers
	const handleSelectCommit = useCallback((index: number) => {
		setSelectedCommitIndex(index);
		const commit = commitsData?.commits[index];
		if (commit) {
			setSelectedCommit(commit.hash);
			// Auto-open details panel on click
			if (!commitDetailsOpen) {
				setCommitDetailsOpen(true);
			}
		}
	}, [commitsData, setSelectedCommit, commitDetailsOpen, setCommitDetailsOpen]);

	const handleExpandCommit = useCallback((index: number | null) => {
		setExpandedCommit(index);
		setCommitDetailsOpen(index !== null);
	}, [setCommitDetailsOpen]);

	const handleFind = useCallback((query: string, options: FindOptions) => {
		if (!commitsData?.commits || !query) {
			setFindMatches([]);
			setFindCurrentIndex(0);
			return;
		}

		const matches: number[] = [];
		commitsData.commits.forEach((commit: ClientCommit, index: number) => {
			const searchStr = options.caseSensitive
				? commit.message
				: commit.message.toLowerCase();
			const searchQuery = options.caseSensitive ? query : query.toLowerCase();

			if (options.regex) {
				try {
					const regex = new RegExp(searchQuery);
					if (regex.test(searchStr)) {
						matches.push(index);
					}
				} catch {
					// Invalid regex
				}
			} else if (searchStr.includes(searchQuery)) {
				matches.push(index);
			}
		});

		setFindMatches(matches);
		setFindCurrentIndex(0);

		const firstMatch = matches[0];
		if (firstMatch !== undefined) {
			handleSelectCommit(firstMatch);
		}
	}, [commitsData, handleSelectCommit]);

	const handleFindNext = useCallback(() => {
		if (findMatches.length === 0) return;
		const nextIndex = (findCurrentIndex + 1) % findMatches.length;
		setFindCurrentIndex(nextIndex);
		const match = findMatches[nextIndex];
		if (match !== undefined) handleSelectCommit(match);
	}, [findMatches, findCurrentIndex, handleSelectCommit]);

	const handleFindPrevious = useCallback(() => {
		if (findMatches.length === 0) return;
		const prevIndex = (findCurrentIndex - 1 + findMatches.length) % findMatches.length;
		setFindCurrentIndex(prevIndex);
		const match = findMatches[prevIndex];
		if (match !== undefined) handleSelectCommit(match);
	}, [findMatches, findCurrentIndex, handleSelectCommit]);

	// Context menu handler
	const handleContextMenu = useCallback((index: number, event: React.MouseEvent) => {
		event.preventDefault();
		const commit = commitsData?.commits[index];
		if (commit) {
			setTargetCommit(commit.hash);
			setSelectedCommitIndex(index);
			setSelectedCommit(commit.hash);
			setContextMenuPosition({ x: event.clientX, y: event.clientY });
			setContextMenuOpen(true);
		}
	}, [commitsData, setSelectedCommit]);

	// Get current commit for context menu
	const selectedCommitData = useMemo(() => {
		if (!targetCommit || !commitsData?.commits) return null;
		return commitsData.commits.find((c: ClientCommit) => c.hash === targetCommit);
	}, [targetCommit, commitsData?.commits]);

	// Handle pin commit
	const handlePinCommit = useCallback(() => {
		if (selectedCommitData) {
			pinCommit({
				hash: selectedCommitData.hash,
				message: selectedCommitData.message,
				author: selectedCommitData.author,
				date: new Date(selectedCommitData.date * 1000).toISOString(),
			});
		}
	}, [selectedCommitData, pinCommit]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const totalCommits = commitsData?.commits?.length ?? 0;

			if (e.key === 'j' || e.key === 'ArrowDown') {
				e.preventDefault();
				if (totalCommits > 0) {
					const nextIndex = selectedCommitIndex === null ? 0 : Math.min(selectedCommitIndex + 1, totalCommits - 1);
					handleSelectCommit(nextIndex);
				}
			} else if (e.key === 'k' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (totalCommits > 0) {
					const prevIndex = selectedCommitIndex === null ? totalCommits - 1 : Math.max(selectedCommitIndex - 1, 0);
					handleSelectCommit(prevIndex);
				}
			} else if (e.key === 'g') {
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(0);
			} else if (e.key === 'G') {
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(totalCommits - 1);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (selectedCommitIndex !== null) {
					handleExpandCommit(expandedCommit === selectedCommitIndex ? null : selectedCommitIndex);
				}
			} else if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setFindWidgetOpen(true);
			} else if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				refetchCommits();
			} else if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setCreateBranchOpen(true);
				}
			} else if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setAddTagOpen(true);
				}
			} else if (e.key === 'Escape') {
				setCommitDetailsOpen(false);
				setFindWidgetOpen(false);
				setFuzzyFinderOpen(false);
			} else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setFuzzyFinderOpen(true);
			} else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setTerminalOpen(!terminalOpen);
			} else if (e.key === 's' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				e.preventDefault();
				setStatisticsOpen(true);
			} else if (e.key === 'p' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				e.preventDefault();
				setPinnedCommitsOpen(true);
			} else if (e.key === 'r' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				e.preventDefault();
				setRemoteManageOpen(true);
			} else if (e.key === 'F' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				// Cmd+Shift+F for global search
				e.preventDefault();
				setSearchCommitsOpen(true);
			} else if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
				// Pin current commit with 's' (star)
				e.preventDefault();
				handlePinCommit();
			} else if (e.key === '?') {
				// Show help/keyboard shortcuts
				e.preventDefault();
				setKeyboardHelpOpen(true);
			} else if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
				// Cmd+, for settings
				e.preventDefault();
				setSettingsOpen(true);
			} else if (e.key === 'P' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				// Cmd+Shift+P for command palette
				e.preventDefault();
				setCommandPaletteOpen(true);
			} else if (e.key === 'G' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				// Cmd+Shift+G for Git Flow
				e.preventDefault();
				setGitFlowOpen(true);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [refetchCommits, commitsData?.commits?.length, selectedCommitIndex, selectedCommit, expandedCommit, handleSelectCommit, handleExpandCommit, setCommitDetailsOpen, terminalOpen, handlePinCommit, setSearchCommitsOpen, setKeyboardHelpOpen, setSettingsOpen, setCommandPaletteOpen, setGitFlowOpen]);

	// tRPC mutations
	const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();
	const { mutate: registerRepo } = trpc.repo.register.useMutation();
	const { setActiveRepo, addRecentRepo } = useAppStore();

	const handleOpenRepo = async () => {
		try {
			const result = await showOpenDialog({
				title: 'Open Repository',
				properties: ['openDirectory'],
			});
			if (!result.canceled && result.filePaths[0]) {
				const path = result.filePaths[0];
				registerRepo({ path });
				setActiveRepo(path);
				addRecentRepo(path);
			}
		} catch (error) {
			console.error('Failed to open folder:', error);
		}
	};

	// No repo selected
	if (!activeRepo) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
						<GitCommit className="h-10 w-10 text-primary" />
					</div>
					<h1 className="text-2xl font-semibold mb-2">Welcome to Git Graph</h1>
					<p className="text-muted-foreground mb-6">
						Open a Git repository to visualize your commit history.
					</p>
					<Button size="lg" onClick={handleOpenRepo} className="gap-2">
						<Plus className="h-5 w-5" />
						Open Repository
					</Button>
					<p className="text-xs text-muted-foreground mt-4">
						or use the sidebar to browse recent repositories
					</p>
				</div>
			</div>
		);
	}

	// Git not available
	if (gitStatus && !gitStatus.available) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center">
						<X className="h-10 w-10 text-destructive" />
					</div>
					<h1 className="text-2xl font-semibold mb-2">Git Not Available</h1>
					<p className="text-muted-foreground mb-2">
						Git Graph requires Git to be installed.
					</p>
					<p className="text-sm text-muted-foreground/70 mb-4">{gitStatus.error}</p>
					<Button variant="outline" onClick={() => window.open('https://git-scm.com/downloads', '_blank')}>
						Download Git
					</Button>
				</div>
			</div>
		);
	}

	// Loading
	if (repoLoading || commitsLoading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
					<p className="text-sm text-muted-foreground">Loading commits...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (commitsData?.error) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-lg mb-2 text-destructive">Error Loading Commits</p>
					<p className="text-sm text-muted-foreground mb-4">{commitsData.error}</p>
					<Button variant="outline" onClick={() => refetchCommits()}>
						Retry
					</Button>
				</div>
			</div>
		);
	}

	const currentHead = repoInfo?.head ?? 'main';

	return (
		<UndoStackProvider repoPath={activeRepo}>
			<TooltipProvider>
			<div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
				{/* Top Toolbar */}
				<div className="flex items-center gap-1 px-3 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{/* Repo info */}
					<div className="flex items-center gap-2 mr-2">
						<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
							<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm font-medium">{activeRepo.split('/').pop()}</span>
						</div>
						{/* Current branch - clickable to show branches */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="secondary" size="sm" className="h-6 px-2 text-xs font-mono gap-1">
									{currentHead}
									<ChevronDown className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
								<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground sticky top-0 bg-popover">
									Local Branches ({repoInfo?.branches?.filter(b => !b.startsWith('remotes/')).length ?? 0})
								</div>
								{repoInfo?.branches?.filter(b => !b.startsWith('remotes/')).map((branch) => (
									<DropdownMenuItem
										key={branch}
										className={branch === currentHead ? 'bg-accent' : ''}
										onClick={() => {
											if (branch !== currentHead) {
												gitOps.checkout(branch);
											}
										}}
									>
										<GitBranch className={`h-4 w-4 mr-2 ${branch === currentHead ? 'text-primary' : 'text-muted-foreground'}`} />
										<span className="flex-1">{branch}</span>
										{branch === currentHead && (
											<span className="text-xs text-primary font-medium">✓</span>
										)}
									</DropdownMenuItem>
								))}
								{/* Remote branches */}
								{repoInfo?.branches?.filter(b => b.startsWith('remotes/')).length > 0 && (
									<>
										<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground sticky top-0 bg-popover mt-2 border-t pt-2">
											Remote Branches ({repoInfo?.branches?.filter(b => b.startsWith('remotes/')).length ?? 0})
										</div>
										{repoInfo?.branches?.filter(b => b.startsWith('remotes/')).map((branch) => (
											<DropdownMenuItem
												key={branch}
												onClick={() => {
													// Checkout remote branch (creates local tracking branch)
													gitOps.checkout(branch);
												}}
											>
												<Globe className="h-4 w-4 mr-2 text-muted-foreground" />
												<span className="flex-1">{branch.replace('remotes/', '')}</span>
											</DropdownMenuItem>
										))}
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div className="h-5 w-px bg-border mx-1" />

					{/* Main actions */}
					<ToolbarButton
						icon={Download}
						label="Fetch"
						onClick={() => gitOps.fetch()}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
								<Upload className="h-4 w-4" />
								<span className="hidden sm:inline">Push</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => gitOps.push(currentHead, 'origin', true, false)}>
								<Upload className="h-4 w-4 mr-2" />
								Push
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => gitOps.push(currentHead, 'origin', true, true)}>
								<Upload className="h-4 w-4 mr-2 text-amber-600" />
								Force Push
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<ToolbarButton
						icon={GitBranch}
						label="Pull"
						onClick={() => gitOps.pull()}
					/>

					<div className="h-5 w-px bg-border mx-1" />

					{/* Branch/Tag creation */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
								<Plus className="h-4 w-4" />
								<span className="hidden sm:inline">New</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => {
								setTargetCommit(selectedCommit ?? 'HEAD');
								setCreateBranchOpen(true);
							}}>
								<GitBranch className="h-4 w-4 mr-2" />
								Branch...
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => {
								setTargetCommit(selectedCommit ?? 'HEAD');
								setAddTagOpen(true);
							}}>
								<Tag className="h-4 w-4 mr-2" />
								Tag...
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => {
								// TODO: Stash
							}}>
								<Archive className="h-4 w-4 mr-2" />
								Stash
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Branch filter */}
					<div className="ml-2 w-44">
						<BranchDropdown
							branches={branchOptions}
							selectedBranches={selectedBranches}
							multiple
							onChange={setSelectedBranches}
						/>
					</div>

					{/* Commit History Filters */}
					{(commitFilters.author || commitFilters.search || commitFilters.dateFrom || commitFilters.dateTo || commitFilters.filePath) && (
						<Badge variant="secondary" className="ml-2 gap-1">
							<Filter className="h-3 w-3" />
							<span className="text-xs">Filtered</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0 ml-1"
								onClick={() => setCommitFilters({})}
							>
								<X className="h-3 w-3" />
							</Button>
						</Badge>
					)}

					{/* Right side */}
					<div className="flex-1" />

					{/* Search */}
					<ToolbarButton
						icon={Search}
						label="Find"
						shortcut="⌘F"
						onClick={() => setFindWidgetOpen(true)}
					/>

					{/* Refresh */}
					<ToolbarButton
						icon={RefreshCw}
						label="Refresh"
						shortcut="⌘R"
						onClick={() => refetchCommits()}
					/>

					{/* Toggle Side Panel */}
					<ToolbarButton
						icon={PanelLeft}
						label="Toggle Panel"
						onClick={() => setShowSidePanel(!showSidePanel)}
					/>

					{/* Pinned Commits */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 relative"
								onClick={() => setPinnedCommitsOpen(true)}
							>
								<Pin className="h-4 w-4" />
								{pinnedCommits.length > 0 && (
									<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] flex items-center justify-center text-primary-foreground">
										{pinnedCommits.length}
									</span>
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Pinned Commits</TooltipContent>
					</Tooltip>

					{/* More options */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => {
								// TODO: Open in terminal
							}}>
								<Terminal className="h-4 w-4 mr-2" />
								Open in Terminal
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => {
								// TODO: Open in Finder
							}}>
								<FileCode className="h-4 w-4 mr-2" />
								Open in Finder
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setFuzzyFinderOpen(true)}>
								<Search className="h-4 w-4 mr-2" />
								Quick Switch...
								<span className="ml-auto text-xs text-muted-foreground">⌘K</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setShowFiltersDialog(true)}>
								<Filter className="h-4 w-4 mr-2" />
								Filter Commits...
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTerminalOpen(!terminalOpen)}>
								<Terminal className="h-4 w-4 mr-2" />
								Toggle Terminal
								<span className="ml-auto text-xs text-muted-foreground">⌘P</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setStatisticsOpen(true)}>
								<BarChart3 className="h-4 w-4 mr-2" />
								Statistics
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setRemoteManageOpen(true)}>
								<Globe className="h-4 w-4 mr-2" />
								Manage Remotes
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setBranchCompareOpen(true)}>
								<GitBranch className="h-4 w-4 mr-2" />
								Compare Branches
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setHooksManageOpen(true)}>
								<Settings className="h-4 w-4 mr-2" />
								Hooks
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setCommitSigningOpen(true)}>
								<Key className="h-4 w-4 mr-2" />
								Commit Signing
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setReflogOpen(true)}>
								<History className="h-4 w-4 mr-2" />
								Reflog
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setTemplatesOpen(true)}>
								<FileText className="h-4 w-4 mr-2" />
								Commit Templates
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setGitignoreOpen(true)}>
								<FileText className="h-4 w-4 mr-2" />
								Edit .gitignore
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setCustomCommandsOpen(true)}>
								<Terminal className="h-4 w-4 mr-2" />
								Custom Commands
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setSearchCommitsOpen(true)}>
								<Search className="h-4 w-4 mr-2" />
								Search Commits
								<span className="ml-auto text-xs text-muted-foreground">⌘⇧F</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setLfsOpen(true)}>
								<Package className="h-4 w-4 mr-2" />
								LFS Management
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setInlineBlameEnabled(!inlineBlameEnabled)}>
								<User className="h-4 w-4 mr-2" />
								{inlineBlameEnabled ? 'Disable' : 'Enable'} Inline Blame
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setPrIntegrationOpen(true)}>
								<GitPullRequest className="h-4 w-4 mr-2" />
								Pull Requests
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setWorktreeOpen(true)}>
								<FolderGit2 className="h-4 w-4 mr-2" />
								Worktrees
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setSubmoduleOpen(true)}>
								<Package className="h-4 w-4 mr-2" />
								Submodules
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setRecentReposOpen(true)}>
								<FolderGit2 className="h-4 w-4 mr-2" />
								Recent Repositories
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setKeyboardHelpOpen(true)}>
								<Keyboard className="h-4 w-4 mr-2" />
								Keyboard Shortcuts
								<span className="ml-auto text-xs text-muted-foreground">?</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setStashManageOpen(true)}>
								<Archive className="h-4 w-4 mr-2" />
								Manage Stashes
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setGraphLegendOpen(true)}>
								<Info className="h-4 w-4 mr-2" />
								Graph Legend
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setGitFlowOpen(true)}>
								<GitBranch className="h-4 w-4 mr-2" />
								Git Flow
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setHealthCheckOpen(true)}>
								<Activity className="h-4 w-4 mr-2" />
								Health Check
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setBisectOpen(true)}>
								<Bug className="h-4 w-4 mr-2" />
								Git Bisect
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setUndoStackOpen(true)}>
								<History className="h-4 w-4 mr-2" />
								Undo History
								<span className="ml-auto text-xs text-muted-foreground">⌘Z</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setConfigEditorOpen(true)}>
								<Settings className="h-4 w-4 mr-2" />
								Git Configuration
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setExternalDiffOpen(true)}>
								<FileCode className="h-4 w-4 mr-2" />
								External Diff Settings
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setIssueTrackerOpen(true)}>
								<GitPullRequest className="h-4 w-4 mr-2" />
								Issue Tracker Settings
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setBulkOpsOpen(true)}>
								<GitCommit className="h-4 w-4 mr-2" />
								Bulk Operations
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFileAnnotationsOpen(true)}>
								<FileCode className="h-4 w-4 mr-2" />
								File Annotations
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setActivityHeatmapOpen(true)}>
								<BarChart3 className="h-4 w-4 mr-2" />
								Activity Heatmap
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setSettingsOpen(true)}>
								<Settings className="h-4 w-4 mr-2" />
								Settings
								<span className="ml-auto text-xs text-muted-foreground">⌘,</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setCommandPaletteOpen(true)}>
								<Search className="h-4 w-4 mr-2" />
								Command Palette
								<span className="ml-auto text-xs text-muted-foreground">⌘⇧P</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => gitOps.undoLastCommit()}>
								<Undo className="h-4 w-4 mr-2" />
								Undo Last Commit
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Find Widget */}
				<FindWidget
					open={findWidgetOpen}
					onClose={() => setFindWidgetOpen(false)}
					onFind={handleFind}
					onFindNext={handleFindNext}
					onFindPrevious={handleFindPrevious}
					currentIndex={findCurrentIndex}
					totalMatches={findMatches.length}
				/>

				{/* Main Content */}
				<div className="flex-1 flex overflow-hidden min-w-0">
					{/* Side Panel - Branches/Tags/Stashes */}
					{showSidePanel && layoutMode === 'panel' && (
						<SidePanel />
					)}

					{/* Graph and Commit List */}
					<div className="flex-1 flex flex-col overflow-hidden">
						{/* Graph mode toggle */}
						<div className="flex items-center gap-2 px-3 py-1 border-b bg-muted/30 text-xs">
							<span className="text-muted-foreground">Graph:</span>
							<Button
								variant={graphMode === 'classic' ? 'default' : 'ghost'}
								size="sm"
								className="h-5 px-2 text-xs"
								onClick={() => setGraphMode('classic')}
							>
								Classic
							</Button>
							<Button
								variant={graphMode === 'lanes' ? 'default' : 'ghost'}
								size="sm"
								className="h-5 px-2 text-xs"
								onClick={() => setGraphMode('lanes')}
							>
								Lanes
							</Button>
						</div>

						<div className="flex-1 flex overflow-hidden">
							<ScrollArea className="h-full w-full">
								<div className="flex min-w-max">
									{/* Refs column - branches and tags */}
									<div className="shrink-0 w-32 border-r bg-muted/10">
										{commitsData?.commits?.map((commit, index) => (
											<div
												key={commit.hash}
												className="flex items-center gap-1 px-2 h-8 text-xs"
												onClick={() => handleSelectCommit(index)}
											>
												{commit.heads && commit.heads.length > 0 && (
													<span className="px-1.5 py-0.5 bg-primary/15 text-primary rounded text-[10px] font-medium truncate">
														{commit.heads[0]}
													</span>
												)}
												{commit.tags && commit.tags.length > 0 && (
													<span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium truncate">
														{commit.tags[0]}
													</span>
												)}
											</div>
										))}
									</div>

									{/* Graph */}
									<div className="shrink-0 bg-background" style={{ width: graphLayout?.width ?? 200 }}>
										{graphMode === 'classic' && graphLayout && (
											<CommitGraph
												layout={graphLayout}
												config={GRAPH_CONFIG}
												expandedIndex={expandedCommit ?? -1}
												onVertexClick={handleSelectCommit}
												onVertexHover={() => {}}
											/>
										)}
										{graphMode === 'lanes' && commitsData?.commits && (
											<LaneGraph
												commits={commitsData.commits}
												selectedIndex={selectedCommitIndex}
												onSelectCommit={handleSelectCommit}
											/>
										)}
									</div>

									{/* Commit list */}
									<div className="flex-1 min-w-[400px]">
										{commitsData?.commits && commitsData.commits.length > 0 ? (
											<CommitList
												commits={commitsData.commits}
												layout={graphLayout}
												selectedIndex={selectedCommitIndex}
												expandedIndex={expandedCommit}
												onSelect={handleSelectCommit}
												onExpand={handleExpandCommit}
												onContextMenu={handleContextMenu}
												hideRefs={true}
											/>
										) : (
											<div className="flex items-center justify-center h-64 text-muted-foreground">
												<p>No commits found</p>
											</div>
										)}
									</div>
								</div>
							</ScrollArea>
						</div>
					</div>

					{/* Commit Details Panel */}
					{commitDetailsOpen && selectedCommit && (
						<div className="w-80 shrink-0 border-l">
							<CommitDetailsPanel
								commitHash={selectedCommit}
								onClose={() => setCommitDetailsOpen(false)}
							/>
						</div>
					)}
				</div>

				{/* Status bar */}
				<div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-t bg-background/95">
					<span>{commitsData?.commits?.length ?? 0} commits</span>
					{commitsData?.moreCommitsAvailable && (
						<>
							<span>•</span>
							<span
								className="text-primary cursor-pointer hover:underline"
								onClick={handleLoadMore}
							>
								Load more
							</span>
						</>
					)}
					<div className="flex-1" />
					<span>{repoInfo?.branches?.length ?? 0} branches</span>
					<span>•</span>
					<span>{repoInfo?.tags?.length ?? 0} tags</span>
				</div>

				{/* Dialogs */}
				<CreateBranchDialog
					open={createBranchOpen}
					onOpenChange={setCreateBranchOpen}
					onCreate={(name, checkout) => {
						gitOps.createBranch(targetCommit, name, checkout);
						setCreateBranchOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<AddTagDialog
					open={addTagOpen}
					onOpenChange={setAddTagOpen}
					onAdd={(name, type, _push) => {
						gitOps.createTag(targetCommit, name, type === 'annotated' ? name : undefined);
						setAddTagOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<ResetDialog
					open={resetOpen}
					onOpenChange={setResetOpen}
					onReset={(mode) => {
						gitOps.reset(targetCommit, mode);
						setResetOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<DeleteBranchDialog
					open={deleteBranchOpen}
					onOpenChange={setDeleteBranchOpen}
					onDelete={(force) => {
						gitOps.deleteBranch(targetBranch, force);
						setDeleteBranchOpen(false);
					}}
					branchName={targetBranch}
				/>

				<MergeDialog
					open={mergeOpen}
					onOpenChange={setMergeOpen}
					onMerge={(options) => {
						gitOps.merge(targetBranch, options);
						setMergeOpen(false);
					}}
					branchName={targetBranch}
				/>

				<RebaseDialog
					open={rebaseOpen}
					onOpenChange={setRebaseOpen}
					onRebase={(interactive) => {
						gitOps.rebase(targetCommit, interactive);
						setRebaseOpen(false);
					}}
					onto={targetCommit}
				/>

				<CherryPickDialog
					open={cherryPickOpen}
					onOpenChange={setCherryPickOpen}
					onCherryPick={(noCommit) => {
						gitOps.cherryPick(targetCommit, noCommit);
						setCherryPickOpen(false);
					}}
					commitHash={targetCommit}
				/>

				<RevertDialog
					open={revertOpen}
					onOpenChange={setRevertOpen}
					onRevert={(noCommit) => {
						gitOps.revert(targetCommit, noCommit);
						setRevertOpen(false);
					}}
					commitHash={targetCommit}
				/>

				{/* New Feature Dialogs */}
				<FuzzyFinder
					open={fuzzyFinderOpen}
					onOpenChange={setFuzzyFinderOpen}
				/>

				<InteractiveRebase
					open={interactiveRebaseOpen}
					onOpenChange={setInteractiveRebaseOpen}
					baseCommit={targetCommit}
					commits={commitsData?.commits?.slice(0, 20) ?? []}
				/>

				<Statistics
					open={statisticsOpen}
					onClose={() => setStatisticsOpen(false)}
				/>

				<RemoteManageDialog
					open={remoteManageOpen}
					onOpenChange={setRemoteManageOpen}
				/>

				<BranchCompare
					open={branchCompareOpen}
					onOpenChange={setBranchCompareOpen}
					branches={repoInfo?.branches ?? []}
					initialFrom={repoInfo?.head ?? ''}
				/>

				<HooksManageDialog
					open={hooksManageOpen}
					onOpenChange={setHooksManageOpen}
				/>

				<MergeConflictEditor
					open={mergeConflictOpen}
					onOpenChange={setMergeConflictOpen}
					conflict={conflictFile}
					onResolve={(path, content) => {
						console.log('Resolved:', path, content);
						setMergeConflictOpen(false);
					}}
				/>

				<TerminalPanel
					open={terminalOpen}
					onOpenChange={setTerminalOpen}
					cwd={activeRepo ?? undefined}
				/>

				{/* Commit Signing Dialog */}
				<CommitSigningDialog
					open={commitSigningOpen}
					onOpenChange={setCommitSigningOpen}
				/>

				{/* Pinned Commits Dialog */}
				<PinnedCommitsDialog
					open={pinnedCommitsOpen}
					onOpenChange={setPinnedCommitsOpen}
					pinnedCommits={pinnedCommits}
					onPin={(commit) => pinCommit(commit as Omit<PinnedCommit, 'pinnedAt'>)}
					onUnpin={unpinCommit}
					onUpdateNote={updateNote}
					onJumpToCommit={(hash) => {
						const index = commitsData?.commits?.findIndex((c: ClientCommit) => c.hash === hash);
						if (index !== undefined && index >= 0) {
							handleSelectCommit(index);
							setPinnedCommitsOpen(false);
						}
					}}
				/>

				{/* Reflog Viewer */}
				<ReflogViewer
					open={reflogOpen}
					onOpenChange={setReflogOpen}
				/>

				{/* Commit Templates */}
				<CommitTemplatesDialog
					open={templatesOpen}
					onOpenChange={setTemplatesOpen}
					templates={templates}
					onTemplatesChange={(t) => {
						// Update templates - for now just close
						setTemplatesOpen(false);
					}}
				/>

				{/* Gitignore Manager */}
				<GitignoreManager
					open={gitignoreOpen}
					onOpenChange={setGitignoreOpen}
				/>

				{/* Custom Commands */}
				<CustomCommands
					open={customCommandsOpen}
					onOpenChange={setCustomCommandsOpen}
				/>

				{/* Search All Commits */}
				<SearchAllCommits
					open={searchCommitsOpen}
					onOpenChange={setSearchCommitsOpen}
					onSelectCommit={(hash) => {
						// Find and select the commit in the list
						const index = commitsData?.commits?.findIndex((c: ClientCommit) => c.hash === hash);
						if (index !== undefined && index >= 0) {
							handleSelectCommit(index);
						}
					}}
				/>

				{/* LFS Support */}
				<LFSSupport
					open={lfsOpen}
					onOpenChange={setLfsOpen}
				/>

				{/* Pull Request Integration */}
				<PullRequestIntegration
					open={prIntegrationOpen}
					onOpenChange={setPrIntegrationOpen}
				/>

				{/* Worktree Management */}
				<WorktreeManagement
					open={worktreeOpen}
					onOpenChange={setWorktreeOpen}
				/>

				{/* Submodule Management */}
				<SubmoduleManagement
					open={submoduleOpen}
					onOpenChange={setSubmoduleOpen}
				/>

				{/* Keyboard Shortcuts Help */}
				<KeyboardShortcutsHelp
					open={keyboardHelpOpen}
					onOpenChange={setKeyboardHelpOpen}
				/>

				{/* Recent Repositories */}
				<RecentRepositories
					open={recentReposOpen}
					onOpenChange={setRecentReposOpen}
				/>

				{/* Stash Management */}
				<StashManagement
					open={stashManageOpen}
					onOpenChange={setStashManageOpen}
				/>

				{/* Graph Legend */}
				<CommitGraphLegend
					open={graphLegendOpen}
					onOpenChange={setGraphLegendOpen}
				/>

				{/* Cherry-Pick Dialog */}
				<DragDropCherryPick
					open={cherryPickDialogOpen}
					onOpenChange={setCherryPickDialogOpen}
					sourceCommit={cherryPickCommit}
				/>

				{/* Settings Dialog */}
				<SettingsDialog
					open={settingsOpen}
					onOpenChange={setSettingsOpen}
				/>

				{/* Line Staging */}
				{lineStagingOpen && stagingFile && (
					<LineStaging
						open={lineStagingOpen}
						onOpenChange={setLineStagingOpen}
						filePath={stagingFile}
					/>
				)}

				{/* Context Menu for Commits */}
				{contextMenuOpen && selectedCommitData && (
					<div
						className="fixed inset-0 z-50"
						onClick={() => setContextMenuOpen(false)}
						onContextMenu={() => setContextMenuOpen(false)}
					>
						<div
							className="fixed z-50"
							style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
						>
							<CommitContextMenu
								commit={{
									hash: selectedCommitData.hash,
									message: selectedCommitData.message,
									author: selectedCommitData.author,
								}}
								onCreateBranch={() => {
									setCreateBranchOpen(true);
									setContextMenuOpen(false);
								}}
								onCreateTag={() => {
									setAddTagOpen(true);
									setContextMenuOpen(false);
								}}
								onMerge={() => {
									setMergeOpen(true);
									setContextMenuOpen(false);
								}}
								onRebase={() => {
									setRebaseOpen(true);
									setContextMenuOpen(false);
								}}
								onCherryPick={() => {
									setCherryPickOpen(true);
									setContextMenuOpen(false);
								}}
								onRevert={() => {
									setRevertOpen(true);
									setContextMenuOpen(false);
								}}
							>
								<div />
							</CommitContextMenu>
						</div>
					</div>
				)}

				{/* Commit Filters Dialog */}
				<Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Filter className="h-5 w-5" />
								Filter Commits
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<CommitHistoryFilters
								filters={commitFilters}
								onChange={(filters) => {
									setCommitFilters(filters);
									if (Object.keys(filters).length === 0) {
										setShowFiltersDialog(false);
									}
								}}
							/>
						</div>
					</DialogContent>
				</Dialog>

				{/* Command Palette */}
				<CommandPalette
					open={commandPaletteOpen}
					onOpenChange={setCommandPaletteOpen}
					actions={{
						onCreateBranch: () => setCreateBranchOpen(true),
						onCreateTag: () => setAddTagOpen(true),
						onFetch: () => gitOps.fetch(),
						onPull: () => gitOps.pull(),
						onPush: () => gitOps.push(),
						onRefresh: () => refetchCommits(),
						onSettings: () => setSettingsOpen(true),
						onSearch: () => setSearchCommitsOpen(true),
						onTerminal: () => setTerminalOpen(!terminalOpen),
						onStash: () => setStashManageOpen(true),
						onCommitSigning: () => setCommitSigningOpen(true),
						onReflog: () => setReflogOpen(true),
						onTemplates: () => setTemplatesOpen(true),
						onGitignore: () => setGitignoreOpen(true),
						onCustomCommands: () => setCustomCommandsOpen(true),
						onLFS: () => setLfsOpen(true),
						onPRIntegration: () => setPrIntegrationOpen(true),
						onWorktrees: () => setWorktreeOpen(true),
						onSubmodules: () => setSubmoduleOpen(true),
						onStatistics: () => setStatisticsOpen(true),
						onRemotes: () => setRemoteManageOpen(true),
						onFilters: () => setShowFiltersDialog(true),
						onPinned: () => setPinnedCommitsOpen(true),
						onKeyboardHelp: () => setKeyboardHelpOpen(true),
						onHealthCheck: () => setHealthCheckOpen(true),
						onFuzzyFinder: () => setFuzzyFinderOpen(true),
						onUndoStack: () => setUndoStackOpen(true),
						onConfigEditor: () => setConfigEditorOpen(true),
						onExternalDiff: () => setExternalDiffOpen(true),
						onIssueTracker: () => setIssueTrackerOpen(true),
						onBulkOps: () => setBulkOpsOpen(true),
						onFileAnnotations: () => {
							setAnnotationsFile('README.md'); // Default file
							setFileAnnotationsOpen(true);
						},
						onActivityHeatmap: () => setActivityHeatmapOpen(true),
					}}
				/>

				{/* Git Flow Automation */}
				<GitFlowAutomation
					open={gitFlowOpen}
					onOpenChange={setGitFlowOpen}
				/>

				{/* Repository Health Check */}
				<RepoHealthCheck
					open={healthCheckOpen}
					onOpenChange={setHealthCheckOpen}
				/>

				{/* Git Bisect UI */}
				<GitBisectUI
					open={bisectOpen}
					onOpenChange={setBisectOpen}
					currentCommitHash={selectedCommit ?? undefined}
				/>

				{/* Undo Stack Dialog */}
				<UndoStackDialog
					open={undoStackOpen}
					onOpenChange={setUndoStackOpen}
				/>

				{/* Git Config Editor */}
				<GitConfigEditor
					open={configEditorOpen}
					onOpenChange={setConfigEditorOpen}
				/>

				{/* External Diff Settings */}
				<ExternalDiffConfig
					open={externalDiffOpen}
					onOpenChange={setExternalDiffOpen}
				/>

				{/* Issue Tracker Settings */}
				<IssueTrackerSettings
					open={issueTrackerOpen}
					onOpenChange={setIssueTrackerOpen}
				/>

				{/* Bulk Commit Operations */}
				<BulkCommitOperations
					open={bulkOpsOpen}
					onOpenChange={setBulkOpsOpen}
					commits={(commitsData?.commits ?? []).map((c: ClientCommit) => ({
						hash: c.hash,
						message: c.message,
						author: c.author,
						date: c.date,
						parents: c.parents,
					}))}
					onComplete={() => refetchCommits()}
				/>

				{/* File Annotations Panel */}
				<FileAnnotationsPanel
					open={fileAnnotationsOpen}
					onOpenChange={setFileAnnotationsOpen}
					filePath={annotationsFile}
					commitHash={selectedCommit ?? 'HEAD'}
				/>

				{/* Activity Heatmap */}
				<ActivityHeatmap
					open={activityHeatmapOpen}
					onOpenChange={setActivityHeatmapOpen}
				/>

				{/* Drag Cherry-Pick Handler */}
				{dragCommit && (
					<DragCommitHandler
						open={dragCherryPickOpen}
						onOpenChange={setDragCherryPickOpen}
						commitHash={dragCommit.hash}
						commitMessage={dragCommit.message}
						targetBranch={dragTargetBranch}
						onComplete={() => refetchCommits()}
					/>
				)}

				{/* Quick Look Panel */}
				<QuickLookPanel />

				{/* Status Bar */}
				<StatusBar
					onFetch={() => gitOps.fetch()}
					onPush={() => gitOps.push()}
					onPull={() => gitOps.pull()}
				/>
			</div>
			</TooltipProvider>
		</UndoStackProvider>
	);
}

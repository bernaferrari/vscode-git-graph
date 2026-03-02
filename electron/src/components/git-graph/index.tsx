/**
 * Git Graph Main Component
 * GitKraken-style Git visualization
 */

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
    GitCommit,
    Archive,
    MoreHorizontal,
    X,
    FileCode,
    User,
    Globe,
    PanelLeft,
    BarChart3,
    Settings,
    Undo,
    Key,
    Filter,
    Pin,
    History,
    FileText,
    Package,
    GitPullRequest,
    FolderGit2,
    Keyboard,
    ArrowUp,
    ArrowDown,
    Info,
    Activity,
    Bug,
    Copy,
    ListPlus,
} from 'lucide-react';
import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef, startTransition } from 'react';
import { toast } from 'sonner';

import { BranchDropdown } from './branch-dropdown';
import { CommitGraph } from './commit-graph';
import { CommitGraphLegend } from './commit-graph-legend';
import { DragCommitHandler } from './drag-commit-to-branch';
import { DragDropCherryPick } from './drag-drop-cherry-pick';
import { CommitListSkeleton, GraphSkeleton, ErrorState } from './empty-states';
import { OperationStatusBar } from './operation-status-bar';
import { PinnedCommitsDialog, usePinnedCommits, type PinnedCommit } from './pinned-commits';
import { SidePanel } from './side-panel';

import { useCommitTemplates } from './useCommitTemplates';
import { useSettings } from './useSettings';
import { VirtualizedCommitList } from './virtualized-commit-list';
import { UndoStackProvider, UndoStackDialog } from './undo-stack';
import { QuickLookPanel, useQuickLookKeyboard } from './quick-look';
import { useActionPreview, type ActionPreview } from '@/components/action-preview';
import { LensSwitcher, useLensMode } from '@/components/lens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { DEFAULT_GRAPH_CONFIG } from '@/lib/graph/layout';
import { useGraphLayoutWorker } from '@/lib/graph/useGraphLayoutWorker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

import type { CommitFilter } from './commit-history-filters';
import type { FindOptions } from './find-widget';

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

interface RefTips {
    heads: Array<{ hash: string; name: string }>;
    tags: Array<{ hash: string; name: string }>;
    remotes: Array<{ hash: string; name: string }>;
}

interface QueryPerfSummary {
    durationMs: number;
    payloadBytes: number;
    at: number;
    counts?: Record<string, number>;
    error?: boolean;
    refsDeferred?: boolean;
}

type PerfHistoryKey = 'repoInfo' | 'commits' | 'refs';

interface PerfHistoryWindow {
    repoInfo: QueryPerfSummary[];
    commits: QueryPerfSummary[];
    refs: QueryPerfSummary[];
}

interface PerfStatsSummary {
    latestDurationMs: number | null;
    latestPayloadBytes: number | null;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
    sampleCount: number;
    errorCount: number;
}

type PerfTrendLevel = 'warming' | 'stable' | 'watch' | 'regressed' | 'improving';

interface PerfTrend {
    level: PerfTrendLevel;
    label: string;
    title: string;
    deltaPct: number | null;
}

interface PersistedCommitFilters {
    author?: string;
    filePath?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}

// Graph configuration
const GRAPH_CONFIG = DEFAULT_GRAPH_CONFIG;
const GRAPH_MUTE_CONFIG = {
    mergeCommits: true,
    commitsNotAncestorsOfHead: false,
};
const INITIAL_MAX_COMMITS = 160;
const LOAD_MORE_STEP = 300;
const INITIAL_LAYOUT_COMMIT_WINDOW = 320;
const LAYOUT_GROWTH_STEP = 520;
const LAYOUT_VISIBLE_BUFFER = 240;
const LAYOUT_GROWTH_DELAY_MS = 90;
const MAX_PERF_HISTORY_SAMPLES = 20;
const PERF_TREND_MIN_SAMPLES = 5;
const PERF_WATCH_DELTA_PCT = 20;
const PERF_REGRESSION_DELTA_PCT = 45;
const PERF_IMPROVING_DELTA_PCT = -25;
const COMMIT_FILTERS_STORAGE_PREFIX = 'git-graph:commit-filters:';

function createEmptyPerfHistory(): PerfHistoryWindow {
    return {
        repoInfo: [],
        commits: [],
        refs: [],
    };
}

function percentile(values: number[], p: number): number | null {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length) - 1;
    const index = Math.max(0, Math.min(sorted.length - 1, rank));
    return sorted[index] ?? null;
}

function summarizePerfSamples(samples: QueryPerfSummary[]): PerfStatsSummary {
    if (samples.length === 0) {
        return {
            latestDurationMs: null,
            latestPayloadBytes: null,
            p50DurationMs: null,
            p95DurationMs: null,
            sampleCount: 0,
            errorCount: 0,
        };
    }

    const durations = samples.map((sample) => sample.durationMs).filter((value) => Number.isFinite(value));
    const latest = samples[samples.length - 1] ?? null;

    return {
        latestDurationMs: latest?.durationMs ?? null,
        latestPayloadBytes: latest?.payloadBytes ?? null,
        p50DurationMs: percentile(durations, 50),
        p95DurationMs: percentile(durations, 95),
        sampleCount: samples.length,
        errorCount: samples.filter((sample) => sample.error).length,
    };
}

function classifyPerfTrend(stats: PerfStatsSummary): PerfTrend {
    const latest = stats.latestDurationMs;
    const baseline = stats.p50DurationMs;

    if (
        stats.sampleCount < PERF_TREND_MIN_SAMPLES ||
        latest === null ||
        baseline === null ||
        baseline <= 0 ||
        !Number.isFinite(latest) ||
        !Number.isFinite(baseline)
    ) {
        return {
            level: 'warming',
            label: 'warm-up',
            title: 'Collecting more samples before trend detection.',
            deltaPct: null,
        };
    }

    const deltaPct = ((latest - baseline) / baseline) * 100;
    const roundedDelta = Math.round(deltaPct);
    const hasTailSpike = stats.p95DurationMs !== null && latest > stats.p95DurationMs * 1.1;

    if (deltaPct >= PERF_REGRESSION_DELTA_PCT || hasTailSpike) {
        return {
            level: 'regressed',
            label: `+${roundedDelta}%`,
            title: `Regression detected: latest latency is ${roundedDelta}% slower than p50.`,
            deltaPct,
        };
    }

    if (deltaPct >= PERF_WATCH_DELTA_PCT) {
        return {
            level: 'watch',
            label: `+${roundedDelta}%`,
            title: `Watch: latest latency is ${roundedDelta}% slower than p50.`,
            deltaPct,
        };
    }

    if (deltaPct <= PERF_IMPROVING_DELTA_PCT) {
        return {
            level: 'improving',
            label: `${roundedDelta}%`,
            title: `Improving: latest latency is ${Math.abs(roundedDelta)}% faster than p50.`,
            deltaPct,
        };
    }

    return {
        level: 'stable',
        label: 'stable',
        title: 'Latest latency is within expected variance.',
        deltaPct,
    };
}

function perfTrendBadgeClass(level: PerfTrendLevel): string {
    switch (level) {
        case 'regressed':
            return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200';
        case 'watch':
            return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200';
        case 'improving':
            return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
        case 'stable':
            return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
        case 'warming':
        default:
            return 'border-border/70 bg-muted/60 text-muted-foreground';
    }
}

const CommitDetailsPanel = lazy(() => import('./commit-details').then((mod) => ({ default: mod.CommitDetailsPanel })));
const InteractiveRebase = lazy(() =>
    import('./interactive-rebase').then((mod) => ({ default: mod.InteractiveRebase }))
);
const Statistics = lazy(() => import('./statistics').then((mod) => ({ default: mod.Statistics })));
const MergeConflictEditor = lazy(() =>
    import('./merge-conflict-editor').then((mod) => ({ default: mod.MergeConflictEditor }))
);
const RemoteManageDialog = lazy(() =>
    import('./remote-manage-dialog').then((mod) => ({ default: mod.RemoteManageDialog }))
);
const BranchCompare = lazy(() => import('./branch-compare').then((mod) => ({ default: mod.BranchCompare })));
const CloneRepositoryDialog = lazy(() =>
    import('./clone-repository-dialog').then((mod) => ({ default: mod.CloneRepositoryDialog }))
);
const HooksManageDialog = lazy(() =>
    import('./hooks-manage-dialog').then((mod) => ({ default: mod.HooksManageDialog }))
);
const TerminalPanel = lazy(() => import('./terminal-panel').then((mod) => ({ default: mod.TerminalPanel })));
const ReflogViewer = lazy(() => import('./reflog-viewer').then((mod) => ({ default: mod.ReflogViewer })));
const SearchAllCommits = lazy(() => import('./search-commits').then((mod) => ({ default: mod.SearchAllCommits })));
const WorktreeManagement = lazy(() =>
    import('./worktree-management').then((mod) => ({ default: mod.WorktreeManagement }))
);
const SubmoduleManagement = lazy(() =>
    import('./submodule-management').then((mod) => ({ default: mod.SubmoduleManagement }))
);
const RepoHealthCheck = lazy(() => import('./repo-health-check').then((mod) => ({ default: mod.RepoHealthCheck })));
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
const VisualRebaseTodoEditor = lazy(() =>
    import('./visual-rebase-todo').then((mod) => ({ default: mod.VisualRebaseTodoEditor }))
);
const CommitSigningDialog = lazy(() =>
    import('./commit-signing-dialog').then((mod) => ({ default: mod.CommitSigningDialog }))
);
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
const OnboardingDialog = lazy(() => import('./onboarding').then((mod) => ({ default: mod.OnboardingDialog })));
const RecentRepositories = lazy(() =>
    import('./recent-repositories').then((mod) => ({ default: mod.RecentRepositories }))
);
const WorkspacesManager = lazy(() => import('./workspaces').then((mod) => ({ default: mod.WorkspacesManager })));
const StashManagement = lazy(() => import('./stash-management').then((mod) => ({ default: mod.StashManagement })));
const SettingsDialog = lazy(() => import('./settings-dialog').then((mod) => ({ default: mod.SettingsDialog })));
const CommandPalette = lazy(() => import('./command-palette').then((mod) => ({ default: mod.CommandPalette })));
const ProfileSwitcher = lazy(() => import('@/components/profile').then((mod) => ({ default: mod.ProfileSwitcher })));
const OperationTimeline = lazy(() =>
    import('@/components/operation-timeline').then((mod) => ({ default: mod.OperationTimeline }))
);
const StackedBranchesPanel = lazy(() =>
    import('@/components/stacked-branches').then((mod) => ({ default: mod.StackedBranchesPanel }))
);
const FindWidget = lazy(() => import('./find-widget').then((mod) => ({ default: mod.FindWidget })));
const FuzzyFinder = lazy(() => import('./fuzzy-finder').then((mod) => ({ default: mod.FuzzyFinder })));
const CommitContextMenu = lazy(() =>
    import('./commit-context-menu').then((mod) => ({ default: mod.CommitContextMenu }))
);
const CommitHistoryFilters = lazy(() =>
    import('./commit-history-filters').then((mod) => ({ default: mod.CommitHistoryFilters }))
);
const CreateBranchDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.CreateBranchDialog })));
const AddTagDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.AddTagDialog })));
const ResetDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.ResetDialog })));
const DeleteBranchDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.DeleteBranchDialog })));
const MergeDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.MergeDialog })));
const RebaseDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.RebaseDialog })));
const CherryPickDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.CherryPickDialog })));
const RevertDialog = lazy(() => import('./dialogs').then((mod) => ({ default: mod.RevertDialog })));

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
    const title = shortcut ? `${label} (${shortcut})` : label;
    const sharedControlClass =
        'rounded-md border border-transparent px-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-150 hover:border-border/70 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] disabled:opacity-40';

    return (
        <Button
            variant={variant}
            size='sm'
            className={`h-8 gap-1.5 ${sharedControlClass}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={label}>
            <Icon className='h-4 w-4' />
            <span className='hidden sm:inline'>{label}</span>
        </Button>
    );
}

function DialogLoadingFallback() {
    return (
        <div className='pointer-events-none fixed inset-0 z-[70] flex items-center justify-center'>
            <div className='ui-surface text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                <span>Loading panel...</span>
            </div>
        </div>
    );
}

export function GitGraph() {
    // App store
    const {
        activeRepo,
        selectedCommit,
        commitDetailsOpen,
        repoLoadPhase,
        setSelectedCommit,
        setCommitDetailsOpen,
        setRepoLoadState,
        resetRepoLoadState,
    } = useAppStore();
    const { openRepositoryDialog, activateRepoPath, isRepoLoading, isRepoBusy } = useRepoActivation();

    // Local state
    const [expandedCommit, setExpandedCommit] = useState<number | null>(null);
    const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);
    const [findWidgetOpen, setFindWidgetOpen] = useState(false);
    const [findMatches, setFindMatches] = useState<number[]>([]);
    const [findCurrentIndex, setFindCurrentIndex] = useState(0);
    const [selectedBranches, setSelectedBranches] = useState<string[]>(['__all__']);
    const [showSidePanel, setShowSidePanel] = useState(true);
    const [layoutMode] = useState<'panel' | 'tabs'>('panel');
    const [branchMenuOpen, setBranchMenuOpen] = useState(false);
    const [branchSearch, setBranchSearch] = useState('');
    const [visibleStartIndex, setVisibleStartIndex] = useState(0);
    const [visibleEndIndex, setVisibleEndIndex] = useState(120);
    const [commitListScrollOffset, setCommitListScrollOffset] = useState(0);
    const visibleRangeRef = useRef({ start: 0, end: 120 });
    const scrollOffsetRef = useRef(0);

    // New feature states
    const [fuzzyFinderOpen, setFuzzyFinderOpen] = useState(false);
    const [interactiveRebaseOpen, setInteractiveRebaseOpen] = useState(false);
    const [rebaseTodoOpen, setRebaseTodoOpen] = useState(false);
    const [statisticsOpen, setStatisticsOpen] = useState(false);
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [remoteManageOpen, setRemoteManageOpen] = useState(false);
    const [branchCompareOpen, setBranchCompareOpen] = useState(false);
    const [hooksManageOpen, setHooksManageOpen] = useState(false);
    const [mergeConflictOpen, setMergeConflictOpen] = useState(false);
    const [conflictFile, setConflictFile] = useState<{
        path: string;
        ours: string;
        theirs: string;
        base?: string;
    } | null>(null);
    const [conflictFilePath, setConflictFilePath] = useState<string | null>(null);

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
    const [onboardingOpen, setOnboardingOpen] = useState(false);
    const [recentReposOpen, setRecentReposOpen] = useState(false);
    const [workspacesOpen, setWorkspacesOpen] = useState(false);
    const [stashManageOpen, setStashManageOpen] = useState(false);
    const [graphLegendOpen, setGraphLegendOpen] = useState(false);
    const [cherryPickDialogOpen, setCherryPickDialogOpen] = useState(false);
    const [cherryPickCommit] = useState<{ hash: string; message: string; author: string } | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [perfPanelOpen, setPerfPanelOpen] = useState(false);
    const [copyingPerfDiagnostics, setCopyingPerfDiagnostics] = useState(false);
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
    const [dragCommit] = useState<{ hash: string; message: string } | null>(null);
    const [dragTargetBranch] = useState('');

    // Quick Look hook
    useQuickLookKeyboard();

    // Settings hook
    const { settings } = useSettings();
    const showPerfDebug = settings.telemetryEnabled;

    useEffect(() => {
        if (!activeRepo) return;
        if (!localStorage.getItem('git-graph-onboarding-complete')) {
            setOnboardingOpen(true);
        }
    }, [activeRepo]);

    // Lens mode hook
    const { setLensMode, isGuided } = useLensMode();

    // Pinned commits hook
    const { pinnedCommits, pinCommit, unpinCommit, updateNote } = usePinnedCommits(activeRepo);

    // Commit templates hook
    const { templates, setTemplates } = useCommitTemplates();
    const actionPreview = useActionPreview();

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
    const [targetBranch, setTargetBranch] = useState<string>('');

    // Git operations hook
    const gitOps = useGitOperations();
    const gitUtils = trpc.useUtils();

    const maxCommitsLimit = useMemo(() => {
        if (!Number.isFinite(settings.maxCommits)) {
            return 1000;
        }
        return Math.max(100, Math.min(10000, Math.round(settings.maxCommits)));
    }, [settings.maxCommits]);
    const baselineInitialMaxCommits = Math.min(INITIAL_MAX_COMMITS, maxCommitsLimit);

    // Commit and layout limit state
    const [maxCommits, setMaxCommits] = useState(INITIAL_MAX_COMMITS);
    const [layoutCommitLimit, setLayoutCommitLimit] = useState(INITIAL_LAYOUT_COMMIT_WINDOW);

    useEffect(() => {
        if (!activeRepo) {
            setCommitFilters({});
            return;
        }

        const storageKey = `${COMMIT_FILTERS_STORAGE_PREFIX}${activeRepo}`;
        const saved = localStorage.getItem(storageKey);
        if (!saved) {
            setCommitFilters({});
            return;
        }

        try {
            const parsed = JSON.parse(saved) as PersistedCommitFilters;
            setCommitFilters({
                ...(parsed.author ? { author: parsed.author } : {}),
                ...(parsed.filePath ? { filePath: parsed.filePath } : {}),
                ...(parsed.search ? { search: parsed.search } : {}),
                ...(parsed.dateFrom ? { dateFrom: new Date(parsed.dateFrom) } : {}),
                ...(parsed.dateTo ? { dateTo: new Date(parsed.dateTo) } : {}),
            });
        } catch {
            setCommitFilters({});
        }
    }, [activeRepo]);

    useEffect(() => {
        if (!activeRepo) return;

        const storageKey = `${COMMIT_FILTERS_STORAGE_PREFIX}${activeRepo}`;
        const persisted: PersistedCommitFilters = {
            ...(commitFilters.author ? { author: commitFilters.author } : {}),
            ...(commitFilters.filePath ? { filePath: commitFilters.filePath } : {}),
            ...(commitFilters.search ? { search: commitFilters.search } : {}),
            ...(commitFilters.dateFrom ? { dateFrom: commitFilters.dateFrom.toISOString() } : {}),
            ...(commitFilters.dateTo ? { dateTo: commitFilters.dateTo.toISOString() } : {}),
        };

        if (Object.keys(persisted).length === 0) {
            localStorage.removeItem(storageKey);
            return;
        }

        localStorage.setItem(storageKey, JSON.stringify(persisted));
    }, [activeRepo, commitFilters]);

    const conflictFileContent = trpc.git.readFile.useQuery(
        { repo: activeRepo ?? '', path: conflictFilePath ?? '' },
        { enabled: !!activeRepo && !!conflictFilePath }
    );
    const conflictVersionsContent = trpc.git.readConflictFile.useQuery(
        { repo: activeRepo ?? '', path: conflictFilePath ?? '' },
        { enabled: !!activeRepo && !!conflictFilePath }
    );

    const writeConflictFile = trpc.git.writeFile.useMutation();
    const stageConflictFile = trpc.git.stage.useMutation();
    const { mutateAsync: revealInRepo } = trpc.system.revealInRepo.useMutation();
    const conflictWarnings =
        conflictVersionsContent.data && 'warnings' in conflictVersionsContent.data
            ? conflictVersionsContent.data.warnings
            : null;

    useEffect(() => {
        if (!conflictFilePath) {
            setConflictFile(null);
            return;
        }

        if (conflictFileContent.isLoading) {
            return;
        }

        if (conflictFileContent.data?.error) {
            toast.error('Failed to load conflict file', {
                description: conflictFileContent.data.error,
            });
            setConflictFile(null);
            return;
        }

        if (conflictVersionsContent.data?.error) {
            toast.error('Failed to load conflict versions', {
                description: conflictVersionsContent.data.error,
            });
        }
        if (conflictWarnings?.length) {
            toast.info('Some conflict-side files could not be loaded', {
                description: conflictWarnings.join(', '),
            });
        }

        if (conflictFileContent.data?.content !== undefined) {
            setConflictFile({
                path: conflictFilePath,
                ours: conflictFileContent.data.content ?? '',
                theirs: conflictVersionsContent.data?.theirs ?? '',
                ...(conflictVersionsContent.data?.base ? { base: conflictVersionsContent.data.base } : {}),
            });
        }
    }, [
        conflictFilePath,
        conflictFileContent.data?.content,
        conflictFileContent.data?.error,
        conflictFileContent.isLoading,
        conflictVersionsContent.data?.theirs,
        conflictVersionsContent.data?.base,
        conflictVersionsContent.data?.error,
        conflictWarnings,
        conflictVersionsContent.isLoading,
    ]);

    const handleOpenConflictFile = useCallback(
        (filePath: string) => {
            if (!activeRepo) {
                toast.error('No active repository');
                return;
            }
            setConflictFile(null);
            setConflictFilePath(filePath);
            setMergeConflictOpen(true);
            void conflictFileContent.refetch();
            void conflictVersionsContent.refetch();
        },
        [activeRepo, conflictFileContent, conflictVersionsContent]
    );

    const handleRevealConflictFile = useCallback(
        (filePath: string) => {
            if (!activeRepo) {
                toast.error('No active repository');
                return;
            }

            void revealInRepo({
                repo: activeRepo,
                path: filePath,
            })
                .then((result) => {
                    if (!result.success) {
                        toast.error('error' in result ? result.error : 'Failed to reveal conflict file');
                    }
                })
                .catch((error) => {
                    toast.error(error instanceof Error ? error.message : 'Failed to reveal conflict file');
                });
        },
        [activeRepo, revealInRepo]
    );

    const handleCloseConflictEditor = useCallback((open: boolean) => {
        setMergeConflictOpen(open);
        if (!open) {
            setConflictFile(null);
            setConflictFilePath(null);
        }
    }, []);

    const handleResolveConflictFile = useCallback(
        (path: string, content: string) => {
            if (!activeRepo) {
                toast.error('No active repository');
                return;
            }

            writeConflictFile.mutate(
                { repo: activeRepo, path, content },
                {
                    onSuccess: (result) => {
                        if (result.error) {
                            toast.error('Failed to save conflict resolution', {
                                description: result.error,
                            });
                            return;
                        }

                        stageConflictFile.mutate(
                            { repo: activeRepo, files: [path] },
                            {
                                onSuccess: (stageResult) => {
                                    if (stageResult.error) {
                                        toast.error('Failed to stage resolved file', {
                                            description: stageResult.error,
                                        });
                                        return;
                                    }
                                    toast.success('Conflict marked as resolved');
                                    void Promise.allSettled([
                                        gitUtils.git.operationState.invalidate(),
                                        gitUtils.git.commits.invalidate(),
                                        gitUtils.git.repoInfo.invalidate(),
                                        gitUtils.git.workingDirectoryStatus.invalidate({ repo: activeRepo }),
                                    ]).catch((error) => {
                                        console.error('[git-graph] Failed to invalidate conflict state:', error);
                                    });
                                    setMergeConflictOpen(false);
                                    setConflictFilePath(null);
                                },
                            }
                        );
                    },
                }
            );
        },
        [
            activeRepo,
            stageConflictFile,
            writeConflictFile,
            gitUtils.git.operationState,
            gitUtils.git.commits,
            gitUtils.git.repoInfo,
            gitUtils.git.workingDirectoryStatus,
        ]
    );

    useEffect(() => {
        setMaxCommits((previous) => Math.min(previous, maxCommitsLimit));
    }, [maxCommitsLimit]);

    // tRPC queries
    const commitQueryInput = useMemo(
        () => ({
            repo: activeRepo ?? '',
            branches: selectedBranches.includes('__all__') ? null : selectedBranches,
            maxCommits,
            order: 'date' as const,
            onlyFollowFirstParent: false,
            showTags: true,
            showRemoteBranches: true,
            hideRemotes: [],
            decorateRefs: false,
            includePerf: showPerfDebug,
            author: commitFilters.author,
            search: commitFilters.search,
            filePath: commitFilters.filePath,
            dateFrom: commitFilters.dateFrom ? commitFilters.dateFrom.toISOString() : undefined,
            dateTo: commitFilters.dateTo ? commitFilters.dateTo.toISOString() : undefined,
        }),
        [activeRepo, selectedBranches, maxCommits, commitFilters, showPerfDebug]
    );

    const { data: repoInfo, isLoading: repoLoading } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: true,
            showStashes: true,
            hideRemotes: [],
            includePerf: showPerfDebug,
        },
        { enabled: !!activeRepo, staleTime: 5000, refetchOnWindowFocus: false }
    );
    const { data: aheadBehindData } = trpc.git.aheadBehind.useQuery(
        {
            repo: activeRepo ?? '',
            branch: repoInfo?.head ?? undefined,
        },
        { enabled: !!activeRepo && !!repoInfo?.head, staleTime: 5000, refetchOnWindowFocus: false }
    );
    const { data: workingTreeStatus } = trpc.git.workingTreeStatus.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo, staleTime: 5000, refetchOnWindowFocus: false }
    );

    const {
        data: commitsData,
        isLoading: commitsLoading,
        isFetching: commitsFetching,
    } = trpc.git.commits.useQuery(commitQueryInput, {
        enabled: !!activeRepo,
        staleTime: 10000,
        refetchOnWindowFocus: false,
        placeholderData: (previous) => previous,
    });
    const { data: refsData, isFetching: refsFetching } = trpc.git.refs.useQuery(
        {
            repo: activeRepo ?? '',
            showTags: true,
            showRemoteBranches: true,
            hideRemotes: [],
            includePerf: showPerfDebug,
        },
        { enabled: !!activeRepo && !!commitsData?.refsDeferred, staleTime: 5000, refetchOnWindowFocus: false }
    );

    const { mutateAsync: revealInFinder } = trpc.system.revealInFinder.useMutation();
    const { mutateAsync: openTerminalInRepo } = trpc.system.openTerminal.useMutation();

    const handleRefreshAll = useCallback(() => {
        void gitUtils.git.invalidate().catch((error) => {
            console.error('[git-graph] Refresh failed:', error);
        });
    }, [gitUtils]);

    // Load more commits handler
    const handleLoadMore = useCallback(() => {
        if (maxCommits >= maxCommitsLimit) {
            toast.info(`Commit load limit reached (${maxCommitsLimit}).`, {
                description: 'Increase it in Settings > Performance if needed.',
            });
            return;
        }
        setMaxCommits((prev) => Math.min(prev + LOAD_MORE_STEP, maxCommitsLimit));
    }, [maxCommits, maxCommitsLimit]);

    // Git status check
    const { data: gitStatus } = trpc.git.status.useQuery();

    const repoInfoPerf = (repoInfo as { perf?: QueryPerfSummary } | undefined)?.perf ?? null;
    const commitsPerf = (commitsData as { perf?: QueryPerfSummary } | undefined)?.perf ?? null;
    const refsPerf = (refsData as { perf?: QueryPerfSummary } | undefined)?.perf ?? null;
    const perfHistoryRef = useRef<Record<string, PerfHistoryWindow>>({});
    const [perfHistoryVersion, setPerfHistoryVersion] = useState(0);

    const appendPerfSample = useCallback(
        (key: PerfHistoryKey, sample: QueryPerfSummary | null) => {
            if (!activeRepo || !sample?.at) {
                return;
            }

            const existingRepoHistory = perfHistoryRef.current[activeRepo] ?? createEmptyPerfHistory();
            const bucket = existingRepoHistory[key];
            const lastEntry = bucket[bucket.length - 1];
            if (lastEntry?.at === sample.at) {
                return;
            }

            bucket.push(sample);
            if (bucket.length > MAX_PERF_HISTORY_SAMPLES) {
                bucket.shift();
            }

            perfHistoryRef.current[activeRepo] = existingRepoHistory;
            setPerfHistoryVersion((current) => current + 1);
        },
        [activeRepo]
    );

    useEffect(() => {
        appendPerfSample('repoInfo', repoInfoPerf);
    }, [appendPerfSample, repoInfoPerf]);

    useEffect(() => {
        appendPerfSample('commits', commitsPerf);
    }, [appendPerfSample, commitsPerf]);

    useEffect(() => {
        appendPerfSample('refs', refsPerf);
    }, [appendPerfSample, refsPerf]);

    const perfHistoryForRepo = useMemo(() => {
        if (!activeRepo) {
            return createEmptyPerfHistory();
        }
        return perfHistoryRef.current[activeRepo] ?? createEmptyPerfHistory();
    }, [activeRepo, perfHistoryVersion]);

    const repoInfoPerfStats = summarizePerfSamples(perfHistoryForRepo.repoInfo);
    const commitsPerfStats = summarizePerfSamples(perfHistoryForRepo.commits);
    const refsPerfStats = summarizePerfSamples(perfHistoryForRepo.refs);
    const repoInfoPerfTrend = classifyPerfTrend(repoInfoPerfStats);
    const commitsPerfTrend = classifyPerfTrend(commitsPerfStats);
    const refsPerfTrend = classifyPerfTrend(refsPerfStats);
    const hasPerfRegression =
        repoInfoPerfTrend.level === 'regressed' ||
        commitsPerfTrend.level === 'regressed' ||
        refsPerfTrend.level === 'regressed';
    const hasPerfWatch =
        repoInfoPerfTrend.level === 'watch' ||
        commitsPerfTrend.level === 'watch' ||
        refsPerfTrend.level === 'watch';

    const formatPerfMs = useCallback((value: number | null | undefined) => {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '--';
        }
        return `${value.toFixed(1)} ms`;
    }, []);

    const formatPerfBytes = useCallback((value: number | null | undefined) => {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return '--';
        }
        if (value < 1024) {
            return `${value} B`;
        }
        return `${(value / 1024).toFixed(1)} KB`;
    }, []);

    const perfDiagnosticsPayload = useMemo(() => {
        const serializeSample = (sample: QueryPerfSummary) => ({
            at: new Date(sample.at).toISOString(),
            durationMs: sample.durationMs,
            payloadBytes: sample.payloadBytes,
            error: Boolean(sample.error),
            refsDeferred: Boolean(sample.refsDeferred),
            counts: sample.counts ?? {},
        });

        return {
            generatedAt: new Date().toISOString(),
            repository: activeRepo ?? null,
            windowSize: MAX_PERF_HISTORY_SAMPLES,
            activeFetches: {
                repoInfo: Boolean(repoLoading),
                commits: Boolean(commitsFetching || commitsLoading),
                refs: Boolean(refsFetching),
            },
            counts: {
                branches: repoInfo?.branches?.length ?? 0,
                tags: repoInfo?.tags?.length ?? 0,
                commits: commitsData?.commits?.length ?? 0,
            },
            queries: {
                repoInfo: {
                    stats: repoInfoPerfStats,
                    trend: repoInfoPerfTrend,
                    recentSamples: perfHistoryForRepo.repoInfo.map(serializeSample),
                },
                commits: {
                    stats: commitsPerfStats,
                    trend: commitsPerfTrend,
                    recentSamples: perfHistoryForRepo.commits.map(serializeSample),
                },
                refs: {
                    stats: refsPerfStats,
                    trend: refsPerfTrend,
                    recentSamples: perfHistoryForRepo.refs.map(serializeSample),
                },
            },
        };
    }, [
        activeRepo,
        repoLoading,
        commitsFetching,
        commitsLoading,
        refsFetching,
        repoInfo?.branches?.length,
        repoInfo?.tags?.length,
        commitsData?.commits?.length,
        repoInfoPerfStats,
        repoInfoPerfTrend,
        commitsPerfStats,
        commitsPerfTrend,
        refsPerfStats,
        refsPerfTrend,
        perfHistoryForRepo,
    ]);

    const copyPerfDiagnostics = useCallback(async () => {
        if (copyingPerfDiagnostics) {
            return;
        }

        setCopyingPerfDiagnostics(true);
        try {
            await navigator.clipboard.writeText(JSON.stringify(perfDiagnosticsPayload, null, 2));
            toast.success('Copied startup telemetry diagnostics');
        } catch (error) {
            console.error('Failed to copy telemetry diagnostics:', error);
            toast.error('Unable to copy telemetry diagnostics');
        } finally {
            setCopyingPerfDiagnostics(false);
        }
    }, [copyingPerfDiagnostics, perfDiagnosticsPayload]);

    const totalLoadedCommits = commitsData?.commits?.length ?? 0;
    const refsLookup = useMemo(() => {
        const headsByHash: Record<string, string[]> = {};
        const tagsByHash: Record<string, string[]> = {};
        const remotesByHash: Record<string, string[]> = {};

        const append = (target: Record<string, string[]>, hash: string, name: string) => {
            const current = target[hash];
            if (current) {
                current.push(name);
                return;
            }
            target[hash] = [name];
        };

        if (!refsData || refsData.error) {
            return {
                headsByHash,
                tagsByHash,
                remotesByHash,
                hasData: false,
            };
        }

        const refs = refsData as RefTips;
        refs.heads.forEach((head) => { append(headsByHash, head.hash, head.name); });
        refs.tags.forEach((tag) => { append(tagsByHash, tag.hash, tag.name); });
        refs.remotes.forEach((remote) => { append(remotesByHash, remote.hash, remote.name); });

        return {
            headsByHash,
            tagsByHash,
            remotesByHash,
            hasData: true,
        };
    }, [refsData]);
    const isDecoratingRefs = Boolean(commitsData?.refsDeferred && (!refsLookup.hasData || refsFetching));

    const layoutCommits = useMemo(() => {
        if (!commitsData?.commits?.length) {
            return [];
        }
        return commitsData.commits.slice(0, Math.min(layoutCommitLimit, commitsData.commits.length));
    }, [commitsData?.commits, layoutCommitLimit]);

    useEffect(() => {
        if (totalLoadedCommits === 0) {
            if (layoutCommitLimit !== INITIAL_LAYOUT_COMMIT_WINDOW) {
                setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
            }
            return;
        }

        if (layoutCommitLimit === 0) {
            setLayoutCommitLimit(Math.min(totalLoadedCommits, INITIAL_LAYOUT_COMMIT_WINDOW));
            return;
        }

        if (layoutCommitLimit > totalLoadedCommits) {
            setLayoutCommitLimit(totalLoadedCommits);
        }
    }, [totalLoadedCommits, layoutCommitLimit]);

    useEffect(() => {
        if (totalLoadedCommits === 0) {
            return;
        }

        const requiredForViewport = Math.min(
            totalLoadedCommits,
            Math.max(INITIAL_LAYOUT_COMMIT_WINDOW, visibleEndIndex + LAYOUT_VISIBLE_BUFFER)
        );

        if (layoutCommitLimit >= requiredForViewport) {
            return;
        }

        startTransition(() => {
            setLayoutCommitLimit(requiredForViewport);
        });
    }, [totalLoadedCommits, visibleEndIndex, layoutCommitLimit]);

    useEffect(() => {
        if (totalLoadedCommits === 0 || layoutCommitLimit >= totalLoadedCommits) {
            return;
        }

        const growthTimerId = window.setTimeout(() => {
            startTransition(() => {
                setLayoutCommitLimit((current) => {
                    if (current >= totalLoadedCommits) {
                        return current;
                    }

                    const viewportFloor = visibleEndIndex + LAYOUT_VISIBLE_BUFFER;
                    const nextLimit = Math.max(current + LAYOUT_GROWTH_STEP, viewportFloor);
                    return Math.min(totalLoadedCommits, nextLimit);
                });
            });
        }, LAYOUT_GROWTH_DELAY_MS);

        return () => {
            window.clearTimeout(growthTimerId);
        };
    }, [totalLoadedCommits, layoutCommitLimit, visibleEndIndex]);

    // Derive commit lookup
    const commitLookup = useMemo(() => {
        if (layoutCommits.length === 0) return {};
        const lookup: Record<string, number> = {};
        layoutCommits.forEach((commit: ClientCommit, index: number) => {
            lookup[commit.hash] = index;
        });
        return lookup;
    }, [layoutCommits]);

    const commitGraphCommits = useMemo(
        () =>
            layoutCommits.map((c) => ({
                hash: c.hash,
                author: c.author,
                email: c.email,
            })),
        [layoutCommits]
    );

    const {
        layout: graphLayout,
        isCalculating: graphLayoutCalculating,
        error: graphLayoutError,
    } = useGraphLayoutWorker({
        commits: layoutCommits,
        head: commitsData?.head ?? repoInfo?.head ?? null,
        commitLookup,
        onlyFollowFirstParent: false,
        config: GRAPH_CONFIG,
        muteConfig: GRAPH_MUTE_CONFIG,
    });

    const hasPendingLayoutExpansion = layoutCommits.length > 0 && layoutCommits.length < totalLoadedCommits;

    useEffect(() => {
        if (!graphLayoutError) {
            return;
        }
        toast.error('Unable to render commit graph', {
            description: graphLayoutError,
        });
    }, [graphLayoutError]);

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
    const handleSelectCommit = useCallback(
        (index: number) => {
            setSelectedCommitIndex(index);
            const commit = commitsData?.commits[index];
            if (commit) {
                setSelectedCommit(commit.hash);
                // Auto-open details panel on click
                if (!commitDetailsOpen) {
                    setCommitDetailsOpen(true);
                }
            }
        },
        [commitsData, setSelectedCommit, commitDetailsOpen, setCommitDetailsOpen]
    );

    // Navigate to a commit by hash
    const handleNavigateToCommit = useCallback(
        (hash: string) => {
            const index = commitsData?.commits?.findIndex((c: ClientCommit) => c.hash === hash);
            if (index !== undefined && index >= 0) {
                handleSelectCommit(index);
            }
        },
        [commitsData, handleSelectCommit]
    );

    const handleExpandCommit = useCallback(
        (index: number | null) => {
            setExpandedCommit(index);
            setCommitDetailsOpen(index !== null);
        },
        [setCommitDetailsOpen]
    );

    const handleFind = useCallback(
        (query: string, options: FindOptions) => {
            if (!commitsData?.commits || !query) {
                setFindMatches([]);
                setFindCurrentIndex(0);
                return;
            }

            const matches: number[] = [];
            commitsData.commits.forEach((commit: ClientCommit, index: number) => {
                const searchStr = options.caseSensitive ? commit.message : commit.message.toLowerCase();
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
        },
        [commitsData, handleSelectCommit]
    );

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
    const handleContextMenu = useCallback(
        (index: number, event: React.MouseEvent) => {
            event.preventDefault();
            const commit = commitsData?.commits[index];
            if (commit) {
                setTargetCommit(commit.hash);
                setSelectedCommitIndex(index);
                setSelectedCommit(commit.hash);
                setContextMenuPosition({ x: event.clientX, y: event.clientY });
                setContextMenuOpen(true);
            }
        },
        [commitsData, setSelectedCommit]
    );

    // Get current commit for context menu
    const selectedCommitData = useMemo(() => {
        if (!targetCommit || !commitsData?.commits) return null;
        return commitsData.commits.find((c: ClientCommit) => c.hash === targetCommit);
    }, [targetCommit, commitsData?.commits]);

    const interactiveRebaseCommits = useMemo(() => {
        if (!targetCommit || !commitsData?.commits?.length) return [];

        const targetIndex = commitsData.commits.findIndex((c: ClientCommit) => c.hash === targetCommit);
        if (targetIndex < 0) return [];

        return commitsData.commits.slice(0, targetIndex);
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

    const handleAuthorFilter = useCallback(
        (author: string) => {
            setCommitFilters((prev) => ({
                ...prev,
                author,
            }));
            setMaxCommits(baselineInitialMaxCommits);
            setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
        },
        [baselineInitialMaxCommits]
    );

    const handleBranchFilter = useCallback(
        (branch: string) => {
            setSelectedBranches([branch]);
            setMaxCommits(baselineInitialMaxCommits);
            setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
            setExpandedCommit(null);
            setSelectedCommitIndex(null);
        },
        [baselineInitialMaxCommits]
    );

    const handleSelectedBranchesChange = useCallback(
        (branches: string[]) => {
            setSelectedBranches(branches);
            setMaxCommits(baselineInitialMaxCommits);
            setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
            setExpandedCommit(null);
            setSelectedCommitIndex(null);
        },
        [baselineInitialMaxCommits]
    );

    const handleCreateBranchFromHash = useCallback((hash: string) => {
        setTargetCommit(hash);
        setCreateBranchOpen(true);
    }, []);

    const handleOpenInFinder = useCallback(() => {
        if (!activeRepo) {
            toast('Open a repository first.');
            return;
        }
        void revealInFinder({
            path: activeRepo,
        })
            .then((result) => {
                if (!result.success) {
                    toast.error('error' in result ? result.error : 'Failed to open repository in finder');
                }
            })
            .catch((error) => {
                toast.error(error instanceof Error ? error.message : 'Failed to open repository in finder');
            });
    }, [activeRepo, revealInFinder]);

    const handleOpenInTerminal = useCallback(() => {
        if (!activeRepo) {
            toast('Open a repository first.');
            return;
        }
        void openTerminalInRepo({
            path: activeRepo,
        })
            .then((result) => {
                if (!result.success) {
                    toast.error('error' in result ? result.error : 'Failed to open terminal');
                }
            })
            .catch((error) => {
                toast.error(error instanceof Error ? error.message : 'Failed to open terminal');
            });
    }, [activeRepo, openTerminalInRepo]);

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
                    const nextIndex =
                        selectedCommitIndex === null ? 0 : Math.min(selectedCommitIndex + 1, totalCommits - 1);
                    handleSelectCommit(nextIndex);
                }
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (totalCommits > 0) {
                    const prevIndex =
                        selectedCommitIndex === null ? totalCommits - 1 : Math.max(selectedCommitIndex - 1, 0);
                    handleSelectCommit(prevIndex);
                }
            } else if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                if (totalCommits > 0) handleSelectCommit(0);
            } else if (e.key === 'G' && !e.metaKey && !e.ctrlKey) {
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
                handleRefreshAll();
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
            } else if (e.key === '1' && (e.metaKey || e.ctrlKey)) {
                // Cmd+1 for Guided mode
                e.preventDefault();
                setLensMode('guided');
            } else if (e.key === '2' && (e.metaKey || e.ctrlKey)) {
                // Cmd+2 for Craft mode
                e.preventDefault();
                setLensMode('craft');
            } else if (e.key === '3' && (e.metaKey || e.ctrlKey)) {
                // Cmd+3 for Control mode
                e.preventDefault();
                setLensMode('control');
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
        return () => { window.removeEventListener('keydown', handleKeyDown); };
    }, [
        handleRefreshAll,
        commitsData?.commits?.length,
        selectedCommitIndex,
        selectedCommit,
        expandedCommit,
        handleSelectCommit,
        handleExpandCommit,
        setCommitDetailsOpen,
        terminalOpen,
        handlePinCommit,
        setSearchCommitsOpen,
        setKeyboardHelpOpen,
        setSettingsOpen,
        setCommandPaletteOpen,
        setGitFlowOpen,
        setLensMode,
    ]);

    const handleOpenRepo = async () => {
        if (isRepoBusy) {
            return;
        }
        await openRepositoryDialog('Open Repository');
    };

    const handleVisibleRangeChange = useCallback((start: number, end: number) => {
        const prev = visibleRangeRef.current;
        if (prev.start === start && prev.end === end) {
            return;
        }
        visibleRangeRef.current = { start, end };
        setVisibleStartIndex(start);
        setVisibleEndIndex(end);
    }, []);

    const handleCommitListScrollOffsetChange = useCallback((offset: number) => {
        if (Math.abs(scrollOffsetRef.current - offset) < 1) {
            return;
        }
        scrollOffsetRef.current = offset;
        setCommitListScrollOffset(offset);
    }, []);

    useEffect(() => {
        visibleRangeRef.current = { start: 0, end: 120 };
        scrollOffsetRef.current = 0;
        startTransition(() => {
            setSelectedBranches(['__all__']);
            setCommitFilters({});
            setMaxCommits(baselineInitialMaxCommits);
            setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
            setExpandedCommit(null);
            setSelectedCommitIndex(null);
            setTargetCommit('');
            setVisibleStartIndex(0);
            setVisibleEndIndex(120);
            setCommitListScrollOffset(0);
        });
    }, [activeRepo, baselineInitialMaxCommits]);

    useEffect(() => {
        if (!activeRepo) {
            if (repoLoadPhase === 'ready' || repoLoadPhase === 'loading-graph' || repoLoadPhase === 'validating') {
                resetRepoLoadState('idle');
            }
            return;
        }

        if (repoLoadPhase !== 'loading-graph' && repoLoadPhase !== 'validating') {
            return;
        }

        if (commitsLoading || commitsData === undefined) {
            return;
        }

        if (commitsData.error) {
            setRepoLoadState({
                phase: 'error',
                message: 'Failed to load repository graph.',
                error: commitsData.error,
                target: activeRepo,
            });
            return;
        }

        setRepoLoadState({
            phase: 'ready',
            message: null,
            error: null,
            target: activeRepo,
        });
    }, [activeRepo, repoLoadPhase, commitsLoading, commitsData, resetRepoLoadState, setRepoLoadState]);

    // No repo selected
    if (!activeRepo) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <div className='ui-surface ui-empty-state-shell max-w-md'>
                    <div className='from-primary/20 to-primary/5 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br'>
                        <GitCommit className='text-primary h-10 w-10' />
                    </div>
                    <h1 className='mb-2 text-2xl font-semibold'>Welcome to Git Graph</h1>
                    <p className='text-muted-foreground mb-6'>
                        Open a Git repository to visualize your commit history.
                    </p>
                    <Button size='lg' onClick={handleOpenRepo} className='gap-2' disabled={isRepoBusy}>
                        {isRepoLoading ? <Loader2 className='h-5 w-5 animate-spin' /> : <Plus className='h-5 w-5' />}
                        {isRepoLoading ? 'Opening…' : 'Open Repository'}
                    </Button>
                    <Button
                        size='lg'
                        variant='outline'
                        onClick={() => { setCloneDialogOpen(true); }}
                        className='mt-3 gap-2'
                        disabled={isRepoBusy}>
                        <Download className='h-5 w-5' />
                        Clone Repository
                    </Button>
                    <p className='text-muted-foreground mt-4 text-xs'>
                        or use the sidebar to browse recent repositories
                    </p>
                </div>
                {cloneDialogOpen && (
                    <Suspense fallback={<DialogLoadingFallback />}>
                        <CloneRepositoryDialog
                            open={cloneDialogOpen}
                            onOpenChange={setCloneDialogOpen}
                            onCloned={async (repoPath) => {
                                await activateRepoPath(repoPath, {
                                    ensureRegistered: true,
                                    errorTitle: 'Failed to open cloned repository',
                                });
                            }}
                        />
                    </Suspense>
                )}
            </div>
        );
    }

    // Git not available
    if (gitStatus && !gitStatus.available) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <div className='ui-surface ui-empty-state-shell max-w-md'>
                    <div className='from-destructive/20 to-destructive/5 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br'>
                        <X className='text-destructive h-10 w-10' />
                    </div>
                    <h1 className='mb-2 text-2xl font-semibold'>Git Not Available</h1>
                    <p className='text-muted-foreground mb-2'>Git Graph requires Git to be installed.</p>
                    <p className='text-muted-foreground/70 mb-4 text-sm'>{gitStatus.error}</p>
                    <Button variant='outline' onClick={() => window.open('https://git-scm.com/downloads', '_blank')}>
                        Download Git
                    </Button>
                </div>
            </div>
        );
    }

    const hasCommitResponse = commitsData !== undefined;

    // Initial repository activation only.
    if (repoLoading && !hasCommitResponse) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <div className='text-center'>
                    <Loader2 className='text-primary mx-auto mb-3 h-8 w-8 animate-spin' />
                    <p className='text-muted-foreground text-sm'>Loading commits...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (commitsData?.error) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <div className='ui-surface ui-empty-state-shell text-center'>
                    <p className='text-destructive mb-2 text-lg'>Error Loading Commits</p>
                    <p className='text-muted-foreground mb-4 text-sm'>{commitsData.error}</p>
                    <Button variant='outline' onClick={handleRefreshAll}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const currentHead = repoInfo?.head ?? 'main';
    const handlePreviewedPush = useCallback(
        (force: boolean) => {
            if (!currentHead) {
                toast.error('No current branch selected for push');
                return;
            }

            if (!force) {
                void gitOps.push(currentHead, 'origin', true, false);
                return;
            }

            const ahead = aheadBehindData?.ahead ?? 0;
            const preview: ActionPreview = {
                type: 'force-push',
                title: 'Force Push Confirmation',
                description: `You are about to force push ${currentHead} to origin.`,
                willChange: {
                    ...(ahead > 0 ? { commits: ahead } : {}),
                    branches: [currentHead],
                    remotes: ['origin'],
                },
                risks: [
                    'Force push rewrites remote history and can overwrite teammates changes.',
                    'Anyone tracking this branch may need to rebase or reset.',
                ],
                undoAvailable: false,
                gitCommands: [`git push --force --set-upstream origin ${currentHead}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.push(currentHead, 'origin', true, true);
            });
        },
        [actionPreview, aheadBehindData?.ahead, currentHead, gitOps]
    );

    const handlePreviewedReset = useCallback(
        async (mode: 'soft' | 'mixed' | 'hard') => {
            if (!activeRepo) return;

            const targetIndex = commitsData?.commits?.findIndex((c: ClientCommit) => c.hash === targetCommit) ?? -1;
            const commitDelta = targetIndex >= 0 ? targetIndex + 1 : undefined;
            const stats = await gitUtils.git.diffStats.fetch({
                repo: activeRepo,
                from: 'HEAD',
                to: targetCommit,
            });
            const fileCount = stats?.stats?.files ?? undefined;

            const modeRisk =
                mode === 'hard'
                    ? 'Hard reset will discard uncommitted changes in tracked files.'
                    : mode === 'mixed'
                      ? 'Mixed reset will unstage changes in your working tree.'
                      : 'Soft reset keeps all changes staged but rewrites commit history.';

            const preview: ActionPreview = {
                type: 'reset',
                title: `Reset ${mode} to ${targetCommit.slice(0, 7)}`,
                description: 'Reset the current branch pointer to a selected commit.',
                willChange: {
                    ...(commitDelta !== undefined ? { commits: commitDelta } : {}),
                    ...(fileCount !== undefined ? { files: fileCount } : {}),
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: [modeRisk, 'Collaborators may need to sync manually if this branch is shared.'],
                undoAvailable: true,
                gitCommands: [`git reset --${mode} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.reset(targetCommit, mode);
                setResetOpen(false);
            });
        },
        [activeRepo, actionPreview, commitsData?.commits, currentHead, gitOps, gitUtils.git.diffStats, targetCommit]
    );

    const handlePreviewedMerge = useCallback(
        async (options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => {
            if (!activeRepo) return;

            const previewResult = await gitUtils.git.mergePreview.fetch({
                repo: activeRepo,
                source: targetBranch,
                target: currentHead,
            });
            if (previewResult && 'error' in previewResult && previewResult.error) {
                toast.error('Unable to preview merge', {
                    description: previewResult.error,
                });
                return;
            }

            const mergePreviewData =
                previewResult && 'aheadCommits' in previewResult && 'files' in previewResult ? previewResult : null;
            const previewConflicts =
                mergePreviewData && 'conflicts' in mergePreviewData && Array.isArray(mergePreviewData.conflicts)
                    ? mergePreviewData.conflicts
                    : [];

            const preview: ActionPreview = {
                type: options.squash ? 'squash' : 'merge',
                title: `Merge ${targetBranch} into ${currentHead}`,
                description: 'Review merge impact before applying it.',
                willChange: {
                    commits: mergePreviewData?.aheadCommits?.length ?? 0,
                    files: mergePreviewData?.files?.length ?? 0,
                    branches: [targetBranch, currentHead],
                },
                risks: [
                    ...(previewConflicts.length ? [`${previewConflicts.length} conflict file(s) likely.`] : []),
                    ...(options.squash ? ['Squash merge combines all commits into one.'] : []),
                    ...(options.noCommit ? ['No-commit mode stages changes without creating a commit.'] : []),
                ],
                undoAvailable: true,
                gitCommands: [
                    `git merge${options.noFastForward ? ' --no-ff' : ''}${options.squash ? ' --squash' : ''}${options.noCommit ? ' --no-commit' : ''} ${targetBranch}`,
                ],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.merge(targetBranch, options);
                setMergeOpen(false);
            });
        },
        [activeRepo, actionPreview, currentHead, gitOps, gitUtils.git.mergePreview, targetBranch]
    );

    const handlePreviewedRebase = useCallback(
        async (interactive: boolean) => {
            if (!activeRepo) return;

            if (interactive) {
                setRebaseOpen(false);
                setInteractiveRebaseOpen(true);
                return;
            }

            const previewResult = await gitUtils.git.rebasePreview.fetch({
                repo: activeRepo,
                branch: currentHead,
                onto: targetCommit,
            });
            if ('error' in previewResult && previewResult.error) {
                toast.error('Unable to preview rebase', {
                    description: previewResult.error,
                });
                return;
            }

            const preview: ActionPreview = {
                type: 'rebase',
                title: `Rebase ${currentHead} onto ${targetCommit.slice(0, 7)}`,
                description: 'This rewrites commit hashes for rebased commits.',
                willChange: {
                    commits: previewResult?.commits?.length ?? 0,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: [...(previewResult?.warnings ?? []), 'Rebase can require conflict resolution commit-by-commit.'],
                undoAvailable: true,
                gitCommands: [`git rebase ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.rebase(targetCommit, false);
                setRebaseOpen(false);
            });
        },
        [activeRepo, actionPreview, currentHead, gitOps, gitUtils.git.rebasePreview, targetCommit]
    );

    const handlePreviewedCherryPick = useCallback(
        (noCommit: boolean) => {
            const pickedCommit = commitsData?.commits?.find((c: ClientCommit) => c.hash === targetCommit);
            const preview: ActionPreview = {
                type: 'cherry-pick',
                title: `Cherry-pick ${targetCommit.slice(0, 7)}`,
                description: pickedCommit?.message ?? 'Apply a commit from another branch onto the current branch.',
                willChange: {
                    commits: noCommit ? 0 : 1,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: ['Cherry-pick may produce conflicts if code has diverged.'],
                undoAvailable: true,
                gitCommands: [`git cherry-pick${noCommit ? ' --no-commit' : ''} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.cherryPick(targetCommit, noCommit);
                setCherryPickOpen(false);
            });
        },
        [actionPreview, commitsData?.commits, currentHead, gitOps, targetCommit]
    );

    const handlePreviewedRevert = useCallback(
        (noCommit: boolean) => {
            const revertedCommit = commitsData?.commits?.find((c: ClientCommit) => c.hash === targetCommit);
            const preview: ActionPreview = {
                type: 'revert',
                title: `Revert ${targetCommit.slice(0, 7)}`,
                description: revertedCommit?.message ?? 'Create a new commit that reverts a previous commit.',
                willChange: {
                    commits: noCommit ? 0 : 1,
                    ...(currentHead ? { branches: [currentHead] } : {}),
                },
                risks: ['Reverting can conflict if dependent commits were added later.'],
                undoAvailable: true,
                gitCommands: [`git revert${noCommit ? ' --no-commit' : ''} ${targetCommit}`],
            };

            actionPreview.showPreview(preview, () => {
                void gitOps.revert(targetCommit, noCommit);
                setRevertOpen(false);
            });
        },
        [actionPreview, commitsData?.commits, currentHead, gitOps, targetCommit]
    );
    const normalizedBranchSearch = branchSearch.trim().toLowerCase();
    const localBranches = useMemo(() => {
        const list = (repoInfo?.branches ?? []).filter((branch) => !branch.startsWith('remotes/'));
        return list.sort((a, b) => {
            if (a === currentHead) return -1;
            if (b === currentHead) return 1;
            return a.localeCompare(b);
        });
    }, [repoInfo?.branches, currentHead]);
    const remoteBranches = useMemo(() => {
        return (repoInfo?.branches ?? [])
            .filter((branch) => branch.startsWith('remotes/') && !branch.endsWith('/HEAD'))
            .sort((a, b) => a.localeCompare(b));
    }, [repoInfo?.branches]);
    const filteredLocalBranches = useMemo(() => {
        if (!normalizedBranchSearch) return localBranches;
        return localBranches.filter((branch) => branch.toLowerCase().includes(normalizedBranchSearch));
    }, [localBranches, normalizedBranchSearch]);
    const filteredRemoteBranches = useMemo(() => {
        if (!normalizedBranchSearch) return remoteBranches;
        return remoteBranches.filter((branch) => branch.toLowerCase().includes(normalizedBranchSearch));
    }, [remoteBranches, normalizedBranchSearch]);
    const branchResults = useMemo(
        () => [...filteredLocalBranches, ...filteredRemoteBranches],
        [filteredLocalBranches, filteredRemoteBranches]
    );

    const handleCheckoutBranch = useCallback(
        (branch: string) => {
            if (branch === currentHead) return;
            void gitOps.checkout(branch);
            setBranchMenuOpen(false);
        },
        [currentHead, gitOps]
    );

    useEffect(() => {
        if (!branchMenuOpen) {
            setBranchSearch('');
        }
    }, [branchMenuOpen]);

    return (
        <UndoStackProvider>
            <TooltipProvider>
                <div className='flex h-full flex-1 flex-col overflow-hidden'>
                    {/* Top Toolbar */}
                    <div className='ui-toolbar flex items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                        {/* Repo info */}
                        <div className='mr-2 flex shrink-0 items-center gap-2'>
                            <div className='from-background/80 to-muted/40 border-border/70 inline-flex items-center gap-1.5 rounded-md border bg-gradient-to-b px-2.5 py-1'>
                                <GitBranch className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                                <span className='max-w-44 truncate text-sm font-semibold tracking-tight'>
                                    {activeRepo.split('/').pop()}
                                </span>
                            </div>
                            {/* Current branch - clickable to show branches */}
                            <DropdownMenu open={branchMenuOpen} onOpenChange={setBranchMenuOpen}>
                                <DropdownMenuTrigger className='bg-primary/10 text-primary border-primary/30 hover:bg-primary/15 focus-visible:ring-primary/40 inline-flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-xs font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                                    <GitBranch className='h-3.5 w-3.5' />
                                    {currentHead}
                                    <ChevronDown className='h-3 w-3' />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align='start' className='max-h-96 w-72 overflow-y-auto p-0'>
                                    <div className='bg-popover sticky top-0 z-10 border-b p-2'>
                                        <Input
                                            value={branchSearch}
                                            onChange={(event) => { setBranchSearch(event.target.value); }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    const firstResult = branchResults[0];
                                                    if (firstResult) {
                                                        handleCheckoutBranch(firstResult);
                                                    }
                                                }
                                            }}
                                            placeholder='Checkout branch...'
                                            className='border-border/70 bg-background/80 focus-visible:ring-primary/30 h-8 text-sm focus-visible:ring-2'
                                        />
                                    </div>
                                    <div className='text-muted-foreground bg-popover sticky top-[49px] px-2 py-1.5 text-xs font-medium'>
                                        Local Branches ({filteredLocalBranches.length})
                                    </div>
                                    {filteredLocalBranches.map((branch) => (
                                        <DropdownMenuItem
                                            key={branch}
                                            className={branch === currentHead ? 'bg-accent font-medium' : ''}
                                            onClick={() => {
                                                handleCheckoutBranch(branch);
                                            }}>
                                            <GitBranch
                                                className={`mr-2 h-4 w-4 ${branch === currentHead ? 'text-primary' : 'text-muted-foreground'}`}
                                            />
                                            <span className='flex-1'>{branch}</span>
                                            {branch === currentHead && (
                                                <span className='text-primary text-xs font-medium'>current</span>
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                    {filteredLocalBranches.length === 0 && (
                                        <div className='text-muted-foreground px-3 py-2 text-sm'>
                                            No local branches found
                                        </div>
                                    )}

                                    {/* Remote branches */}
                                    {filteredRemoteBranches.length > 0 && (
                                        <>
                                            <div className='text-muted-foreground bg-popover sticky top-[49px] mt-1 border-t px-2 py-1.5 text-xs font-medium'>
                                                Remote Branches ({filteredRemoteBranches.length})
                                            </div>
                                            {filteredRemoteBranches.map((branch) => (
                                                <DropdownMenuItem
                                                    key={branch}
                                                    onClick={() => {
                                                        handleCheckoutBranch(branch);
                                                    }}>
                                                    <Globe className='text-muted-foreground mr-2 h-4 w-4' />
                                                    <span className='flex-1'>{branch.replace('remotes/', '')}</span>
                                                </DropdownMenuItem>
                                            ))}
                                        </>
                                    )}
                                    {branchResults.length === 0 && (
                                        <div className='text-muted-foreground px-3 py-3 text-center text-sm'>
                                            No branches match "{branchSearch}"
                                        </div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className='bg-border mx-1 h-5 w-px shrink-0' />

                        {/* Main actions - adaptive based on lens mode */}
                        {isGuided ? (
                            // Guided mode: Simple "Sync" button
                            <ToolbarButton
                                icon={RefreshCw}
                                label='Sync'
                                onClick={async () => {
                                    await gitOps.fetch();
                                    await gitOps.pull(currentHead, 'origin', false, false);
                                }}
                            />
                        ) : (
                            // Craft/Control mode: Individual buttons
                            <>
                                <ToolbarButton
                                    icon={Download}
                                    label={isGuided ? 'Check for updates' : 'Fetch'}
                                    onClick={() => gitOps.fetch()}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                                        <Upload className='h-4 w-4' />
                                        <span className='hidden sm:inline'>{isGuided ? 'Share' : 'Push'}</span>
                                        <ChevronDown className='h-3 w-3' />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='start'>
                                        <DropdownMenuItem onClick={() => { handlePreviewedPush(false); }}>
                                            <Upload className='mr-2 h-4 w-4' />
                                            Push
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { handlePreviewedPush(true); }}>
                                            <Upload className='mr-2 h-4 w-4 text-amber-600' />
                                            Force Push
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu>
                                    <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                                        <Download className='h-4 w-4' />
                                        <span className='hidden sm:inline'>Pull</span>
                                        <ChevronDown className='h-3 w-3' />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='start'>
                                        <DropdownMenuItem onClick={() => gitOps.pull(currentHead, 'origin', false, false)}>
                                            <Download className='mr-2 h-4 w-4' />
                                            Pull
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => gitOps.pull(currentHead, 'origin', false, true)}>
                                            <Download className='mr-2 h-4 w-4 text-emerald-600' />
                                            Pull (Fast-forward only)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        )}

                        <div className='bg-border mx-1 h-5 w-px shrink-0' />

                        {/* Branch/Tag creation */}
                        <DropdownMenu>
                            <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                                <Plus className='h-4 w-4' />
                                <span className='hidden sm:inline'>New</span>
                                <ChevronDown className='h-3 w-3' />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='start'>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setTargetCommit(selectedCommit ?? 'HEAD');
                                        setCreateBranchOpen(true);
                                    }}>
                                    <GitBranch className='mr-2 h-4 w-4' />
                                    Branch...
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setTargetCommit(selectedCommit ?? 'HEAD');
                                        setAddTagOpen(true);
                                    }}>
                                    <Tag className='mr-2 h-4 w-4' />
                                    Tag...
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => {
                                        setStashManageOpen(true);
                                    }}>
                                    <Archive className='mr-2 h-4 w-4' />
                                    Stash
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Branch filter */}
                        <div className='ml-1 w-44 shrink-0'>
                            <BranchDropdown
                                branches={branchOptions}
                                selectedBranches={selectedBranches}
                                multiple
                                onChange={handleSelectedBranchesChange}
                            />
                        </div>

                        {/* Lens Mode Switcher */}
                        <div className='ml-1 shrink-0'>
                            <LensSwitcher variant='toolbar' showLabel={false} />
                        </div>

                        {/* Profile Switcher */}
                        <div className='ml-1 shrink-0'>
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <ProfileSwitcher />
                            </Suspense>
                        </div>

                        {/* Operation Timeline */}
                        <div className='ml-1 shrink-0'>
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <OperationTimeline />
                            </Suspense>
                        </div>

                        {/* Stacked Branches */}
                        <div className='ml-1 shrink-0'>
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <StackedBranchesPanel />
                            </Suspense>
                        </div>

                        {/* Workspaces Launchpad */}
                        <div className='ml-1 shrink-0'>
                            <ToolbarButton icon={FolderGit2} label='Workspaces' onClick={() => { setWorkspacesOpen(true); }} />
                        </div>

                        {/* Commit History Filters */}
                        {(commitFilters.author ||
                            commitFilters.search ||
                            commitFilters.dateFrom ||
                            commitFilters.dateTo ||
                            commitFilters.filePath) && (
                            <Badge variant='secondary' className='ml-2 shrink-0 gap-1'>
                                <Filter className='h-3 w-3' />
                                <span className='text-xs'>Filtered</span>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='ml-1 h-4 w-4 p-0'
                                    onClick={() => {
                                        setCommitFilters({});
                                        setMaxCommits(baselineInitialMaxCommits);
                                        setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
                                    }}>
                                    <X className='h-3 w-3' />
                                </Button>
                            </Badge>
                        )}

                        {/* Right side */}
                        <div className='flex-1 shrink-0' />

                        {/* Search */}
                        <ToolbarButton
                            icon={Search}
                            label='Find'
                            shortcut='⌘F'
                            onClick={() => { setFindWidgetOpen(true); }}
                        />

                        {/* Refresh */}
                        <ToolbarButton icon={RefreshCw} label='Refresh' shortcut='⌘R' onClick={handleRefreshAll} />

                        {/* Toggle Side Panel */}
                        <ToolbarButton
                            icon={PanelLeft}
                            label='Toggle Panel'
                            onClick={() => { setShowSidePanel(!showSidePanel); }}
                        />

                        {/* Pinned Commits */}
                        <Button
                            variant='ghost'
                            size='sm'
                            className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 relative h-8 w-8 rounded-md border border-transparent p-0 transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'
                            onClick={() => { setPinnedCommitsOpen(true); }}
                            title='Pinned Commits'>
                            <Pin className='h-4 w-4' />
                            {pinnedCommits.length > 0 && (
                                <span className='bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]'>
                                    {pinnedCommits.length}
                                </span>
                            )}
                        </Button>

                        {/* More options */}
                        <DropdownMenu>
                            <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                                <MoreHorizontal className='h-4 w-4' />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                    onClick={() => {
                                        handleOpenInTerminal();
                                    }}>
                                    <Terminal className='mr-2 h-4 w-4' />
                                    Open in Terminal
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        handleOpenInFinder();
                                    }}>
                                    <FileCode className='mr-2 h-4 w-4' />
                                    Open in Finder
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setCloneDialogOpen(true); }}>
                                    <Download className='mr-2 h-4 w-4' />
                                    Clone Repository
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setFuzzyFinderOpen(true); }}>
                                    <Search className='mr-2 h-4 w-4' />
                                    Quick Switch...
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘K</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setShowFiltersDialog(true); }}>
                                    <Filter className='mr-2 h-4 w-4' />
                                    Filter Commits...
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        const fileForLineStaging =
                                            workingTreeStatus?.unstaged?.[0]?.file ?? workingTreeStatus?.staged?.[0]?.file;
                                        if (!fileForLineStaging) {
                                            toast.info('No changed files available for line staging');
                                            return;
                                        }
                                        setStagingFile(fileForLineStaging);
                                        setLineStagingOpen(true);
                                    }}>
                                    <ListPlus className='mr-2 h-4 w-4' />
                                    Line Staging...
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setTerminalOpen(!terminalOpen); }}>
                                    <Terminal className='mr-2 h-4 w-4' />
                                    Toggle Terminal
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘P</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setStatisticsOpen(true); }}>
                                    <BarChart3 className='mr-2 h-4 w-4' />
                                    Statistics
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRemoteManageOpen(true); }}>
                                    <Globe className='mr-2 h-4 w-4' />
                                    Manage Remotes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setBranchCompareOpen(true); }}>
                                    <GitBranch className='mr-2 h-4 w-4' />
                                    Compare Branches
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setHooksManageOpen(true); }}>
                                    <Settings className='mr-2 h-4 w-4' />
                                    Hooks
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setCommitSigningOpen(true); }}>
                                    <Key className='mr-2 h-4 w-4' />
                                    Commit Signing
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setReflogOpen(true); }}>
                                    <History className='mr-2 h-4 w-4' />
                                    Reflog
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setTemplatesOpen(true); }}>
                                    <FileText className='mr-2 h-4 w-4' />
                                    Commit Templates
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setGitignoreOpen(true); }}>
                                    <FileText className='mr-2 h-4 w-4' />
                                    Edit .gitignore
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setCustomCommandsOpen(true); }}>
                                    <Terminal className='mr-2 h-4 w-4' />
                                    Custom Commands
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setSearchCommitsOpen(true); }}>
                                    <Search className='mr-2 h-4 w-4' />
                                    Search Commits
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘⇧F</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setLfsOpen(true); }}>
                                    <Package className='mr-2 h-4 w-4' />
                                    LFS Management
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setInlineBlameEnabled(!inlineBlameEnabled); }}>
                                    <User className='mr-2 h-4 w-4' />
                                    {inlineBlameEnabled ? 'Disable' : 'Enable'} Inline Blame
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setPrIntegrationOpen(true); }}>
                                    <GitPullRequest className='mr-2 h-4 w-4' />
                                    Pull Requests
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setWorktreeOpen(true); }}>
                                    <FolderGit2 className='mr-2 h-4 w-4' />
                                    Worktrees
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSubmoduleOpen(true); }}>
                                    <Package className='mr-2 h-4 w-4' />
                                    Submodules
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setRecentReposOpen(true); }}>
                                    <FolderGit2 className='mr-2 h-4 w-4' />
                                    Recent Repositories
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setWorkspacesOpen(true); }}>
                                    <FolderGit2 className='mr-2 h-4 w-4' />
                                    Workspaces Launchpad
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setKeyboardHelpOpen(true); }}>
                                    <Keyboard className='mr-2 h-4 w-4' />
                                    Keyboard Shortcuts
                                    <span className='text-muted-foreground ml-auto text-xs'>?</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        localStorage.removeItem('git-graph-onboarding-complete');
                                        setOnboardingOpen(true);
                                    }}>
                                    <Info className='mr-2 h-4 w-4' />
                                    Start Onboarding Tour
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setStashManageOpen(true); }}>
                                    <Archive className='mr-2 h-4 w-4' />
                                    Manage Stashes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setGraphLegendOpen(true); }}>
                                    <Info className='mr-2 h-4 w-4' />
                                    Graph Legend
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setGitFlowOpen(true); }}>
                                    <GitBranch className='mr-2 h-4 w-4' />
                                    Git Flow
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setHealthCheckOpen(true); }}>
                                    <Activity className='mr-2 h-4 w-4' />
                                    Health Check
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setBisectOpen(true); }}>
                                    <Bug className='mr-2 h-4 w-4' />
                                    Git Bisect
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setUndoStackOpen(true); }}>
                                    <History className='mr-2 h-4 w-4' />
                                    Undo History
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘Z</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setConfigEditorOpen(true); }}>
                                    <Settings className='mr-2 h-4 w-4' />
                                    Git Configuration
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setExternalDiffOpen(true); }}>
                                    <FileCode className='mr-2 h-4 w-4' />
                                    External Diff Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setIssueTrackerOpen(true); }}>
                                    <GitPullRequest className='mr-2 h-4 w-4' />
                                    Issue Tracker Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setBulkOpsOpen(true); }}>
                                    <GitCommit className='mr-2 h-4 w-4' />
                                    Bulk Operations
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setFileAnnotationsOpen(true); }}>
                                    <FileCode className='mr-2 h-4 w-4' />
                                    File Annotations
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setActivityHeatmapOpen(true); }}>
                                    <BarChart3 className='mr-2 h-4 w-4' />
                                    Activity Heatmap
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setSettingsOpen(true); }}>
                                    <Settings className='mr-2 h-4 w-4' />
                                    Settings
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘,</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setCommandPaletteOpen(true); }}>
                                    <Search className='mr-2 h-4 w-4' />
                                    Command Palette
                                    <span className='text-muted-foreground ml-auto text-xs'>⌘⇧P</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => gitOps.undoLastCommit()}>
                                    <Undo className='mr-2 h-4 w-4' />
                                    Undo Last Commit
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Find Widget */}
                    {findWidgetOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <FindWidget
                                open={findWidgetOpen}
                                onClose={() => { setFindWidgetOpen(false); }}
                                onFind={handleFind}
                                onFindNext={handleFindNext}
                                onFindPrevious={handleFindPrevious}
                                currentIndex={findCurrentIndex}
                                totalMatches={findMatches.length}
                            />
                        </Suspense>
                    )}

                    {/* Main Content */}
                    <div className='flex min-w-0 flex-1 overflow-hidden'>
                        {/* Side Panel - Branches/Tags/Stashes */}
                        {showSidePanel && layoutMode === 'panel' && (
                            <SidePanel
                                onBranchSelect={handleBranchFilter}
                                onCreateBranch={() => {
                                    setTargetCommit(selectedCommit ?? 'HEAD');
                                    setCreateBranchOpen(true);
                                }}
                                onCreateTag={() => {
                                    setTargetCommit(selectedCommit ?? 'HEAD');
                                    setAddTagOpen(true);
                                }}
                                onMergeBranch={(branch) => {
                                    setTargetBranch(branch);
                                    setMergeOpen(true);
                                }}
                            />
                        )}

                        {/* Graph and Commit List */}
                        <div className='flex flex-1 flex-col overflow-hidden'>
                            <div className='flex flex-1 overflow-hidden'>
                                {commitsLoading && !hasCommitResponse ? (
                                    // Loading skeleton
                                    <div className='flex w-full'>
                                        <div className='ui-commit-col w-28 shrink-0'>
                                            {Array.from({ length: 15 }).map((_, i) => (
                                                <div key={i} className='h-8 animate-pulse px-2'>
                                                    <div className='bg-muted h-4 w-16 rounded' />
                                                </div>
                                            ))}
                                        </div>
                                        <div className='shrink-0' style={{ width: 210 }}>
                                            <GraphSkeleton />
                                        </div>
                                        <div className='flex-1'>
                                            <CommitListSkeleton count={15} />
                                        </div>
                                    </div>
                                ) : commitsData?.error ? (
                                    // Error state
                                    <ErrorState
                                        title='Failed to load commits'
                                        message={commitsData.error}
                                        onRetry={handleRefreshAll}
                                    />
                                ) : (
                                    <div className='relative h-full w-full overflow-hidden'>
                                        {commitsFetching && hasCommitResponse && (
                                            <div className='pointer-events-none absolute top-2 right-3 z-10'>
                                                <div className='bg-background/90 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] shadow-sm backdrop-blur'>
                                                    <Loader2 className='h-3 w-3 animate-spin' />
                                                    <span>Refreshing graph…</span>
                                                </div>
                                            </div>
                                        )}
                                        {hasPendingLayoutExpansion && (
                                            <div className='pointer-events-none absolute top-10 right-3 z-10'>
                                                <div className='bg-background/90 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] shadow-sm backdrop-blur'>
                                                    {graphLayoutCalculating ? (
                                                        <Loader2 className='h-3 w-3 animate-spin' />
                                                    ) : (
                                                        <Activity className='h-3 w-3' />
                                                    )}
                                                    <span>
                                                        Refining graph… {layoutCommits.length}/{totalLoadedCommits}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {isDecoratingRefs && (
                                            <div className='pointer-events-none absolute top-[4.5rem] right-3 z-10'>
                                                <div className='bg-background/90 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] shadow-sm backdrop-blur'>
                                                    <Loader2 className='h-3 w-3 animate-spin' />
                                                    <span>Loading branch labels…</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className='flex h-full min-w-max'>
                                            {/* Graph */}
                                            <div
                                                className='bg-background relative shrink-0 overflow-hidden'
                                                style={{ width: (graphLayout?.width ?? 200) + 10 }}>
                                                {graphLayout && (
                                                    <CommitGraph
                                                        layout={graphLayout}
                                                        config={GRAPH_CONFIG}
                                                        expandedIndex={expandedCommit ?? -1}
                                                        selectedIndex={selectedCommitIndex}
                                                        onVertexClick={handleSelectCommit}
                                                        onVertexHover={() => {}}
                                                        commits={commitGraphCommits}
                                                        showAvatars={(commitsData?.commits?.length ?? 0) < 2500}
                                                        visibleStartIndex={visibleStartIndex}
                                                        visibleEndIndex={visibleEndIndex}
                                                        scrollOffset={commitListScrollOffset}
                                                    />
                                                )}
                                                {!graphLayout && graphLayoutCalculating && (
                                                    <div className='flex h-full min-h-[240px] items-center justify-center px-3'>
                                                        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                                                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                                            <span>Computing graph in background...</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Commit list */}
                                            <div className='min-w-[400px] flex-1'>
                                                {commitsData?.commits && commitsData.commits.length > 0 ? (
                                                    <VirtualizedCommitList
                                                        commits={commitsData.commits}
                                                        layout={graphLayout}
                                                        refLookup={refsLookup}
                                                        repo={activeRepo ?? undefined}
                                                        selectedIndex={selectedCommitIndex}
                                                        expandedIndex={expandedCommit}
                                                        onSelect={handleSelectCommit}
                                                        onExpand={handleExpandCommit}
                                                        onContextMenu={handleContextMenu}
                                                        onVisibleRangeChange={handleVisibleRangeChange}
                                                        onScrollOffsetChange={handleCommitListScrollOffsetChange}
                                                        showAvatars={false}
                                                        hideRefs={false}
                                                    />
                                                ) : (
                                                    <div className='text-muted-foreground flex h-64 items-center justify-center'>
                                                        <p>No commits found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Commit Details Panel */}
                        {commitDetailsOpen && selectedCommit && (
                            <div className='border-border/65 w-80 shrink-0 border-l'>
                                <Suspense
                                    fallback={
                                        <div className='flex h-full items-center justify-center'>
                                            <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
                                        </div>
                                    }>
                                    <CommitDetailsPanel
                                        commitHash={selectedCommit}
                                        onClose={() => { setCommitDetailsOpen(false); }}
                                        onNavigateToCommit={handleNavigateToCommit}
                                        onFilterByAuthor={handleAuthorFilter}
                                        onCreateBranch={handleCreateBranchFromHash}
                                        onCreateTag={(hash) => {
                                            setTargetCommit(hash);
                                            setAddTagOpen(true);
                                        }}
                                        onReset={(hash) => {
                                            setTargetCommit(hash);
                                            setResetOpen(true);
                                        }}
                                        onFileHistoryNavigate={handleNavigateToCommit}
                                    />
                                </Suspense>
                            </div>
                        )}
                    </div>

                    {/* Status bar */}
                    <div className='ui-status-bar flex items-center gap-3 px-4 py-1.5 text-xs'>
                        {/* Left side - commit info */}
                        <div className='flex items-center gap-3'>
                            <span className='text-muted-foreground'>
                                <span className='text-foreground font-medium'>{commitsData?.commits?.length ?? 0}</span>{' '}
                                commits
                            </span>
                            {commitsData?.moreCommitsAvailable && maxCommits < maxCommitsLimit && (
                                <button className='text-primary font-medium hover:underline' onClick={handleLoadMore}>
                                    Load more...
                                </button>
                            )}
                            {commitsData?.moreCommitsAvailable && maxCommits >= maxCommitsLimit && (
                                <span className='text-muted-foreground/80'>
                                    Limit reached ({maxCommitsLimit.toLocaleString()})
                                </span>
                            )}
                        </div>

                        <div className='flex-1' />

                        {/* Center - repo status */}
                        <div className='text-muted-foreground flex items-center gap-3'>
                            {(aheadBehindData?.ahead ?? 0) > 0 && (
                                <span className='flex items-center gap-1 text-emerald-600 dark:text-emerald-400'>
                                    <ArrowUp className='h-3 w-3' />
                                    {aheadBehindData?.ahead} ahead
                                </span>
                            )}
                            {(aheadBehindData?.behind ?? 0) > 0 && (
                                <span className='flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                                    <ArrowDown className='h-3 w-3' />
                                    {aheadBehindData?.behind} behind
                                </span>
                            )}
                            {(workingTreeStatus?.unstaged?.length ?? 0) > 0 && (
                                <span className='flex items-center gap-1'>
                                    <GitCommit className='h-3 w-3' />
                                    {workingTreeStatus?.unstaged?.length ?? 0} changes
                                </span>
                            )}
                        </div>

                        <div className='flex-1' />

                        {/* Right side - counts */}
                        <div className='text-muted-foreground flex items-center gap-3'>
                            <span className='flex items-center gap-1'>
                                <GitBranch className='h-3 w-3' />
                                {repoInfo?.branches?.length ?? 0}
                            </span>
                            <span className='flex items-center gap-1'>
                                <Tag className='h-3 w-3' />
                                {repoInfo?.tags?.length ?? 0}
                            </span>
                            {showPerfDebug && (
                                <button
                                    className='hover:bg-accent/60 text-muted-foreground hover:text-foreground inline-flex h-6 items-center gap-1 rounded border border-transparent px-1.5 transition-colors'
                                    onClick={() => { setPerfPanelOpen(true); }}
                                    title={
                                        hasPerfRegression
                                            ? 'Startup query regression detected'
                                            : hasPerfWatch
                                              ? 'Startup query latency drift detected'
                                              : 'Open startup query telemetry'
                                    }>
                                    <Activity
                                        className={`h-3 w-3 ${
                                            hasPerfRegression
                                                ? 'text-rose-500'
                                                : hasPerfWatch
                                                  ? 'text-amber-500'
                                                  : 'text-emerald-500'
                                        }`}
                                    />
                                    <span className='text-[11px]'>Perf</span>
                                    <span
                                        aria-hidden='true'
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            hasPerfRegression
                                                ? 'bg-rose-500'
                                                : hasPerfWatch
                                                  ? 'bg-amber-500'
                                                  : 'bg-emerald-500'
                                        }`}
                                    />
                                </button>
                            )}
                        </div>
                    </div>

                    {showPerfDebug && (
                        <Dialog open={perfPanelOpen} onOpenChange={setPerfPanelOpen}>
                            <DialogContent className='ui-surface sm:max-w-xl'>
                                <DialogHeader>
                                    <div className='flex items-center justify-between gap-3'>
                                        <DialogTitle className='flex items-center gap-2'>
                                            <Activity className='h-4 w-4' />
                                            Startup Query Telemetry
                                        </DialogTitle>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            className='h-7 gap-1 px-2 text-[11px]'
                                            onClick={copyPerfDiagnostics}
                                            disabled={copyingPerfDiagnostics}>
                                            {copyingPerfDiagnostics ? (
                                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                            ) : (
                                                <Copy className='h-3.5 w-3.5' />
                                            )}
                                            Copy diagnostics
                                        </Button>
                                    </div>
                                </DialogHeader>
                                <div className='space-y-2 text-xs'>
                                    <p className='text-muted-foreground px-2 text-[11px]'>
                                        Repository-scoped rolling window (last {MAX_PERF_HISTORY_SAMPLES}{' '}
                                        samples/query).
                                    </p>
                                    <div className='text-muted-foreground grid grid-cols-[176px_1fr_1fr_1fr_1fr_64px_64px] gap-2 px-2 text-[11px] tabular-nums'>
                                        <span>Query</span>
                                        <span>Latest</span>
                                        <span>p50</span>
                                        <span>p95</span>
                                        <span>Payload</span>
                                        <span>Samples</span>
                                        <span>Errors</span>
                                    </div>

                                    <div className='bg-muted/35 grid grid-cols-[176px_1fr_1fr_1fr_1fr_64px_64px] items-center gap-2 rounded-md px-2 py-2 font-mono tabular-nums'>
                                        <span className='flex items-center gap-2'>
                                            <span className='w-[64px]'>repoInfo</span>
                                            <Badge
                                                variant='outline'
                                                title={repoInfoPerfTrend.title}
                                                className={`min-w-[74px] justify-center px-1.5 text-[10px] ${perfTrendBadgeClass(repoInfoPerfTrend.level)}`}>
                                                {repoInfoPerfTrend.label}
                                            </Badge>
                                        </span>
                                        <span>{formatPerfMs(repoInfoPerfStats.latestDurationMs)}</span>
                                        <span>{formatPerfMs(repoInfoPerfStats.p50DurationMs)}</span>
                                        <span>{formatPerfMs(repoInfoPerfStats.p95DurationMs)}</span>
                                        <span>{formatPerfBytes(repoInfoPerfStats.latestPayloadBytes)}</span>
                                        <span>{repoInfoPerfStats.sampleCount}</span>
                                        <span>{repoInfoPerfStats.errorCount}</span>
                                    </div>

                                    <div className='bg-muted/35 grid grid-cols-[176px_1fr_1fr_1fr_1fr_64px_64px] items-center gap-2 rounded-md px-2 py-2 font-mono tabular-nums'>
                                        <span className='flex items-center gap-2'>
                                            <span className='w-[64px]'>commits</span>
                                            <Badge
                                                variant='outline'
                                                title={commitsPerfTrend.title}
                                                className={`min-w-[74px] justify-center px-1.5 text-[10px] ${perfTrendBadgeClass(commitsPerfTrend.level)}`}>
                                                {commitsPerfTrend.label}
                                            </Badge>
                                        </span>
                                        <span>{formatPerfMs(commitsPerfStats.latestDurationMs)}</span>
                                        <span>{formatPerfMs(commitsPerfStats.p50DurationMs)}</span>
                                        <span>{formatPerfMs(commitsPerfStats.p95DurationMs)}</span>
                                        <span>{formatPerfBytes(commitsPerfStats.latestPayloadBytes)}</span>
                                        <span>{commitsPerfStats.sampleCount}</span>
                                        <span>{commitsPerfStats.errorCount}</span>
                                    </div>

                                    <div className='bg-muted/35 grid grid-cols-[176px_1fr_1fr_1fr_1fr_64px_64px] items-center gap-2 rounded-md px-2 py-2 font-mono tabular-nums'>
                                        <span className='flex items-center gap-2'>
                                            <span className='w-[64px]'>refs</span>
                                            <Badge
                                                variant='outline'
                                                title={refsPerfTrend.title}
                                                className={`min-w-[74px] justify-center px-1.5 text-[10px] ${perfTrendBadgeClass(refsPerfTrend.level)}`}>
                                                {refsPerfTrend.label}
                                            </Badge>
                                        </span>
                                        <span>{formatPerfMs(refsPerfStats.latestDurationMs)}</span>
                                        <span>{formatPerfMs(refsPerfStats.p50DurationMs)}</span>
                                        <span>{formatPerfMs(refsPerfStats.p95DurationMs)}</span>
                                        <span>{formatPerfBytes(refsPerfStats.latestPayloadBytes)}</span>
                                        <span>{refsPerfStats.sampleCount}</span>
                                        <span>{refsPerfStats.errorCount}</span>
                                    </div>

                                    <div className='text-muted-foreground border-border/60 mt-3 space-y-1 rounded-md border p-2 text-[11px]'>
                                        <p>
                                            Active fetches: repoInfo {repoLoading ? 'yes' : 'no'}, commits{' '}
                                            {commitsFetching || commitsLoading ? 'yes' : 'no'}, refs{' '}
                                            {refsFetching ? 'yes' : 'no'}
                                        </p>
                                        <p>
                                            Counts: branches {repoInfo?.branches?.length ?? 0}, tags{' '}
                                            {repoInfo?.tags?.length ?? 0}, commits {commitsData?.commits?.length ?? 0}
                                        </p>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {/* Dialogs */}
                    {createBranchOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CreateBranchDialog
                                open={createBranchOpen}
                                onOpenChange={setCreateBranchOpen}
                                onCreate={(name, checkout) => {
                                    gitOps.createBranch(targetCommit, name, checkout);
                                    setCreateBranchOpen(false);
                                }}
                                targetCommit={targetCommit}
                            />
                        </Suspense>
                    )}

                    {addTagOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <AddTagDialog
                                open={addTagOpen}
                                onOpenChange={setAddTagOpen}
                                onAdd={(name, type, _push) => {
                                    gitOps.createTag(targetCommit, name, type === 'annotated' ? name : undefined);
                                    setAddTagOpen(false);
                                }}
                                targetCommit={targetCommit}
                            />
                        </Suspense>
                    )}

                    {resetOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <ResetDialog
                                open={resetOpen}
                                onOpenChange={setResetOpen}
                                onReset={(mode) => {
                                    void handlePreviewedReset(mode);
                                }}
                                targetCommit={targetCommit}
                            />
                        </Suspense>
                    )}

                    {deleteBranchOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <DeleteBranchDialog
                                open={deleteBranchOpen}
                                onOpenChange={setDeleteBranchOpen}
                                onDelete={(force) => {
                                    gitOps.deleteBranch(targetBranch, force);
                                    setDeleteBranchOpen(false);
                                }}
                                branchName={targetBranch}
                            />
                        </Suspense>
                    )}

                    {mergeOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <MergeDialog
                                open={mergeOpen}
                                onOpenChange={setMergeOpen}
                                onMerge={(options) => {
                                    void handlePreviewedMerge(options);
                                }}
                                branchName={targetBranch}
                            />
                        </Suspense>
                    )}

                    {rebaseOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <RebaseDialog
                                open={rebaseOpen}
                                onOpenChange={setRebaseOpen}
                                onRebase={(interactive) => {
                                    void handlePreviewedRebase(interactive);
                                }}
                                onto={targetCommit}
                            />
                        </Suspense>
                    )}

                    {cherryPickOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CherryPickDialog
                                open={cherryPickOpen}
                                onOpenChange={setCherryPickOpen}
                                onCherryPick={(noCommit) => {
                                    handlePreviewedCherryPick(noCommit);
                                }}
                                commitHash={targetCommit}
                            />
                        </Suspense>
                    )}

                    {revertOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <RevertDialog
                                open={revertOpen}
                                onOpenChange={setRevertOpen}
                                onRevert={(noCommit) => {
                                    handlePreviewedRevert(noCommit);
                                }}
                                commitHash={targetCommit}
                            />
                        </Suspense>
                    )}

                    {actionPreview.Dialog}

                    {/* New Feature Dialogs */}
                    {fuzzyFinderOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <FuzzyFinder open={fuzzyFinderOpen} onOpenChange={setFuzzyFinderOpen} />
                        </Suspense>
                    )}

                    {interactiveRebaseOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <InteractiveRebase
                                open={interactiveRebaseOpen}
                                onOpenChange={setInteractiveRebaseOpen}
                                baseCommit={targetCommit}
                                commits={interactiveRebaseCommits}
                                onComplete={handleRefreshAll}
                            />
                        </Suspense>
                    )}

                    {statisticsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <Statistics open={statisticsOpen} onClose={() => { setStatisticsOpen(false); }} />
                        </Suspense>
                    )}

                    {remoteManageOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <RemoteManageDialog open={remoteManageOpen} onOpenChange={setRemoteManageOpen} />
                        </Suspense>
                    )}

                    {branchCompareOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <BranchCompare
                                open={branchCompareOpen}
                                onOpenChange={setBranchCompareOpen}
                                branches={repoInfo?.branches ?? []}
                                initialFrom={repoInfo?.head ?? ''}
                            />
                        </Suspense>
                    )}

                    {hooksManageOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <HooksManageDialog open={hooksManageOpen} onOpenChange={setHooksManageOpen} />
                        </Suspense>
                    )}

                    {mergeConflictOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <MergeConflictEditor
                                open={mergeConflictOpen}
                                onOpenChange={handleCloseConflictEditor}
                                conflict={conflictFile}
                                onResolve={handleResolveConflictFile}
                            />
                        </Suspense>
                    )}

                    {terminalOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <TerminalPanel
                                open={terminalOpen}
                                onOpenChange={setTerminalOpen}
                                cwd={activeRepo ?? undefined}
                            />
                        </Suspense>
                    )}

                    {/* Commit Signing Dialog */}
                    {commitSigningOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CommitSigningDialog open={commitSigningOpen} onOpenChange={setCommitSigningOpen} />
                        </Suspense>
                    )}

                    {/* Pinned Commits Dialog */}
                    <PinnedCommitsDialog
                        open={pinnedCommitsOpen}
                        onOpenChange={setPinnedCommitsOpen}
                        pinnedCommits={pinnedCommits}
                        onPin={(commit) => { pinCommit(commit as Omit<PinnedCommit, 'pinnedAt'>); }}
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
                    {reflogOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <ReflogViewer
                                open={reflogOpen}
                                onOpenChange={setReflogOpen}
                                onCreateBranchFromHash={handleCreateBranchFromHash}
                            />
                        </Suspense>
                    )}

                    {/* Commit Templates */}
                    {templatesOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CommitTemplatesDialog
                                open={templatesOpen}
                                onOpenChange={setTemplatesOpen}
                                templates={templates}
                                onTemplatesChange={setTemplates}
                            />
                        </Suspense>
                    )}

                    {/* Gitignore Manager */}
                    {gitignoreOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <GitignoreManager open={gitignoreOpen} onOpenChange={setGitignoreOpen} />
                        </Suspense>
                    )}

                    {/* Custom Commands */}
                    {customCommandsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CustomCommands open={customCommandsOpen} onOpenChange={setCustomCommandsOpen} />
                        </Suspense>
                    )}

                    {/* Search All Commits */}
                    {searchCommitsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
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
                        </Suspense>
                    )}

                    {/* LFS Support */}
                    {lfsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <LFSSupport open={lfsOpen} onOpenChange={setLfsOpen} />
                        </Suspense>
                    )}

                    {/* Pull Request Integration */}
                    {prIntegrationOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <PullRequestIntegration open={prIntegrationOpen} onOpenChange={setPrIntegrationOpen} />
                        </Suspense>
                    )}

                    {/* Worktree Management */}
                    {worktreeOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <WorktreeManagement open={worktreeOpen} onOpenChange={setWorktreeOpen} />
                        </Suspense>
                    )}

                    {/* Submodule Management */}
                    {submoduleOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <SubmoduleManagement open={submoduleOpen} onOpenChange={setSubmoduleOpen} />
                        </Suspense>
                    )}

                    {/* Keyboard Shortcuts Help */}
                    {keyboardHelpOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <KeyboardShortcutsHelp open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen} />
                        </Suspense>
                    )}

                    {/* Onboarding Tour */}
                    {onboardingOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
                        </Suspense>
                    )}

                    {/* Recent Repositories */}
                    {recentReposOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <RecentRepositories open={recentReposOpen} onOpenChange={setRecentReposOpen} />
                        </Suspense>
                    )}

                    {/* Workspaces Launchpad */}
                    {workspacesOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <WorkspacesManager open={workspacesOpen} onOpenChange={setWorkspacesOpen} />
                        </Suspense>
                    )}

                    {/* Clone Repository */}
                    {cloneDialogOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CloneRepositoryDialog
                                open={cloneDialogOpen}
                                onOpenChange={setCloneDialogOpen}
                                onCloned={async (repoPath) => {
                                    await activateRepoPath(repoPath, {
                                        ensureRegistered: true,
                                        errorTitle: 'Failed to open cloned repository',
                                    });
                                }}
                            />
                        </Suspense>
                    )}

                    {/* Stash Management */}
                    {stashManageOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <StashManagement open={stashManageOpen} onOpenChange={setStashManageOpen} />
                        </Suspense>
                    )}

                    {/* Graph Legend */}
                    <CommitGraphLegend open={graphLegendOpen} onOpenChange={setGraphLegendOpen} />

                    {/* Cherry-Pick Dialog */}
                    <DragDropCherryPick
                        open={cherryPickDialogOpen}
                        onOpenChange={setCherryPickDialogOpen}
                        sourceCommit={cherryPickCommit}
                    />

                    {/* Settings Dialog */}
                    {settingsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
                        </Suspense>
                    )}

                    {/* Line Staging */}
                    {lineStagingOpen && stagingFile && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <LineStaging
                                open={lineStagingOpen}
                                onOpenChange={(nextOpen) => {
                                    setLineStagingOpen(nextOpen);
                                    if (!nextOpen) {
                                        setStagingFile(null);
                                    }
                                }}
                                filePath={stagingFile}
                                onStaged={() => {
                                    void gitUtils.git.workingTreeStatus
                                        .invalidate({ repo: activeRepo ?? '' })
                                        .catch((error) => {
                                            console.error('[git-graph] Failed to refresh working tree status:', error);
                                        });
                                }}
                            />
                        </Suspense>
                    )}

                    {/* Context Menu for Commits */}
                    {contextMenuOpen && selectedCommitData && (
                        <div
                            className='fixed inset-0 z-50'
                            onClick={() => { setContextMenuOpen(false); }}
                            onContextMenu={() => { setContextMenuOpen(false); }}>
                            <div
                                className='fixed z-50'
                                style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}>
                                <Suspense fallback={<DialogLoadingFallback />}>
                                    <CommitContextMenu
                                        commit={{
                                            hash: selectedCommitData.hash,
                                            message: selectedCommitData.message,
                                            author: selectedCommitData.author,
                                        }}
                                        onCreateBranch={() => {
                                            setTargetCommit(selectedCommitData.hash);
                                            setCreateBranchOpen(true);
                                            setContextMenuOpen(false);
                                        }}
                                        onCreateTag={() => {
                                            setTargetCommit(selectedCommitData.hash);
                                            setAddTagOpen(true);
                                            setContextMenuOpen(false);
                                        }}
                                        onMerge={() => {
                                            setTargetBranch(selectedCommitData.hash);
                                            setMergeOpen(true);
                                            setContextMenuOpen(false);
                                        }}
                                        onRebase={() => {
                                            setTargetCommit(selectedCommitData.hash);
                                            setRebaseOpen(true);
                                            setContextMenuOpen(false);
                                        }}
                                        onCherryPick={() => {
                                            setTargetCommit(selectedCommitData.hash);
                                            setCherryPickOpen(true);
                                            setContextMenuOpen(false);
                                        }}
                                        onRevert={() => {
                                            setTargetCommit(selectedCommitData.hash);
                                            setRevertOpen(true);
                                            setContextMenuOpen(false);
                                        }}>
                                        <div />
                                    </CommitContextMenu>
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {/* Commit Filters Dialog */}
                    <Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
                        <DialogContent className='ui-surface sm:max-w-md'>
                            <DialogHeader>
                                <DialogTitle className='flex items-center gap-2'>
                                    <Filter className='h-5 w-5' />
                                    Filter Commits
                                </DialogTitle>
                            </DialogHeader>
                            <div className='space-y-4 py-4'>
                                {showFiltersDialog && (
                                    <Suspense fallback={<DialogLoadingFallback />}>
                                        <CommitHistoryFilters
                                            filters={commitFilters}
                                            onChange={(filters) => {
                                                setCommitFilters(filters);
                                                setMaxCommits(baselineInitialMaxCommits);
                                                setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
                                                if (Object.keys(filters).length === 0) {
                                                    setShowFiltersDialog(false);
                                                }
                                            }}
                                        />
                                    </Suspense>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Command Palette */}
                    {commandPaletteOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CommandPalette
                                open={commandPaletteOpen}
                                onOpenChange={setCommandPaletteOpen}
                                actions={{
                                    onCreateBranch: () => { setCreateBranchOpen(true); },
                                    onCreateTag: () => { setAddTagOpen(true); },
                                    onFetch: () => gitOps.fetch(),
                                    onPull: () => gitOps.pull(currentHead, 'origin', false),
                                    onPullFfOnly: () => gitOps.pull(currentHead, 'origin', false, true),
                                    onPush: () => gitOps.push(currentHead, 'origin', true, false),
                                    onRefresh: handleRefreshAll,
                                    onSettings: () => { setSettingsOpen(true); },
                                    onSearch: () => { setSearchCommitsOpen(true); },
                                    onTerminal: () => { setTerminalOpen(!terminalOpen); },
                                    onClone: () => { setCloneDialogOpen(true); },
                                    onOpenInFinder: () => { handleOpenInFinder(); },
                                    onStash: () => { setStashManageOpen(true); },
                                    onCommitSigning: () => { setCommitSigningOpen(true); },
                                    onReflog: () => { setReflogOpen(true); },
                                    onTemplates: () => { setTemplatesOpen(true); },
                                    onGitignore: () => { setGitignoreOpen(true); },
                                    onCustomCommands: () => { setCustomCommandsOpen(true); },
                                    onLFS: () => { setLfsOpen(true); },
                                    onPRIntegration: () => { setPrIntegrationOpen(true); },
                                    onWorktrees: () => { setWorktreeOpen(true); },
                                    onSubmodules: () => { setSubmoduleOpen(true); },
                                    onStatistics: () => { setStatisticsOpen(true); },
                                    onRemotes: () => { setRemoteManageOpen(true); },
                                    onFilters: () => { setShowFiltersDialog(true); },
                                    onPinned: () => { setPinnedCommitsOpen(true); },
                                    onLineStaging: () => {
                                        const fileForLineStaging =
                                            workingTreeStatus?.unstaged?.[0]?.file ?? workingTreeStatus?.staged?.[0]?.file;
                                        if (!fileForLineStaging) {
                                            toast.info('No changed files available for line staging');
                                            return;
                                        }
                                        setStagingFile(fileForLineStaging);
                                        setLineStagingOpen(true);
                                    },
                                    onWorkspaces: () => { setWorkspacesOpen(true); },
                                    onKeyboardHelp: () => { setKeyboardHelpOpen(true); },
                                    onHealthCheck: () => { setHealthCheckOpen(true); },
                                    onFuzzyFinder: () => { setFuzzyFinderOpen(true); },
                                    onUndoStack: () => { setUndoStackOpen(true); },
                                    onConfigEditor: () => { setConfigEditorOpen(true); },
                                    onExternalDiff: () => { setExternalDiffOpen(true); },
                                    onIssueTracker: () => { setIssueTrackerOpen(true); },
                                    onBulkOps: () => { setBulkOpsOpen(true); },
                                    onFileAnnotations: () => {
                                        setAnnotationsFile('README.md'); // Default file
                                        setFileAnnotationsOpen(true);
                                    },
                                    onActivityHeatmap: () => { setActivityHeatmapOpen(true); },
                                }}
                            />
                        </Suspense>
                    )}

                    {/* Git Flow Automation */}
                    {gitFlowOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <GitFlowAutomation open={gitFlowOpen} onOpenChange={setGitFlowOpen} />
                        </Suspense>
                    )}

                    {/* Repository Health Check */}
                    {healthCheckOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <RepoHealthCheck open={healthCheckOpen} onOpenChange={setHealthCheckOpen} />
                        </Suspense>
                    )}

                    {/* Git Bisect UI */}
                    {bisectOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <GitBisectUI
                                open={bisectOpen}
                                onOpenChange={setBisectOpen}
                                {...(selectedCommit ? { currentCommitHash: selectedCommit } : {})}
                            />
                        </Suspense>
                    )}

                    {/* Undo Stack Dialog */}
                    {undoStackOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <UndoStackDialog open={undoStackOpen} onOpenChange={setUndoStackOpen} />
                        </Suspense>
                    )}

                    {/* Git Config Editor */}
                    {configEditorOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <GitConfigEditor open={configEditorOpen} onOpenChange={setConfigEditorOpen} />
                        </Suspense>
                    )}

                    {/* External Diff Settings */}
                    {externalDiffOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <ExternalDiffConfig open={externalDiffOpen} onOpenChange={setExternalDiffOpen} />
                        </Suspense>
                    )}

                    {/* Issue Tracker Settings */}
                    {issueTrackerOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <IssueTrackerSettings open={issueTrackerOpen} onOpenChange={setIssueTrackerOpen} />
                        </Suspense>
                    )}

                    {/* Bulk Commit Operations */}
                    {bulkOpsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
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
                                onComplete={handleRefreshAll}
                            />
                        </Suspense>
                    )}

                    {/* File Annotations Panel */}
                    {fileAnnotationsOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <FileAnnotationsPanel
                                open={fileAnnotationsOpen}
                                onOpenChange={setFileAnnotationsOpen}
                                filePath={annotationsFile}
                                commitHash={selectedCommit ?? 'HEAD'}
                            />
                        </Suspense>
                    )}

                    {/* Activity Heatmap */}
                    {activityHeatmapOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <ActivityHeatmap open={activityHeatmapOpen} onOpenChange={setActivityHeatmapOpen} />
                        </Suspense>
                    )}

                    {/* Drag Cherry-Pick Handler */}
                    {dragCommit && (
                        <DragCommitHandler
                            open={dragCherryPickOpen}
                            onOpenChange={setDragCherryPickOpen}
                            commitHash={dragCommit.hash}
                            commitMessage={dragCommit.message}
                            targetBranch={dragTargetBranch}
                            onComplete={handleRefreshAll}
                        />
                    )}

                    {/* Quick Look Panel */}
                    <QuickLookPanel />

                    {activeRepo && (
                        <OperationStatusBar
                            repo={activeRepo}
                            onOpenRebaseTodo={() => { setRebaseTodoOpen(true); }}
                            onOpenConflictFile={handleOpenConflictFile}
                            onRevealConflictFile={handleRevealConflictFile}
                            onOperationStateChange={(operationState) => {
                                if (operationState && !operationState.rebasing) {
                                    setRebaseTodoOpen(false);
                                }
                            }}
                        />
                    )}

                    {rebaseTodoOpen && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <VisualRebaseTodoEditor open={rebaseTodoOpen} onOpenChange={setRebaseTodoOpen} />
                        </Suspense>
                    )}
                </div>
            </TooltipProvider>
        </UndoStackProvider>
    );
}

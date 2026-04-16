/**
 * Git Graph Main Component
 * GitKraken-style Git visualization
 */

import {
    Loader2,
    GitBranch,
    Download,
    Plus,
    Tag,
    GitCommit,
    X,
    ArrowUp,
    ArrowDown,
    Activity,
    Copy,
} from 'lucide-react';
import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef, startTransition } from 'react';
import { toast } from 'sonner';

import { BranchDropdown } from './branch-dropdown';
import { CommitGraph } from './commit-graph';
import { CommitGraphLegend } from './commit-graph-legend';
import { GitGraphCommitActionDialogs } from './git-graph-commit-action-dialogs';
import { CommitContextMenuOverlay } from './commit-context-menu-overlay';
import { CommitFiltersDialog } from './commit-filters-dialog';
import { DragCommitHandler } from './drag-commit-to-branch';
import { DragDropCherryPick } from './drag-drop-cherry-pick';
import { CommitListSkeleton, GraphSkeleton, ErrorState } from './empty-states';
import { FeatureHubStrip } from './feature-hub-strip';
import { GitGraphFeatureDialogs } from './git-graph-feature-dialogs';
import { GitGraphShellOverlays } from './git-graph-shell-overlays';
import { GitGraphToolbar } from './git-graph-toolbar';
import { NotificationCenter } from './notification-center';
import { OperationStatusBar } from './operation-status-bar';
import { OverflowMenu } from './overflow-menu';
import { PinnedCommitsDialog, usePinnedCommits, type PinnedCommit } from './pinned-commits';
import { QuickActionsToolbar } from './quick-actions-toolbar';
import { RepoBranchSwitcher } from './repo-branch-switcher';
import { SidePanel } from './side-panel';
import { useCommandPaletteActions } from './use-command-palette-actions';
import { useFeatureHubData } from './use-feature-hub-data';
import { useCollaborationPresence } from './use-collaboration-presence';
import { useCollaborationRealtime } from './use-collaboration-realtime';
import { useGitGraphCommitActions } from './use-git-graph-commit-actions';
import { useGitGraphShellPanels } from './use-git-graph-shell-panels';
import { useRepoCommitFilters } from './use-repo-commit-filters';

import { useCommitTemplates } from './useCommitTemplates';
import { useSettings } from './useSettings';
import { VirtualizedCommitList } from './virtualized-commit-list';
import { QuickLookPanel, useQuickLookKeyboard } from './quick-look';
import { UndoStackProvider } from './undo-stack-provider';
import { useActionPreview, type ActionPreview } from '@/components/action-preview';
import { LensSwitcher, useLensMode } from '@/components/lens';
import { useLensOnboarding } from '@/components/lens/LensOnboarding';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { DEFAULT_GRAPH_CONFIG } from '@/lib/graph/layout';
import { useGraphLayoutWorker } from '@/lib/graph/useGraphLayoutWorker';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

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

interface SimpleMutationResult {
    success?: boolean;
    error?: string | null;
}

interface CommitsQueryResultShape {
    commits?: ClientCommit[];
    refsDeferred?: boolean;
    head?: string | null;
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
const DEFAULT_RELEASE_FEATURE_FLAGS = {
    worktreePro: true,
    workflowEngine: true,
    graphiteInterop: false,
    aiProd: false,
    deepLinks: true,
    branchPinning: true,
} as const;

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
const CloneRepositoryDialog = lazy(() =>
    import('./clone-repository-dialog').then((mod) => ({ default: mod.CloneRepositoryDialog }))
);
const ProfileSwitcher = lazy(() => import('@/components/profile').then((mod) => ({ default: mod.ProfileSwitcher })));
const OperationTimeline = lazy(() =>
    import('@/components/operation-timeline').then((mod) => ({ default: mod.OperationTimeline }))
);
const StackedBranchesPanel = lazy(() =>
    import('@/components/stacked-branches').then((mod) => ({ default: mod.StackedBranchesPanel }))
);
const FindWidget = lazy(() => import('./find-widget').then((mod) => ({ default: mod.FindWidget })));

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
    const [graphLegendOpen, setGraphLegendOpen] = useState(false);
    const [cherryPickDialogOpen, setCherryPickDialogOpen] = useState(false);
    const [cherryPickCommit] = useState<{ hash: string; message: string; author: string } | null>(null);
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [perfPanelOpen, setPerfPanelOpen] = useState(false);
    const [copyingPerfDiagnostics, setCopyingPerfDiagnostics] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [annotationsFile, setAnnotationsFile] = useState<string>('');
    const [dragCherryPickOpen, setDragCherryPickOpen] = useState(false);
    const [dragCommit] = useState<{ hash: string; message: string } | null>(null);
    const [dragTargetBranch] = useState('');
    const {
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
    } = useGitGraphShellPanels();

    // Quick Look hook
    useQuickLookKeyboard();

    // Settings hook
    const { settings } = useSettings();
    const showPerfDebug = settings.telemetryEnabled;
    const onboardingStateQuery = trpc.config.onboardingState.useQuery(undefined, { staleTime: 10_000 });

    useEffect(() => {
        if (!activeRepo) return;
        if (!onboardingStateQuery.data?.state.gitGraphCompleted) {
            setOnboardingOpen(true);
        }
    }, [activeRepo, onboardingStateQuery.data?.state.gitGraphCompleted, setOnboardingOpen]);

    // Lens mode hook
    const { setLensMode, isGuided } = useLensMode();

    // Pinned commits hook
    const { pinnedCommits, pinCommit, unpinCommit, updateNote } = usePinnedCommits(activeRepo);

    // Commit templates hook
    const { templates, setTemplates } = useCommitTemplates();
    const { commitFilters, setCommitFilters } = useRepoCommitFilters(activeRepo);
    const actionPreview = useActionPreview();
    const { LensOnboardingDialog } = useLensOnboarding();

    // Refs
    // Note: ScrollArea handles scrolling internally

    // Git operations hook
    const gitOps = useGitOperations();
    const gitUtils = trpc.useUtils();
    const configAllQuery = trpc.config.getAll.useQuery(undefined, { staleTime: 10_000 });
    const featureFlags = useMemo(() => {
        const ui = configAllQuery.data?.ui as
            | {
                  featureFlags?: Partial<typeof DEFAULT_RELEASE_FEATURE_FLAGS>;
              }
            | undefined;
        return {
            ...DEFAULT_RELEASE_FEATURE_FLAGS,
            ...(ui?.featureFlags ?? {}),
        };
    }, [configAllQuery.data?.ui]);

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
                .then((result: SimpleMutationResult) => {
                    if (!result.success) {
                        toast.error('error' in result ? result.error : 'Failed to reveal conflict file');
                    }
                })
                .catch((error: unknown) => {
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
                    onSuccess: (result: { error?: string | null }) => {
                        if (result.error) {
                            toast.error('Failed to save conflict resolution', {
                                description: result.error,
                            });
                            return;
                        }

                        stageConflictFile.mutate(
                            { repo: activeRepo, files: [path] },
                            {
                                onSuccess: (stageResult: { error?: string | null }) => {
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
    const currentHead = repoInfo?.head ?? 'main';
    useCollaborationPresence(activeRepo, repoInfo?.head ?? null);
    useCollaborationRealtime();
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
        placeholderData: (previous: CommitsQueryResultShape | undefined) => previous,
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
    const createDeepLinkMutation = trpc.app.deeplink.create.useMutation();

    const handleRefreshAll = useCallback(() => {
        void gitUtils.git.invalidate().catch((error: unknown) => {
            console.error('[git-graph] Refresh failed:', error);
        });
    }, [gitUtils]);
    const commitActionGitOps = useMemo(
        () => ({
            createBranch: (commitHash: string, branchName: string, checkout?: boolean) => {
                void gitOps.createBranch(commitHash, branchName, checkout ?? false);
            },
            createTag: (commitHash: string, name: string, message?: string) => {
                void gitOps.createTag(commitHash, name, message);
            },
            reset: (commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
                void gitOps.reset(commitHash, mode);
            },
            merge: (branchName: string, options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => {
                void gitOps.merge(branchName, options);
            },
            rebase: (onto: string, interactive?: boolean, todoContent?: string) =>
                gitOps.rebase(onto, interactive, todoContent),
            cherryPick: (commitHash: string, noCommit?: boolean) => {
                void gitOps.cherryPick(commitHash, noCommit);
            },
            revert: (commitHash: string, noCommit?: boolean) => {
                void gitOps.revert(commitHash, noCommit);
            },
        }),
        [gitOps]
    );
    const commitActionController = useGitGraphCommitActions({
        activeRepo,
        commits: commitsData?.commits,
        currentHead,
        gitOps: commitActionGitOps,
        actionPreview,
        onRefreshAll: handleRefreshAll,
    });

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

    const featureHubData = useFeatureHubData(activeRepo, {
        worktreePro: featureFlags.worktreePro,
        workflowEngine: featureFlags.workflowEngine,
    });

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
            layoutCommits.map((c: ClientCommit) => ({
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
                commitActionController.setTargetCommit(commit.hash);
                setSelectedCommitIndex(index);
                setSelectedCommit(commit.hash);
                setContextMenuPosition({ x: event.clientX, y: event.clientY });
                setContextMenuOpen(true);
            }
        },
        [commitActionController, commitsData, setSelectedCommit]
    );

    // Handle pin commit
    const handlePinCommit = useCallback(() => {
        if (commitActionController.selectedCommitData) {
            pinCommit({
                hash: commitActionController.selectedCommitData.hash,
                message: commitActionController.selectedCommitData.message,
                author: commitActionController.selectedCommitData.author,
                date: new Date(commitActionController.selectedCommitData.date * 1000).toISOString(),
            });
        }
    }, [commitActionController.selectedCommitData, pinCommit]);

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

    useEffect(() => {
        if (!featureFlags.deepLinks) {
            return;
        }

        let cancelled = false;
        let lastHandledLink: string | null = null;

        const handleDeepLink = async (link: string) => {
            if (!link || cancelled || link === lastHandledLink) {
                return;
            }

            lastHandledLink = link;
            const resolved = await gitUtils.app.deeplink.resolve.fetch({ link });
            if (!resolved.valid || !resolved.target) {
                toast.error('Invalid deep link', { description: resolved.error ?? 'Unable to parse deep link.' });
                return;
            }

            if (resolved.target.repo) {
                await activateRepoPath(resolved.target.repo, {
                    ensureRegistered: true,
                    errorTitle: 'Unable to open deep linked repository',
                });
            }

            if (resolved.target.branch) {
                handleBranchFilter(resolved.target.branch);
            }

            if (resolved.target.commit) {
                setSelectedCommit(resolved.target.commit);
                handleNavigateToCommit(resolved.target.commit);
            }

            if (resolved.target.file) {
                toast.info(`Deep link selected file context: ${resolved.target.file}`);
            }

            if (resolved.target.panel === 'worktree') {
                if (!featureFlags.worktreePro) {
                    toast.info('Worktree panel is disabled by feature flag');
                    return;
                }
                setWorktreeOpen(true);
            } else if (resolved.target.panel === 'blame' && resolved.target.file) {
                setAnnotationsFile(resolved.target.file);
                setFileAnnotationsOpen(true);
            } else if (resolved.target.panel === 'diff' && resolved.target.commit) {
                setSelectedCommit(resolved.target.commit);
                setCommitDetailsOpen(true);
            }
        };

        const onDeepLinkEvent = (event: Event) => {
            const custom = event as CustomEvent<string>;
            if (typeof custom.detail === 'string') {
                void handleDeepLink(custom.detail);
            }
        };

        window.addEventListener('git-graph:deeplink', onDeepLinkEvent as EventListener);
        const pending = (window as unknown as { __gitGraphPendingDeepLink?: string }).__gitGraphPendingDeepLink;
        if (typeof pending === 'string' && pending) {
            void handleDeepLink(pending);
            (window as unknown as { __gitGraphPendingDeepLink?: string }).__gitGraphPendingDeepLink = '';
        }

        return () => {
            cancelled = true;
            window.removeEventListener('git-graph:deeplink', onDeepLinkEvent as EventListener);
        };
    }, [
        activateRepoPath,
        featureFlags.deepLinks,
        featureFlags.worktreePro,
        gitUtils.app.deeplink.resolve,
        handleBranchFilter,
        handleNavigateToCommit,
        setAnnotationsFile,
        setFileAnnotationsOpen,
        setCommitDetailsOpen,
        setSelectedCommit,
        setWorktreeOpen,
    ]);

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
        commitActionController.openCreateBranch(hash);
    }, [commitActionController]);

    const handleOpenInFinder = useCallback(() => {
        if (!activeRepo) {
            toast('Open a repository first.');
            return;
        }
        void revealInFinder({
            path: activeRepo,
        })
            .then((result: SimpleMutationResult) => {
                if (!result.success) {
                    toast.error('error' in result ? result.error : 'Failed to open repository in finder');
                }
            })
            .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : 'Failed to open repository in finder');
            });
    }, [activeRepo, revealInFinder]);

    const handleCopyDeepLink = useCallback(async () => {
        if (!activeRepo) {
            toast.error('Open a repository first.');
            return;
        }

        const target: {
            repo: string;
            branch?: string;
            commit?: string;
            file?: string;
            panel?: 'worktree' | 'diff' | 'blame';
        } = {
            repo: activeRepo,
            ...(repoInfo?.head ? { branch: repoInfo.head } : {}),
            ...(selectedCommit ? { commit: selectedCommit } : {}),
        };

        if (featureFlags.worktreePro && worktreeOpen) {
            target.panel = 'worktree';
        } else if (fileAnnotationsOpen && annotationsFile) {
            target.panel = 'blame';
            target.file = annotationsFile;
        } else if (commitDetailsOpen && selectedCommit) {
            target.panel = 'diff';
        }

        const result = await createDeepLinkMutation.mutateAsync(target);
        await navigator.clipboard.writeText(result.link);
        toast.success('Deep link copied');
    }, [
        activeRepo,
        annotationsFile,
        commitDetailsOpen,
        createDeepLinkMutation,
        featureFlags.worktreePro,
        fileAnnotationsOpen,
        repoInfo?.head,
        selectedCommit,
        worktreeOpen,
    ]);

    const commandPaletteActions = useCommandPaletteActions({
        currentHead,
        gitOps,
        terminalOpen,
        featureFlags,
        workingTreeStatus,
        openSettingsAt,
        handleRefreshAll,
        openers: {
            setCreateBranchOpen: (open) => {
                if (open) {
                    commitActionController.openCreateBranch(selectedCommit ?? 'HEAD');
                    return;
                }
                commitActionController.setCreateBranchOpen(false);
            },
            setAddTagOpen: (open) => {
                if (open) {
                    commitActionController.openCreateTag(selectedCommit ?? 'HEAD');
                    return;
                }
                commitActionController.setAddTagOpen(false);
            },
            setSearchCommitsOpen,
            setTerminalOpen,
            setCloneDialogOpen,
            handleOpenInFinder,
            handleCopyDeepLink,
            setStashManageOpen,
            setCommitSigningOpen,
            setReflogOpen,
            setTemplatesOpen,
            setGitignoreOpen,
            setCustomCommandsOpen,
            setLfsOpen,
            setPrIntegrationOpen,
            setWorktreeOpen,
            setWorkflowOpen,
            setSubmoduleOpen,
            setStatisticsOpen,
            setRemoteManageOpen,
            setShowFiltersDialog,
            setPinnedCommitsOpen,
            setStagingFile,
            setLineStagingOpen,
            setWorkspacesOpen,
            setCollaborationOpen,
            setKeyboardHelpOpen,
            setKeyboardEditorOpen,
            setHealthCheckOpen,
            setFuzzyFinderOpen,
            setUndoStackOpen,
            setConfigEditorOpen,
            setExternalDiffOpen,
            setIssueTrackerOpen,
            setBulkOpsOpen,
            setAnnotationsFile,
            setFileAnnotationsOpen,
            setActivityHeatmapOpen,
        },
    });

    const handleOpenInTerminal = useCallback(() => {
        if (!activeRepo) {
            toast('Open a repository first.');
            return;
        }
        void openTerminalInRepo({
            path: activeRepo,
        })
            .then((result: SimpleMutationResult) => {
                if (!result.success) {
                    toast.error('error' in result ? result.error : 'Failed to open terminal');
                }
            })
            .catch((error: unknown) => {
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
                    commitActionController.openCreateBranch(selectedCommit);
                }
            } else if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (selectedCommit) {
                    commitActionController.openCreateTag(selectedCommit);
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
        commitActionController.setTargetCommit('');
        setVisibleStartIndex(0);
        setVisibleEndIndex(120);
        setCommitListScrollOffset(0);
    });
    }, [activeRepo, baselineInitialMaxCommits, commitActionController]);

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
    const normalizedBranchSearch = branchSearch.trim().toLowerCase();
    const localBranches = useMemo(() => {
        const list = (repoInfo?.branches ?? []).filter((branch: string) => !branch.startsWith('remotes/'));
        return list.sort((a: string, b: string) => {
            if (a === currentHead) return -1;
            if (b === currentHead) return 1;
            return a.localeCompare(b);
        });
    }, [repoInfo?.branches, currentHead]);
    const remoteBranches = useMemo(() => {
        return (repoInfo?.branches ?? [])
            .filter((branch: string) => branch.startsWith('remotes/') && !branch.endsWith('/HEAD'))
            .sort((a: string, b: string) => a.localeCompare(b));
    }, [repoInfo?.branches]);
    const filteredLocalBranches = useMemo(() => {
        if (!normalizedBranchSearch) return localBranches;
        return localBranches.filter((branch: string) => branch.toLowerCase().includes(normalizedBranchSearch));
    }, [localBranches, normalizedBranchSearch]);
    const filteredRemoteBranches = useMemo(() => {
        if (!normalizedBranchSearch) return remoteBranches;
        return remoteBranches.filter((branch: string) => branch.toLowerCase().includes(normalizedBranchSearch));
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
                    <GitGraphToolbar
                        isGuided={isGuided}
                        hasFilters={Boolean(
                            commitFilters.author ||
                                commitFilters.search ||
                                commitFilters.dateFrom ||
                                commitFilters.dateTo ||
                                commitFilters.filePath
                        )}
                        pinnedCommitCount={pinnedCommits.length}
                        leftSlots={
                            <RepoBranchSwitcher
                                repoLabel={activeRepo.split('/').pop() ?? activeRepo}
                                currentHead={currentHead}
                                branchMenuOpen={branchMenuOpen}
                                onBranchMenuOpenChange={setBranchMenuOpen}
                                branchSearch={branchSearch}
                                onBranchSearchChange={setBranchSearch}
                                onBranchSearchSubmit={() => {
                                    const firstResult = branchResults[0];
                                    if (firstResult) {
                                        handleCheckoutBranch(firstResult);
                                    }
                                }}
                                filteredLocalBranches={filteredLocalBranches}
                                filteredRemoteBranches={filteredRemoteBranches}
                                branchResultsEmpty={branchResults.length === 0}
                                onCheckoutBranch={handleCheckoutBranch}
                            />
                        }
                        branchFilter={
                            <BranchDropdown
                                branches={branchOptions}
                                selectedBranches={selectedBranches}
                                multiple
                                onChange={handleSelectedBranchesChange}
                            />
                        }
                        lensSwitcher={<LensSwitcher variant='toolbar' showLabel={false} />}
                        profileSwitcher={
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <ProfileSwitcher />
                            </Suspense>
                        }
                        operationTimeline={
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <OperationTimeline />
                            </Suspense>
                        }
                        stackedBranches={
                            <Suspense fallback={<div className='h-8 w-8' />}>
                                <StackedBranchesPanel enableGraphiteInterop={featureFlags.graphiteInterop} />
                            </Suspense>
                        }
                        overflowMenu={
                            <OverflowMenu
                                featureFlags={featureFlags}
                                inlineBlameEnabled={inlineBlameEnabled}
                                onOpenInTerminal={handleOpenInTerminal}
                                onOpenInFinder={handleOpenInFinder}
                                onClone={() => { setCloneDialogOpen(true); }}
                                onQuickSwitch={() => { setFuzzyFinderOpen(true); }}
                                onFilterCommits={() => { setShowFiltersDialog(true); }}
                                onLineStaging={() => { commandPaletteActions.onLineStaging?.(); }}
                                onToggleTerminal={() => { setTerminalOpen(!terminalOpen); }}
                                onStatistics={() => { setStatisticsOpen(true); }}
                                onManageRemotes={() => { setRemoteManageOpen(true); }}
                                onCompareBranches={() => { setBranchCompareOpen(true); }}
                                onHooks={() => { setHooksManageOpen(true); }}
                                onCommitSigning={() => { setCommitSigningOpen(true); }}
                                onReflog={() => { setReflogOpen(true); }}
                                onTemplates={() => { setTemplatesOpen(true); }}
                                onGitignore={() => { setGitignoreOpen(true); }}
                                onCustomCommands={() => { setCustomCommandsOpen(true); }}
                                onSearchCommits={() => { setSearchCommitsOpen(true); }}
                                onLfs={() => { setLfsOpen(true); }}
                                onToggleInlineBlame={() => { setInlineBlameEnabled(!inlineBlameEnabled); }}
                                onPullRequests={() => { setPrIntegrationOpen(true); }}
                                onWorktrees={() => { setWorktreeOpen(true); }}
                                onWorkflows={() => { setWorkflowOpen(true); }}
                                onSubmodules={() => { setSubmoduleOpen(true); }}
                                onRecentRepos={() => { setRecentReposOpen(true); }}
                                onWorkspaces={() => { setWorkspacesOpen(true); }}
                                onKeyboardHelp={() => { setKeyboardHelpOpen(true); }}
                                onRestartOnboarding={restartOnboarding}
                                onStashes={() => { setStashManageOpen(true); }}
                                onGraphLegend={() => { setGraphLegendOpen(true); }}
                                onGitFlow={() => { setGitFlowOpen(true); }}
                                onHealthCheck={() => { setHealthCheckOpen(true); }}
                                onBisect={() => { setBisectOpen(true); }}
                                onUndoStack={() => { setUndoStackOpen(true); }}
                                onConfigEditor={() => { setConfigEditorOpen(true); }}
                                onExternalDiff={() => { setExternalDiffOpen(true); }}
                                onIssueTracker={() => { setIssueTrackerOpen(true); }}
                                onBulkOps={() => { setBulkOpsOpen(true); }}
                                onFileAnnotations={() => { setFileAnnotationsOpen(true); }}
                                onActivityHeatmap={() => { setActivityHeatmapOpen(true); }}
                                onSettings={() => { openSettingsAt('general'); }}
                                onDiagnostics={() => { openSettingsAt('integrations'); }}
                                onCommandPalette={() => { setCommandPaletteOpen(true); }}
                                onUndoLastCommit={() => gitOps.undoLastCommit()}
                            />
                        }
                        notifications={<NotificationCenter />}
                        onSync={async () => {
                            await gitOps.fetch();
                            await gitOps.pull(currentHead, 'origin', false, false);
                        }}
                        onFetch={() => {
                            void gitOps.fetch();
                        }}
                        onPush={() => {
                            handlePreviewedPush(false);
                        }}
                        onForcePush={() => {
                            handlePreviewedPush(true);
                        }}
                        onPull={() => {
                            void gitOps.pull(currentHead, 'origin', false, false);
                        }}
                        onPullFfOnly={() => {
                            void gitOps.pull(currentHead, 'origin', false, true);
                        }}
                        onCreateBranch={() => {
                            commitActionController.openCreateBranch(selectedCommit ?? 'HEAD');
                        }}
                        onCreateTag={() => {
                            commitActionController.openCreateTag(selectedCommit ?? 'HEAD');
                        }}
                        onStash={() => {
                            setStashManageOpen(true);
                        }}
                        onOpenWorkspaces={() => {
                            setWorkspacesOpen(true);
                        }}
                        onClearFilters={() => {
                            setCommitFilters({});
                            setMaxCommits(baselineInitialMaxCommits);
                            setLayoutCommitLimit(INITIAL_LAYOUT_COMMIT_WINDOW);
                        }}
                        onFind={() => {
                            setFindWidgetOpen(true);
                        }}
                        onRefresh={handleRefreshAll}
                        onToggleSidePanel={() => {
                            setShowSidePanel(!showSidePanel);
                        }}
                        onOpenPinnedCommits={() => {
                            setPinnedCommitsOpen(true);
                        }}
                    />
                    <QuickActionsToolbar
                        className='border-border/60 border-t'
                        onCreateBranch={() => {
                            commitActionController.openCreateBranch(selectedCommit ?? 'HEAD');
                        }}
                        onCreateTag={() => {
                            commitActionController.openCreateTag(selectedCommit ?? 'HEAD');
                        }}
                        onStash={() => {
                            setStashManageOpen(true);
                        }}
                    />

                    <FeatureHubStrip
                        worktreeCount={featureHubData.worktreeCount}
                        worktreeAttentionCount={featureHubData.worktreeAttentionCount}
                        workflowCount={featureHubData.workflowCount}
                        workflowFailureCount={featureHubData.workflowFailureCount}
                        auditCount={featureHubData.auditCount}
                        protocolRegistered={featureHubData.protocolRegistered}
                        collaborationSummary={featureHubData.collaborationSummary}
                        prSummary={featureHubData.prSummary}
                        repoPolicy={featureHubData.repoPolicy}
                        onOpenWorktrees={() => {
                            if (featureFlags.worktreePro) {
                                setWorktreeOpen(true);
                                return;
                            }
                            openSettingsAt('integrations');
                        }}
                        onOpenWorkflows={() => {
                            if (featureFlags.workflowEngine) {
                                setWorkflowOpen(true);
                                return;
                            }
                            openSettingsAt('integrations');
                        }}
                        onOpenPullRequests={() => {
                            setPrIntegrationOpen(true);
                        }}
                        onOpenCollaboration={() => {
                            setCollaborationOpen(true);
                        }}
                        onOpenRepoPolicy={() => {
                            openSettingsAt('integrations');
                        }}
                        onOpenDiagnostics={() => {
                            openSettingsAt('integrations');
                        }}
                    />

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
                                    commitActionController.openCreateBranch(selectedCommit ?? 'HEAD');
                                }}
                                onCreateTag={() => {
                                    commitActionController.openCreateTag(selectedCommit ?? 'HEAD');
                                }}
                                onMergeBranch={(branch) => {
                                    commitActionController.openMerge(branch);
                                }}
                                enableBranchPinning={featureFlags.branchPinning}
                                {...(featureFlags.worktreePro
                                    ? {
                                          onOpenWorktrees: () => {
                                              setWorktreeOpen(true);
                                          },
                                      }
                                    : {})}
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
                                            commitActionController.openCreateTag(hash);
                                        }}
                                        onReset={(hash) => {
                                            commitActionController.openReset(hash);
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

                    <GitGraphCommitActionDialogs
                        createBranchOpen={commitActionController.createBranchOpen}
                        onCreateBranchOpenChange={commitActionController.setCreateBranchOpen}
                        onCreateBranch={(name, checkout) => {
                            gitOps.createBranch(commitActionController.targetCommit, name, checkout);
                            commitActionController.setCreateBranchOpen(false);
                        }}
                        addTagOpen={commitActionController.addTagOpen}
                        onAddTagOpenChange={commitActionController.setAddTagOpen}
                        onAddTag={(name, type) => {
                            gitOps.createTag(
                                commitActionController.targetCommit,
                                name,
                                type === 'annotated' ? name : undefined
                            );
                            commitActionController.setAddTagOpen(false);
                        }}
                        resetOpen={commitActionController.resetOpen}
                        onResetOpenChange={commitActionController.setResetOpen}
                        onReset={(mode) => {
                            void commitActionController.handlePreviewedReset(mode);
                        }}
                        mergeOpen={commitActionController.mergeOpen}
                        onMergeOpenChange={commitActionController.setMergeOpen}
                        onMerge={(options) => {
                            void commitActionController.handlePreviewedMerge(options);
                        }}
                        rebaseOpen={commitActionController.rebaseOpen}
                        onRebaseOpenChange={commitActionController.setRebaseOpen}
                        onRebase={(interactive) => {
                            void commitActionController.handlePreviewedRebase(interactive);
                        }}
                        cherryPickOpen={commitActionController.cherryPickOpen}
                        onCherryPickOpenChange={commitActionController.setCherryPickOpen}
                        onCherryPick={(noCommit) => {
                            commitActionController.handlePreviewedCherryPick(noCommit);
                        }}
                        revertOpen={commitActionController.revertOpen}
                        onRevertOpenChange={commitActionController.setRevertOpen}
                        onRevert={(noCommit) => {
                            commitActionController.handlePreviewedRevert(noCommit);
                        }}
                        interactiveRebaseOpen={commitActionController.interactiveRebaseOpen}
                        onInteractiveRebaseOpenChange={commitActionController.setInteractiveRebaseOpen}
                        targetCommit={commitActionController.targetCommit}
                        targetBranch={commitActionController.targetBranch}
                        interactiveRebaseCommits={commitActionController.interactiveRebaseCommits}
                        onInteractiveRebaseComplete={commitActionController.handleInteractiveRebaseComplete}
                        actionPreviewDialog={commitActionController.actionPreviewDialog}
                    />

                    <GitGraphShellOverlays
                        fuzzyFinder={{ open: fuzzyFinderOpen, onOpenChange: setFuzzyFinderOpen }}
                        statistics={{ open: statisticsOpen, onClose: () => { setStatisticsOpen(false); } }}
                        remoteManage={{ open: remoteManageOpen, onOpenChange: setRemoteManageOpen }}
                        branchCompare={{
                            open: branchCompareOpen,
                            onOpenChange: setBranchCompareOpen,
                            branches: repoInfo?.branches ?? [],
                            initialFrom: repoInfo?.head ?? '',
                        }}
                        hooksManage={{ open: hooksManageOpen, onOpenChange: setHooksManageOpen }}
                        mergeConflict={{
                            open: mergeConflictOpen,
                            onOpenChange: handleCloseConflictEditor,
                            conflict: conflictFile,
                            onResolve: handleResolveConflictFile,
                        }}
                        terminal={{ open: terminalOpen, onOpenChange: setTerminalOpen, cwd: activeRepo ?? undefined }}
                        commitSigning={{ open: commitSigningOpen, onOpenChange: setCommitSigningOpen }}
                        rebaseTodo={{ open: rebaseTodoOpen, onOpenChange: setRebaseTodoOpen }}
                    />

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

                    {/* Graph Legend */}
                    <CommitGraphLegend open={graphLegendOpen} onOpenChange={setGraphLegendOpen} />

                    {/* Cherry-Pick Dialog */}
                    <DragDropCherryPick
                        open={cherryPickDialogOpen}
                        onOpenChange={setCherryPickDialogOpen}
                        sourceCommit={cherryPickCommit}
                    />

                    <CommitContextMenuOverlay
                        open={contextMenuOpen}
                        position={contextMenuPosition}
                        selectedCommit={
                            commitActionController.selectedCommitData
                                ? {
                                      hash: commitActionController.selectedCommitData.hash,
                                      message: commitActionController.selectedCommitData.message,
                                      author: commitActionController.selectedCommitData.author,
                                  }
                                : null
                        }
                        onClose={() => { setContextMenuOpen(false); }}
                        onCreateBranch={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openCreateBranch(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                        onCreateTag={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openCreateTag(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                        onMerge={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openMerge(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                        onRebase={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openRebase(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                        onCherryPick={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openCherryPick(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                        onRevert={() => {
                            if (!commitActionController.selectedCommitData) return;
                            commitActionController.openRevert(commitActionController.selectedCommitData.hash);
                            setContextMenuOpen(false);
                        }}
                    />

                    <CommitFiltersDialog
                        open={showFiltersDialog}
                        onOpenChange={setShowFiltersDialog}
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

                    <GitGraphFeatureDialogs
                        featureFlags={featureFlags}
                        reflog={{ open: reflogOpen, onOpenChange: setReflogOpen }}
                        onCreateBranchFromHash={handleCreateBranchFromHash}
                        templates={{ open: templatesOpen, onOpenChange: setTemplatesOpen }}
                        templateValues={templates}
                        onTemplatesChange={setTemplates}
                        gitignore={{ open: gitignoreOpen, onOpenChange: setGitignoreOpen }}
                        customCommands={{ open: customCommandsOpen, onOpenChange: setCustomCommandsOpen }}
                        searchCommits={{ open: searchCommitsOpen, onOpenChange: setSearchCommitsOpen }}
                        onSelectCommit={(hash) => {
                            const index = commitsData?.commits?.findIndex((c: ClientCommit) => c.hash === hash);
                            if (index !== undefined && index >= 0) {
                                handleSelectCommit(index);
                            }
                        }}
                        lfs={{ open: lfsOpen, onOpenChange: setLfsOpen }}
                        pullRequests={{ open: prIntegrationOpen, onOpenChange: setPrIntegrationOpen }}
                        worktree={{ open: worktreeOpen, onOpenChange: setWorktreeOpen }}
                        workflow={{ open: workflowOpen, onOpenChange: setWorkflowOpen }}
                        submodule={{ open: submoduleOpen, onOpenChange: setSubmoduleOpen }}
                        keyboardHelp={{ open: keyboardHelpOpen, onOpenChange: setKeyboardHelpOpen }}
                        keyboardEditor={{ open: keyboardEditorOpen, onOpenChange: setKeyboardEditorOpen }}
                        onboarding={{ open: onboardingOpen, onOpenChange: setOnboardingOpen }}
                        recentRepos={{ open: recentReposOpen, onOpenChange: setRecentReposOpen }}
                        workspaces={{ open: workspacesOpen, onOpenChange: setWorkspacesOpen }}
                        collaboration={{ open: collaborationOpen, onOpenChange: setCollaborationOpen }}
                        cloneRepository={{ open: cloneDialogOpen, onOpenChange: setCloneDialogOpen }}
                        onCloned={async (repoPath) => {
                            await activateRepoPath(repoPath, {
                                ensureRegistered: true,
                                errorTitle: 'Failed to open cloned repository',
                            });
                        }}
                        stashManagement={{ open: stashManageOpen, onOpenChange: setStashManageOpen }}
                        settings={{
                            open: settingsOpen,
                            onOpenChange: setSettingsOpen,
                            initialTab: settingsInitialTab,
                        }}
                        lineStaging={{ open: lineStagingOpen, onOpenChange: setLineStagingOpen }}
                        stagingFile={stagingFile}
                        onLineStagingChange={(nextOpen) => {
                            setLineStagingOpen(nextOpen);
                            if (!nextOpen) {
                                setStagingFile(null);
                            }
                        }}
                        onLineStaged={() => {
                            void gitUtils.git.workingTreeStatus
                                .invalidate({ repo: activeRepo ?? '' })
                                .catch((error: unknown) => {
                                    console.error('[git-graph] Failed to refresh working tree status:', error);
                                });
                        }}
                        commandPalette={{ open: commandPaletteOpen, onOpenChange: setCommandPaletteOpen }}
                        commandPaletteActions={commandPaletteActions}
                        gitFlow={{ open: gitFlowOpen, onOpenChange: setGitFlowOpen }}
                        healthCheck={{ open: healthCheckOpen, onOpenChange: setHealthCheckOpen }}
                        bisect={{ open: bisectOpen, onOpenChange: setBisectOpen }}
                        selectedCommit={selectedCommit}
                        undoStack={{ open: undoStackOpen, onOpenChange: setUndoStackOpen }}
                        configEditor={{ open: configEditorOpen, onOpenChange: setConfigEditorOpen }}
                        externalDiff={{ open: externalDiffOpen, onOpenChange: setExternalDiffOpen }}
                        issueTracker={{ open: issueTrackerOpen, onOpenChange: setIssueTrackerOpen }}
                        bulkOps={{ open: bulkOpsOpen, onOpenChange: setBulkOpsOpen }}
                        bulkOpCommits={(commitsData?.commits ?? []).map((c: ClientCommit) => ({
                            hash: c.hash,
                            message: c.message,
                            author: c.author,
                            date: c.date,
                            parents: c.parents,
                        }))}
                        onBulkOpsComplete={handleRefreshAll}
                        fileAnnotations={{ open: fileAnnotationsOpen, onOpenChange: setFileAnnotationsOpen }}
                        annotationsFile={annotationsFile}
                        activityHeatmap={{ open: activityHeatmapOpen, onOpenChange: setActivityHeatmapOpen }}
                    />

                    <LensOnboardingDialog />

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
                </div>
            </TooltipProvider>
        </UndoStackProvider>
    );
}

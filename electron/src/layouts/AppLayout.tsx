import { Outlet } from '@tanstack/react-router';
import {
    ChevronLeft,
    ChevronRight,
    FolderGit2,
    FolderOpen,
    Loader2,
    PanelLeft,
    PanelTop,
    Plus,
    X,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppShellPersistence } from '@/layouts/use-app-shell-persistence';
import { preloadGitGraph, scheduleGitGraphPreload } from '@/lib/preloadGitGraph';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

import type { HomeStartRepoEntry } from '@/components/git-graph/home-start-surface';

// Extend CSSProperties to include webkit drag properties.
declare module 'react' {
    interface CSSProperties {
        WebkitAppRegion?: 'drag' | 'no-drag';
    }
}

const getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'darwin';
    if (ua.includes('win')) return 'win32';
    return 'linux';
};

function MainViewLoadingFallback() {
    const [showSlowHint, setShowSlowHint] = useState(false);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            setShowSlowHint(true);
        }, 1200);
        return () => { window.clearTimeout(timerId); };
    }, []);

    return (
        <div className='flex flex-1 items-center justify-center p-6'>
            <div className='ui-surface w-full max-w-md space-y-3.5 p-5'>
                <div className='flex items-center gap-2'>
                    <Loader2 className='text-primary h-3.5 w-3.5 animate-spin' />
                    <p className='text-[0.8125rem] font-semibold tracking-[-0.01em]'>Loading view</p>
                </div>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                    {showSlowHint ? 'Still loading. Preparing interface modules…' : 'Preparing interface…'}
                </p>
                <div className='space-y-2'>
                    <div className='bg-muted/70 h-6 w-full rounded-md motion-safe:animate-pulse' />
                    <div className='bg-muted/70 h-6 w-[82%] rounded-md motion-safe:animate-pulse' />
                </div>
            </div>
        </div>
    );
}

export default function AppLayout() {
    useAppShellPersistence();

    const {
        activeRepo,
        setSidebarOpen,
        sidebarOpen,
        openedRepos,
        removeOpenedRepo,
        repoNavMode,
        setRepoNavMode,
        repoLoading,
        repoLoadPhase,
        repoLoadMessage,
        repoLoadError,
        resetRepoLoadState,
        operationLoading,
        operationLabel,
        operationQueue,
        error,
        setError,
    } = useAppStore();
    const { openRepositoryDialog, activateRepoPath, isRepoLoading, isRepoBusy } = useRepoActivation();
    const [repoLoadingStartedAt, setRepoLoadingStartedAt] = useState<number | null>(null);
    const [repoLoadingNow, setRepoLoadingNow] = useState(() => Date.now());
    useEffect(() => {
        const platform = getPlatform();
        document.documentElement.classList.add(`platform-${platform}`);
        return () => {
            document.documentElement.classList.remove(`platform-${platform}`);
        };
    }, []);

    useEffect(() => {
        return scheduleGitGraphPreload({ delayMs: 1200 });
    }, []);

    const settingsQuery = trpc.config.settings.useQuery(undefined, { staleTime: 10_000 });
    const uiSettings = useMemo(
        () => ({
            theme: settingsQuery.data?.settings.theme ?? 'system',
            enhancedAccessibility: settingsQuery.data?.settings.enhancedAccessibility ?? false,
        }),
        [settingsQuery.data?.settings.enhancedAccessibility, settingsQuery.data?.settings.theme]
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const applyUiTheme = () => {
            const useDarkTheme =
                uiSettings.theme === 'dark' || (uiSettings.theme === 'system' && mediaQuery.matches);
            document.documentElement.classList.toggle('dark', useDarkTheme);
            document.documentElement.classList.toggle('high-contrast', uiSettings.enhancedAccessibility);
        };

        applyUiTheme();
        mediaQuery.addEventListener('change', applyUiTheme);
        return () => { mediaQuery.removeEventListener('change', applyUiTheme); };
    }, [uiSettings.enhancedAccessibility, uiSettings.theme]);

    const repoList = trpc.repo.list.useQuery().data as { repos?: HomeStartRepoEntry[] } | undefined;
    const recentRepos = trpc.repo.recent.useQuery().data;
    const lastActiveRepo = trpc.repo.lastActive.useQuery().data;
    const { mutate: setLastActive } = trpc.repo.setLastActive.useMutation();
    const repoEntries = useMemo(() => repoList?.repos ?? [], [repoList?.repos]);

    useEffect(() => {
        if (activeRepo) {
            setLastActive({ repo: activeRepo });
        }
    }, [activeRepo, setLastActive]);

    useEffect(() => {
        if (!repoLoading) {
            setRepoLoadingStartedAt(null);
            return;
        }

        setRepoLoadingNow(Date.now());
        setRepoLoadingStartedAt((prev) => prev ?? Date.now());
    }, [repoLoading]);

    useEffect(() => {
        if (!repoLoading) {
            return;
        }
        const intervalId = window.setInterval(() => {
            setRepoLoadingNow(Date.now());
        }, 500);
        return () => { window.clearInterval(intervalId); };
    }, [repoLoading]);

    useEffect(() => {
        if (repoEntries.length === 0) {
            return;
        }

        const knownRepos = repoEntries.map((repo) => repo.path);
        if (knownRepos.length === 0) {
            return;
        }

        if (repoLoading && activeRepo && !knownRepos.includes(activeRepo)) {
            return;
        }

        if (activeRepo && knownRepos.includes(activeRepo)) {
            return;
        }

        const openedCandidate = openedRepos.find((path) => knownRepos.includes(path));
        const lastActiveCandidate = lastActiveRepo && knownRepos.includes(lastActiveRepo) ? lastActiveRepo : null;
        const nextActive = openedCandidate ?? lastActiveCandidate ?? knownRepos[0] ?? null;

        if (nextActive && nextActive !== activeRepo) {
            void activateRepoPath(nextActive, {
                ensureRegistered: false,
                showErrorToast: false,
                errorTitle: 'Failed to restore repository',
            });
        }
    }, [activeRepo, activateRepoPath, openedRepos, lastActiveRepo, repoLoading, repoEntries]);

    const knownRepoPaths = useMemo(() => new Set(repoEntries.map((repo) => repo.path)), [repoEntries]);

    const repoMetaByPath = useMemo(() => {
        return new Map<string, HomeStartRepoEntry>(repoEntries.map((repo) => [repo.path, repo]));
    }, [repoEntries]);

    const openedRepoEntries = useMemo(() => {
        const knownPaths = new Set(repoEntries.map((repo) => repo.path));
        const validOpened = openedRepos.filter((path) => knownPaths.has(path));
        const withActive =
            activeRepo && knownPaths.has(activeRepo) && !validOpened.includes(activeRepo)
                ? [activeRepo, ...validOpened]
                : validOpened;

        return withActive.map((path) => {
            const meta = repoMetaByPath.get(path);
            return {
                path,
                name: meta?.name ?? path.split('/').pop() ?? path,
            };
        });
    }, [openedRepos, repoMetaByPath, repoEntries, activeRepo]);

    const openedRepoPathSet = useMemo(() => new Set(openedRepoEntries.map((repo) => repo.path)), [openedRepoEntries]);

    const recentRepoEntries = useMemo(() => {
        if (!recentRepos || recentRepos.length === 0) {
            return [];
        }

        const unique = new Set<string>();
        const entries: Array<{ path: string; name: string }> = [];
        for (const path of recentRepos) {
            if (unique.has(path) || openedRepoPathSet.has(path) || !knownRepoPaths.has(path)) {
                continue;
            }
            unique.add(path);
            const meta = repoMetaByPath.get(path);
            entries.push({
                path,
                name: meta?.name ?? path.split('/').pop() ?? path,
            });
        }

        return entries;
    }, [recentRepos, openedRepoPathSet, knownRepoPaths, repoMetaByPath]);

    const recentRepoPathSet = useMemo(() => new Set(recentRepoEntries.map((repo) => repo.path)), [recentRepoEntries]);

    const groupedRepos = useMemo(() => {
        if (repoEntries.length === 0) {
            return {};
        }

        const remainingRepos = repoEntries.filter(
            (repo) => !openedRepoPathSet.has(repo.path) && !recentRepoPathSet.has(repo.path)
        );

        return remainingRepos.reduce<Record<string, HomeStartRepoEntry[]>>((acc, repo) => {
            const normalizedPath = repo.path.replace(/\\/g, '/');
            const parentFolder = normalizedPath.split('/').slice(-2, -1)[0] ?? 'Other';
            if (!acc[parentFolder]) {
                acc[parentFolder] = [];
            }
            acc[parentFolder].push(repo);
            return acc;
        }, {});
    }, [repoEntries, openedRepoPathSet, recentRepoPathSet]);

    const handleOpenFolder = async () => {
        if (isRepoBusy) {
            return;
        }
        void preloadGitGraph();
        await openRepositoryDialog('Open Repository');
    };

    const handleActivateRepo = useCallback(
        async (path: string) => {
            if (isRepoBusy) {
                return;
            }
            void preloadGitGraph();
            await activateRepoPath(path, {
                ensureRegistered: !knownRepoPaths.has(path),
                errorTitle: 'Failed to open repository',
            });
        },
        [activateRepoPath, isRepoBusy, knownRepoPaths]
    );

    const handleCloseOpenedRepo = useCallback(
        (path: string) => {
            removeOpenedRepo(path);
        },
        [removeOpenedRepo]
    );

    const repoLoadingElapsedMs = repoLoadingStartedAt ? repoLoadingNow - repoLoadingStartedAt : 0;
    const repoLoadingIsSlow = repoLoadingElapsedMs > 8000;
    const repoLoadingLabel = repoLoadPhase === 'validating' ? 'Validating repository...' : 'Loading git graph...';
    const repoLoadingHint =
        repoLoadMessage ?? (repoLoadingIsSlow ? 'This is taking longer than usual.' : 'Preparing repository data.');

    return (
        <div className='app-shell'>
            <a className='skip-link' href='#main-content'>
                Skip to main content
            </a>
            {repoNavMode === 'sidebar' && (
                <aside
                    className={`app-shell-sidebar ui-reveal flex flex-col transition-[width] duration-200 ease-out ${sidebarOpen ? 'w-60' : 'w-12'}`}
                    role='navigation'
                    aria-label='Repository navigation'>
                    <div
                        className={`sidebar-header flex items-center ${
                            sidebarOpen ? 'justify-between px-3 py-2' : 'justify-center p-1.5'
                        }`}
                        style={{ WebkitAppRegion: 'drag' }}>
                        {sidebarOpen && (
                            <div className='flex items-center gap-2'>
                                <div className='flex h-6 w-6 items-center justify-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/20'>
                                    <FolderGit2 className='h-3.5 w-3.5' />
                                </div>
                                <span className='text-[0.8125rem] font-semibold tracking-[-0.01em] select-none'>GitLizard</span>
                            </div>
                        )}
                        <div
                            className={`flex items-center ${sidebarOpen ? 'ml-auto gap-0.5' : 'w-full justify-center'}`}
                            style={{ WebkitAppRegion: 'no-drag' }}>
                            {sidebarOpen && (
                                <Button
                                    variant='ghost'
                                    size='icon-sm'
                                    onClick={() => { setRepoNavMode('tabs'); }}
                                    title='Switch to tabbed repositories'
                                    aria-label='Switch to tabbed repositories'>
                                    <PanelTop className='h-3.5 w-3.5' />
                                </Button>
                            )}
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => { setSidebarOpen(!sidebarOpen); }}
                                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
                                {sidebarOpen ? (
                                    <ChevronLeft className='h-3.5 w-3.5' />
                                ) : (
                                    <ChevronRight className='h-3.5 w-3.5' />
                                )}
                            </Button>
                        </div>
                    </div>

                    {sidebarOpen && (
                        <>
                            <div className='px-3 pt-1 pb-3'>
                                <Button
                                    size='sm'
                                    className='w-full justify-center gap-1.5'
                                    onClick={() => { void handleOpenFolder(); }}
                                    disabled={isRepoBusy || isRepoLoading}>
                                    {isRepoLoading ? (
                                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                    ) : (
                                        <Plus className='h-3.5 w-3.5' />
                                    )}
                                    <span>{repoLoadPhase === 'dialog-open' ? 'Choose Folder' : 'Open Repository'}</span>
                                </Button>
                            </div>

                            <ScrollArea className='flex-1'>
                                <div className='px-2 pb-3'>
                                {Object.keys(groupedRepos).length > 0 && (
                                    <div className='space-y-3'>
                                        {Object.entries(groupedRepos).map(([folder, repos]) => (
                                            <div key={folder} className='space-y-0.5'>
                                                <div className='text-muted-foreground/70 px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase'>
                                                    {folder}
                                                </div>
                                                {repos.map((repo) => {
                                                    const isActive = activeRepo === repo.path;
                                                    return (
                                                        <button
                                                            type='button'
                                                            key={repo.path}
                                                            className={`group/repo relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors ${
                                                                isActive
                                                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                                                    : 'text-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground'
                                                            }`}
                                                            onClick={() => {
                                                                void handleActivateRepo(repo.path);
                                                            }}>
                                                            {isActive && (
                                                                <span className='absolute inset-y-1.5 left-0 w-[2px] rounded-r-full bg-primary' />
                                                            )}
                                                            <FolderGit2
                                                                className={`h-3.5 w-3.5 shrink-0 ${
                                                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                                                }`}
                                                            />
                                                            <span className='truncate'>{repo.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {repoEntries.length === 0 ? (
                                    <div className='ui-reveal mt-6 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center'>
                                        <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
                                            <FolderOpen className='h-4 w-4' />
                                        </div>
                                        <div className='text-foreground text-[0.8125rem] font-medium'>No repositories yet</div>
                                        <div className='text-muted-foreground text-[11px]'>Open a folder to begin.</div>
                                    </div>
                                ) : null}
                                </div>
                            </ScrollArea>
                        </>
                    )}

                    {!sidebarOpen && (
                        <div className='flex flex-col items-center gap-1 p-1.5'>
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => { setSidebarOpen(true); }}
                                title='Expand sidebar'
                                aria-label='Expand sidebar'>
                                <ChevronRight className='h-3.5 w-3.5' />
                            </Button>
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => { void handleOpenFolder(); }}
                                onPointerEnter={() => {
                                    void preloadGitGraph();
                                }}
                                onFocus={() => {
                                    void preloadGitGraph();
                                }}
                                disabled={isRepoBusy}
                                title='Open Repository'
                                aria-label='Open Repository'>
                                {isRepoLoading ? (
                                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                ) : (
                                    <Plus className='h-3.5 w-3.5' />
                                )}
                            </Button>
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => { setRepoNavMode('tabs'); }}
                                title='Switch to tabbed repositories'
                                aria-label='Switch to tabbed repositories'>
                                <PanelTop className='h-3.5 w-3.5' />
                            </Button>
                        </div>
                    )}
                </aside>
            )}

            <div id='main-content' className='app-shell-main ui-reveal flex flex-1 flex-col overflow-hidden'>
                {repoLoading && (
                    <div className='ui-banner ui-banner-warning'>
                        <div className='flex items-center gap-2 text-[11px]'>
                            <Loader2 className='h-3 w-3 animate-spin text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]' />
                            <span className='font-medium'>{repoLoadingLabel}</span>
                            <span className='text-muted-foreground'>{repoLoadingHint}</span>
                        </div>
                    </div>
                )}
                {repoLoadPhase === 'error' && repoLoadError && (
                    <div className='ui-banner ui-banner-error'>
                        <div className='flex flex-wrap items-center gap-2 text-[11px]'>
                            <span className='font-semibold text-destructive'>Repository load failed.</span>
                            <span className='text-muted-foreground'>{repoLoadError}</span>
                            <Button
                                variant='outline'
                                size='xs'
                                className='ml-auto'
                                onClick={() => { resetRepoLoadState(activeRepo ? 'ready' : 'idle'); }}>
                                Dismiss
                            </Button>
                            <Button variant='outline' size='xs' onClick={() => void handleOpenFolder()}>
                                Try again
                            </Button>
                        </div>
                    </div>
                )}
                {error && (
                    <div className='ui-banner ui-banner-error'>
                        <div className='flex items-center gap-2 text-[11px]'>
                            <span className='font-semibold text-destructive'>Unexpected runtime error.</span>
                            <span className='text-muted-foreground truncate'>{error}</span>
                            <Button variant='outline' size='xs' className='ml-auto' onClick={() => { setError(null); }}>
                                Dismiss
                            </Button>
                        </div>
                    </div>
                )}
                {operationLoading && (
                    <div className='ui-banner ui-banner-info'>
                        <div className='flex items-center gap-2 text-[11px]'>
                            <Loader2 className='h-3 w-3 animate-spin text-[color-mix(in_oklch,var(--info)_70%,var(--foreground))]' />
                            <span className='font-medium'>{operationLabel ?? 'Running Git operation...'}</span>
                            <span className='text-muted-foreground'>Continue browsing while this runs.</span>
                            {operationQueue.length > 1 && (
                                <span className='text-muted-foreground tabular-nums'>
                                    +{operationQueue.length - 1} queued
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {repoNavMode === 'tabs' && (
                    <div className='ui-toolbar tabs-nav-toolbar flex items-center gap-1.5 border-b px-1.5 py-1'>
                        <Button
                            variant='ghost'
                            size='icon-sm'
                            className='shrink-0'
                            onClick={() => {
                                setRepoNavMode('sidebar');
                                setSidebarOpen(true);
                            }}
                            title='Switch to sidebar navigation'
                            aria-label='Switch to sidebar navigation'>
                            <PanelLeft className='h-3.5 w-3.5' />
                        </Button>
                        <div className='flex-1 overflow-hidden'>
                            <ScrollArea>
                                <div className='flex items-center gap-0.5 py-0.5'>
                                    {openedRepoEntries.map((repo) => {
                                        const isActive = activeRepo === repo.path;
                                        return (
                                            <div
                                                key={repo.path}
                                                role='button'
                                                tabIndex={0}
                                                className={`group/tab relative flex h-7 max-w-[220px] min-w-[140px] items-center gap-1.5 rounded-md px-2 text-[0.8125rem] transition-colors ${
                                                    isActive
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground/75 hover:bg-accent/60 hover:text-foreground'
                                                }`}
                                                onClick={() => {
                                                    void handleActivateRepo(repo.path);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        void handleActivateRepo(repo.path);
                                                    }
                                                }}>
                                                {isActive && (
                                                    <span className='absolute inset-x-2 -bottom-1 h-[2px] rounded-full bg-primary' />
                                                )}
                                                <FolderGit2
                                                    className={`h-3.5 w-3.5 shrink-0 ${
                                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                                    }`}
                                                />
                                                <span className='flex-1 truncate font-medium'>{repo.name}</span>
                                                <button
                                                    type='button'
                                                    className='text-muted-foreground hover:bg-foreground/8 hover:text-foreground -mr-1 grid h-5 w-5 place-items-center rounded opacity-0 transition-opacity group-hover/tab:opacity-100 focus-visible:opacity-100'
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleCloseOpenedRepo(repo.path);
                                                    }}
                                                    aria-label={`Close ${repo.name}`}>
                                                    <X className='h-3 w-3' />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {openedRepoEntries.length === 0 && (
                                        <div className='text-muted-foreground px-2 text-[0.8125rem]'>No opened repositories</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                        <Button
                            variant='outline'
                            size='sm'
                            className='shrink-0 gap-1.5'
                            onClick={() => { void handleOpenFolder(); }}
                            onPointerEnter={() => {
                                void preloadGitGraph();
                            }}
                            onFocus={() => {
                                void preloadGitGraph();
                            }}
                            disabled={isRepoBusy}
                            aria-label='Open repository'>
                            {isRepoLoading ? (
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            ) : (
                                <Plus className='h-3.5 w-3.5' />
                            )}
                            <span>{isRepoLoading ? 'Opening…' : 'Open'}</span>
                        </Button>
                    </div>
                )}
                <Suspense
                    fallback={<MainViewLoadingFallback />}>
                    <Outlet />
                </Suspense>
            </div>
        </div>
    );
}

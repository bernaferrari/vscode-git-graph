import { Outlet } from '@tanstack/react-router';
import {
    Clock,
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
import { preloadGitGraph, scheduleGitGraphPreload } from '@/lib/preloadGitGraph';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


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
            <div className='ui-surface w-full max-w-lg space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                    <Loader2 className='text-primary h-4 w-4 animate-spin' />
                    <p className='text-sm font-medium'>Loading view</p>
                </div>
                <p className='text-muted-foreground text-xs'>
                    {showSlowHint ? 'Still loading. Preparing interface modules...' : 'Preparing interface...'}
                </p>
                <div className='space-y-2'>
                    <div className='bg-muted h-8 w-full rounded-md motion-safe:animate-pulse' />
                    <div className='bg-muted h-8 w-[88%] rounded-md motion-safe:animate-pulse' />
                </div>
            </div>
        </div>
    );
}

export default function AppLayout() {
    const {
        activeRepo,
        addRecentRepo,
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

    const { data: repoList } = trpc.repo.list.useQuery();
    const { data: recentRepos } = trpc.repo.recent.useQuery();
    const { data: lastActiveRepo } = trpc.repo.lastActive.useQuery();
    const { mutate: setLastActive } = trpc.repo.setLastActive.useMutation();

    useEffect(() => {
        if (activeRepo) {
            setLastActive({ repo: activeRepo });
            addRecentRepo(activeRepo);
        }
    }, [activeRepo, setLastActive, addRecentRepo]);

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
        if (!repoList) {
            return;
        }

        const knownRepos = repoList.repos.map((repo) => repo.path);
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
    }, [activeRepo, activateRepoPath, repoList, openedRepos, lastActiveRepo, repoLoading]);

    const knownRepoPaths = useMemo(() => new Set((repoList?.repos ?? []).map((repo) => repo.path)), [repoList?.repos]);

    const repoMetaByPath = useMemo(() => {
        return new Map((repoList?.repos ?? []).map((repo) => [repo.path, repo]));
    }, [repoList?.repos]);

    const openedRepoEntries = useMemo(() => {
        const knownPaths = new Set((repoList?.repos ?? []).map((repo) => repo.path));
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
    }, [openedRepos, repoMetaByPath, repoList?.repos, activeRepo]);

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
        if (!repoList?.repos?.length) {
            return {};
        }

        const remainingRepos = repoList.repos.filter(
            (repo) => !openedRepoPathSet.has(repo.path) && !recentRepoPathSet.has(repo.path)
        );

        return remainingRepos.reduce<Record<string, typeof repoList.repos>>((acc, repo) => {
            const normalizedPath = repo.path.replace(/\\/g, '/');
            const parentFolder = normalizedPath.split('/').slice(-2, -1)[0] ?? 'Other';
            if (!acc[parentFolder]) {
                acc[parentFolder] = [];
            }
            acc[parentFolder].push(repo);
            return acc;
        }, {});
    }, [repoList?.repos, openedRepoPathSet, recentRepoPathSet]);

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
                    className={`app-shell-sidebar ui-reveal flex flex-col ${sidebarOpen ? 'w-64' : 'w-12'}`}
                    role='navigation'
                    aria-label='Repository navigation'>
                    <div
                        className={`sidebar-header border-sidebar-border flex items-center border-b ${
                            sidebarOpen ? 'justify-between px-3' : 'justify-center px-1'
                        }`}
                        style={{ WebkitAppRegion: 'drag' }}>
                        {sidebarOpen && (
                            <div className='flex items-center gap-2'>
                                <FolderGit2 className='text-primary h-4 w-4' />
                                <span className='text-sm font-semibold select-none'>Git Graph</span>
                            </div>
                        )}
                        <div
                            className={`flex items-center ${sidebarOpen ? 'ml-auto gap-1' : 'w-full justify-center'}`}
                            style={{ WebkitAppRegion: 'no-drag' }}>
                            {sidebarOpen && (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => { setRepoNavMode('tabs'); }}
                                    className='h-9 w-9 p-0'
                                    title='Switch to tabbed repositories'
                                    aria-label='Switch to tabbed repositories'>
                                    <PanelTop className='h-4 w-4' />
                                </Button>
                            )}
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => { setSidebarOpen(!sidebarOpen); }}
                                className='h-9 w-9 p-0'
                                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
                                {sidebarOpen ? (
                                    <ChevronLeft className='h-4 w-4' />
                                ) : (
                                    <ChevronRight className='h-4 w-4' />
                                )}
                            </Button>
                        </div>
                    </div>

                    {sidebarOpen && (
                        <>
                            <div className='p-2'>
                                <Button
                                    variant='outline'
                                    className='h-9 w-full justify-start gap-2'
                                    onClick={handleOpenFolder}
                                    onPointerEnter={() => {
                                        void preloadGitGraph();
                                    }}
                                    onFocus={() => {
                                        void preloadGitGraph();
                                    }}
                                    disabled={isRepoBusy}
                                    aria-label='Open repository'>
                                    {isRepoLoading ? (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                    ) : (
                                        <Plus className='h-4 w-4' />
                                    )}
                                    <span>{isRepoLoading ? 'Opening…' : 'Open Repository'}</span>
                                </Button>
                            </div>

                            {openedRepoEntries.length > 0 && (
                                <div className='px-2 pb-2'>
                                    <div className='text-muted-foreground mb-1.5 flex items-center gap-1.5 px-2 pt-1 text-xs font-medium'>
                                        <PanelTop className='h-3 w-3' />
                                        <span>Opened</span>
                                    </div>
                                    <div className='space-y-0.5'>
                                        {openedRepoEntries.slice(0, 8).map((repo) => (
                                            <div
                                                key={repo.path}
                                                role='button'
                                                tabIndex={0}
                                                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                                    activeRepo === repo.path
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground hover:bg-accent/50'
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
                                                <FolderGit2 className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                                                <span className='flex-1 truncate'>{repo.name}</span>
                                                <button
                                                    type='button'
                                                    className='hover:bg-accent/80 text-muted-foreground hover:text-foreground h-6 w-6 rounded p-0 opacity-0 transition-opacity group-hover:opacity-100'
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleCloseOpenedRepo(repo.path);
                                                    }}
                                                    aria-label={`Close ${repo.name}`}>
                                                    <X className='mx-auto h-3 w-3' />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {recentRepoEntries.length > 0 && (
                                <div className='px-2 pb-2'>
                                    <div className='text-muted-foreground mb-1.5 flex items-center gap-1.5 px-2 pt-1 text-xs font-medium'>
                                        <Clock className='h-3 w-3' />
                                        <span>Recent</span>
                                    </div>
                                    <div className='space-y-0.5'>
                                        {recentRepoEntries.slice(0, 5).map((repo) => (
                                            <button
                                                key={repo.path}
                                                type='button'
                                                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                                                    activeRepo === repo.path
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'hover:bg-accent/50 text-foreground'
                                                }`}
                                                onClick={() => {
                                                    void handleActivateRepo(repo.path);
                                                }}>
                                                <div className='flex items-center gap-2'>
                                                    <FolderGit2 className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                                                    <span className='truncate'>{repo.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <ScrollArea className='flex-1 px-2'>
                                {Object.keys(groupedRepos).length > 0 && (
                                    <div className='pb-2'>
                                        <div className='text-muted-foreground mb-1.5 flex items-center gap-1.5 px-2 pt-1 text-xs font-medium'>
                                            <FolderOpen className='h-3 w-3' />
                                            <span>All Repositories</span>
                                        </div>
                                        {Object.entries(groupedRepos).map(([folder, repos]) => (
                                            <div key={folder} className='mb-2'>
                                                <div className='text-muted-foreground/60 px-2 py-1 text-[10px] font-medium tracking-wider uppercase'>
                                                    {folder}
                                                </div>
                                                <div className='space-y-0.5'>
                                                    {repos.map((repo) => (
                                                        <button
                                                            type='button'
                                                            key={repo.path}
                                                            className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                                                                activeRepo === repo.path
                                                                    ? 'bg-accent text-accent-foreground'
                                                                    : 'hover:bg-accent/50 text-foreground'
                                                            }`}
                                                            onClick={() => {
                                                                void handleActivateRepo(repo.path);
                                                            }}>
                                                            <div className='flex items-center gap-2'>
                                                                <FolderGit2 className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                                                                <span className='truncate'>{repo.name}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!repoList || repoList.repos.length === 0 ? (
                                    <div className='empty-state ui-reveal'>
                                        <FolderOpen className='text-muted-foreground h-6 w-6' />
                                        <div className='text-foreground font-medium'>No repositories yet</div>
                                        <div className='text-xs'>Open a folder to start using Git Graph.</div>
                                    </div>
                                ) : null}
                            </ScrollArea>
                        </>
                    )}

                    {!sidebarOpen && (
                        <div className='flex flex-col items-center gap-1 p-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-11 w-11 p-0'
                                onClick={() => { setSidebarOpen(true); }}
                                title='Expand sidebar'
                                aria-label='Expand sidebar'>
                                <ChevronRight className='h-4 w-4' />
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-11 w-11 p-0'
                                onClick={handleOpenFolder}
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
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <Plus className='h-4 w-4' />
                                )}
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-11 w-11 p-0'
                                onClick={() => { setRepoNavMode('tabs'); }}
                                title='Switch to tabbed repositories'
                                aria-label='Switch to tabbed repositories'>
                                <PanelTop className='h-4 w-4' />
                            </Button>
                        </div>
                    )}
                </aside>
            )}

            <div id='main-content' className='app-shell-main ui-reveal flex flex-1 flex-col overflow-hidden'>
                {repoLoading && (
                    <div className='border-b border-amber-400/25 bg-amber-500/12 px-3 py-1.5'>
                        <div className='flex items-center gap-2 text-xs'>
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            <span className='font-medium'>{repoLoadingLabel}</span>
                            <span className='text-muted-foreground'>{repoLoadingHint}</span>
                        </div>
                    </div>
                )}
                {repoLoadPhase === 'error' && repoLoadError && (
                    <div className='border-b border-red-500/35 bg-red-500/10 px-3 py-2'>
                        <div className='flex flex-wrap items-center gap-2 text-xs'>
                            <span className='font-medium text-red-500'>Repository load failed.</span>
                            <span className='text-muted-foreground'>{repoLoadError}</span>
                            <Button
                                variant='outline'
                                size='sm'
                                className='ml-auto h-7'
                                onClick={() => { resetRepoLoadState(activeRepo ? 'ready' : 'idle'); }}>
                                Dismiss
                            </Button>
                            <Button variant='outline' size='sm' className='h-7' onClick={() => void handleOpenFolder()}>
                                Try again
                            </Button>
                        </div>
                    </div>
                )}
                {error && (
                    <div className='border-b border-red-500/35 bg-red-500/10 px-3 py-2'>
                        <div className='flex items-center gap-2 text-xs'>
                            <span className='font-medium text-red-500'>Unexpected runtime error.</span>
                            <span className='text-muted-foreground truncate'>{error}</span>
                            <Button variant='outline' size='sm' className='ml-auto h-7' onClick={() => { setError(null); }}>
                                Dismiss
                            </Button>
                        </div>
                    </div>
                )}
                {operationLoading && (
                    <div className='border-b border-sky-500/25 bg-sky-500/10 px-3 py-1.5'>
                        <div className='flex items-center gap-2 text-xs'>
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            <span className='font-medium'>{operationLabel ?? 'Running Git operation...'}</span>
                            <span className='text-muted-foreground'>You can keep browsing while this runs.</span>
                            {operationQueue.length > 1 && (
                                <span className='text-muted-foreground tabular-nums'>
                                    ({operationQueue.length - 1} queued)
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {repoNavMode === 'tabs' && (
                    <div className='ui-toolbar tabs-nav-toolbar flex items-center gap-2 border-b px-2 py-1.5'>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-9 w-9 shrink-0 p-0'
                            onClick={() => {
                                setRepoNavMode('sidebar');
                                setSidebarOpen(true);
                            }}
                            title='Switch to sidebar navigation'
                            aria-label='Switch to sidebar navigation'>
                            <PanelLeft className='h-4 w-4' />
                        </Button>
                        <ScrollArea className='flex-1'>
                            <div className='flex items-center gap-1 py-0.5'>
                                {openedRepoEntries.map((repo) => (
                                    <div
                                        key={repo.path}
                                        role='button'
                                        tabIndex={0}
                                        className={`group flex h-8 max-w-[220px] min-w-[160px] items-center gap-1.5 rounded-md border px-2 text-sm transition-colors ${
                                            activeRepo === repo.path
                                                ? 'bg-accent text-accent-foreground border-border/80'
                                                : 'hover:bg-accent/45 border-transparent'
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
                                        <FolderGit2 className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                                        <span className='flex-1 truncate'>{repo.name}</span>
                                        <button
                                            type='button'
                                            className='hover:bg-accent/80 text-muted-foreground hover:text-foreground h-6 w-6 rounded p-0 opacity-0 transition-opacity group-hover:opacity-100'
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleCloseOpenedRepo(repo.path);
                                            }}
                                            aria-label={`Close ${repo.name}`}>
                                            <X className='mx-auto h-3 w-3' />
                                        </button>
                                    </div>
                                ))}
                                {openedRepoEntries.length === 0 && (
                                    <div className='text-muted-foreground px-2 text-sm'>No opened repositories</div>
                                )}
                            </div>
                        </ScrollArea>
                        <Button
                            variant='outline'
                            size='sm'
                            className='h-8 shrink-0 gap-1.5'
                            onClick={handleOpenFolder}
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

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeStartSurface, type HomeStartRepoEntry } from '@/components/git-graph/home-start-surface';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppStore } from '@/lib/store';
import { preloadGitGraph, scheduleGitGraphPreload } from '@/lib/preloadGitGraph';
import { trpc } from '@/trpc/client';

const LazyGitGraph = lazy(async () => {
    const mod = await import('@/components/git-graph');
    return { default: mod.GitGraph };
});

function GitGraphLoadingFallback() {
    const [showSlowHint, setShowSlowHint] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setShowSlowHint(true);
        }, 1500);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div className='flex flex-1 items-center justify-center p-6'>
            <div className='ui-surface w-full max-w-xl space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                    <Loader2 className='text-primary h-4 w-4 animate-spin' />
                    <p className='text-sm font-medium'>Loading Git Graph</p>
                </div>
                <p className='text-muted-foreground text-xs'>
                    {showSlowHint
                        ? 'Still preparing the graph view. Large repositories can take longer.'
                        : 'Preparing repository visualization...'}
                </p>
                <div className='space-y-2'>
                    <div className='bg-muted h-8 w-full rounded-md motion-safe:animate-pulse' />
                    <div className='bg-muted h-8 w-[92%] rounded-md motion-safe:animate-pulse' />
                    <div className='bg-muted h-8 w-[86%] rounded-md motion-safe:animate-pulse' />
                </div>
            </div>
        </div>
    );
}

export function GitGraphPage() {
    const activeRepo = useAppStore((state) => state.activeRepo);
    const openedRepos = useAppStore((state) => state.openedRepos);
    const { activateRepoPath, isRepoLoading, isRepoBusy, repoLoadPhase, openRepositoryDialog } = useRepoActivation();
    const [openRepoError, setOpenRepoError] = useState<string | null>(null);
    const repoList = trpc.repo.list.useQuery().data as { repos?: HomeStartRepoEntry[] } | undefined;
    const recentRepos = trpc.repo.recent.useQuery().data as string[] | undefined;

    const repoMetaByPath = useMemo(() => {
        return new Map<string, HomeStartRepoEntry>((repoList?.repos ?? []).map((repo) => [repo.path, repo]));
    }, [repoList?.repos]);

    const knownRepoPaths = useMemo(() => new Set((repoList?.repos ?? []).map((repo) => repo.path)), [repoList?.repos]);

    const openedRepoEntries = useMemo<HomeStartRepoEntry[]>(
        () =>
            openedRepos.map((path) => {
                const meta = repoMetaByPath.get(path);
                return {
                    path,
                    name: meta?.name ?? path.split('/').pop() ?? path,
                };
            }),
        [openedRepos, repoMetaByPath]
    );

    const recentRepoEntries = useMemo<HomeStartRepoEntry[]>(
        () =>
            (recentRepos ?? []).map((path) => {
                const meta = repoMetaByPath.get(path);
                return {
                    path,
                    name: meta?.name ?? path.split('/').pop() ?? path,
                };
            }),
        [recentRepos, repoMetaByPath]
    );

    useEffect(() => {
        return scheduleGitGraphPreload({ delayMs: 700 });
    }, []);

    const handleOpenRepository = async () => {
        if (isRepoBusy) {
            return;
        }
        setOpenRepoError(null);
        void preloadGitGraph().catch((error) => {
            console.warn('[preload] Failed to warm Git Graph before open:', error);
        });
        const result = await openRepositoryDialog('Open Repository');
        if (result.error) {
            setOpenRepoError(result.error);
        }
    };

    const handleActivateRepo = async (path: string) => {
        if (isRepoBusy) {
            return;
        }
        void preloadGitGraph();
        await activateRepoPath(path, {
            ensureRegistered: !knownRepoPaths.has(path),
            showErrorToast: false,
            errorTitle: 'Failed to open repository',
        });
    };

    if (!activeRepo) {
        return (
            <div className='flex flex-1 items-center justify-center p-6'>
                <div className='w-full'>
                    <HomeStartSurface
                        mode='hero'
                        title='Open a repository or resume a workspace'
                        description='Keep multi-repo navigation, review work, and recovery tools in one shell instead of scattering them across dialogs.'
                        primaryActionLabel='Open Repository'
                        primaryActionBusyLabel={repoLoadPhase === 'dialog-open' ? 'Choose Folder' : 'Opening'}
                        isPrimaryActionBusy={isRepoBusy || isRepoLoading}
                        onPrimaryAction={() => void handleOpenRepository()}
                        recentRepos={recentRepoEntries}
                        openedRepos={openedRepoEntries}
                        onActivateRepo={(path) => {
                            void handleActivateRepo(path);
                        }}
                    />
                    {openRepoError && <p className='text-muted-foreground mt-3 text-xs text-red-500'>{openRepoError}</p>}
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<GitGraphLoadingFallback />}>
            <LazyGitGraph />
        </Suspense>
    );
}

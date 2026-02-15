import { Suspense, lazy, useEffect, useState } from 'react';
import { GitCommit, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppStore } from '@/lib/store';
import { preloadGitGraph, scheduleGitGraphPreload } from '@/lib/preloadGitGraph';

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
    const { isRepoLoading, isRepoBusy, repoLoadPhase, openRepositoryDialog } = useRepoActivation();
    const [openRepoError, setOpenRepoError] = useState<string | null>(null);

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
                    <Button
                        size='lg'
                        className='gap-2'
                        onClick={() => void handleOpenRepository()}
                        onPointerEnter={() => {
                            void preloadGitGraph();
                        }}
                        onFocus={() => {
                            void preloadGitGraph();
                        }}
                        disabled={isRepoBusy}
                        aria-busy={isRepoLoading}>
                        {isRepoLoading ? <Loader2 className='h-5 w-5 animate-spin' /> : <Plus className='h-5 w-5' />}
                        {repoLoadPhase === 'dialog-open'
                            ? 'Choose Folder…'
                            : isRepoLoading
                              ? 'Opening…'
                              : 'Open Repository'}
                    </Button>
                    {openRepoError && <p className='mt-3 text-xs text-red-500'>{openRepoError}</p>}
                    <p className='text-muted-foreground mt-4 text-xs'>
                        or use the sidebar to browse recent repositories
                    </p>
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

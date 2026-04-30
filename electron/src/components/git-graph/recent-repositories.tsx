import { FolderGit2, Clock, X, Pin, GitBranch, Plus, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface RecentRepo {
    path: string;
    name: string;
    lastOpened: number;
    openCount: number;
    pinned: boolean;
    currentBranch?: string;
}

interface RecentRepositoriesProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRecentRepos() {
    const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
    const utils = trpc.useUtils();
    const recentReposQuery = trpc.repo.recentRepoDetails.useQuery(undefined, { staleTime: 10_000 });
    const setRecentReposMutation = trpc.repo.setRecentRepoDetails.useMutation({
        onSuccess: async () => {
            await utils.repo.recentRepoDetails.invalidate();
        },
    });

    useEffect(() => {
        setRecentRepos(recentReposQuery.data?.repos ?? []);
    }, [recentReposQuery.data?.repos]);

    const persistRecentRepos = (nextRepos: RecentRepo[]) => {
        setRecentRepos(nextRepos);
        setRecentReposMutation.mutate({ repos: nextRepos });
    };

    const addRecentRepo = (path: string, branch?: string) => {
        const existing = recentRepos.find((r) => r.path === path);
        const name = path.split('/').pop() || path;
        const branchPatch = branch ? { currentBranch: branch } : {};

        if (existing) {
            persistRecentRepos([
                {
                    ...existing,
                    lastOpened: Date.now(),
                    openCount: existing.openCount + 1,
                    ...branchPatch,
                },
                ...recentRepos.filter((r) => r.path !== path),
            ]);
            return;
        }

        persistRecentRepos(
            [
                {
                    path,
                    name,
                    lastOpened: Date.now(),
                    openCount: 1,
                    pinned: false,
                    ...branchPatch,
                },
                ...recentRepos,
            ].slice(0, 20)
        );
    };

    const removeRecentRepo = (path: string) => {
        persistRecentRepos(recentRepos.filter((r) => r.path !== path));
    };

    const togglePin = (path: string) => {
        persistRecentRepos(recentRepos.map((r) => (r.path === path ? { ...r, pinned: !r.pinned } : r)));
    };

    const clearRecentRepos = () => {
        persistRecentRepos([]);
    };

    return {
        recentRepos,
        addRecentRepo,
        removeRecentRepo,
        togglePin,
        clearRecentRepos,
    };
}

export function RecentRepositories({ open, onOpenChange }: RecentRepositoriesProps) {
    const { activeRepo } = useAppStore();
    const { activateRepoPath, openRepositoryDialog, isRepoLoading, isRepoBusy } = useRepoActivation();
    const { recentRepos, addRecentRepo, removeRecentRepo, togglePin, clearRecentRepos } = useRecentRepos();

    const handleOpenRepo = async () => {
        if (isRepoBusy) {
            return;
        }
        const result = await openRepositoryDialog('Open Repository');
        if (!result.canceled && result.root) {
            addRecentRepo(result.root);
            onOpenChange(false);
        }
    };

    const handleSelectRepo = async (path: string) => {
        if (isRepoBusy) {
            return;
        }
        const result = await activateRepoPath(path, {
            ensureRegistered: true,
            errorTitle: 'Failed to open repository',
        });
        if (result.root) {
            addRecentRepo(result.root);
            onOpenChange(false);
        }
    };

    const formatLastOpened = (timestamp: number) => {
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${String(diffMins)}m ago`;
        if (diffHours < 24) return `${String(diffHours)}h ago`;
        if (diffDays < 7) return `${String(diffDays)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Sort: pinned first, then by last opened
    const sortedRepos = [...recentRepos].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.lastOpened - a.lastOpened;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-lg flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FolderGit2 className='h-4 w-4' />
                        Repositories
                    </DialogTitle>
                </DialogHeader>

                <div className='border-border/70 flex items-center justify-between border-b pb-3'>
                    <Badge variant='outline'>
                        {recentRepos.length} repositor{recentRepos.length === 1 ? 'y' : 'ies'}
                    </Badge>
                    <div className='flex items-center gap-2'>
                        {recentRepos.length > 0 && (
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={clearRecentRepos}
                                className='text-muted-foreground hover:text-destructive'
                                title='Clear recent repositories'
                                aria-label='Clear recent repositories'>
                                <X className='h-4 w-4' />
                            </Button>
                        )}
                        <Button size='sm' onClick={() => void handleOpenRepo()} disabled={isRepoBusy}>
                            {isRepoLoading ? (
                                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                            ) : (
                                <Plus className='mr-1 h-4 w-4' />
                            )}
                            Open
                        </Button>
                    </div>
                </div>

                <ScrollArea className='flex-1'>
                    {sortedRepos.length === 0 ? (
                        <div className='text-muted-foreground py-10 text-center'>
                            <FolderGit2 className='mx-auto mb-3 h-9 w-9 opacity-45' />
                            <p className='text-foreground text-sm font-medium'>Open a repository.</p>
                        </div>
                    ) : (
                        <div className='space-y-1 py-1'>
                            {sortedRepos.map((repo) => (
                                <div
                                    key={repo.path}
                                    className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-[background-color,border-color] ${
                                        repo.path === activeRepo
                                            ? 'border-primary/25 bg-primary/10'
                                            : 'border-transparent hover:border-border/70 hover:bg-accent/45'
                                    }`}
                                    onClick={() => void handleSelectRepo(repo.path)}>
                                    <div className='bg-muted/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
                                        <FolderGit2 className='text-muted-foreground h-4 w-4' />
                                    </div>
                                    <div className='min-w-0 flex-1'>
                                        <div className='mb-0.5 flex items-center gap-2'>
                                            <span className='truncate text-sm font-medium'>{repo.name}</span>
                                            {repo.pinned && <Pin className='text-primary h-3 w-3' />}
                                            {repo.path === activeRepo && (
                                                <Badge variant='outline' className='h-5 px-1.5 text-[11px]'>
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                                            {repo.currentBranch && (
                                                <>
                                                    <GitBranch className='h-3 w-3' />
                                                    <span>{repo.currentBranch}</span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            <Clock className='h-3 w-3' />
                                            <span>{formatLastOpened(repo.lastOpened)}</span>
                                        </div>
                                        <div className='text-muted-foreground mt-0.5 truncate text-xs'>{repo.path}</div>
                                    </div>
                                    <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                                        <Button
                                            variant='ghost'
                                            size='icon-sm'
                                            title={repo.pinned ? 'Unpin repository' : 'Pin repository'}
                                            aria-label={repo.pinned ? 'Unpin repository' : 'Pin repository'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePin(repo.path);
                                            }}>
                                            <Pin className={`h-4 w-4 ${repo.pinned ? 'text-primary' : ''}`} />
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='icon-sm'
                                            className='text-muted-foreground hover:text-destructive'
                                            title='Remove repository'
                                            aria-label='Remove repository'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeRecentRepo(repo.path);
                                            }}>
                                            <X className='h-4 w-4' />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default RecentRepositories;

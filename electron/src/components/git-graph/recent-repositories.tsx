/**
 * Recent Repositories
 * Quick access to recently opened repositories
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderGit2, Clock, X, Pin, GitBranch, Plus, Loader2 } from 'lucide-react';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppStore } from '@/lib/store';

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

const STORAGE_KEY = 'git-graph-recent-repos';

export function useRecentRepos() {
    const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setRecentRepos(JSON.parse(stored));
            } catch {
                setRecentRepos([]);
            }
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentRepos));
    }, [recentRepos, isHydrated]);

    const addRecentRepo = (path: string, branch?: string) => {
        setRecentRepos((prev) => {
            const existing = prev.find((r) => r.path === path);
            const name = path.split('/').pop() || path;
            const branchPatch = branch ? { currentBranch: branch } : {};

            if (existing) {
                return [
                    {
                        ...existing,
                        lastOpened: Date.now(),
                        openCount: existing.openCount + 1,
                        ...branchPatch,
                    },
                    ...prev.filter((r) => r.path !== path),
                ];
            }

            return [
                {
                    path,
                    name,
                    lastOpened: Date.now(),
                    openCount: 1,
                    pinned: false,
                    ...branchPatch,
                },
                ...prev,
            ].slice(0, 20); // Keep max 20
        });
    };

    const removeRecentRepo = (path: string) => {
        setRecentRepos((prev) => prev.filter((r) => r.path !== path));
    };

    const togglePin = (path: string) => {
        setRecentRepos((prev) => prev.map((r) => (r.path === path ? { ...r, pinned: !r.pinned } : r)));
    };

    const clearRecentRepos = () => {
        setRecentRepos([]);
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
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
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
                        <FolderGit2 className='h-5 w-5' />
                        Recent Repositories
                    </DialogTitle>
                </DialogHeader>

                <div className='flex items-center justify-between border-b py-2'>
                    <span className='text-muted-foreground text-sm'>
                        {recentRepos.length} repositor{recentRepos.length !== 1 ? 'ies' : 'y'}
                    </span>
                    <div className='flex items-center gap-2'>
                        {recentRepos.length > 0 && (
                            <Button variant='ghost' size='sm' onClick={clearRecentRepos} className='text-red-600'>
                                <X className='mr-1 h-4 w-4' />
                                Clear
                            </Button>
                        )}
                        <Button size='sm' onClick={() => void handleOpenRepo()} disabled={isRepoBusy}>
                            {isRepoLoading ? (
                                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                            ) : (
                                <Plus className='mr-1 h-4 w-4' />
                            )}
                            Open Repository
                        </Button>
                    </div>
                </div>

                <ScrollArea className='flex-1'>
                    {sortedRepos.length === 0 ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <FolderGit2 className='mx-auto mb-4 h-12 w-12 opacity-50' />
                            <p>No recent repositories</p>
                            <p className='mt-1 text-xs'>Open a repository to get started</p>
                        </div>
                    ) : (
                        <div className='space-y-1'>
                            {sortedRepos.map((repo) => (
                                <div
                                    key={repo.path}
                                    className={`group flex cursor-pointer items-center gap-3 rounded-lg p-3 ${
                                        repo.path === activeRepo
                                            ? 'bg-primary/10 border-primary/20 border'
                                            : 'hover:bg-accent/50'
                                    }`}
                                    onClick={() => void handleSelectRepo(repo.path)}>
                                    <div className='bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full'>
                                        <FolderGit2 className='text-muted-foreground h-5 w-5' />
                                    </div>
                                    <div className='min-w-0 flex-1'>
                                        <div className='mb-0.5 flex items-center gap-2'>
                                            <span className='truncate font-medium'>{repo.name}</span>
                                            {repo.pinned && <Pin className='text-primary h-3 w-3' />}
                                            {repo.path === activeRepo && (
                                                <span className='bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs'>
                                                    Active
                                                </span>
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
                                            size='sm'
                                            className='h-7 w-7 p-0'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePin(repo.path);
                                            }}>
                                            <Pin className={`h-4 w-4 ${repo.pinned ? 'text-primary' : ''}`} />
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-7 w-7 p-0 text-red-600'
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

                <div className='text-muted-foreground border-t pt-2 text-xs'>
                    Tip: Pin frequently used repositories for quick access
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default RecentRepositories;

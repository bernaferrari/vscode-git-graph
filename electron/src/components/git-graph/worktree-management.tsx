/**
 * Worktree Management
 * Create, manage, and switch between git worktrees
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderGit2, Plus, Trash2, FolderOpen, Loader2, Check, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

interface Worktree {
    path: string;
    branch: string;
    commit: string;
    isMain: boolean;
}

interface WorktreeManagementProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorktreeManagement({ open, onOpenChange }: WorktreeManagementProps) {
    const { activeRepo } = useAppStore();
    const { activateRepoPath, isRepoBusy } = useRepoActivation();
    const [isCreating, setIsCreating] = useState(false);
    const [newWorktree, setNewWorktree] = useState({
        path: '',
        branch: '',
        createBranch: false,
        newBranchName: '',
    });

    // Fetch worktrees
    const {
        data: worktreeData,
        isLoading,
        refetch,
    } = trpc.git.worktree.list.useQuery({ repo: activeRepo ?? '' }, { enabled: !!activeRepo && open });

    // Create worktree mutation
    const createMutation = trpc.git.worktree.add.useMutation({
        onSuccess: () => {
            toast.success('Worktree created successfully');
            setIsCreating(false);
            setNewWorktree({ path: '', branch: '', createBranch: false, newBranchName: '' });
            refetch();
        },
        onError: (error) => {
            toast.error('Failed to create worktree', { description: error.message });
        },
    });

    // Remove worktree mutation
    const removeMutation = trpc.git.worktree.remove.useMutation({
        onSuccess: () => {
            toast.success('Worktree removed');
            refetch();
        },
        onError: (error) => {
            toast.error('Failed to remove worktree', { description: error.message });
        },
    });

    // Prune worktrees mutation
    const pruneMutation = trpc.git.worktree.prune.useMutation({
        onSuccess: () => {
            toast.success('Pruned stale worktrees');
            refetch();
        },
        onError: (error) => {
            toast.error('Failed to prune worktrees', { description: error.message });
        },
    });

    // Fetch branches for dropdown
    const { data: repoInfo } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: true,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo && open }
    );

    const worktrees: Worktree[] = worktreeData?.worktrees ?? [];
    const branches = repoInfo?.branches ?? [];

    const handleCreateWorktree = () => {
        if (!newWorktree.path) {
            toast.error('Please enter a path for the worktree');
            return;
        }

        if (newWorktree.createBranch && !newWorktree.newBranchName) {
            toast.error('Please enter a branch name');
            return;
        }

        if (!newWorktree.createBranch && !newWorktree.branch) {
            toast.error('Please select a branch');
            return;
        }

        createMutation.mutate({
            repo: activeRepo ?? '',
            path: newWorktree.path,
            branch: newWorktree.createBranch ? newWorktree.newBranchName : newWorktree.branch,
        });
    };

    const handleRemoveWorktree = (path: string) => {
        if (confirm(`Remove worktree at ${path}?`)) {
            removeMutation.mutate({ repo: activeRepo ?? '', path });
        }
    };

    const handleOpenWorktree = async (path: string) => {
        if (isRepoBusy) {
            return;
        }
        const result = await activateRepoPath(path, {
            ensureRegistered: true,
            errorTitle: 'Failed to open worktree',
        });
        if (result.root) {
            onOpenChange(false);
            toast.success(`Switched to worktree: ${result.root}`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FolderGit2 className='h-5 w-5' />
                        Worktrees
                    </DialogTitle>
                </DialogHeader>

                <div className='flex items-center justify-between border-b py-2'>
                    <span className='text-muted-foreground text-sm'>
                        {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
                    </span>
                    <div className='flex items-center gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => pruneMutation.mutate({ repo: activeRepo ?? '' })}
                            disabled={pruneMutation.isPending}>
                            <Trash2 className='mr-1 h-4 w-4' />
                            Prune
                        </Button>
                        <Button size='sm' onClick={() => setIsCreating(!isCreating)}>
                            <Plus className='mr-1 h-4 w-4' />
                            New Worktree
                        </Button>
                    </div>
                </div>

                {/* Create Worktree Form */}
                {isCreating && (
                    <div className='bg-muted/30 space-y-3 rounded-lg border p-4'>
                        <h4 className='font-medium'>Create New Worktree</h4>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <label className='mb-1 block text-xs font-medium'>Path</label>
                                <Input
                                    placeholder='../my-feature'
                                    value={newWorktree.path}
                                    onChange={(e) => setNewWorktree((prev) => ({ ...prev, path: e.target.value }))}
                                />
                            </div>
                            <div className='flex items-end gap-2'>
                                <input
                                    type='checkbox'
                                    id='createBranch'
                                    checked={newWorktree.createBranch}
                                    onChange={(e) =>
                                        setNewWorktree((prev) => ({ ...prev, createBranch: e.target.checked }))
                                    }
                                />
                                <label htmlFor='createBranch' className='text-sm'>
                                    Create new branch
                                </label>
                            </div>
                        </div>

                        {newWorktree.createBranch ? (
                            <Input
                                placeholder='New branch name'
                                value={newWorktree.newBranchName}
                                onChange={(e) => setNewWorktree((prev) => ({ ...prev, newBranchName: e.target.value }))}
                            />
                        ) : (
                            <select
                                className='h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm'
                                value={newWorktree.branch}
                                onChange={(e) => setNewWorktree((prev) => ({ ...prev, branch: e.target.value }))}>
                                <option value=''>Select branch...</option>
                                {branches.map((branchName: string) => (
                                    <option key={branchName} value={branchName}>
                                        {branchName}
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className='flex justify-end gap-2'>
                            <Button variant='outline' size='sm' onClick={() => setIsCreating(false)}>
                                Cancel
                            </Button>
                            <Button size='sm' onClick={handleCreateWorktree} disabled={createMutation.isPending}>
                                {createMutation.isPending ? (
                                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                                ) : (
                                    <FolderGit2 className='mr-1 h-4 w-4' />
                                )}
                                Create
                            </Button>
                        </div>
                    </div>
                )}

                <ScrollArea className='flex-1'>
                    {isLoading ? (
                        <div className='flex items-center justify-center py-8'>
                            <Loader2 className='h-6 w-6 animate-spin' />
                        </div>
                    ) : worktrees.length === 0 ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <FolderGit2 className='mx-auto mb-4 h-12 w-12 opacity-50' />
                            <p>No worktrees found</p>
                        </div>
                    ) : (
                        <div className='space-y-2'>
                            {worktrees.map((wt) => (
                                <div
                                    key={wt.path}
                                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                                        wt.path === activeRepo ? 'border-primary bg-accent/50' : 'hover:bg-accent/30'
                                    }`}>
                                    <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-full'>
                                        <FolderGit2 className='text-muted-foreground h-5 w-5' />
                                    </div>
                                    <div className='min-w-0 flex-1'>
                                        <div className='mb-1 flex items-center gap-2'>
                                            <span className='truncate font-mono text-sm'>
                                                {wt.path.split('/').pop()}
                                            </span>
                                            {wt.path === activeRepo && (
                                                <Badge variant='outline' className='text-xs'>
                                                    <Check className='mr-1 h-3 w-3 text-green-600' />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                                            <GitBranch className='h-3 w-3' />
                                            <span>{wt.branch || 'detached'}</span>
                                            <span className='font-mono'>({wt.commit.slice(0, 7)})</span>
                                        </div>
                                        <div className='text-muted-foreground mt-0.5 truncate text-xs'>{wt.path}</div>
                                    </div>
                                    <div className='flex items-center gap-1'>
                                        {wt.path !== activeRepo && (
                                            <>
                                                <Button
                                                    variant='outline'
                                                    size='sm'
                                                    disabled={isRepoBusy}
                                                    onClick={() => void handleOpenWorktree(wt.path)}>
                                                    <FolderOpen className='mr-1 h-4 w-4' />
                                                    Open
                                                </Button>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    className='text-red-600'
                                                    onClick={() => handleRemoveWorktree(wt.path)}
                                                    disabled={removeMutation.isPending}>
                                                    <Trash2 className='h-4 w-4' />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className='text-muted-foreground border-t pt-2 text-xs'>
                    Worktrees allow you to checkout multiple branches simultaneously in separate directories.
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default WorktreeManagement;

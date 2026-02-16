/**
 * Workspaces Management
 * Group related repositories for quick access
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/trpc/client';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    FolderGit2,
    Plus,
    Trash2,
    Edit,
    Star,
    StarOff,
    FolderOpen,
    MoreHorizontal,
    Check,
    X,
    RefreshCw,
    GitPullRequest,
    ArrowUp,
    ArrowDown,
    CircleAlert,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export interface Workspace {
    id: string;
    name: string;
    color: string;
    repos: WorkspaceRepo[];
    createdAt: number;
    updatedAt: number;
}

export interface WorkspaceRepo {
    path: string;
    name: string;
    lastOpened?: number;
    isFavorite?: boolean;
}

const STORAGE_KEY = 'git-graph-workspaces';

const COLORS = [
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-indigo-500',
];
const DEFAULT_WORKSPACE_COLOR = 'bg-blue-500';

export function WorkspacesManager({
    open,
    onOpenChange,
    onSelectRepo,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectRepo?: (path: string) => void;
}) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const { activateRepoPath, isRepoBusy } = useRepoActivation();
    const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();
    const selectedWorkspaceRepoPaths = useMemo(
        () => selectedWorkspace?.repos.map((repo) => repo.path) ?? [],
        [selectedWorkspace]
    );
    const launchpadQuery = trpc.repo.launchpad.useQuery(
        {
            repos: selectedWorkspaceRepoPaths,
            includePullRequests: true,
        },
        {
            enabled: open && Boolean(selectedWorkspace) && selectedWorkspaceRepoPaths.length > 0,
            staleTime: 15_000,
            refetchOnWindowFocus: false,
        }
    );
    const launchpadByPath = useMemo(() => {
        const entries = launchpadQuery.data?.repos ?? [];
        return new Map(entries.map((entry) => [entry.path, entry]));
    }, [launchpadQuery.data?.repos]);

    // Load workspaces
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setWorkspaces(JSON.parse(stored));
            } catch {
                setWorkspaces([]);
            }
        }
    }, [open]);

    // Save workspaces
    const saveWorkspaces = useCallback((ws: Workspace[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
        setWorkspaces(ws);
    }, []);

    // Create workspace
    const handleCreateWorkspace = () => {
        if (!newWorkspaceName.trim()) return;

        const workspace: Workspace = {
            id: `ws-${Date.now()}`,
            name: newWorkspaceName.trim(),
            color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? DEFAULT_WORKSPACE_COLOR,
            repos: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        saveWorkspaces([...workspaces, workspace]);
        setNewWorkspaceName('');
        setIsCreating(false);
        toast.success(`Created workspace "${workspace.name}"`);
    };

    // Delete workspace
    const handleDeleteWorkspace = (id: string) => {
        const ws = workspaces.find((w) => w.id === id);
        if (!confirm(`Delete workspace "${ws?.name}"?`)) return;

        saveWorkspaces(workspaces.filter((w) => w.id !== id));
        if (selectedWorkspace?.id === id) {
            setSelectedWorkspace(null);
        }
        toast.success('Workspace deleted');
    };

    // Rename workspace
    const handleRenameWorkspace = (id: string) => {
        if (!editName.trim()) return;

        saveWorkspaces(
            workspaces.map((w) => (w.id === id ? { ...w, name: editName.trim(), updatedAt: Date.now() } : w))
        );
        setEditingWorkspace(null);
        toast.success('Workspace renamed');
    };

    // Add repo to workspace
    const handleAddRepo = async (workspaceId: string) => {
        const result = await showOpenDialog({
            title: 'Add repository to workspace',
            properties: ['openDirectory'],
        });
        if (!result || result.canceled) return;

        const path = result.filePaths[0];
        if (!path) return;
        const name = path.split('/').pop() || path;

        saveWorkspaces(
            workspaces.map((w) =>
                w.id === workspaceId
                    ? {
                          ...w,
                          repos: w.repos.some((r) => r.path === path)
                              ? w.repos
                              : [...w.repos, { path, name, lastOpened: Date.now() }],
                          updatedAt: Date.now(),
                      }
                    : w
            )
        );

        toast.success(`Added "${name}" to workspace`);
    };

    // Remove repo from workspace
    const handleRemoveRepo = (workspaceId: string, repoPath: string) => {
        saveWorkspaces(
            workspaces.map((w) =>
                w.id === workspaceId
                    ? {
                          ...w,
                          repos: w.repos.filter((r) => r.path !== repoPath),
                          updatedAt: Date.now(),
                      }
                    : w
            )
        );
    };

    // Toggle favorite
    const handleToggleFavorite = (workspaceId: string, repoPath: string) => {
        saveWorkspaces(
            workspaces.map((w) =>
                w.id === workspaceId
                    ? {
                          ...w,
                          repos: w.repos.map((r) => (r.path === repoPath ? { ...r, isFavorite: !r.isFavorite } : r)),
                          updatedAt: Date.now(),
                      }
                    : w
            )
        );
    };

    // Open repo
    const handleOpenRepo = async (path: string) => {
        if (isRepoBusy) {
            return;
        }
        if (onSelectRepo) {
            await Promise.resolve(onSelectRepo(path));
            onOpenChange(false);
            return;
        }
        const result = await activateRepoPath(path, {
            ensureRegistered: true,
            errorTitle: 'Failed to open repository',
        });
        if (result.root) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-3xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FolderGit2 className='h-5 w-5' />
                        Workspaces
                    </DialogTitle>
                </DialogHeader>

                <div className='flex flex-1 gap-4 overflow-hidden'>
                    {/* Workspace list */}
                    <div className='flex w-64 flex-col overflow-hidden rounded-lg border'>
                        <div className='bg-muted/30 flex items-center justify-between border-b p-2'>
                            <span className='text-sm font-medium'>Workspaces</span>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0'
                                onClick={() => setIsCreating(true)}>
                                <Plus className='h-4 w-4' />
                            </Button>
                        </div>

                        <ScrollArea className='flex-1'>
                            {isCreating && (
                                <div className='border-b p-2'>
                                    <Input
                                        placeholder='Workspace name...'
                                        value={newWorkspaceName}
                                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateWorkspace();
                                            if (e.key === 'Escape') setIsCreating(false);
                                        }}
                                        autoFocus
                                    />
                                    <div className='mt-2 flex gap-1'>
                                        <Button size='sm' onClick={handleCreateWorkspace}>
                                            <Check className='h-3 w-3' />
                                        </Button>
                                        <Button size='sm' variant='ghost' onClick={() => setIsCreating(false)}>
                                            <X className='h-3 w-3' />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {workspaces.map((workspace) => (
                                <div
                                    key={workspace.id}
                                    className={`hover:bg-accent/50 flex cursor-pointer items-center gap-2 px-3 py-2 ${
                                        selectedWorkspace?.id === workspace.id ? 'bg-accent' : ''
                                    }`}
                                    onClick={() => setSelectedWorkspace(workspace)}>
                                    <div className={`h-3 w-3 rounded ${workspace.color}`} />
                                    <span className='flex-1 truncate text-sm'>
                                        {editingWorkspace === workspace.id ? (
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenameWorkspace(workspace.id);
                                                    if (e.key === 'Escape') setEditingWorkspace(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className='h-6'
                                            />
                                        ) : (
                                            workspace.name
                                        )}
                                    </span>
                                    <Badge variant='outline' className='text-xs'>
                                        {workspace.repos.length}
                                    </Badge>
                                </div>
                            ))}

                            {workspaces.length === 0 && !isCreating && (
                                <div className='text-muted-foreground p-4 text-center text-sm'>
                                    <p>No workspaces yet</p>
                                    <p className='mt-1 text-xs'>Create one to organize your repos</p>
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Repos in workspace */}
                    <div className='flex flex-1 flex-col overflow-hidden rounded-lg border'>
                        {selectedWorkspace ? (
                            <>
                                <div className='bg-muted/30 flex items-center justify-between border-b p-2'>
                                    <span className='text-sm font-medium'>{selectedWorkspace.name}</span>
                                    <div className='flex items-center gap-1'>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-6 w-6 p-0'
                                            onClick={() => void launchpadQuery.refetch()}
                                            title='Refresh workspace launchpad'>
                                            <RefreshCw
                                                className={`h-3.5 w-3.5 ${
                                                    launchpadQuery.isFetching ? 'animate-spin' : ''
                                                }`}
                                            />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className='hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded-md p-0'>
                                                <MoreHorizontal className='h-4 w-4' />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align='end'>
                                                <DropdownMenuItem onClick={() => handleAddRepo(selectedWorkspace.id)}>
                                                    <Plus className='mr-2 h-4 w-4' />
                                                    Add Repository
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setEditingWorkspace(selectedWorkspace.id);
                                                        setEditName(selectedWorkspace.name);
                                                    }}>
                                                    <Edit className='mr-2 h-4 w-4' />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteWorkspace(selectedWorkspace.id)}
                                                    className='text-red-600'>
                                                    <Trash2 className='mr-2 h-4 w-4' />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <ScrollArea className='flex-1'>
                                    {selectedWorkspace.repos.length > 0 && (
                                        <div className='border-b px-3 py-2'>
                                            <div className='mb-1 flex items-center justify-between'>
                                                <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                                                    Launchpad
                                                </span>
                                                <span className='text-[11px] text-muted-foreground'>
                                                    {launchpadQuery.isFetching ? 'syncing...' : 'ready'}
                                                </span>
                                            </div>
                                            <div className='grid grid-cols-3 gap-2 text-xs'>
                                                <div className='rounded border px-2 py-1'>
                                                    <p className='text-muted-foreground'>Dirty</p>
                                                    <p className='font-semibold'>
                                                        {Array.from(launchpadByPath.values()).filter((repo) => repo.dirtyCount > 0)
                                                            .length}
                                                    </p>
                                                </div>
                                                <div className='rounded border px-2 py-1'>
                                                    <p className='text-muted-foreground'>Ahead</p>
                                                    <p className='font-semibold'>
                                                        {Array.from(launchpadByPath.values()).filter((repo) => repo.ahead > 0)
                                                            .length}
                                                    </p>
                                                </div>
                                                <div className='rounded border px-2 py-1'>
                                                    <p className='text-muted-foreground'>Open PRs</p>
                                                    <p className='font-semibold'>
                                                        {Array.from(launchpadByPath.values()).reduce(
                                                            (sum, repo) => sum + (repo.openPullRequests ?? 0),
                                                            0
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedWorkspace.repos.length > 0 ? (
                                        <div className='divide-y'>
                                            {selectedWorkspace.repos.map((repo) => (
                                                (() => {
                                                    const launchpad = launchpadByPath.get(repo.path);
                                                    return (
                                                <div
                                                    key={repo.path}
                                                    className='hover:bg-accent/50 group flex cursor-pointer items-center gap-3 px-3 py-2'
                                                    onClick={() => void handleOpenRepo(repo.path)}>
                                                    <FolderGit2 className='text-muted-foreground h-4 w-4' />
                                                    <div className='min-w-0 flex-1'>
                                                        <p className='truncate text-sm font-medium'>{repo.name}</p>
                                                        <p className='text-muted-foreground truncate text-xs'>{repo.path}</p>
                                                        {launchpad ? (
                                                            <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]'>
                                                                {launchpad.error ? (
                                                                    <span className='inline-flex items-center gap-1 text-amber-600'>
                                                                        <CircleAlert className='h-3 w-3' />
                                                                        {launchpad.error}
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        <span>{launchpad.head ?? 'detached'}</span>
                                                                        {launchpad.dirtyCount > 0 && (
                                                                            <span className='rounded bg-amber-100 px-1.5 py-0.5 text-amber-700'>
                                                                                {launchpad.dirtyCount} changed
                                                                            </span>
                                                                        )}
                                                                        {(launchpad.ahead > 0 || launchpad.behind > 0) && (
                                                                            <span className='inline-flex items-center gap-1'>
                                                                                {launchpad.ahead > 0 && (
                                                                                    <span className='inline-flex items-center gap-0.5 text-emerald-600'>
                                                                                        <ArrowUp className='h-3 w-3' />
                                                                                        {launchpad.ahead}
                                                                                    </span>
                                                                                )}
                                                                                {launchpad.behind > 0 && (
                                                                                    <span className='inline-flex items-center gap-0.5 text-sky-600'>
                                                                                        <ArrowDown className='h-3 w-3' />
                                                                                        {launchpad.behind}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                        {(launchpad.openPullRequests ?? 0) > 0 && (
                                                                            <span className='inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700'>
                                                                                <GitPullRequest className='h-3 w-3' />
                                                                                {launchpad.openPullRequests}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    {repo.isFavorite && (
                                                        <Star className='h-4 w-4 fill-amber-500 text-amber-500' />
                                                    )}
                                                    <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100'>
                                                        <Button
                                                            variant='ghost'
                                                            size='sm'
                                                            className='h-6 w-6 p-0'
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleFavorite(selectedWorkspace.id, repo.path);
                                                            }}>
                                                            {repo.isFavorite ? (
                                                                <StarOff className='h-3 w-3' />
                                                            ) : (
                                                                <Star className='h-3 w-3' />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant='ghost'
                                                            size='sm'
                                                            className='h-6 w-6 p-0 text-red-600'
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveRepo(selectedWorkspace.id, repo.path);
                                                            }}>
                                                            <X className='h-3 w-3' />
                                                        </Button>
                                                    </div>
                                                </div>
                                                    );
                                                })()
                                            ))}
                                        </div>
                                    ) : (
                                        <div className='p-8 text-center'>
                                            <FolderOpen className='text-muted-foreground mx-auto h-12 w-12 opacity-30' />
                                            <p className='text-muted-foreground mt-4'>No repositories yet</p>
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                className='mt-2'
                                                onClick={() => handleAddRepo(selectedWorkspace.id)}>
                                                <Plus className='mr-2 h-4 w-4' />
                                                Add Repository
                                            </Button>
                                        </div>
                                    )}
                                </ScrollArea>
                            </>
                        ) : (
                            <div className='flex flex-1 items-center justify-center'>
                                <div className='text-muted-foreground text-center'>
                                    <FolderGit2 className='mx-auto h-12 w-12 opacity-30' />
                                    <p className='mt-4'>Select a workspace to view repositories</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default WorkspacesManager;

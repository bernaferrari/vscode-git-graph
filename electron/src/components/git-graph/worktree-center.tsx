/**
 * Worktree Center
 * Unified worktree UX for overview, creation and cleanup.
 */

import {
    AlertTriangle,
    Check,
    Copy,
    FolderGit2,
    FolderOpen,
    Loader2,
    Lock,
    RefreshCw,
    Trash2,
    Unlock,
    Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

type CreateMode = 'existing' | 'new-branch' | 'detached' | 'ephemeral-review';

interface WorktreeCenterProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    repo?: string;
    embedded?: boolean;
}

interface LaunchpadEntry {
    path: string;
    openPullRequests: number | null;
}

interface WorkspaceEntry {
    id: string;
    name: string;
    repos: Array<{ path: string }>;
}

interface WorktreeMutationResult {
    error?: string | null;
}

interface WorktreeCheckoutResult extends WorktreeMutationResult {
    branchCreated?: string | null;
    path?: string | null;
}

interface WorktreeRemoveResult extends WorktreeMutationResult {
    dirtyCount?: number;
}

interface WorktreePruneResult extends WorktreeMutationResult {
    entries?: string[];
}

interface WorktreeRepairResult extends WorktreeMutationResult {
    repaired?: string[];
    pruned?: string[];
}

function isRemoteBranch(value: string): boolean {
    return value.startsWith('remotes/');
}

function toFolderName(worktreePath: string): string {
    return worktreePath.split('/').filter(Boolean).pop() ?? worktreePath;
}

export function WorktreeCenter({ open, onOpenChange, repo, embedded }: WorktreeCenterProps) {
    const { activeRepo } = useAppStore();
    const { activateRepoPath, isRepoBusy } = useRepoActivation();
    const targetRepo = repo ?? activeRepo ?? '';
    const trpcUtils = trpc.useUtils();
    const { notifySuccess, notifyError, notifyInfo } = useAppNotifications();

    const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'cleanup'>('overview');
    const [mode, setMode] = useState<CreateMode>('existing');
    const [createPath, setCreatePath] = useState('');
    const [branch, setBranch] = useState('');
    const [newBranch, setNewBranch] = useState('');
    const [baseRef, setBaseRef] = useState('');
    const [detachedEphemeral, setDetachedEphemeral] = useState(false);
    const [forceReason, setForceReason] = useState('');
    const [showLocked, setShowLocked] = useState(true);
    const [showPrunable, setShowPrunable] = useState(true);
    const [pathPresetRoot, setPathPresetRoot] = useState('');
    const [checkoutTargets, setCheckoutTargets] = useState<Record<string, string>>({});

    const { data: repoInfo } = trpc.git.repoInfo.useQuery(
        {
            repo: targetRepo,
            showRemoteBranches: true,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: open && !!targetRepo }
    );
    const listQuery = trpc.git.worktree.list.useQuery({ repo: targetRepo }, { enabled: open && !!targetRepo });
    const prefsQuery = trpc.git.worktree.viewPrefs.useQuery(undefined, { enabled: open });
    const workspaceQuery = trpc.repo.workspace.list.useQuery(undefined, { enabled: open });
    const launchpadQuery = trpc.repo.launchpad.useQuery(
        {
            repos: (listQuery.data?.worktrees ?? []).map((entry: Record<string, unknown>) => String(entry.path ?? '')),
            includePullRequests: true,
        },
        {
            enabled: open && !!targetRepo && (listQuery.data?.worktrees?.length ?? 0) > 0,
            staleTime: 20_000,
        }
    );
    const validatePathQuery = trpc.git.worktree.validatePath.useQuery(
        { repo: targetRepo, path: createPath || '.' },
        { enabled: open && !!targetRepo && createPath.trim().length > 0 }
    );
    const prunePreviewQuery = trpc.git.worktree.prunePreview.useQuery(
        { repo: targetRepo },
        { enabled: open && !!targetRepo && activeTab === 'cleanup' }
    );

    const revealMutation = trpc.system.revealInFinder.useMutation();
    const prefsMutation = trpc.git.worktree.setViewPrefs.useMutation();
    const checkoutMutation = trpc.git.checkout.useMutation({
        onSuccess: async (result: WorktreeMutationResult) => {
            if (result.error) {
                notifyError('Worktree checkout failed', { description: result.error });
                return;
            }
            notifySuccess('Branch checked out in worktree');
            await trpcUtils.git.worktree.list.invalidate({ repo: targetRepo });
        },
    });
    const addMutation = trpc.git.worktree.add.useMutation({
        onSuccess: async (result: WorktreeCheckoutResult) => {
            if (result.error) {
                notifyError('Worktree creation failed', { description: result.error });
                return;
            }
            const description = result.branchCreated
                ? `Created branch ${result.branchCreated}`
                : typeof result.path === 'string'
                  ? result.path
                  : undefined;
            notifySuccess('Worktree created', description ? { description } : undefined);
            setCreatePath('');
            setNewBranch('');
            setBaseRef('');
            setBranch('');
            await trpcUtils.git.worktree.list.invalidate({ repo: targetRepo });
        },
    });
    const removeMutation = trpc.git.worktree.remove.useMutation({
        onSuccess: async (result: WorktreeRemoveResult) => {
            if (result.error) {
                notifyError('Worktree removal failed', { description: result.error });
                return;
            }
            const description =
                typeof result.dirtyCount === 'number' && result.dirtyCount > 0
                    ? `Force-removed worktree with ${String(result.dirtyCount)} local change(s)`
                    : undefined;
            notifySuccess('Worktree removed', description ? { description } : undefined);
            await trpcUtils.git.worktree.list.invalidate({ repo: targetRepo });
        },
    });
    const lockMutation = trpc.git.worktree.lock.useMutation({
        onSuccess: async (result: WorktreeMutationResult) => {
            if (result.error) {
                notifyError('Worktree lock failed', { description: result.error });
                return;
            }
            notifySuccess('Worktree locked');
            await trpcUtils.git.worktree.list.invalidate({ repo: targetRepo });
        },
    });
    const unlockMutation = trpc.git.worktree.unlock.useMutation({
        onSuccess: async (result: WorktreeMutationResult) => {
            if (result.error) {
                notifyError('Worktree unlock failed', { description: result.error });
                return;
            }
            notifySuccess('Worktree unlocked');
            await trpcUtils.git.worktree.list.invalidate({ repo: targetRepo });
        },
    });
    const pruneMutation = trpc.git.worktree.prune.useMutation({
        onSuccess: async (result: WorktreePruneResult) => {
            if (result.error) {
                notifyError('Worktree prune failed', { description: result.error });
                return;
            }
            const description =
                Array.isArray(result.entries) && result.entries.length > 0
                    ? `${String(result.entries.length)} entry${result.entries.length === 1 ? '' : 'ies'} updated`
                    : 'No stale worktree entries found';
            notifySuccess('Worktree prune completed', { description });
            await Promise.all([
                trpcUtils.git.worktree.list.invalidate({ repo: targetRepo }),
                prunePreviewQuery.refetch(),
            ]);
        },
    });
    const repairMutation = trpc.git.worktree.repair.useMutation({
        onSuccess: async (result: WorktreeRepairResult) => {
            if (result.error) {
                notifyError('Worktree repair failed', { description: result.error });
                return;
            }
            notifySuccess('Worktree repair completed', {
                description: `${String(result.repaired?.length ?? 0)} repaired, ${String(result.pruned?.length ?? 0)} pruned`,
            });
            await Promise.all([
                trpcUtils.git.worktree.list.invalidate({ repo: targetRepo }),
                prunePreviewQuery.refetch(),
            ]);
        },
    });

    const branches = useMemo(() => repoInfo?.branches ?? [], [repoInfo?.branches]);
    const localBranches = branches.filter((entry: string) => !isRemoteBranch(entry));
    const remoteBranches = branches.filter((entry: string) => isRemoteBranch(entry));
    const worktrees = useMemo(() => listQuery.data?.worktrees ?? [], [listQuery.data?.worktrees]);
    const filteredWorktrees = useMemo(
        () =>
            worktrees.filter((entry: Record<string, unknown>) => {
                if (!showLocked && Boolean(entry.locked)) return false;
                if (!showPrunable && Boolean(entry.prunable)) return false;
                return true;
            }),
        [showLocked, showPrunable, worktrees]
    );
    const launchpadByPath = useMemo(() => {
        const entries = (launchpadQuery.data?.repos ?? []) as LaunchpadEntry[];
        return new Map<string, LaunchpadEntry>(entries.map((entry) => [entry.path, entry]));
    }, [launchpadQuery.data?.repos]);
    const workspacesByPath = useMemo(() => {
        const map = new Map<string, string[]>();
        const workspaces = (workspaceQuery.data?.workspaces ?? []) as WorkspaceEntry[];
        for (const workspace of workspaces) {
            for (const repoEntry of workspace.repos) {
                const current = map.get(repoEntry.path) ?? [];
                if (!current.includes(workspace.name)) {
                    current.push(workspace.name);
                    map.set(repoEntry.path, current);
                }
            }
        }
        return map;
    }, [workspaceQuery.data?.workspaces]);

    const pending =
        addMutation.isPending ||
        removeMutation.isPending ||
        lockMutation.isPending ||
        unlockMutation.isPending ||
        pruneMutation.isPending ||
        repairMutation.isPending ||
        checkoutMutation.isPending;

    const canCreate = useMemo(() => {
        if (!createPath.trim()) return false;
        if (mode === 'existing') return !!branch;
        if (mode === 'new-branch') return !!newBranch.trim();
        if (mode === 'detached') return !!(baseRef || 'HEAD');
        if (detachedEphemeral) return !!createPath.trim();
        return !!createPath.trim();
    }, [baseRef, branch, createPath, detachedEphemeral, mode, newBranch]);

    useEffect(() => {
        if (!open || !prefsQuery.data?.prefs) {
            return;
        }
        const prefs = prefsQuery.data.prefs;
        setShowLocked(Boolean(prefs.showLocked));
        setShowPrunable(Boolean(prefs.showPrunable));
        setMode(prefs.defaultCreateMode as CreateMode);
        setPathPresetRoot(prefs.pathPresetRoot ?? '');
        if (prefs.lastSelectedBranch) {
            setBranch(prefs.lastSelectedBranch);
        }
    }, [open, prefsQuery.data?.prefs]);

    const persistViewPrefs = (patch: {
        showLocked?: boolean;
        showPrunable?: boolean;
        defaultCreateMode?: CreateMode;
        pathPresetRoot?: string | null;
        lastSelectedBranch?: string | null;
    }) => {
        prefsMutation.mutate({
            ...patch,
        });
    };

    const buildPresetPath = (nameSeed: string): string => {
        const root = pathPresetRoot.trim();
        if (!root) {
            return createPath;
        }
        const safeSegment = (nameSeed || 'review')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const normalizedRoot = root.replace(/[\\/]+$/, '');
        return `${normalizedRoot}/${safeSegment || 'review'}`;
    };

    const toAgeLabel = (timestamp: unknown): string => {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
            return 'unknown';
        }
        const deltaMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
        if (deltaMinutes < 1) return 'just now';
        if (deltaMinutes < 60) return `${String(deltaMinutes)}m ago`;
        const deltaHours = Math.floor(deltaMinutes / 60);
        if (deltaHours < 48) return `${String(deltaHours)}h ago`;
        const deltaDays = Math.floor(deltaHours / 24);
        return `${String(deltaDays)}d ago`;
    };

    const handleOpenWorktree = async (targetPath: string) => {
        if (isRepoBusy) {
            return;
        }
        const resolved = await trpcUtils.git.worktree.open.fetch({
            repo: targetRepo,
            path: targetPath,
        });
        if (!resolved.valid) {
            notifyError('Failed to open worktree', {
                description: resolved.error ?? 'Invalid worktree path',
            });
            return;
        }
        const result = await activateRepoPath(resolved.resolvedPath ?? targetPath, {
            ensureRegistered: true,
            errorTitle: 'Failed to open worktree',
        });
        if (result.root) {
            notifyInfo('Opened worktree', { description: result.root, persist: false });
            onOpenChange(false);
        }
    };

    const handleCreate = () => {
        if (!targetRepo) {
            toast.error('No repository selected');
            return;
        }

        addMutation.mutate({
            repo: targetRepo,
            path: createPath.trim(),
            mode,
            branch: mode === 'existing' ? branch : undefined,
            newBranch: mode === 'new-branch' || mode === 'ephemeral-review' ? newBranch.trim() || undefined : undefined,
            baseRef: baseRef.trim() || undefined,
            detached: mode === 'ephemeral-review' ? detachedEphemeral : undefined,
        });
    };

    const handleRemove = (targetPath: string, dirtyCount: number) => {
        const confirmed = window.confirm(`Remove worktree at ${targetPath}?`);
        if (!confirmed) {
            return;
        }

        if (dirtyCount > 0) {
            const typedReason = window.prompt(
                `Worktree has ${String(dirtyCount)} local change(s). Type reason to force remove:`,
                forceReason || 'cleanup'
            );
            if (!typedReason) {
                return;
            }
            setForceReason(typedReason);
            removeMutation.mutate({
                repo: targetRepo,
                path: targetPath,
                force: true,
                forceReason: typedReason,
            });
            return;
        }

        removeMutation.mutate({
            repo: targetRepo,
            path: targetPath,
            force: false,
        });
    };

    const body = (
        <div className='flex h-full flex-col overflow-hidden'>
            <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as 'overview' | 'create' | 'cleanup'); }}>
                <TabsList className='mb-3 w-full'>
                    <TabsTrigger value='overview'>Overview</TabsTrigger>
                    <TabsTrigger value='create'>Create</TabsTrigger>
                    <TabsTrigger value='cleanup'>Cleanup</TabsTrigger>
                </TabsList>

                <TabsContent value='overview' className='min-h-0 flex-1'>
                    <div className='mb-2 flex items-center justify-between'>
                        <span className='text-muted-foreground text-xs'>
                            {filteredWorktrees.length} worktree{filteredWorktrees.length === 1 ? '' : 's'}
                        </span>
                        <div className='flex items-center gap-2'>
                            <label className='text-muted-foreground flex items-center gap-1 text-xs'>
                                <input
                                    type='checkbox'
                                    checked={showLocked}
                                    onChange={(event) => {
                                        const value = event.target.checked;
                                        setShowLocked(value);
                                        persistViewPrefs({ showLocked: value });
                                    }}
                                />
                                Locked
                            </label>
                            <label className='text-muted-foreground flex items-center gap-1 text-xs'>
                                <input
                                    type='checkbox'
                                    checked={showPrunable}
                                    onChange={(event) => {
                                        const value = event.target.checked;
                                        setShowPrunable(value);
                                        persistViewPrefs({ showPrunable: value });
                                    }}
                                />
                                Prunable
                            </label>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                    void listQuery.refetch();
                                }}
                                aria-label='Refresh worktrees'>
                                {listQuery.isFetching ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            </Button>
                        </div>
                    </div>
                    <ScrollArea className='h-[52vh] pr-1'>
                        <div className='space-y-2'>
                            {filteredWorktrees.map((worktree: Record<string, unknown>) => {
                                const locked = Boolean(worktree.locked);
                                const prunable = Boolean(worktree.prunable);
                                const isMain = Boolean(worktree.isMain);
                                const dirtyCount = Number(worktree.dirtyCount ?? 0);
                                const ahead = Number(worktree.ahead ?? 0);
                                const behind = Number(worktree.behind ?? 0);
                                const branchLabel =
                                    typeof worktree.headRef === 'string' && worktree.headRef
                                        ? worktree.headRef
                                        : typeof worktree.branch === 'string'
                                          ? worktree.branch
                                          : 'detached';
                                const lockReason = typeof worktree.lockReason === 'string' ? worktree.lockReason : '';
                                const targetPath = String(worktree.path ?? '');
                                const launchpad = launchpadByPath.get(targetPath);
                                const linkedWorkspaces = workspacesByPath.get(targetPath) ?? [];
                                const checkoutTarget =
                                    checkoutTargets[targetPath] ||
                                    (localBranches.includes(branchLabel) ? branchLabel : localBranches[0] ?? '');

                                return (
                                    <div key={targetPath} className='rounded-lg border p-3'>
                                        <div className='mb-1 flex items-center gap-2'>
                                            <FolderGit2 className='text-muted-foreground h-4 w-4' />
                                            <span className='min-w-0 flex-1 truncate text-sm font-medium'>{toFolderName(targetPath)}</span>
                                            {isMain && <Badge variant='default'>main</Badge>}
                                            {locked && <Badge variant='outline'>locked</Badge>}
                                            {prunable && <Badge variant='outline'>prunable</Badge>}
                                            {linkedWorkspaces.length > 0 && <Badge variant='secondary'>{linkedWorkspaces.length} workspace</Badge>}
                                        </div>
                                        <div className='text-muted-foreground mb-2 space-y-0.5 text-xs'>
                                            <p className='truncate'>{targetPath}</p>
                                            <p>{branchLabel}</p>
                                            {lockReason && <p>lock: {lockReason}</p>}
                                            <p>
                                                {dirtyCount > 0 ? `${String(dirtyCount)} changed` : 'clean'}
                                                {(ahead > 0 || behind > 0) && ` · ↑${String(ahead)} ↓${String(behind)}`}
                                                {(launchpad?.openPullRequests ?? 0) > 0 &&
                                                    ` · ${String(launchpad?.openPullRequests)} open PR`}
                                                {` · last commit ${toAgeLabel(worktree.lastCommitAt)}`}
                                            </p>
                                        </div>
                                        <div className='mb-2 grid grid-cols-[1fr_auto] gap-1'>
                                            <select
                                                className='h-8 rounded-md border bg-background px-2 text-xs'
                                                value={checkoutTarget}
                                                onChange={(event) => {
                                                    const nextBranch = event.target.value;
                                                    setCheckoutTargets((previous) => ({
                                                        ...previous,
                                                        [targetPath]: nextBranch,
                                                    }));
                                                }}>
                                                <option value=''>Checkout branch...</option>
                                                {localBranches.map((entry: string) => (
                                                    <option key={`${targetPath}-${entry}`} value={entry}>
                                                        {entry}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                className='h-8'
                                                disabled={!checkoutTarget}
                                                onClick={() => {
                                                    if (!checkoutTarget) {
                                                        return;
                                                    }
                                                    checkoutMutation.mutate({
                                                        repo: targetPath,
                                                        ref: checkoutTarget,
                                                    });
                                                }}>
                                                Checkout
                                            </Button>
                                        </div>
                                        <div className='grid grid-cols-3 gap-1'>
                                            <Button size='sm' variant='outline' className='h-8' onClick={() => { void handleOpenWorktree(targetPath); }}>
                                                <FolderOpen className='mr-1 h-3.5 w-3.5' />
                                                Open
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                className='h-8'
                                                onClick={() => {
                                                    revealMutation.mutate({ path: targetPath });
                                                }}>
                                                <FolderOpen className='mr-1 h-3.5 w-3.5' />
                                                Reveal
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                className='h-8'
                                                onClick={() => {
                                                    void navigator.clipboard.writeText(targetPath);
                                                    toast.success('Path copied');
                                                }}>
                                                <Copy className='mr-1 h-3.5 w-3.5' />
                                                Copy
                                            </Button>
                                            {locked ? (
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    className='h-8'
                                                    onClick={() => {
                                                        unlockMutation.mutate({ repo: targetRepo, path: targetPath });
                                                    }}>
                                                    <Unlock className='mr-1 h-3.5 w-3.5' />
                                                    Unlock
                                                </Button>
                                            ) : (
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    className='h-8'
                                                    onClick={() => {
                                                        const reason = window.prompt('Lock reason (optional):', '') ?? '';
                                                        lockMutation.mutate({
                                                            repo: targetRepo,
                                                            path: targetPath,
                                                            reason: reason || undefined,
                                                        });
                                                    }}>
                                                    <Lock className='mr-1 h-3.5 w-3.5' />
                                                    Lock
                                                </Button>
                                            )}
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                className='h-8 text-destructive'
                                                onClick={() => {
                                                    handleRemove(targetPath, dirtyCount);
                                                }}
                                                disabled={isMain}>
                                                <Trash2 className='mr-1 h-3.5 w-3.5' />
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredWorktrees.length === 0 && (
                                <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
                                    No worktrees found
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value='create' className='space-y-3'>
                    <div className='grid gap-2'>
                        <label className='text-xs font-medium'>Mode</label>
                        <select
                            className='h-9 rounded-md border bg-background px-3 text-sm'
                            value={mode}
                            onChange={(event) => {
                                const nextMode = event.target.value as CreateMode;
                                setMode(nextMode);
                                persistViewPrefs({ defaultCreateMode: nextMode });
                            }}>
                            <option value='existing'>Existing branch checkout</option>
                            <option value='new-branch'>Create new branch from base</option>
                            <option value='detached'>Detached from commit/ref</option>
                            <option value='ephemeral-review'>Ephemeral review worktree</option>
                        </select>
                    </div>

                    <div className='grid gap-2'>
                        <label className='text-xs font-medium'>Path Preset Root</label>
                        <div className='flex gap-2'>
                            <Input
                                value={pathPresetRoot}
                                onChange={(event) => { setPathPresetRoot(event.target.value); }}
                                onBlur={() => {
                                    persistViewPrefs({ pathPresetRoot: pathPresetRoot.trim() || null });
                                }}
                                placeholder='/repos/worktrees'
                            />
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => {
                                    const branchSeed =
                                        mode === 'new-branch' || mode === 'ephemeral-review'
                                            ? newBranch || branch || baseRef || 'review'
                                            : branch || baseRef || 'worktree';
                                    const nextPath = buildPresetPath(branchSeed);
                                    setCreatePath(nextPath);
                                }}>
                                Apply Preset
                            </Button>
                        </div>
                    </div>

                    <div className='grid gap-2'>
                        <label className='text-xs font-medium'>Path</label>
                        <Input
                            value={createPath}
                            onChange={(event) => { setCreatePath(event.target.value); }}
                            placeholder='../feature-review'
                        />
                        {createPath && (
                            <p className={`text-xs ${validatePathQuery.data?.valid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {validatePathQuery.isFetching
                                    ? 'Validating path...'
                                    : validatePathQuery.data?.valid
                                      ? `Path OK (${validatePathQuery.data.exists ? 'existing directory' : 'new path'})`
                                      : validatePathQuery.data?.error ?? 'Invalid path'}
                            </p>
                        )}
                    </div>

                    {(mode === 'existing' || mode === 'new-branch') && (
                        <div className='grid gap-2'>
                            <label className='text-xs font-medium'>{mode === 'existing' ? 'Branch' : 'Base branch/ref'}</label>
                            <select
                                className='h-9 rounded-md border bg-background px-3 text-sm'
                                value={mode === 'existing' ? branch : baseRef}
                                onChange={(event) => {
                                    if (mode === 'existing') {
                                        setBranch(event.target.value);
                                        persistViewPrefs({ lastSelectedBranch: event.target.value || null });
                                    } else {
                                        setBaseRef(event.target.value);
                                    }
                                }}>
                                <option value=''>Select...</option>
                                <optgroup label='Local'>
                                    {localBranches.map((entry: string) => (
                                        <option key={entry} value={entry}>
                                            {entry}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label='Remote'>
                                    {remoteBranches.map((entry: string) => (
                                        <option key={entry} value={entry}>
                                            {entry}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    )}

                    {(mode === 'new-branch' || mode === 'ephemeral-review') && (
                        <div className='grid gap-2'>
                            <label className='text-xs font-medium'>New branch name</label>
                            <Input
                                value={newBranch}
                                onChange={(event) => { setNewBranch(event.target.value); }}
                                placeholder={mode === 'ephemeral-review' ? 'review/feature-123' : 'feature/my-change'}
                            />
                        </div>
                    )}

                    {(mode === 'detached' || mode === 'ephemeral-review') && (
                        <div className='grid gap-2'>
                            <label className='text-xs font-medium'>Commit or base ref</label>
                            <Input value={baseRef} onChange={(event) => { setBaseRef(event.target.value); }} placeholder='HEAD' />
                        </div>
                    )}

                    {mode === 'ephemeral-review' && (
                        <label className='flex items-center gap-2 text-sm'>
                            <input
                                type='checkbox'
                                checked={detachedEphemeral}
                                onChange={(event) => { setDetachedEphemeral(event.target.checked); }}
                            />
                            Detached review mode
                        </label>
                    )}

                    <Button onClick={handleCreate} disabled={!canCreate || pending}>
                        {addMutation.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Check className='mr-2 h-4 w-4' />}
                        Create Worktree
                    </Button>
                </TabsContent>

                <TabsContent value='cleanup' className='space-y-3'>
                    <div className='flex gap-2'>
                        <Button
                            variant='outline'
                            onClick={() => {
                                pruneMutation.mutate({ repo: targetRepo });
                            }}
                            disabled={pending}>
                            <Trash2 className='mr-2 h-4 w-4' />
                            Prune
                        </Button>
                        <Button
                            variant='outline'
                            onClick={() => {
                                repairMutation.mutate({ repo: targetRepo, runPrune: true });
                            }}
                            disabled={pending}>
                            <Wrench className='mr-2 h-4 w-4' />
                            Repair + Prune
                        </Button>
                    </div>
                    <div className='rounded-lg border p-3'>
                        <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
                            <AlertTriangle className='h-4 w-4 text-amber-500' />
                            Prune Preview
                        </div>
                        <ScrollArea className='h-52'>
                            <div className='space-y-1 text-xs'>
                                {((prunePreviewQuery.data?.entries ?? []) as string[]).map((entry: string) => (
                                    <p key={entry} className='text-muted-foreground'>
                                        {entry}
                                    </p>
                                ))}
                                {(prunePreviewQuery.data?.entries ?? []).length === 0 && (
                                    <p className='text-muted-foreground'>No stale entries detected.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    if (embedded) {
        return <div className='ui-surface h-full rounded-lg border p-3'>{body}</div>;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface max-w-4xl'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FolderGit2 className='h-5 w-5' />
                        Worktree Center
                    </DialogTitle>
                </DialogHeader>
                {body}
            </DialogContent>
        </Dialog>
    );
}

export default WorktreeCenter;

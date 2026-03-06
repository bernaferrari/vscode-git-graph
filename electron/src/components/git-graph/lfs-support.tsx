/**
 * LFS Support
 * Manage Git LFS tracking and files
 */

import {
    AlertCircle,
    Check,
    HardDrive,
    Loader2,
    Package,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface LFSSupportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface LfsTrackedFile {
    path: string;
    oid: string;
    sizeLabel?: string;
}

interface LfsSummary {
    trackedPatternCount?: number;
    trackedFileCount?: number;
    totalSizeLabel?: string;
    unknownSizeFileCount?: number;
}

interface LfsStatusResponse {
    installed: boolean;
    trackingPatterns?: string[];
    tracking?: string[];
    trackedFiles?: LfsTrackedFile[];
    summary?: LfsSummary;
}

interface QueryOptions {
    enabled: boolean;
}

interface QueryState<TData> {
    data?: TData;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
}

interface MutationCallbacks {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
}

interface MutationState<TInput> {
    mutate: (input: TInput) => void;
    isPending: boolean;
}

interface LfsApiShape {
    status: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<LfsStatusResponse>;
    };
    track: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; pattern: string }>;
    };
    untrack: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; pattern: string }>;
    };
    pull: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string }>;
    };
    push: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string }>;
    };
    prune: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string }>;
    };
}

interface TrpcClientShape {
    git: {
        lfs: LfsApiShape;
    };
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function LFSSupport({ open, onOpenChange }: LFSSupportProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const [newPattern, setNewPattern] = useState('');
    const repo = activeRepo ?? '';

    const { data: lfsStatus, isLoading, refetch } = typedTrpc.git.lfs.status.useQuery(
        { repo },
        { enabled: Boolean(activeRepo) && open }
    );

    const trackMutation = typedTrpc.git.lfs.track.useMutation({
        onSuccess: () => {
            toast.success('LFS tracking pattern added');
            setNewPattern('');
            void refetch();
        },
        onError: (error: unknown) => {
            toast.error('Failed to add tracking pattern', {
                description: getErrorMessage(error, 'Unable to add tracking pattern'),
            });
        },
    });

    const untrackMutation = typedTrpc.git.lfs.untrack.useMutation({
        onSuccess: () => {
            toast.success('LFS tracking pattern removed');
            void refetch();
        },
        onError: (error: unknown) => {
            toast.error('Failed to remove tracking pattern', {
                description: getErrorMessage(error, 'Unable to remove tracking pattern'),
            });
        },
    });

    const pullMutation = typedTrpc.git.lfs.pull.useMutation({
        onSuccess: () => {
            toast.success('LFS files pulled successfully');
        },
        onError: (error: unknown) => {
            toast.error('Failed to pull LFS files', {
                description: getErrorMessage(error, 'Unable to pull LFS files'),
            });
        },
    });

    const pushMutation = typedTrpc.git.lfs.push.useMutation({
        onSuccess: () => {
            toast.success('LFS files pushed successfully');
        },
        onError: (error: unknown) => {
            toast.error('Failed to push LFS files', {
                description: getErrorMessage(error, 'Unable to push LFS files'),
            });
        },
    });

    const pruneMutation = typedTrpc.git.lfs.prune.useMutation({
        onSuccess: () => {
            toast.success('LFS objects pruned successfully');
        },
        onError: (error: unknown) => {
            toast.error('Failed to prune LFS objects', {
                description: getErrorMessage(error, 'Unable to prune LFS objects'),
            });
        },
    });

    const handleAddPattern = () => {
        if (!newPattern.trim()) {
            return;
        }
        trackMutation.mutate({ repo, pattern: newPattern.trim() });
    };

    const handleRemovePattern = (pattern: string) => {
        untrackMutation.mutate({ repo, pattern });
    };

    const isInstalled = lfsStatus?.installed ?? false;
    const trackingPatterns = lfsStatus?.trackingPatterns ?? lfsStatus?.tracking ?? [];
    const trackedFiles = lfsStatus?.trackedFiles ?? [];
    const summary = lfsStatus?.summary;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Package className='h-5 w-5' />
                        Git LFS
                        {isInstalled ? (
                            <span className='rounded bg-green-100 px-1.5 py-0.5 text-xs font-normal text-green-700'>
                                Installed
                            </span>
                        ) : null}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className='flex items-center justify-center py-8'>
                        <Loader2 className='h-6 w-6 animate-spin' />
                    </div>
                ) : !isInstalled ? (
                    <div className='py-8 text-center'>
                        <AlertCircle className='mx-auto mb-4 h-12 w-12 text-amber-500' />
                        <h3 className='mb-2 font-medium'>Git LFS Not Installed</h3>
                        <p className='mb-4 text-sm text-muted-foreground'>
                            Install Git LFS to manage large files in your repository.
                        </p>
                        <a
                            href='https://git-lfs.github.com/'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-sm text-blue-600 hover:underline'>
                            Learn how to install Git LFS
                        </a>
                    </div>
                ) : (
                    <>
                        <div className='flex items-center gap-2 border-b pb-4'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pullMutation.mutate({ repo });
                                }}
                                disabled={pullMutation.isPending}>
                                {pullMutation.isPending ? (
                                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                                ) : (
                                    <Package className='mr-1 h-4 w-4' />
                                )}
                                Pull LFS
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pushMutation.mutate({ repo });
                                }}
                                disabled={pushMutation.isPending}>
                                {pushMutation.isPending ? (
                                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                                ) : (
                                    <Package className='mr-1 h-4 w-4' />
                                )}
                                Push LFS
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pruneMutation.mutate({ repo });
                                }}
                                disabled={pruneMutation.isPending}>
                                {pruneMutation.isPending ? (
                                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                                ) : (
                                    <Trash2 className='mr-1 h-4 w-4' />
                                )}
                                Prune
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                    void refetch();
                                }}>
                                <RefreshCw className='h-4 w-4' />
                            </Button>
                        </div>

                        <div className='grid grid-cols-2 gap-2 py-3 sm:grid-cols-4'>
                            <div className='rounded-md border bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Patterns</p>
                                <p className='text-sm font-semibold'>
                                    {summary?.trackedPatternCount ?? trackingPatterns.length}
                                </p>
                            </div>
                            <div className='rounded-md border bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Tracked files</p>
                                <p className='text-sm font-semibold'>
                                    {summary?.trackedFileCount ?? trackedFiles.length}
                                </p>
                            </div>
                            <div className='rounded-md border bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Known size</p>
                                <p className='text-sm font-semibold'>{summary?.totalSizeLabel ?? 'N/A'}</p>
                            </div>
                            <div className='rounded-md border bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Unknown size files</p>
                                <p className='text-sm font-semibold'>{summary?.unknownSizeFileCount ?? 0}</p>
                            </div>
                        </div>

                        <div className='flex items-center gap-2 py-3'>
                            <Input
                                placeholder='Add tracking pattern (e.g., *.psd)'
                                value={newPattern}
                                onChange={(event) => {
                                    setNewPattern(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        handleAddPattern();
                                    }
                                }}
                                className='flex-1'
                            />
                            <Button size='sm' onClick={handleAddPattern} disabled={!newPattern || trackMutation.isPending}>
                                {trackMutation.isPending ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <Plus className='h-4 w-4' />
                                )}
                            </Button>
                        </div>

                        <ScrollArea className='flex-1'>
                            <h4 className='mb-3 text-sm font-medium'>Tracking Patterns</h4>
                            {trackingPatterns.length === 0 ? (
                                <div className='py-4 text-center text-sm text-muted-foreground'>
                                    No LFS tracking patterns configured
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {trackingPatterns.map((pattern, index) => (
                                        <div
                                            key={`${pattern}-${String(index)}`}
                                            className='flex items-center justify-between rounded-lg bg-muted/50 p-2'>
                                            <code className='text-sm font-mono'>{pattern}</code>
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                className='h-7 w-7 p-0 text-red-600'
                                                onClick={() => {
                                                    handleRemovePattern(pattern);
                                                }}
                                                disabled={untrackMutation.isPending}>
                                                <Trash2 className='h-4 w-4' />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h4 className='mb-3 mt-6 text-sm font-medium'>Tracked LFS Files</h4>
                            {trackedFiles.length === 0 ? (
                                <div className='py-4 text-center text-sm text-muted-foreground'>
                                    No tracked LFS files yet
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {trackedFiles.map((file) => (
                                        <div
                                            key={`${file.path}-${file.oid}`}
                                            className='flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2 py-1.5'>
                                            <div className='min-w-0'>
                                                <p className='truncate text-xs font-mono'>{file.path}</p>
                                                <p className='text-[11px] text-muted-foreground'>
                                                    {file.sizeLabel ? file.sizeLabel : 'size unknown'}
                                                </p>
                                            </div>
                                            <HardDrive className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h4 className='mb-3 mt-6 text-sm font-medium'>Common Patterns</h4>
                            <div className='grid grid-cols-2 gap-2'>
                                {['*.psd', '*.ai', '*.zip', '*.mp4', '*.mov', '*.exe', '*.dll', '*.bin'].map(
                                    (pattern) => (
                                        <Button
                                            key={pattern}
                                            variant='outline'
                                            size='sm'
                                            className='justify-start font-mono'
                                            onClick={() => {
                                                setNewPattern(pattern);
                                                trackMutation.mutate({ repo, pattern });
                                            }}
                                            disabled={trackMutation.isPending}>
                                            <Plus className='mr-2 h-3 w-3' />
                                            {pattern}
                                        </Button>
                                    )
                                )}
                            </div>
                        </ScrollArea>

                        <div className='border-t pt-2 text-xs text-muted-foreground'>
                            <div className='flex items-center gap-1'>
                                <Check className='h-3.5 w-3.5 text-emerald-600' />
                                <span>
                                    LFS stores large files outside the Git repository for faster clones and fetches.
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default LFSSupport;

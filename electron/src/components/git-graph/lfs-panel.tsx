/**
 * LFS Management Panel
 */

import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface LFSPanelProps {
    repo: string;
}

interface LfsTrackedFile {
    path: string;
    oid: string;
    sizeLabel?: string;
}

interface LfsSummary {
    trackedFileCount?: number;
    totalSizeLabel?: string;
}

interface LfsStatusData {
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
}

interface MutationCallbacks {
    onSuccess?: () => void;
}

interface MutationState<TInput> {
    mutate: (input: TInput) => void;
    isPending: boolean;
}

interface InvalidateTarget {
    invalidate: () => Promise<unknown>;
}

interface TrpcUtilsShape {
    git: {
        lfs: {
            status: InvalidateTarget;
        };
    };
}

interface TrpcLfsShape {
    status: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<LfsStatusData>;
    };
    track: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; pattern: string }>;
    };
    untrack: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; pattern: string }>;
    };
    pull: {
        useMutation: () => MutationState<{ repo: string }>;
    };
    push: {
        useMutation: () => MutationState<{ repo: string }>;
    };
    prune: {
        useMutation: () => MutationState<{ repo: string }>;
    };
}

interface TrpcClientShape {
    useUtils: () => TrpcUtilsShape;
    git: {
        lfs: TrpcLfsShape;
    };
}

export function LFSPanel({ repo }: LFSPanelProps) {
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const utils = typedTrpc.useUtils();
    const { data: lfsStatus, isLoading } = typedTrpc.git.lfs.status.useQuery({ repo }, { enabled: Boolean(repo) });

    const trackMutation = typedTrpc.git.lfs.track.useMutation({
        onSuccess: () => {
            void utils.git.lfs.status.invalidate();
        },
    });

    const untrackMutation = typedTrpc.git.lfs.untrack.useMutation({
        onSuccess: () => {
            void utils.git.lfs.status.invalidate();
        },
    });

    const pullMutation = typedTrpc.git.lfs.pull.useMutation();
    const pushMutation = typedTrpc.git.lfs.push.useMutation();
    const pruneMutation = typedTrpc.git.lfs.prune.useMutation();

    const [pattern, setPattern] = useState('');

    const handleTrack = () => {
        if (!pattern.trim()) {
            return;
        }
        trackMutation.mutate({ repo, pattern: pattern.trim() });
        setPattern('');
    };

    const handleUntrack = (targetPattern: string) => {
        untrackMutation.mutate({ repo, pattern: targetPattern });
    };

    const isInstalled = lfsStatus?.installed ?? false;
    const tracking = lfsStatus?.trackingPatterns ?? lfsStatus?.tracking ?? [];
    const trackedFiles = lfsStatus?.trackedFiles ?? [];
    const summary = lfsStatus?.summary;

    if (isLoading) {
        return (
            <Card className='h-full'>
                <CardContent className='flex h-full items-center justify-center'>
                    <div className='h-6 w-6 animate-spin rounded-full border-b-2 border-primary' />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className='h-full'>
            <CardHeader className='pb-2'>
                <CardTitle className='flex items-center justify-between text-sm'>
                    <span>Git LFS</span>
                    <Badge variant={isInstalled ? 'default' : 'secondary'}>
                        {isInstalled ? 'Installed' : 'Not Installed'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                {!isInstalled ? (
                    <Alert>
                        <AlertDescription className='text-xs'>
                            Git LFS is not installed or not available. Install it to track large files.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pullMutation.mutate({ repo });
                                }}
                                disabled={pullMutation.isPending}>
                                {pullMutation.isPending ? 'Pulling...' : 'Pull LFS'}
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pushMutation.mutate({ repo });
                                }}
                                disabled={pushMutation.isPending}>
                                {pushMutation.isPending ? 'Pushing...' : 'Push LFS'}
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    pruneMutation.mutate({ repo });
                                }}
                                disabled={pruneMutation.isPending}>
                                Prune Old Files
                            </Button>
                        </div>

                        <div className='flex gap-2'>
                            <Input
                                value={pattern}
                                onChange={(event) => {
                                    setPattern(event.target.value);
                                }}
                                placeholder='*.psd, *.zip, etc.'
                                className='h-8'
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        handleTrack();
                                    }
                                }}
                            />
                            <Button size='sm' onClick={handleTrack} disabled={!pattern || trackMutation.isPending}>
                                Track
                            </Button>
                        </div>

                        <div className='space-y-1'>
                            <div className='text-xs font-medium text-muted-foreground'>
                                Tracked Patterns ({tracking.length})
                            </div>
                            <ScrollArea className='h-32'>
                                {tracking.length > 0 ? (
                                    <div className='space-y-1'>
                                        {tracking.map((trackedPattern) => (
                                            <div
                                                key={trackedPattern}
                                                className='flex items-center justify-between rounded p-1 text-xs hover:bg-accent'>
                                                <span className='truncate font-mono'>{trackedPattern}</span>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    className='h-5 px-1'
                                                    onClick={() => {
                                                        handleUntrack(trackedPattern);
                                                    }}>
                                                    Untrack
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className='py-4 text-center text-xs text-muted-foreground'>
                                        No LFS patterns configured
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        <div className='text-xs text-muted-foreground'>
                            Tracked files: {summary?.trackedFileCount ?? trackedFiles.length}
                            {summary?.totalSizeLabel ? ` • Size: ${summary.totalSizeLabel}` : ''}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

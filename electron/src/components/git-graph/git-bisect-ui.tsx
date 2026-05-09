/**
 * Git Bisect UI
 * Visual workflow for finding bugs using binary search
 */

import {
    AlertTriangle,
    Bug,
    Check,
    CheckCircle,
    Flag,
    GitBranch,
    Loader2,
    Play,
    RotateCcw,
    SkipForward,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface BisectLogEntry {
    type: 'good' | 'bad' | 'skip' | 'start' | 'reset' | 'found';
    commit: string;
    message: string;
    timestamp: number;
}

interface BisectState {
    isActive: boolean;
    badCommit: string | null;
    goodCommits: string[];
    currentCommit: string | null;
    remainingCommits: number;
    estimatedSteps: number;
    culprit: string | null;
    log: BisectLogEntry[];
}

interface CommitInfo {
    author: string;
    message: string;
}

interface BisectStepResult {
    nextCommit?: string | null;
    remaining?: number;
    steps?: number;
    culprit?: string | null;
}

interface BisectStatusResult {
    isActive: boolean;
    badCommit?: string | null;
    goodCommits?: string[];
    currentCommit?: string | null;
    remaining?: number;
    culprit?: string | null;
}

interface QueryOptions {
    enabled: boolean;
}

interface QueryState<TData> {
    data?: TData;
}

interface TrpcGitShape {
    commitInfo: {
        useQuery: (input: { repo: string; hash: string }, options: QueryOptions) => QueryState<CommitInfo>;
    };
    bisectStart: {
        mutate: (input: { repo: string }) => Promise<unknown>;
    };
    bisectGood: {
        mutate: (input: { repo: string; commit: string }) => Promise<BisectStepResult>;
    };
    bisectBad: {
        mutate: (input: { repo: string; commit: string }) => Promise<BisectStepResult>;
    };
    bisectSkip: {
        mutate: (input: { repo: string }) => Promise<BisectStepResult>;
    };
    bisectReset: {
        mutate: (input: { repo: string }) => Promise<unknown>;
    };
    bisectStatus: {
        query: (input: { repo: string }) => Promise<BisectStatusResult>;
    };
}

interface TrpcClientShape {
    git: TrpcGitShape;
}

interface GitBisectUIProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentCommitHash?: string;
}

const EMPTY_BISECT_STATE: BisectState = {
    isActive: false,
    badCommit: null,
    goodCommits: [],
    currentCommit: null,
    remainingCommits: 0,
    estimatedSteps: 0,
    culprit: null,
    log: [],
};

function shortHash(hash: string): string {
    return hash.slice(0, 7);
}

function safeMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function foundEntry(culprit: string | null | undefined): BisectLogEntry[] {
    if (!culprit) {
        return [];
    }
    return [
        {
            type: 'found',
            commit: culprit,
            message: `Found culprit: ${shortHash(culprit)}`,
            timestamp: Date.now(),
        },
    ];
}

export function GitBisectUI({ open, onOpenChange, currentCommitHash }: GitBisectUIProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const [isLoading, setIsLoading] = useState(false);
    const [bisectState, setBisectState] = useState<BisectState>(EMPTY_BISECT_STATE);
    const repo = activeRepo ?? '';

    const { data: currentCommitData } = typedTrpc.git.commitInfo.useQuery(
        { repo, hash: bisectState.currentCommit ?? '' },
        { enabled: Boolean(activeRepo) && Boolean(bisectState.currentCommit) }
    );

    const handleStartBisect = useCallback(async () => {
        if (!activeRepo || !currentCommitHash) {
            return;
        }

        setIsLoading(true);
        try {
            await typedTrpc.git.bisectStart.mutate({ repo: activeRepo });
            await typedTrpc.git.bisectBad.mutate({ repo: activeRepo, commit: currentCommitHash });

            setBisectState((previous) => ({
                ...previous,
                isActive: true,
                badCommit: currentCommitHash,
                currentCommit: currentCommitHash,
                log: [
                    ...previous.log,
                    {
                        type: 'start',
                        commit: currentCommitHash,
                        message: `Started bisect, marked ${shortHash(currentCommitHash)} as bad`,
                        timestamp: Date.now(),
                    },
                ],
            }));

            toast.success('Bisect started', {
                description: 'Mark a known-good commit to begin the search',
            });
        } catch (error) {
            toast.error('Failed to start bisect', {
                description: safeMessage(error, 'Unknown error while starting bisect'),
            });
        } finally {
            setIsLoading(false);
        }
    }, [activeRepo, currentCommitHash, typedTrpc.git.bisectBad, typedTrpc.git.bisectStart]);

    const handleMarkGood = useCallback(
        async (commit?: string) => {
            if (!activeRepo) {
                return;
            }

            const targetCommit = commit ?? bisectState.currentCommit;
            if (!targetCommit) {
                return;
            }

            setIsLoading(true);
            try {
                const result = await typedTrpc.git.bisectGood.mutate({ repo: activeRepo, commit: targetCommit });

                setBisectState((previous) => ({
                    ...previous,
                    goodCommits: [...previous.goodCommits, targetCommit],
                    currentCommit: result.nextCommit ?? null,
                    remainingCommits: result.remaining ?? 0,
                    estimatedSteps: result.steps ?? 0,
                    culprit: result.culprit ?? null,
                    log: [
                        ...previous.log,
                        {
                            type: 'good',
                            commit: targetCommit,
                            message: `Marked ${shortHash(targetCommit)} as good`,
                            timestamp: Date.now(),
                        },
                        ...foundEntry(result.culprit),
                    ],
                }));

                if (result.culprit) {
                    toast.success('Culprit found!', {
                        description: `Commit ${shortHash(result.culprit)} introduced the bug`,
                    });
                } else {
                    toast.success('Marked as good');
                }
            } catch (error) {
                toast.error('Failed to mark as good', {
                    description: safeMessage(error, 'Unable to mark this commit as good'),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [activeRepo, bisectState.currentCommit, typedTrpc.git.bisectGood]
    );

    const handleMarkBad = useCallback(
        async (commit?: string) => {
            if (!activeRepo) {
                return;
            }

            const targetCommit = commit ?? bisectState.currentCommit;
            if (!targetCommit) {
                return;
            }

            setIsLoading(true);
            try {
                const result = await typedTrpc.git.bisectBad.mutate({ repo: activeRepo, commit: targetCommit });

                setBisectState((previous) => ({
                    ...previous,
                    badCommit: targetCommit,
                    currentCommit: result.nextCommit ?? null,
                    remainingCommits: result.remaining ?? 0,
                    estimatedSteps: result.steps ?? 0,
                    culprit: result.culprit ?? null,
                    log: [
                        ...previous.log,
                        {
                            type: 'bad',
                            commit: targetCommit,
                            message: `Marked ${shortHash(targetCommit)} as bad`,
                            timestamp: Date.now(),
                        },
                        ...foundEntry(result.culprit),
                    ],
                }));

                if (result.culprit) {
                    toast.success('Culprit found!', {
                        description: `Commit ${shortHash(result.culprit)} introduced the bug`,
                    });
                } else {
                    toast.success('Marked as bad');
                }
            } catch (error) {
                toast.error('Failed to mark as bad', {
                    description: safeMessage(error, 'Unable to mark this commit as bad'),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [activeRepo, bisectState.currentCommit, typedTrpc.git.bisectBad]
    );

    const handleSkip = useCallback(async () => {
        if (!activeRepo || !bisectState.currentCommit) {
            return;
        }

        const currentCommit = bisectState.currentCommit;
        setIsLoading(true);
        try {
            const result = await typedTrpc.git.bisectSkip.mutate({ repo: activeRepo });

            setBisectState((previous) => ({
                ...previous,
                currentCommit: result.nextCommit ?? null,
                remainingCommits: result.remaining ?? 0,
                log: [
                    ...previous.log,
                    {
                        type: 'skip',
                        commit: currentCommit,
                        message: `Skipped ${shortHash(currentCommit)}`,
                        timestamp: Date.now(),
                    },
                ],
            }));

            toast.success('Skipped commit');
        } catch (error) {
            toast.error('Failed to skip', {
                description: safeMessage(error, 'Unable to skip this commit'),
            });
        } finally {
            setIsLoading(false);
        }
    }, [activeRepo, bisectState.currentCommit, typedTrpc.git.bisectSkip]);

    const handleReset = useCallback(async () => {
        if (!activeRepo) {
            return;
        }

        setIsLoading(true);
        try {
            await typedTrpc.git.bisectReset.mutate({ repo: activeRepo });
            setBisectState(EMPTY_BISECT_STATE);
            toast.success('Bisect reset');
        } catch (error) {
            toast.error('Failed to reset bisect', {
                description: safeMessage(error, 'Unable to reset bisect state'),
            });
        } finally {
            setIsLoading(false);
        }
    }, [activeRepo, typedTrpc.git.bisectReset]);

    useEffect(() => {
        if (!open || !activeRepo) {
            return;
        }

        const checkStatus = async () => {
            try {
                const status = await typedTrpc.git.bisectStatus.query({ repo: activeRepo });
                if (!status.isActive) {
                    return;
                }

                setBisectState((previous) => ({
                    ...previous,
                    isActive: true,
                    badCommit: status.badCommit ?? null,
                    goodCommits: status.goodCommits ?? [],
                    currentCommit: status.currentCommit ?? null,
                    remainingCommits: status.remaining ?? 0,
                    culprit: status.culprit ?? null,
                }));
            } catch {
                // No active bisect is an expected state.
            }
        };

        void checkStatus();
    }, [activeRepo, open, typedTrpc.git.bisectStatus]);

    const progress = useMemo(() => {
        if (bisectState.culprit) {
            return 100;
        }
        if (bisectState.estimatedSteps === 0) {
            return 0;
        }

        const testedSteps = bisectState.log.filter((entry) => entry.type === 'good' || entry.type === 'bad').length;
        return Math.min(99, Math.round((testedSteps / (testedSteps + bisectState.estimatedSteps)) * 100));
    }, [bisectState.culprit, bisectState.estimatedSteps, bisectState.log]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Bug className='h-5 w-5' />
                        Git Bisect
                        {bisectState.isActive ? (
                            <Badge variant='secondary' className='ml-2'>
                                Active
                            </Badge>
                        ) : null}
                    </DialogTitle>
                </DialogHeader>

                <div className='flex flex-1 flex-col gap-4 overflow-hidden'>
                    {bisectState.isActive ? (
                        <div className='rounded-lg bg-muted/50 p-4'>
                            <div className='mb-2 flex items-center justify-between'>
                                <span className='text-sm font-medium'>Progress</span>
                                <span className='text-sm text-muted-foreground'>
                                    ~{bisectState.estimatedSteps} steps remaining
                                </span>
                            </div>
                            <div className='h-2 overflow-hidden rounded-full bg-muted'>
                                <div className='h-full bg-primary transition-all' style={{ width: `${String(progress)}%` }} />
                            </div>
                        </div>
                    ) : null}

                    {bisectState.culprit ? (
                        <div className='rounded-lg border border-[color-mix(in_oklch,var(--success)_35%,transparent)] bg-[color-mix(in_oklch,var(--success)_15%,transparent)] p-4 dark:border-[color-mix(in_oklch,var(--success)_35%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_30%,transparent)]'>
                            <div className='flex items-center gap-3'>
                                <CheckCircle className='h-6 w-6 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
                                <div>
                                    <p className='font-medium text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>Culprit Found!</p>
                                    <p className='text-sm text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>
                                        Commit{' '}
                                        <code className='rounded bg-[color-mix(in_oklch,var(--success)_15%,transparent)] px-1 dark:bg-[color-mix(in_oklch,var(--success)_15%,transparent)]'>
                                            {shortHash(bisectState.culprit)}
                                        </code>{' '}
                                        introduced the bug
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {bisectState.isActive && bisectState.currentCommit && !bisectState.culprit ? (
                        <div className='rounded-lg border p-4'>
                            <div className='mb-3 flex items-center gap-2'>
                                <GitBranch className='h-4 w-4 text-muted-foreground' />
                                <span className='text-sm font-medium'>Current Commit to Test</span>
                            </div>

                            {currentCommitData ? (
                                <div className='mb-4 rounded bg-muted/50 p-3'>
                                    <div className='mb-1 flex items-center gap-2'>
                                        <code className='text-sm font-mono text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]'>
                                            {shortHash(bisectState.currentCommit)}
                                        </code>
                                        <span className='text-xs text-muted-foreground'>{currentCommitData.author}</span>
                                    </div>
                                    <p className='truncate text-sm'>{currentCommitData.message}</p>
                                </div>
                            ) : null}

                            <div className='flex items-center gap-2'>
                                <Button
                                    variant='outline'
                                    className='flex-1'
                                    onClick={() => {
                                        void handleMarkGood();
                                    }}
                                    disabled={isLoading}>
                                    {isLoading ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Check className='mr-2 h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
                                    )}
                                    Good
                                </Button>
                                <Button
                                    variant='outline'
                                    className='flex-1'
                                    onClick={() => {
                                        void handleMarkBad();
                                    }}
                                    disabled={isLoading}>
                                    {isLoading ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <X className='mr-2 h-4 w-4 text-destructive' />
                                    )}
                                    Bad
                                </Button>
                                <Button
                                    variant='ghost'
                                    onClick={() => {
                                        void handleSkip();
                                    }}
                                    disabled={isLoading}>
                                    <SkipForward className='h-4 w-4' />
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {!bisectState.isActive ? (
                        <div className='rounded-lg border p-6 text-center'>
                            <Bug className='mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50' />
                            <p className='mb-4 text-muted-foreground'>
                                Bisect uses binary search to find which commit introduced a bug.
                            </p>
                            <ol className='mb-6 space-y-2 text-left text-sm text-muted-foreground'>
                                <li className='flex items-start gap-2'>
                                    <span className='font-medium text-foreground'>1.</span>
                                    Start bisect from a commit with the bug
                                </li>
                                <li className='flex items-start gap-2'>
                                    <span className='font-medium text-foreground'>2.</span>
                                    Mark commits as &quot;good&quot; or &quot;bad&quot; after testing
                                </li>
                                <li className='flex items-start gap-2'>
                                    <span className='font-medium text-foreground'>3.</span>
                                    Git narrows down to the culprit commit
                                </li>
                            </ol>
                            <Button
                                onClick={() => {
                                    void handleStartBisect();
                                }}
                                disabled={isLoading}>
                                {isLoading ? (
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                ) : (
                                    <Play className='mr-2 h-4 w-4' />
                                )}
                                Start Bisect from Current Commit
                            </Button>
                        </div>
                    ) : null}

                    {bisectState.log.length > 0 ? (
                        <div className='overflow-hidden rounded-lg border'>
                            <div className='border-b bg-muted/50 px-3 py-2 text-sm font-medium'>Bisect Log</div>
                            <ScrollArea className='h-40'>
                                <div className='divide-y'>
                                    {bisectState.log.map((entry, index) => (
                                        <div
                                            key={String(index)}
                                            className={`flex items-center gap-3 px-3 py-2 ${
                                                entry.type === 'good'
                                                    ? 'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_20%,transparent)]'
                                                    : entry.type === 'bad'
                                                      ? 'bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--destructive)_20%,transparent)]'
                                                      : entry.type === 'found'
                                                        ? 'bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_20%,transparent)]'
                                                        : ''
                                            }`}>
                                            {entry.type === 'good' ? (
                                                <Check className='h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
                                            ) : entry.type === 'bad' ? (
                                                <X className='h-4 w-4 text-destructive' />
                                            ) : entry.type === 'skip' ? (
                                                <SkipForward className='h-4 w-4 text-muted-foreground' />
                                            ) : entry.type === 'start' ? (
                                                <Flag className='h-4 w-4 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]' />
                                            ) : entry.type === 'found' ? (
                                                <CheckCircle className='h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
                                            ) : null}
                                            <code className='text-xs font-mono text-muted-foreground'>
                                                {shortHash(entry.commit)}
                                            </code>
                                            <span className='flex-1 text-sm'>{entry.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : null}
                </div>

                <div className='flex items-center justify-between border-t pt-4'>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <AlertTriangle className='h-4 w-4' />
                        <span>Make sure to test the current commit before marking</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        {bisectState.isActive ? (
                            <Button
                                variant='outline'
                                onClick={() => {
                                    void handleReset();
                                }}
                                disabled={isLoading}>
                                <RotateCcw className='mr-2 h-4 w-4' />
                                Reset
                            </Button>
                        ) : null}
                        <Button
                            variant='ghost'
                            onClick={() => {
                                onOpenChange(false);
                            }}>
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default GitBisectUI;

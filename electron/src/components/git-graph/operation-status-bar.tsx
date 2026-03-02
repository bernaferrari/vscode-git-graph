/**
 * Operation Status Bar
 * Shows current git operation state (merge/rebase/cherry-pick/revert)
 * with abort/continue/skip buttons
 */

import { CheckCheck, FileText, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

interface GitOperationState {
    merging: boolean;
    rebasing: boolean;
    cherryPicking: boolean;
    reverting: boolean;
    bisecting: boolean;
    conflicts: string[];
}

interface OperationStatusBarProps {
    repo: string;
    onOpenRebaseTodo?: () => void;
    onOpenConflictFile?: (filePath: string) => void;
    onRevealConflictFile?: (filePath: string) => void;
    onOperationStateChange?: (state: GitOperationState | null) => void;
}

export function OperationStatusBar({
    repo,
    onOpenRebaseTodo,
    onOpenConflictFile,
    onRevealConflictFile,
    onOperationStateChange,
}: OperationStatusBarProps) {
    const utils = trpc.useUtils();
    const { data: opState } = trpc.git.operationState.useQuery({ repo }, { enabled: !!repo });

    const invalidateOperationState = () => {
        void Promise.allSettled([
            utils.git.operationState.invalidate(),
            utils.git.commits.invalidate(),
            utils.git.repoInfo.invalidate(),
            utils.git.workingDirectoryStatus.invalidate(),
        ]).catch((error) => {
            console.error('[operation-status] Failed to refresh operation state:', error);
        });
    };

    const handleMutationSuccess = (result: { error?: string | null } | undefined, actionLabel: string) => {
        if (result?.error) {
            toast.error(`${actionLabel} failed: ${result.error}`);
            return;
        }
        invalidateOperationState();
    };

    const handleMutationError = (actionLabel: string, error: unknown) => {
        const message = error instanceof Error ? error.message : `Failed to ${actionLabel}`;
        toast.error(message);
    };

    // Mutations
    const mergeAbort = trpc.git.mergeAbort.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Abort merge');
        },
        onError: (error) => {
            handleMutationError('abort merge', error);
        },
    });

    const mergeContinue = trpc.git.mergeContinue.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Continue merge');
        },
        onError: (error) => {
            handleMutationError('continue merge', error);
        },
    });

    const rebaseAbort = trpc.git.rebaseAbort.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Abort rebase');
        },
        onError: (error) => {
            handleMutationError('abort rebase', error);
        },
    });

    const rebaseContinue = trpc.git.rebaseContinue.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Continue rebase');
        },
        onError: (error) => {
            handleMutationError('continue rebase', error);
        },
    });

    const rebaseSkip = trpc.git.rebaseSkip.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Skip rebase commit');
        },
        onError: (error) => {
            handleMutationError('skip rebase commit', error);
        },
    });

    const cherryPickAbort = trpc.git.cherryPickAbort.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Abort cherry-pick');
        },
        onError: (error) => {
            handleMutationError('abort cherry-pick', error);
        },
    });

    const cherryPickContinue = trpc.git.cherryPickContinue.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Continue cherry-pick');
        },
        onError: (error) => {
            handleMutationError('continue cherry-pick', error);
        },
    });

    const cherryPickSkip = trpc.git.cherryPickSkip.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Skip cherry-pick commit');
        },
        onError: (error) => {
            handleMutationError('skip cherry-pick commit', error);
        },
    });

    const revertAbort = trpc.git.revertAbort.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Abort revert');
        },
        onError: (error) => {
            handleMutationError('abort revert', error);
        },
    });

    const revertContinue = trpc.git.revertContinue.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Continue revert');
        },
        onError: (error) => {
            handleMutationError('continue revert', error);
        },
    });

    const revertSkip = trpc.git.revertSkip.useMutation({
        onSuccess: (result) => {
            handleMutationSuccess(result, 'Skip revert commit');
        },
        onError: (error) => {
            handleMutationError('skip revert commit', error);
        },
    });
    const resolveConflict = trpc.git.resolveConflict.useMutation({
        onError: (error) => {
            handleMutationError('resolve conflict', error);
        },
    });

    const [showAbortConfirm, setShowAbortConfirm] = useState(false);
    const [abortAction, setAbortAction] = useState<(() => void) | null>(null);
    const [activeConflictIndex, setActiveConflictIndex] = useState(0);

    const state = opState?.state ?? null;
    useEffect(() => {
        onOperationStateChange?.(state);
    }, [state, onOperationStateChange]);

    useEffect(() => {
        if (!state?.conflicts?.length) {
            setActiveConflictIndex(0);
            return;
        }
        setActiveConflictIndex((current) => Math.min(current, state.conflicts.length - 1));
    }, [state?.conflicts]);

    if (!state) return null;

    const hasActiveOperation =
        state.merging || state.rebasing || state.cherryPicking || state.reverting || state.bisecting;
    if (!hasActiveOperation) return null;

    const hasConflicts = state.conflicts.length > 0;

    // Determine current operation type
    const operationType = state.merging
        ? 'merge'
        : state.rebasing
          ? 'rebase'
          : state.cherryPicking
            ? 'cherry-pick'
            : state.reverting
              ? 'revert'
              : state.bisecting
                ? 'bisect'
                : null;

    if (!operationType) return null;

    // Get appropriate handlers
    const handleAbort = () => {
        switch (operationType) {
            case 'merge':
                setAbortAction(() => () => mergeAbort.mutate({ repo }));
                break;
            case 'rebase':
                setAbortAction(() => () => rebaseAbort.mutate({ repo }));
                break;
            case 'cherry-pick':
                setAbortAction(() => () => cherryPickAbort.mutate({ repo }));
                break;
            case 'revert':
                setAbortAction(() => () => revertAbort.mutate({ repo }));
                break;
        }
        setShowAbortConfirm(true);
    };

    const handleContinue = () => {
        switch (operationType) {
            case 'merge':
                mergeContinue.mutate({ repo });
                break;
            case 'rebase':
                rebaseContinue.mutate({ repo });
                break;
            case 'cherry-pick':
                cherryPickContinue.mutate({ repo });
                break;
            case 'revert':
                revertContinue.mutate({ repo });
                break;
        }
    };

    const handleSkip = () => {
        switch (operationType) {
            case 'rebase':
                rebaseSkip.mutate({ repo });
                break;
            case 'cherry-pick':
                cherryPickSkip.mutate({ repo });
                break;
            case 'revert':
                revertSkip.mutate({ repo });
                break;
        }
    };

    const handleOpenRebaseTodo = () => {
        if (onOpenRebaseTodo && operationType === 'rebase') {
            onOpenRebaseTodo();
        }
    };

    const canSkip = operationType !== 'merge' && operationType !== 'bisect';
    const isLoading =
        mergeAbort.isPending ||
        mergeContinue.isPending ||
        rebaseAbort.isPending ||
        rebaseContinue.isPending ||
        rebaseSkip.isPending ||
        cherryPickAbort.isPending ||
        cherryPickContinue.isPending ||
        cherryPickSkip.isPending ||
        revertAbort.isPending ||
        revertContinue.isPending ||
        revertSkip.isPending ||
        resolveConflict.isPending;

    const handleOpenNextConflict = () => {
        if (!state.conflicts.length || !onOpenConflictFile) return;
        const index = Math.min(activeConflictIndex, state.conflicts.length - 1);
        const nextFile = state.conflicts[index];
        if (!nextFile) return;
        onOpenConflictFile(nextFile);
        setActiveConflictIndex((current) => Math.min(state.conflicts.length - 1, current + 1));
    };

    const handleResolveConflictFile = async (filePath: string, resolution: 'ours' | 'theirs') => {
        try {
            const result = await resolveConflict.mutateAsync({ repo, path: filePath, resolution });
            if (result.error) {
                toast.error(`Failed to resolve ${filePath}: ${result.error}`);
                return;
            }
            toast.success(`Resolved ${filePath} with ${resolution}`);
            invalidateOperationState();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to resolve ${filePath}`);
        }
    };

    const handleResolveAllConflicts = async (resolution: 'ours' | 'theirs') => {
        const files = state.conflicts;
        if (files.length === 0) return;

        let resolvedCount = 0;
        for (const file of files) {
            // Keep this sequential to avoid clobbering index/stage state while conflicts resolve.
            try {
                const result = await resolveConflict.mutateAsync({ repo, path: file, resolution });
                if (!result.error) {
                    resolvedCount++;
                }
            } catch {
                // keep processing other files
            }
        }

        if (resolvedCount === files.length) {
            toast.success(`Resolved ${resolvedCount} conflict files with ${resolution}`);
        } else {
            toast.error(`Resolved ${resolvedCount}/${files.length} conflicts with ${resolution}`);
        }
        invalidateOperationState();
    };

    const nextActionHint = hasConflicts
        ? `Resolve ${state.conflicts.length} conflict${state.conflicts.length === 1 ? '' : 's'} to continue ${operationType}.`
        : operationType === 'rebase'
          ? 'Continue rebase when your working tree is ready.'
          : operationType === 'cherry-pick'
            ? 'Continue cherry-pick to apply the next commit.'
            : operationType === 'revert'
              ? 'Continue revert to complete this operation.'
              : operationType === 'merge'
                ? 'Continue merge to finalize the merge commit.'
                : 'Finish the current operation to proceed.';

    return (
        <>
            <Card
                className={cn(
                    'border-2',
                    hasConflicts ? 'border-destructive bg-destructive/5' : 'border-yellow-500 bg-yellow-500/5'
                )}>
                <CardContent className='p-3'>
                    <div className='flex items-center justify-between gap-4'>
                        {/* Operation info */}
                        <div className='flex items-center gap-3'>
                            <Badge variant={hasConflicts ? 'destructive' : 'outline'} className='capitalize'>
                                {operationType} in progress
                            </Badge>

                            {hasConflicts && (
                                <span className='text-destructive text-sm'>
                                    {state.conflicts.length} conflict{state.conflicts.length !== 1 ? 's' : ''}
                                </span>
                            )}

                            {/* Conflicts list */}
                            {state.conflicts.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <Button variant='ghost' size='sm' className='h-6 px-2 text-xs'>
                                                View files
                                            </Button>
                                        }
                                    />
                                    <DropdownMenuContent align='start'>
                                        <ScrollArea className='max-h-48'>
                                            {state.conflicts.map((file) => (
                                                <div key={file} className='space-y-0.5'>
                                                    <DropdownMenuItem
                                                        className='flex items-center justify-between gap-2 px-2 py-1 font-mono text-xs'
                                                        onSelect={(event) => {
                                                            event.preventDefault();
                                                            onOpenConflictFile?.(file);
                                                        }}>
                                                        <span className='flex-1 truncate'>{file}</span>
                                                        <span className='text-muted-foreground flex shrink-0 items-center gap-1'>
                                                            <FileText className='h-3.5 w-3.5' />
                                                            Open
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className='text-muted-foreground flex items-center justify-between gap-2 px-2 py-1 text-xs'
                                                        onSelect={(event) => {
                                                            event.preventDefault();
                                                            void handleResolveConflictFile(file, 'ours');
                                                        }}>
                                                        <span className='truncate'>{`Resolve ${file} with ours`}</span>
                                                        <CheckCheck className='h-3.5 w-3.5' />
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className='text-muted-foreground flex items-center justify-between gap-2 px-2 py-1 text-xs'
                                                        onSelect={(event) => {
                                                            event.preventDefault();
                                                            void handleResolveConflictFile(file, 'theirs');
                                                        }}>
                                                        <span className='truncate'>{`Resolve ${file} with theirs`}</span>
                                                        <CheckCheck className='h-3.5 w-3.5' />
                                                    </DropdownMenuItem>
                                                    {onRevealConflictFile ? (
                                                        <DropdownMenuItem
                                                            className='text-muted-foreground flex items-center justify-between gap-2 px-2 py-1 text-xs'
                                                            onSelect={(event) => {
                                                                event.preventDefault();
                                                                onRevealConflictFile(file);
                                                            }}>
                                                            <span className='truncate'>{`Reveal ${file}`}</span>
                                                            <FolderOpen className='h-3.5 w-3.5' />
                                                        </DropdownMenuItem>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </ScrollArea>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>

                        {/* Actions */}
                        <div className='flex items-center gap-2'>
                            <span className='text-muted-foreground text-xs'>{nextActionHint}</span>

                            {hasConflicts && onOpenConflictFile && (
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={handleOpenNextConflict}
                                    disabled={isLoading}>
                                    Open next conflict
                                    <span className='text-muted-foreground ml-2 text-[10px] tabular-nums'>
                                        {Math.min(activeConflictIndex + 1, state.conflicts.length)}/
                                        {state.conflicts.length}
                                    </span>
                                </Button>
                            )}
                            {hasConflicts && (
                                <>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => void handleResolveAllConflicts('ours')}
                                        disabled={isLoading}>
                                        <CheckCheck className='mr-2 h-3.5 w-3.5' />
                                        Resolve all (ours)
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => void handleResolveAllConflicts('theirs')}
                                        disabled={isLoading}>
                                        <CheckCheck className='mr-2 h-3.5 w-3.5' />
                                        Resolve all (theirs)
                                    </Button>
                                </>
                            )}

                            {canSkip && (
                                <Button variant='outline' size='sm' onClick={handleSkip} disabled={isLoading}>
                                    Skip
                                </Button>
                            )}

                            {operationType === 'rebase' && (
                                <Button variant='outline' size='sm' onClick={handleOpenRebaseTodo} disabled={isLoading}>
                                    Edit todo list
                                </Button>
                            )}

                            <Button
                                variant='default'
                                size='sm'
                                onClick={handleContinue}
                                disabled={isLoading || hasConflicts}>
                                Continue
                            </Button>

                            <Button variant='destructive' size='sm' onClick={handleAbort} disabled={isLoading}>
                                Abort
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Abort confirmation dialog */}
            <AlertDialog open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Abort {operationType}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will cancel the current {operationType} operation and reset the repository to its
                            previous state. Any changes made during the {operationType} will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                abortAction?.();
                                setShowAbortConfirm(false);
                            }}
                            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                            Abort {operationType}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Operation Timeline Panel
 * Shows recent Git operations with undo capability
 */

import { formatDistanceToNow } from 'date-fns';
import {
    History,
    RotateCcw,
    GitCommit,
    GitBranch,
    Tag,
    Archive,
    Upload,
    Download,
    Merge,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Trash2,
    Loader2,
    X,
} from 'lucide-react';
import { isValidElement, useCallback, useState, type ReactElement } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
    useOperationLog,
    formatOperationDescription,
    getOperationStatusColor,
    type OperationReceipt,
} from '@/lib/operationLog';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';


const OPERATION_ICONS: Record<string, React.ElementType> = {
    commit: GitCommit,
    rebase: GitBranch,
    merge: Merge,
    'cherry-pick': GitCommit,
    revert: GitCommit,
    reset: RotateCcw,
    checkout: GitBranch,
    'branch-create': GitBranch,
    'branch-delete': GitBranch,
    'branch-rename': GitBranch,
    'tag-create': Tag,
    'tag-delete': Tag,
    stash: Archive,
    push: Upload,
    pull: Download,
    fetch: Download,
    'force-push': Upload,
    amend: GitCommit,
};

const SAFE_UNDO_ACTION_TYPES = new Set(['undo-last-commit', 'checkout', 'delete-branch']);

interface OperationTimelineProps {
    children?: ReactElement;
}

export function OperationTimeline({ children }: OperationTimelineProps) {
    const { operations, markAsUndone, clearOperations, getRecentOperations } = useOperationLog();
    const recentOps = getRecentOperations(20);
    const { activeRepo, operationQueue, cancelQueuedOperation } = useAppStore();
    const [undoingOperationId, setUndoingOperationId] = useState<string | null>(null);
    const utils = trpc.useUtils();

    const undoLastCommit = trpc.git.undoLastCommit.useMutation();
    const checkout = trpc.git.checkout.useMutation();
    const deleteBranch = trpc.git.deleteBranch.useMutation();

    const handleUndo = useCallback(
        async (operation: OperationReceipt) => {
            if (!activeRepo || !operation.undoAction) return;

            setUndoingOperationId(operation.id);
            try {
                switch (operation.undoAction.type) {
                    case 'undo-last-commit': {
                        const result = await undoLastCommit.mutateAsync({ repo: activeRepo, soft: true });
                        if (result.error) throw new Error(result.error);
                        break;
                    }
                    case 'checkout': {
                        const result = await checkout.mutateAsync({
                            repo: activeRepo,
                            ref: operation.undoAction.command,
                        });
                        if (result.error) throw new Error(result.error);
                        break;
                    }
                    case 'delete-branch': {
                        const result = await deleteBranch.mutateAsync({
                            repo: activeRepo,
                            branchName: operation.undoAction.command,
                            force: true,
                        });
                        if (result.error) throw new Error(result.error);
                        break;
                    }
                    default:
                        toast.info('Undo is not implemented for this operation yet.');
                        return;
                }

                markAsUndone(operation.id);
                await Promise.allSettled([
                    utils.git.repoInfo.invalidate(),
                    utils.git.commits.invalidate(),
                    utils.git.workingTreeStatus.invalidate(),
                    utils.git.workingDirectoryStatus.invalidate(),
                    utils.git.aheadBehind.invalidate(),
                    utils.git.aheadBehindAll.invalidate(),
                    utils.git.operationState.invalidate(),
                ]);
                toast.success('Operation undone');
            } catch (error) {
                toast.error('Failed to undo operation', {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                setUndoingOperationId(null);
            }
        },
        [
            activeRepo,
            checkout,
            deleteBranch,
            markAsUndone,
            undoLastCommit,
            utils.git.aheadBehind,
            utils.git.aheadBehindAll,
            utils.git.commits,
            utils.git.operationState,
            utils.git.repoInfo,
            utils.git.workingDirectoryStatus,
            utils.git.workingTreeStatus,
        ]
    );

    const triggerElement = isValidElement(children) ? (
        children
    ) : (
        <Button variant='ghost' size='sm' className='gap-1.5'>
            <History className='h-4 w-4' />
            <span className='hidden sm:inline'>History</span>
        </Button>
    );

    return (
        <Sheet>
            <SheetTrigger render={triggerElement} />
            <SheetContent className='w-80 sm:w-96'>
                <SheetHeader className='mb-4'>
                    <div className='flex items-center justify-between'>
                        <SheetTitle className='flex items-center gap-2'>
                            <History className='h-5 w-5' />
                            Operation History
                        </SheetTitle>
                        {operations.length > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={clearOperations}
                                className='text-muted-foreground'>
                                <Trash2 className='h-4 w-4' />
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <ScrollArea className='h-[calc(100vh-8rem)]'>
                    {operationQueue.length > 0 && (
                        <div className='mb-4 space-y-2'>
                            <div className='text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase'>
                                Operation Queue
                            </div>
                            {operationQueue.map((entry) => (
                                <div
                                    key={entry.id}
                                    className='bg-card flex items-center justify-between rounded-md border px-2.5 py-2'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium'>{entry.label}</div>
                                        <div className='text-muted-foreground text-xs'>
                                            {entry.status === 'running' ? 'Running' : 'Queued'}
                                        </div>
                                    </div>
                                    {entry.status === 'queued' ? (
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-7 w-7 p-0'
                                            onClick={() => { cancelQueuedOperation(entry.id); }}
                                            aria-label={`Cancel ${entry.label}`}>
                                            <X className='h-3.5 w-3.5' />
                                        </Button>
                                    ) : (
                                        <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {recentOps.length === 0 ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <History className='mx-auto mb-3 h-12 w-12 opacity-30' />
                            <p>No operations yet</p>
                            <p className='mt-1 text-xs'>Your Git actions will appear here</p>
                        </div>
                    ) : (
                        <div className='space-y-2'>
                            {recentOps.map((op) => (
                                <OperationItem
                                    key={op.id}
                                    operation={op}
                                    {...(op.undoAction &&
                                    SAFE_UNDO_ACTION_TYPES.has(op.undoAction.type) &&
                                    op.status === 'success'
                                        ? {
                                              onUndo: () => {
                                                  void handleUndo(op);
                                              },
                                          }
                                        : {})}
                                    isUndoing={undoingOperationId === op.id}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

interface OperationItemProps {
    operation: OperationReceipt;
    onUndo?: () => void;
    isUndoing?: boolean;
}

function OperationItem({ operation, onUndo, isUndoing = false }: OperationItemProps) {
    const Icon = OPERATION_ICONS[operation.type] || GitCommit;
    const statusColor = getOperationStatusColor(operation.status);

    const StatusIcon =
        operation.status === 'success' ? CheckCircle2 : operation.status === 'failed' ? XCircle : History;

    return (
        <div
            className={cn(
                'bg-card hover:bg-accent/50 rounded-lg border p-3 transition-colors',
                operation.status === 'undone' && 'opacity-60'
            )}>
            <div className='flex items-start gap-2'>
                <Icon className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
                <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-1.5'>
                        <span className={cn('text-sm font-medium', statusColor)}>
                            {formatOperationDescription(operation)}
                        </span>
                        <StatusIcon
                            className={cn(
                                'h-3.5 w-3.5',
                                operation.status === 'success' && 'text-green-500',
                                operation.status === 'failed' && 'text-red-500',
                                operation.status === 'undone' && 'text-muted-foreground'
                            )}
                        />
                    </div>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                        {formatDistanceToNow(operation.timestamp, { addSuffix: true })}
                    </p>
                    {operation.error && (
                        <p className='mt-1 flex items-center gap-1 text-xs text-red-500'>
                            <AlertCircle className='h-3 w-3' />
                            {operation.error}
                        </p>
                    )}
                    {operation.affectedBranches.length > 0 && (
                        <p className='text-muted-foreground mt-1 text-xs'>
                            Affected: {operation.affectedBranches.join(', ')}
                        </p>
                    )}
                </div>
                {onUndo && operation.status === 'success' && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onUndo}
                        className='h-7 shrink-0 px-2'
                        disabled={isUndoing}
                        title='Undo this operation'>
                        {isUndoing ? (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                        ) : (
                            <RotateCcw className='h-3.5 w-3.5' />
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

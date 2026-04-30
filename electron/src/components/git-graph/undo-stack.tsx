/**
 * Git Undo Stack UI
 */

import {
    AlertTriangle,
    Archive,
    Download,
    GitBranch,
    GitCommit,
    GitMerge,
    GitPullRequest,
    History,
    Loader2,
    Redo,
    RotateCcw,
    Trash2,
    Undo,
    Upload,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { useUndoStack } from './undo-stack-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

function getOperationIcon(type: string) {
    switch (type) {
        case 'commit':
        case 'amend':
            return <GitCommit className='h-4 w-4' />;
        case 'branch_create':
        case 'branch_delete':
        case 'branch_rename':
        case 'checkout':
            return <GitBranch className='h-4 w-4' />;
        case 'merge':
            return <GitMerge className='h-4 w-4' />;
        case 'cherry_pick':
        case 'revert':
            return <GitPullRequest className='h-4 w-4' />;
        case 'push':
            return <Upload className='h-4 w-4' />;
        case 'pull':
        case 'fetch':
            return <Download className='h-4 w-4' />;
        case 'stash_push':
        case 'stash_pop':
        case 'stash_drop':
        case 'tag_create':
        case 'tag_delete':
            return <Archive className='h-4 w-4' />;
        case 'reset':
        case 'clean':
            return <RotateCcw className='h-4 w-4' />;
        default:
            return <History className='h-4 w-4' />;
    }
}

function getOperationColor(type: string): string {
    switch (type) {
        case 'commit':
        case 'amend':
            return 'text-green-600 bg-green-100 dark:bg-green-900/30';
        case 'branch_create':
        case 'tag_create':
            return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
        case 'branch_delete':
        case 'tag_delete':
        case 'reset':
        case 'clean':
            return 'text-red-600 bg-red-100 dark:bg-red-900/30';
        case 'merge':
        case 'cherry_pick':
            return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
        case 'push':
            return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
        case 'pull':
        case 'fetch':
            return 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30';
        case 'stash_push':
        case 'stash_pop':
        case 'stash_drop':
            return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
        default:
            return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
}

export function UndoStackDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { operations, undoOperation, clearHistory, isUndoing } = useUndoStackDialog();

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${String(diffMins)}m ago`;
        if (diffHours < 24) return `${String(diffHours)}h ago`;
        if (diffDays < 7) return `${String(diffDays)}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[80vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <History className='h-5 w-5' />
                        Undo History
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className='flex-1'>
                    {operations.length === 0 ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <History className='mx-auto mb-4 h-12 w-12 opacity-30' />
                            <p>No operations in history</p>
                        </div>
                    ) : (
                        <div className='space-y-1'>
                            {operations.slice().reverse().map((operation) => (
                                <div
                                    key={operation.id}
                                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                                        operation.undone ? 'bg-muted/30 opacity-50' : 'hover:bg-accent/50'
                                    }`}>
                                    <div className={`rounded p-2 ${getOperationColor(operation.type)}`}>
                                        {getOperationIcon(operation.type)}
                                    </div>

                                    <div className='min-w-0 flex-1'>
                                        <div className='flex items-center gap-2'>
                                            <span className='font-medium capitalize'>
                                                {operation.type.replace(/_/g, ' ')}
                                            </span>
                                            {operation.undone && (
                                                <Badge variant='outline' className='text-xs'>
                                                    Undone
                                                </Badge>
                                            )}
                                        </div>
                                        <p className='text-muted-foreground truncate text-sm'>{operation.description}</p>
                                    </div>

                                    <div className='flex items-center gap-2'>
                                        <span className='text-muted-foreground text-xs'>
                                            {formatTime(operation.timestamp)}
                                        </span>
                                        {operation.undoable && !operation.undone && (
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                onClick={() => { void undoOperation(operation.id); }}
                                                disabled={isUndoing}>
                                                {isUndoing ? (
                                                    <Loader2 className='h-3 w-3 animate-spin' />
                                                ) : (
                                                    <Undo className='h-3 w-3' />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className='flex items-center justify-between border-t pt-4'>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                        <AlertTriangle className='h-4 w-4' />
                        <span>Some operations cannot be undone</span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button variant='outline' onClick={clearHistory}>
                            <Trash2 className='mr-2 h-4 w-4' />
                            Clear History
                        </Button>
                        <Button variant='ghost' onClick={() => { onOpenChange(false); }}>
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function useUndoStackDialog() {
    const { operations, undoOperation, clearHistory } = useUndoStack();
    const [isUndoing, setIsUndoing] = useState(false);

    const handleUndoOperation = useCallback(async (id: string) => {
        setIsUndoing(true);
        try {
            await undoOperation(id);
        } finally {
            setIsUndoing(false);
        }
    }, [undoOperation]);

    return {
        operations,
        undoOperation: handleUndoOperation,
        clearHistory,
        isUndoing,
    };
}

export function UndoRedoButtons() {
    const { canUndo, canRedo, undo, redo } = useUndoStack();
    const [isLoading, setIsLoading] = useState(false);

    const handleUndo = async () => {
        setIsLoading(true);
        try {
            await undo();
        } finally {
            setIsLoading(false);
        }
    };

    const handleRedo = async () => {
        setIsLoading(true);
        try {
            await redo();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='flex items-center gap-1'>
            <Button
                variant='ghost'
                size='sm'
                className='h-7 w-7 p-0'
                onClick={() => { void handleUndo(); }}
                disabled={!canUndo || isLoading}
                title='Undo (⌘Z)'>
                <Undo className='h-4 w-4' />
            </Button>
            <Button
                variant='ghost'
                size='sm'
                className='h-7 w-7 p-0'
                onClick={() => { void handleRedo(); }}
                disabled={!canRedo || isLoading}
                title='Redo (⌘⇧Z)'>
                <Redo className='h-4 w-4' />
            </Button>
        </div>
    );
}

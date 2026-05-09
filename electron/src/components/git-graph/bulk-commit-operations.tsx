/**
 * Bulk Commit Operations
 * Select multiple commits and perform batch actions
 */

import {
    CheckSquare,
    X,
    GitCommit,
    GitBranch,
    Copy,
    RotateCcw,
    MoreHorizontal,
    Loader2,
    Check,
    AlertTriangle,
    Plus,
    Minus,
} from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';


interface Commit {
    hash: string;
    message: string;
    author: string;
    date: number;
    parents: string[];
}

interface BulkOperationsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    commits: Commit[];
    onComplete?: () => void;
}

type BulkAction = 'cherry-pick' | 'revert' | 'copy-hash' | 'create-branch' | 'archive';

export function BulkCommitOperations({ open, onOpenChange, commits, onComplete }: BulkOperationsProps) {
    const { activeRepo } = useAppStore();
    const gitOps = useGitOperations();
    const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
    const [isExecuting, setIsExecuting] = useState(false);
    const [targetBranch, setTargetBranch] = useState('');
    const [showBranchInput, setShowBranchInput] = useState(false);

    // Reset selection when dialog opens
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setSelectedHashes(new Set());
            setShowBranchInput(false);
        }
        onOpenChange(newOpen);
    };

    // Toggle commit selection
    const toggleCommit = useCallback((hash: string) => {
        setSelectedHashes((prev) => {
            const next = new Set(prev);
            if (next.has(hash)) {
                next.delete(hash);
            } else {
                next.add(hash);
            }
            return next;
        });
    }, []);

    // Select all
    const selectAll = useCallback(() => {
        setSelectedHashes(new Set(commits.map((c) => c.hash)));
    }, [commits]);

    // Deselect all
    const deselectAll = useCallback(() => {
        setSelectedHashes(new Set());
    }, []);

    // Select range
    const selectRange = useCallback(
        (startHash: string, endHash: string) => {
            const startIndex = commits.findIndex((c) => c.hash === startHash);
            const endIndex = commits.findIndex((c) => c.hash === endHash);

            if (startIndex === -1 || endIndex === -1) return;

            const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
            const newSelection = new Set(selectedHashes);

            for (let i = from; i <= to; i++) {
                const commit = commits[i];
                if (commit) {
                    newSelection.add(commit.hash);
                }
            }

            setSelectedHashes(newSelection);
        },
        [commits, selectedHashes]
    );

    // Get selected commits in order
    const selectedCommits = useMemo(() => {
        return commits.filter((c) => selectedHashes.has(c.hash));
    }, [commits, selectedHashes]);

    // Execute bulk action
    const executeAction = useCallback(
        async (action: BulkAction) => {
            if (selectedHashes.size === 0) {
                toast.error('No commits selected');
                return;
            }
            if (!activeRepo) {
                toast.error('No active repository');
                return;
            }

            if (action === 'copy-hash') {
                const hashes = selectedCommits.map((c) => c.hash.slice(0, 7)).join('\n');
                void navigator.clipboard.writeText(hashes);
                toast.success(`Copied ${String(selectedHashes.size)} commit hashes`);
                return;
            }

            if (action === 'create-branch') {
                if (!targetBranch.trim()) {
                    setShowBranchInput(true);
                    return;
                }
            }

            setIsExecuting(true);

            try {
                const getMutationError = (result: unknown): string | null => {
                    if (!result || typeof result !== 'object') {
                        return null;
                    }
                    const typed = result as { error?: string | null; errors?: string[] };
                    if (typeof typed.error === 'string' && typed.error.length > 0) {
                        return typed.error;
                    }
                    if (Array.isArray(typed.errors) && typed.errors.length > 0) {
                        return typed.errors.join('\n');
                    }
                    return null;
                };

                switch (action) {
                    case 'cherry-pick': {
                        // Cherry-pick commits in order (oldest first)
                        const orderedCommits = [...selectedCommits].reverse();
                        for (const commit of orderedCommits) {
                            const result = await gitOps.cherryPick(commit.hash);
                            const error = getMutationError(result);
                            if (error) {
                                throw new Error(error);
                            }
                        }
                        toast.success(`Cherry-picked ${String(selectedHashes.size)} commits`);
                        break;
                    }

                    case 'revert':
                        // Revert commits in order (newest first for reverts)
                        for (const commit of selectedCommits) {
                            const result = await gitOps.revert(commit.hash);
                            const error = getMutationError(result);
                            if (error) {
                                throw new Error(error);
                            }
                        }
                        toast.success(`Reverted ${String(selectedHashes.size)} commits`);
                        break;

                    case 'create-branch':
                        if (selectedCommits.length > 0) {
                            const firstCommit = selectedCommits[0];
                            if (!firstCommit) break;
                            const createResult = await gitOps.createBranch(firstCommit.hash, targetBranch, true);
                            const createError = getMutationError(createResult);
                            if (createError) {
                                throw new Error(createError);
                            }

                            // Cherry-pick remaining commits
                            const remaining = selectedCommits.slice(1);
                            for (const commit of remaining) {
                                const result = await gitOps.cherryPick(commit.hash);
                                const error = getMutationError(result);
                                if (error) {
                                    throw new Error(error);
                                }
                            }
                            toast.success(`Created branch ${targetBranch} with ${String(selectedHashes.size)} commits`);
                        }
                        break;

                    default:
                        break;
                }

                setSelectedHashes(new Set());
                setShowBranchInput(false);
                onComplete?.();
                onOpenChange(false);
            } catch (error) {
                toast.error(`Failed to ${action}`, {
                    description: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                setIsExecuting(false);
            }
        },
        [activeRepo, gitOps, selectedCommits, selectedHashes, targetBranch, onComplete, onOpenChange]
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <CheckSquare className='h-5 w-5' />
                        Bulk Commit Operations
                        {selectedHashes.size > 0 && <Badge variant='secondary'>{selectedHashes.size} selected</Badge>}
                    </DialogTitle>
                </DialogHeader>

                {/* Toolbar */}
                <div className='flex items-center justify-between border-b pb-3'>
                    <div className='flex items-center gap-2'>
                        <Button variant='outline' size='sm' onClick={selectAll}>
                            <Plus className='mr-1 h-4 w-4' />
                            Select All
                        </Button>
                        <Button variant='outline' size='sm' onClick={deselectAll}>
                            <Minus className='mr-1 h-4 w-4' />
                            Deselect All
                        </Button>
                    </div>

                    <div className='flex items-center gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => { void executeAction('copy-hash'); }}
                            disabled={selectedHashes.size === 0}>
                            <Copy className='mr-1 h-4 w-4' />
                            Copy Hashes
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                disabled={selectedHashes.size === 0}
                                className='bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium'>
                                Actions
                                <MoreHorizontal className='ml-1 h-4 w-4' />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuItem onClick={() => { void executeAction('cherry-pick'); }}>
                                    <GitCommit className='mr-2 h-4 w-4' />
                                    Cherry-pick Selected
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { void executeAction('revert'); }}>
                                    <RotateCcw className='mr-2 h-4 w-4' />
                                    Revert Selected
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setShowBranchInput(true); }}>
                                    <GitBranch className='mr-2 h-4 w-4' />
                                    Create Branch with Selected
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Branch name input */}
                {showBranchInput && (
                    <div className='bg-muted/50 flex items-center gap-2 rounded-lg p-3'>
                        <GitBranch className='text-muted-foreground h-4 w-4' />
                        <input
                            type='text'
                            placeholder='New branch name...'
                            value={targetBranch}
                            onChange={(e) => { setTargetBranch(e.target.value); }}
                            className='flex-1 border-none bg-transparent text-sm outline-none'
                            autoFocus
                        />
                        <Button
                            size='sm'
                            onClick={() => { void executeAction('create-branch'); }}
                            disabled={!targetBranch.trim() || isExecuting}>
                            {isExecuting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => { setShowBranchInput(false); }}>
                            <X className='h-4 w-4' />
                        </Button>
                    </div>
                )}

                {/* Commit list */}
                <ScrollArea className='flex-1'>
                    <div className='space-y-1'>
                        {commits.map((commit, index) => {
                            const isSelected = selectedHashes.has(commit.hash);
                            const prevCommit = commits[index - 1];

                            return (
                                <div
                                    key={commit.hash}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors ${
                                        isSelected ? 'bg-primary/10 border-primary/30 border' : 'hover:bg-accent/50'
                                    }`}
                                    onClick={(e) => {
                                        if (e.shiftKey && prevCommit && selectedHashes.has(prevCommit.hash)) {
                                            selectRange(prevCommit.hash, commit.hash);
                                        } else {
                                            toggleCommit(commit.hash);
                                        }
                                    }}>
                                    <Checkbox checked={isSelected} className='pointer-events-none' />

                                    <code className='w-16 font-mono text-xs text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]'>
                                        {commit.hash.slice(0, 7)}
                                    </code>

                                    <span className='flex-1 truncate text-sm'>{commit.message.split('\n')[0]}</span>

                                    <span className='text-muted-foreground w-24 truncate text-xs'>{commit.author}</span>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className='flex items-center justify-between border-t pt-4'>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                        <AlertTriangle className='h-4 w-4' />
                        <span>Shift+Click to select range</span>
                    </div>
                    <Button variant='ghost' onClick={() => { handleOpenChange(false); }}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Mini button to open bulk operations
export function BulkOperationsButton({ onOpen }: { onOpen: () => void }) {
    return (
        <Button variant='ghost' size='sm' onClick={onOpen} title='Bulk operations'>
            <CheckSquare className='h-4 w-4' />
        </Button>
    );
}

export default BulkCommitOperations;

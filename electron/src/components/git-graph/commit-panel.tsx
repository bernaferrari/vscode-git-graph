/**
 * Commit Panel
 * Shows staging area and allows creating commits
 * Now with inline staging diff support
 */

import {
    GitCommit,
    Plus,
    Minus,
    FileText,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Archive,
    RefreshCw,
    Edit,
    ChevronUp,
    FolderTree,
    List,
    X,
} from 'lucide-react';
import { useState } from 'react';

import { InlineStagingDiff } from './inline-staging-diff';
import { LineStaging } from './line-staging';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface CommitPanelProps {
    onCommit?: () => void;
}

interface FileStatus {
    file: string;
    status: string;
}

export function CommitPanel({ onCommit }: CommitPanelProps) {
    const { activeRepo } = useAppStore();
    const gitOps = useGitOperations();
    const [message, setMessage] = useState('');
    const [expandedStaged, setExpandedStaged] = useState(true);
    const [expandedUnstaged, setExpandedUnstaged] = useState(true);
    const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
    const [selectedFile, setSelectedFile] = useState<{ path: string; status: string; staged: boolean } | null>(null);
    const [lineStagingOpen, setLineStagingOpen] = useState(false);

    // Get working tree status
    const { data: statusData, refetch: refetchStatus } = trpc.git.workingTreeStatus.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );

    const staged: FileStatus[] = statusData?.staged ?? [];
    const unstaged: FileStatus[] = statusData?.unstaged ?? [];

    // Auto-select all staged files
    const handleStageFile = async (file: string) => {
        try {
            await gitOps.stage([file]);
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleUnstageFile = async (file: string) => {
        try {
            await gitOps.unstage([file]);
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleStageAll = async () => {
        try {
            await gitOps.stage(unstaged.map((f) => f.file));
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleUnstageAll = async () => {
        try {
            await gitOps.unstage(staged.map((f) => f.file));
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleCommit = async (amend: boolean = false) => {
        if (!message.trim() && !amend) return;
        try {
            await gitOps.commit(message, amend);
            setMessage('');
            await refetchStatus();
            onCommit?.();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleStash = async () => {
        try {
            await gitOps.stashPush(message || undefined);
            setMessage('');
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    if (!activeRepo) return null;

    const hasChanges = unstaged.length > 0 || staged.length > 0;
    const canCommit = staged.length > 0 && message.trim().length > 0;
    const canAmend = staged.length > 0;
    const selectedFileScope = selectedFile?.staged ? 'Already staged' : 'Working tree';
    const commitReadiness =
        staged.length > 0
            ? `${String(staged.length)} file${staged.length === 1 ? '' : 's'} ready`
            : unstaged.length > 0
              ? 'Stage changes before committing'
              : 'No local changes';

    return (
        <div className='bg-muted/30 flex h-full flex-col border-t'>
            {/* Header */}
            <div className='flex items-center justify-between border-b px-3 py-2'>
                <span className='text-sm font-medium'>Commit</span>
                <div className='flex items-center gap-1'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                                size='sm'
                                className='h-6 w-6 p-0'
                                onClick={() => { setViewMode(viewMode === 'tree' ? 'flat' : 'tree'); }}>
                                {viewMode === 'tree' ? (
                                    <FolderTree className='h-3 w-3' />
                                ) : (
                                    <List className='h-3 w-3' />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {viewMode === 'tree' ? 'Switch to list view' : 'Switch to tree view'}
                        </TooltipContent>
                    </Tooltip>
                    <Button variant='ghost' size='sm' className='h-6 w-6 p-0' onClick={() => { void refetchStatus(); }}>
                        <span className='sr-only'>Refresh file status</span>
                        <RefreshCw className='h-3 w-3' />
                    </Button>
                </div>
            </div>

            <div className='border-b px-3 py-2'>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline' className='border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'>
                        <Plus className='h-3 w-3' />
                        {staged.length} staged
                    </Badge>
                    <Badge variant='outline' className='border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300'>
                        <Minus className='h-3 w-3' />
                        {unstaged.length} unstaged
                    </Badge>
                    <span className='text-muted-foreground text-xs'>{commitReadiness}</span>
                </div>
            </div>

            {/* File changes */}
            <ScrollArea className='min-h-0 flex-1'>
                <div className='p-2'>
                    {/* Staged files */}
                    {staged.length > 0 && (
                        <div className='mb-2'>
                            <button
                                onClick={() => { setExpandedStaged(!expandedStaged); }}
                                className='text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium'>
                                {expandedStaged ? (
                                    <ChevronDown className='h-3 w-3' />
                                ) : (
                                    <ChevronRight className='h-3 w-3' />
                                )}
                                <Plus className='h-3 w-3 text-green-600' />
                                <span>Staged ({staged.length})</span>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='ml-auto h-4 px-1 text-[10px]'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleUnstageAll();
                                    }}>
                                    Unstage All
                                </Button>
                            </button>
                            {expandedStaged && (
                                <div className='mt-1 space-y-0.5'>
                                    {staged.map((file) => (
                                        <FileItem
                                            key={file.file}
                                            file={file.file}
                                            status={file.status}
                                            staged={true}
                                            selected={selectedFile?.path === file.file}
                                            onToggle={() => { void handleUnstageFile(file.file); }}
                                            onClick={() =>
                                                { setSelectedFile({ path: file.file, status: file.status, staged: true }); }
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Unstaged files */}
                    {unstaged.length > 0 && (
                        <div className='mb-2'>
                            <button
                                onClick={() => { setExpandedUnstaged(!expandedUnstaged); }}
                                className='text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium'>
                                {expandedUnstaged ? (
                                    <ChevronDown className='h-3 w-3' />
                                ) : (
                                    <ChevronRight className='h-3 w-3' />
                                )}
                                <Minus className='h-3 w-3 text-amber-600' />
                                <span>Unstaged ({unstaged.length})</span>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='ml-auto h-4 px-1 text-[10px]'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleStageAll();
                                    }}>
                                    Stage All
                                </Button>
                            </button>
                            {expandedUnstaged && (
                                <div className='mt-1 space-y-0.5'>
                                    {unstaged.map((file) => (
                                        <FileItem
                                            key={file.file}
                                            file={file.file}
                                            status={file.status}
                                            staged={false}
                                            selected={selectedFile?.path === file.file}
                                            onToggle={() => { void handleStageFile(file.file); }}
                                            onClick={() =>
                                                { setSelectedFile({ path: file.file, status: file.status, staged: false }); }
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* No changes */}
                    {!hasChanges && (
                        <div className='text-muted-foreground py-8 text-center text-xs'>
                            <FileText className='mx-auto mb-2 h-8 w-8 opacity-30' />
                            <p>No changes to commit</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Inline Diff View */}
            {selectedFile && (
                <div className='flex h-64 flex-col border-t'>
                    <div className='bg-muted/50 flex items-center justify-between border-b px-2 py-1'>
                        <div className='flex min-w-0 items-center gap-2'>
                            <span className='truncate text-xs font-medium'>{selectedFile.path}</span>
                            <Badge variant='outline' className='h-5 text-[10px]'>
                                {selectedFileScope}
                            </Badge>
                        </div>
                        <div className='flex items-center gap-1'>
                            {!selectedFile.staged && selectedFile.status !== '?' && (
                                <Button
                                    variant='outline'
                                    size='sm'
                                    className='h-6 px-2 text-xs'
                                    onClick={() => { setLineStagingOpen(true); }}>
                                    Stage Lines
                                </Button>
                            )}
                            <Button variant='ghost' size='sm' className='h-5 w-5 p-0' onClick={() => { setSelectedFile(null); }}>
                                <span className='sr-only'>Close inline diff</span>
                                <X className='h-3 w-3' />
                            </Button>
                        </div>
                    </div>
                    <div className='flex-1 overflow-hidden'>
                        <InlineStagingDiff
                            filePath={selectedFile.path}
                            fileStatus={selectedFile.status}
                            onStaged={() => { void refetchStatus(); }}
                        />
                    </div>
                </div>
            )}

            {selectedFile && (
                <LineStaging
                    open={lineStagingOpen}
                    onOpenChange={setLineStagingOpen}
                    filePath={selectedFile.path}
                    onStaged={() => { void refetchStatus(); }}
                />
            )}

            {/* Commit message and actions */}
            <div className='space-y-2 border-t p-2'>
                <Textarea
                    placeholder='Commit message...'
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); }}
                    className='min-h-[60px] resize-none text-sm'
                    disabled={!hasChanges}
                />

                <div className='flex items-center gap-2'>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size='sm' className='flex-1' disabled={!canCommit}>
                                <GitCommit className='mr-1 h-4 w-4' />
                                Commit
                                <ChevronUp className='ml-1 h-3 w-3' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start' className='w-40'>
                            <DropdownMenuItem onClick={() => { void handleCommit(false); }} disabled={!canCommit}>
                                <GitCommit className='mr-2 h-4 w-4' />
                                New Commit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { void handleCommit(true); }} disabled={!canAmend}>
                                <Edit className='mr-2 h-4 w-4' />
                                Amend HEAD
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={!hasChanges}
                        onClick={() => { void handleStash(); }}
                        aria-label='Stash current changes'
                        title='Stash changes'>
                        <Archive className='h-4 w-4' />
                    </Button>
                </div>
                <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-[11px]'>
                    <span>Primary action creates a new commit from staged files.</span>
                    <span>Use Amend HEAD only when replacing the previous commit.</span>
                </div>
            </div>
        </div>
    );
}

// File item component
function FileItem({
    file,
    status,
    staged,
    selected,
    onToggle,
    onClick,
}: {
    file: string;
    status: string;
    staged: boolean;
    selected?: boolean;
    onToggle: () => void;
    onClick: () => void;
}) {
    const getStatusIcon = () => {
        switch (status) {
            case 'A':
                return <Plus className='h-3 w-3 text-green-600' />;
            case 'D':
                return <Minus className='h-3 w-3 text-red-600' />;
            case 'R':
                return <RotateCcw className='h-3 w-3 text-amber-600' />;
            default:
                return <FileText className='text-muted-foreground h-3 w-3' />;
        }
    };

    return (
        <div
            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-0.5 ${
                selected ? 'bg-accent' : 'hover:bg-accent/50'
            }`}
            onClick={onClick}
            onDoubleClick={onToggle}>
            <Checkbox
                checked={staged}
                className='h-3 w-3'
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
            />
            {getStatusIcon()}
            <span className='flex-1 truncate text-xs' title={file}>
                {file}
            </span>
        </div>
    );
}

/**
 * Quick Actions Toolbar
 * Common git actions in a compact toolbar
 */

import { Upload, Download, RefreshCw, GitBranch, Tag, Archive, Loader2, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface QuickActionsToolbarProps {
    className?: string;
    onCreateBranch?: () => void;
    onCreateTag?: () => void;
    onStash?: () => void;
}

export function QuickActionsToolbar({ className, onCreateBranch, onCreateTag, onStash }: QuickActionsToolbarProps) {
    const { activeRepo } = useAppStore();
    const gitOps = useGitOperations();
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);

    // Get working tree status
    const { data: statusData, refetch: refetchStatus } = trpc.git.workingTreeStatus.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );
    const { data: repoInfo } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: false,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo }
    );
    const currentBranch = repoInfo?.head ?? undefined;

    // Get ahead/behind
    const { data: aheadBehindData, refetch: refetchAheadBehind } = trpc.git.aheadBehind.useQuery(
        { repo: activeRepo ?? '', branch: currentBranch },
        { enabled: !!activeRepo && !!currentBranch }
    );

    const stagedCount = statusData?.staged?.length ?? 0;
    const ahead = aheadBehindData?.ahead ?? 0;
    const behind = aheadBehindData?.behind ?? 0;

    const handleQuickCommit = async () => {
        if (!commitMessage.trim()) {
            toast.error('Please enter a commit message');
            return;
        }

        setIsCommitting(true);
        try {
            await gitOps.commit(commitMessage);
            setCommitMessage('');
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        } finally {
            setIsCommitting(false);
        }
    };

    const handleQuickPush = async () => {
        if (!currentBranch) {
            toast.error('No current branch to push');
            return;
        }
        try {
            await gitOps.push(currentBranch, 'origin', true, false);
            await Promise.allSettled([refetchAheadBehind(), refetchStatus()]);
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleQuickPull = async () => {
        if (!currentBranch) {
            toast.error('No current branch to pull');
            return;
        }
        try {
            await gitOps.pull(currentBranch, 'origin', false, false);
            await Promise.allSettled([refetchAheadBehind(), refetchStatus()]);
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleQuickPullFastForwardOnly = async () => {
        if (!currentBranch) {
            toast.error('No current branch to pull');
            return;
        }
        try {
            await gitOps.pull(currentBranch, 'origin', false, true);
            await Promise.allSettled([refetchAheadBehind(), refetchStatus()]);
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleQuickFetch = async () => {
        try {
            await gitOps.fetch();
            await Promise.allSettled([refetchAheadBehind(), refetchStatus()]);
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    return (
        <div className={`bg-background flex items-center gap-2 border-b p-2 ${className || ''}`}>
            {/* Quick commit */}
            <div className='flex max-w-md flex-1 items-center gap-2'>
                <Input
                    placeholder='Commit message...'
                    value={commitMessage}
                    onChange={(e) => { setCommitMessage(e.target.value); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickCommit()}
                    className='h-8 text-sm'
                    disabled={!activeRepo || stagedCount === 0}
                />
                <Button
                    size='sm'
                    className='h-8'
                    onClick={handleQuickCommit}
                    disabled={!activeRepo || stagedCount === 0 || isCommitting}
                    aria-label='Create commit'
                    title={`Commit (${stagedCount} staged)`}>
                    {isCommitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
                </Button>
            </div>

            {/* Divider */}
            <div className='bg-border mx-2 h-6 w-px' />

            {/* Sync actions */}
            <div className='flex items-center gap-1'>
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0'
                    onClick={handleQuickFetch}
                    disabled={!activeRepo}
                    aria-label='Fetch from remote'
                    title='Fetch'>
                    <RefreshCw className='h-4 w-4' />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 px-2'
                            disabled={!activeRepo || behind === 0}
                            aria-label='Pull from remote'
                            title={`Pull (${behind} behind)`}>
                            <Download className='h-4 w-4' />
                            {behind > 0 && <span className='ml-1 text-xs'>{behind}</span>}
                            <ChevronDown className='ml-1 h-3 w-3' />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start'>
                        <DropdownMenuItem onClick={handleQuickPull}>
                            <Download className='mr-2 h-4 w-4' />
                            Pull
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleQuickPullFastForwardOnly}>
                            <Download className='mr-2 h-4 w-4 text-emerald-600' />
                            Pull (Fast-forward only)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 px-2'
                    onClick={handleQuickPush}
                    disabled={!activeRepo || ahead === 0}
                    aria-label='Push to remote'
                    title={`Push (${ahead} ahead)`}>
                    <Upload className='h-4 w-4' />
                    {ahead > 0 && <span className='ml-1 text-xs'>{ahead}</span>}
                </Button>
            </div>

            {/* Divider */}
            <div className='bg-border mx-2 h-6 w-px' />

            {/* Create actions */}
            <div className='flex items-center gap-1'>
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0'
                    onClick={onCreateBranch}
                    disabled={!activeRepo}
                    aria-label='Create branch'
                    title='Create Branch'>
                    <GitBranch className='h-4 w-4' />
                </Button>

                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0'
                    onClick={onCreateTag}
                    disabled={!activeRepo}
                    aria-label='Create tag'
                    title='Create Tag'>
                    <Tag className='h-4 w-4' />
                </Button>

                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0'
                    onClick={onStash}
                    disabled={!activeRepo}
                    aria-label='Stash changes'
                    title='Stash Changes'>
                    <Archive className='h-4 w-4' />
                </Button>
            </div>
        </div>
    );
}

export default QuickActionsToolbar;

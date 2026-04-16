/**
 * Status Bar
 * Show repository status, branch info, and quick actions at bottom
 */

import { GitBranch, RefreshCw, AlertCircle, Check, Upload, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

interface StatusBarProps {
    className?: string;
    onFetch?: () => void;
    onPush?: () => void;
    onPull?: () => void;
}

export function StatusBar({ className, onFetch, onPush, onPull }: StatusBarProps) {
    const { activeRepo } = useAppStore();

    // Get working tree status
    const { data: statusData, isLoading: statusLoading } = trpc.git.workingTreeStatus.useQuery(
        { repo: activeRepo ?? '' },
        {
            enabled: !!activeRepo,
        }
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
    const { data: workingDirStatus } = trpc.git.workingDirectoryStatus.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );
    const currentBranch = repoInfo?.head ?? undefined;

    // Get ahead/behind info
    const { data: aheadBehindData } = trpc.git.aheadBehind.useQuery(
        { repo: activeRepo ?? '', branch: currentBranch },
        { enabled: !!activeRepo && !!currentBranch }
    );

    // Get file counts
    const stagedCount = statusData?.staged?.length ?? 0;
    const unstagedCount = statusData?.unstaged?.length ?? 0;
    const untrackedCount = statusData?.unstaged?.filter((f: { status: string }) => f.status === 'U').length ?? 0;
    const conflictedCount: number = workingDirStatus?.conflicted?.length ?? 0;

    const ahead = aheadBehindData?.ahead ?? 0;
    const behind = aheadBehindData?.behind ?? 0;

    if (!activeRepo) {
        return (
            <div className={cn('ui-status-bar text-muted-foreground flex h-6 items-center px-3 text-xs', className)}>
                <span>No repository open</span>
            </div>
        );
    }

    return (
        <div className={cn('ui-status-bar flex h-6 items-center justify-between px-3 text-xs', className)}>
            {/* Left side - Branch and status */}
            <div className='flex items-center gap-3'>
                {/* Branch */}
                <div className='flex items-center gap-1.5'>
                    <GitBranch className='text-muted-foreground h-3 w-3' />
                    <span className='font-medium'>{currentBranch || 'detached'}</span>
                </div>

                {/* Sync status */}
                {statusLoading ? (
                    <Loader2 className='text-muted-foreground h-3 w-3 animate-spin' />
                ) : (
                    <div className='flex items-center gap-2'>
                        {ahead > 0 && (
                            <span className='flex items-center gap-1 text-green-600'>
                                <Upload className='h-3 w-3' />
                                {ahead}
                            </span>
                        )}
                        {behind > 0 && (
                            <span className='flex items-center gap-1 text-blue-600'>
                                <Download className='h-3 w-3' />
                                {behind}
                            </span>
                        )}
                        {ahead === 0 && behind === 0 && (
                            <span className='text-muted-foreground flex items-center gap-1'>
                                <Check className='h-3 w-3' />
                                Synced
                            </span>
                        )}
                    </div>
                )}

                {/* File status */}
                {(stagedCount > 0 || unstagedCount > 0 || untrackedCount > 0 || conflictedCount > 0) && (
                    <div className='flex items-center gap-2'>
                        {conflictedCount > 0 && (
                            <span className='flex items-center gap-1 text-red-600'>
                                <AlertCircle className='h-3 w-3' />
                                {conflictedCount} conflict{conflictedCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        {stagedCount > 0 && <span className='text-green-600'>+{stagedCount} staged</span>}
                        {unstagedCount > 0 && <span className='text-amber-600'>~{unstagedCount} modified</span>}
                        {untrackedCount > 0 && (
                            <span className='text-muted-foreground'>?{untrackedCount} untracked</span>
                        )}
                    </div>
                )}
            </div>

            {/* Right side - Quick actions and info */}
            <div className='flex items-center gap-3'>
                {/* Quick sync buttons */}
                <div className='flex items-center gap-1'>
                    {behind > 0 && (
                        <Button variant='ghost' size='sm' className='h-5 px-1.5 text-xs' onClick={onPull}>
                            <Download className='mr-1 h-3 w-3' />
                            Pull
                        </Button>
                    )}
                    {ahead > 0 && (
                        <Button variant='ghost' size='sm' className='h-5 px-1.5 text-xs' onClick={onPush}>
                            <Upload className='mr-1 h-3 w-3' />
                            Push
                        </Button>
                    )}
                    <Button variant='ghost' size='sm' className='h-5 px-1.5 text-xs' onClick={onFetch}>
                        <RefreshCw className='h-3 w-3' />
                    </Button>
                </div>

                {/* Repository name */}
                <span className='text-muted-foreground max-w-[200px] truncate'>{activeRepo.split('/').pop()}</span>
            </div>
        </div>
    );
}

export default StatusBar;

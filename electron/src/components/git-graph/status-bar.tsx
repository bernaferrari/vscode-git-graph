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
    const stagedCount = statusData?.staged.length ?? 0;
    const unstagedCount = statusData?.unstaged.length ?? 0;
    const untrackedCount = statusData?.unstaged.filter((f: { status: string }) => f.status === 'U').length ?? 0;
    const conflictedCount: number = workingDirStatus?.conflicted.length ?? 0;

    const ahead = aheadBehindData?.ahead ?? 0;
    const behind = aheadBehindData?.behind ?? 0;
    const stateMessage =
        conflictedCount > 0
            ? `${String(conflictedCount)} conflict${conflictedCount === 1 ? '' : 's'} need resolution`
            : stagedCount > 0 && unstagedCount > 0
              ? `${String(stagedCount)} staged, ${String(unstagedCount)} still outside the next commit`
              : stagedCount > 0
                ? `${String(stagedCount)} staged and ready to commit`
                : unstagedCount > 0
                  ? `${String(unstagedCount)} unstaged change${unstagedCount === 1 ? '' : 's'}`
                  : ahead > 0 && behind > 0
                    ? `Sync required: push ${String(ahead)}, pull ${String(behind)}`
                    : ahead > 0
                      ? `${String(ahead)} commit${ahead === 1 ? '' : 's'} ready to push`
                      : behind > 0
                        ? `Pull ${String(behind)} incoming commit${behind === 1 ? '' : 's'}`
                        : 'Working tree clean';

    if (!activeRepo) {
        return (
            <div className={cn('ui-status-bar flex h-6 items-center px-3 text-xs text-muted-foreground/85', className)}>
                <span>No repository open</span>
            </div>
        );
    }

    const detached = !currentBranch;
    const isClean = stagedCount === 0 && unstagedCount === 0 && untrackedCount === 0 && conflictedCount === 0;

    return (
        <div className={cn('ui-status-bar flex h-6 items-center justify-between px-3 text-xs', className)}>
            {/* Left side - Branch and status */}
            <div className='flex items-center gap-3'>
                {/* Branch */}
                <div
                    className='flex items-center gap-1.5'
                    title={detached ? 'HEAD is detached — not on a branch' : `On branch ${currentBranch ?? ''}`}>
                    <GitBranch className={cn('h-3 w-3', detached ? 'text-warning' : 'text-muted-foreground')} />
                    <span className={cn('font-medium tabular-nums', detached && 'italic text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]')}>
                        {currentBranch ?? 'detached HEAD'}
                    </span>
                </div>

                {/* Sync status */}
                {statusLoading ? (
                    <Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />
                ) : (
                    <div className='flex items-center gap-2 tabular-nums'>
                        {ahead > 0 && (
                            <span
                                title={`${String(ahead)} commit${ahead === 1 ? '' : 's'} to push`}
                                className='flex items-center gap-1 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>
                                <Upload className='h-3 w-3' />
                                {ahead}
                            </span>
                        )}
                        {behind > 0 && (
                            <span
                                title={`${String(behind)} commit${behind === 1 ? '' : 's'} to pull`}
                                className='flex items-center gap-1 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]'>
                                <Download className='h-3 w-3' />
                                {behind}
                            </span>
                        )}
                        {ahead === 0 && behind === 0 && (
                            <span className='flex items-center gap-1 text-muted-foreground'>
                                <Check className='h-3 w-3' />
                                Synced
                            </span>
                        )}
                    </div>
                )}

                {/* File status */}
                {!isClean && (
                    <div className='flex items-center gap-2 tabular-nums'>
                        {conflictedCount > 0 && (
                            <span
                                title={`${String(conflictedCount)} conflicted file${conflictedCount === 1 ? '' : 's'} — resolve in the diff editor`}
                                className='flex items-center gap-1 text-destructive'>
                                <AlertCircle className='h-3 w-3' />
                                {conflictedCount} conflict{conflictedCount === 1 ? '' : 's'}
                            </span>
                        )}
                        {stagedCount > 0 && (
                            <span
                                title={`${String(stagedCount)} staged change${stagedCount === 1 ? '' : 's'}`}
                                className='flex items-center gap-1 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>
                                <span aria-hidden className='inline-block h-1.5 w-1.5 rounded-full bg-current' />
                                {stagedCount} staged
                            </span>
                        )}
                        {unstagedCount > 0 && (
                            <span
                                title={`${String(unstagedCount)} modified file${unstagedCount === 1 ? '' : 's'} not yet staged`}
                                className='flex items-center gap-1 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
                                <span aria-hidden className='inline-block h-1.5 w-1.5 rounded-full bg-current' />
                                {unstagedCount} modified
                            </span>
                        )}
                        {untrackedCount > 0 && (
                            <span
                                title={`${String(untrackedCount)} untracked file${untrackedCount === 1 ? '' : 's'}`}
                                className='flex items-center gap-1 text-muted-foreground'>
                                <span aria-hidden className='inline-block h-1.5 w-1.5 rounded-full bg-current opacity-65' />
                                {untrackedCount} untracked
                            </span>
                        )}
                    </div>
                )}
                <span className='hidden text-muted-foreground/85 lg:inline'>{stateMessage}</span>
            </div>

            {/* Right side - Quick actions and info */}
            <div className='flex items-center gap-3'>
                {/* Quick sync buttons */}
                <div className='flex items-center gap-1'>
                    {behind > 0 && (
                        <Button variant='ghost' size='sm' className='h-5 px-1.5 text-xs' onClick={onPull} title={`Pull ${String(behind)} commit${behind === 1 ? '' : 's'}`}>
                            <Download className='mr-1 h-3 w-3' />
                            Pull
                        </Button>
                    )}
                    {ahead > 0 && (
                        <Button variant='ghost' size='sm' className='h-5 px-1.5 text-xs' onClick={onPush} title={`Push ${String(ahead)} commit${ahead === 1 ? '' : 's'}`}>
                            <Upload className='mr-1 h-3 w-3' />
                            Push
                        </Button>
                    )}
                    <Button variant='ghost' size='sm' className='h-5 w-5 p-0 text-xs' onClick={onFetch} title='Fetch from remote' aria-label='Fetch'>
                        <RefreshCw className='h-3 w-3' />
                    </Button>
                </div>

                {/* Repository name */}
                <span className='max-w-[200px] truncate text-muted-foreground' title={activeRepo}>
                    {activeRepo.split('/').pop()}
                </span>
            </div>
        </div>
    );
}

export default StatusBar;

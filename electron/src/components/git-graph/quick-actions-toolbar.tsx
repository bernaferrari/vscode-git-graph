/**
 * Quick Actions Toolbar
 * Common git actions in a compact toolbar
 */

import {
    Upload,
    Download,
    RefreshCw,
    Loader2,
    Check,
    ChevronDown,
    Wand2,
    GitCommit,
    Sparkles,
    Edit3,
    ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface QuickActionsToolbarProps {
    className?: string;
}

function summarizeChangedFiles(entries?: Array<{ file?: string | null }>, limit: number = 3) {
    const files = (entries ?? [])
        .map((entry) => entry.file)
        .filter((entry): entry is string => Boolean(entry));

    return {
        files: files.slice(0, limit),
        overflow: Math.max(0, files.length - limit),
    };
}

export function QuickActionsToolbar({ className }: QuickActionsToolbarProps) {
    const { activeRepo } = useAppStore();
    const gitOps = useGitOperations();
    const trpcUtils = trpc.useUtils();
    const { generateCommitMessage, isGeneratingMessage, isAIEnabled } = useAIFeatures();
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [amendCommit, setAmendCommit] = useState(false);

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
    const currentBranch = repoInfo?.head ?? null;
    const configAllQuery = trpc.config.getAll.useQuery(undefined, { staleTime: 10_000 });
    const aiProdEnabled = Boolean(
        (configAllQuery.data?.ui as { featureFlags?: { aiProd?: boolean } } | undefined)?.featureFlags?.aiProd
    );

    // Get ahead/behind
    const { data: aheadBehindData, refetch: refetchAheadBehind } = trpc.git.aheadBehind.useQuery(
        { repo: activeRepo ?? '', branch: currentBranch ?? undefined },
        { enabled: !!activeRepo && !!currentBranch }
    );
    const { data: latestCommitDetails } = trpc.git.commitDetails.useQuery(
        {
            repo: activeRepo ?? '',
            commitHash: 'HEAD',
        },
        { enabled: !!activeRepo }
    );

    const stagedCount = statusData?.staged.length ?? 0;
    const unstagedCount = statusData?.unstaged.length ?? 0;
    const stagedSummary = summarizeChangedFiles(statusData?.staged);
    const unstagedSummary = summarizeChangedFiles(statusData?.unstaged);
    const untrackedCount = statusData?.unstaged.filter((entry) => entry.status === 'U').length ?? 0;
    const ahead = aheadBehindData?.ahead ?? 0;
    const behind = aheadBehindData?.behind ?? 0;
    const latestCommitSubject =
        latestCommitDetails?.details?.body.split('\n')[0]?.trim() || latestCommitDetails?.details?.hash.slice(0, 7) || null;
    const hasCommitFocus = stagedCount > 0 || commitMessage.trim().length > 0 || amendCommit;
    const hasActionableState = hasCommitFocus || unstagedCount > 0 || ahead > 0 || behind > 0;
    const syncSummary =
        behind > 0 && ahead > 0
            ? `${String(ahead)} commit${ahead === 1 ? '' : 's'} ready to push after syncing ${String(behind)} incoming commit${behind === 1 ? '' : 's'}`
            : behind > 0
              ? `Pull ${String(behind)} incoming commit${behind === 1 ? '' : 's'} before pushing`
              : ahead > 0
                ? `${String(ahead)} commit${ahead === 1 ? '' : 's'} ready to push`
                : 'Branch is synced with origin';
    const commitScopeLabel =
        stagedCount > 0
            ? `${String(stagedCount)} staged file${stagedCount === 1 ? '' : 's'} will be included`
            : amendCommit
              ? 'Amend will reuse the current commit content if you leave the staged set empty'
              : 'Stage files to prepare the next commit';
    const workingTreeReminder =
        unstagedCount > 0
            ? `${String(unstagedCount)} file${unstagedCount === 1 ? '' : 's'} still sit outside the next commit`
            : 'No unstaged files remain outside the next commit';

    const handleQuickCommit = async () => {
        if (!commitMessage.trim() && !amendCommit) {
            toast.error('Please enter a commit message');
            return;
        }

        setIsCommitting(true);
        try {
            await gitOps.commit(commitMessage, amendCommit);
            setCommitMessage('');
            setAmendCommit(false);
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        } finally {
            setIsCommitting(false);
        }
    };

    const handleStageAll = async () => {
        const files = (statusData?.unstaged ?? []).map((entry) => entry.file).filter(Boolean);
        if (files.length === 0) {
            toast.info('No unstaged files available');
            return;
        }
        try {
            await gitOps.stage(files);
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleUnstageAll = async () => {
        const files = (statusData?.staged ?? []).map((entry) => entry.file).filter(Boolean);
        if (files.length === 0) {
            toast.info('No staged files available');
            return;
        }
        try {
            await gitOps.unstage(files);
            await refetchStatus();
        } catch {
            // Error is surfaced by the mutation toast.
        }
    };

    const handleGenerateCommitMessage = async () => {
        if (!activeRepo) {
            toast.error('No active repository');
            return;
        }
        if (!aiProdEnabled) {
            toast.info('AI production features are disabled by feature flag');
            return;
        }
        if (!isAIEnabled) {
            toast.info('Enable AI provider in Settings first');
            return;
        }
        const stagedFiles = (statusData?.staged ?? [])
            .map((entry: { file?: string | null }) => entry.file)
            .filter((entry: string | null | undefined): entry is string => Boolean(entry));
        if (stagedFiles.length === 0) {
            toast.info('Stage files before generating a commit message');
            return;
        }

        const diffParts = await Promise.all(
            stagedFiles.map(async (filePath: string) => {
                const result = await trpcUtils.git.workingTreeFileDiff.fetch({
                    repo: activeRepo,
                    filePath,
                    staged: true,
                });
                if (result.error) {
                    return `# ${filePath}\n(diff unavailable: ${result.error})`;
                }
                return `# ${filePath}\n${result.diff}`;
            })
        );
        const suggestion = await generateCommitMessage(stagedFiles, diffParts.join('\n\n'));
        if (!suggestion?.message) {
            toast.error('Unable to generate commit message');
            return;
        }
        setCommitMessage(suggestion.message);
        toast.success('Commit message generated');
    };

    const handleQuickPush = async () => {
        if (!currentBranch) {
            toast.error('No current branch to push');
            return;
        }
        try {
            await gitOps.push(currentBranch, 'origin', true, 'normal');
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

    if (!activeRepo || !hasActionableState) {
        return null;
    }

    return (
        <div className={`border-border/60 bg-muted/20 border-b ${className || ''}`}>
            <div className='flex flex-wrap items-center gap-2 px-3 py-2'>
                <div className='mr-2 flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                    <div className='text-foreground flex min-w-0 items-center gap-2 text-sm font-medium'>
                        <Sparkles className='h-4 w-4 text-primary' />
                        <span>{hasCommitFocus ? 'Review before commit' : ahead > 0 || behind > 0 ? 'Review before sync' : 'Repository activity'}</span>
                    </div>
                    {stagedCount > 0 && (
                        <Badge variant='outline' className='font-medium'>
                            <GitCommit className='h-3 w-3' />
                            {stagedCount} staged
                        </Badge>
                    )}
                    {unstagedCount > 0 && (
                        <Badge variant='outline' className='font-medium'>
                            {unstagedCount} unstaged
                        </Badge>
                    )}
                    {behind > 0 && (
                        <Badge variant='outline' className='border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'>
                            {behind} behind
                        </Badge>
                    )}
                    {ahead > 0 && (
                        <Badge variant='outline' className='border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'>
                            {ahead} ahead
                        </Badge>
                    )}
                    {amendCommit && (
                        <Badge variant='outline' className='border-primary/30 bg-primary/10 text-primary'>
                            <Edit3 className='h-3 w-3' />
                            Amending HEAD
                        </Badge>
                    )}
                </div>

                {hasCommitFocus && (
                    <div className='flex min-w-[280px] flex-1 items-center gap-2 lg:max-w-xl'>
                        <Input
                            placeholder={amendCommit ? 'Optional amended commit message…' : 'Write a focused commit message...'}
                            value={commitMessage}
                            onChange={(e) => { setCommitMessage(e.target.value); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { void handleQuickCommit(); } }}
                            className='h-9 text-sm'
                            disabled={stagedCount === 0 && !amendCommit}
                        />
                        <Button
                            size='sm'
                            variant={amendCommit ? 'default' : 'outline'}
                            className='h-9 shrink-0'
                            onClick={() => { setAmendCommit((current) => !current); }}
                            disabled={!latestCommitSubject}
                            aria-label='Toggle amend last commit'
                            title={latestCommitSubject ? `Amend ${latestCommitSubject}` : 'No commit available to amend'}>
                            <Edit3 className='h-4 w-4' />
                        </Button>
                        <Button
                            size='sm'
                            variant='outline'
                            className='h-9 shrink-0'
                            onClick={() => {
                                void handleGenerateCommitMessage();
                            }}
                            disabled={(stagedCount === 0 && !amendCommit) || isGeneratingMessage || !aiProdEnabled}
                            aria-label='Generate commit message with AI'
                            title='Generate commit message with AI'>
                            {isGeneratingMessage ? <Loader2 className='h-4 w-4 animate-spin' /> : <Wand2 className='h-4 w-4' />}
                        </Button>
                        <Button
                            size='sm'
                            className='h-9 shrink-0'
                            onClick={() => { void handleQuickCommit(); }}
                            disabled={(stagedCount === 0 && !amendCommit) || isCommitting}
                            aria-label={amendCommit ? 'Amend last commit' : 'Create commit'}
                            title={amendCommit ? 'Amend last commit' : `Commit (${String(stagedCount)} staged)`}>
                            {isCommitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Check className='h-4 w-4' />}
                            <span className='hidden sm:inline'>{amendCommit ? 'Amend' : 'Commit'}</span>
                        </Button>
                    </div>
                )}

                <div className='ml-auto flex items-center gap-1'>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='h-8 w-8 p-0'
                        onClick={() => { void handleQuickFetch(); }}
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
                                title={`Pull (${String(behind)} behind)`}>
                                <Download className='h-4 w-4' />
                                {behind > 0 && <span className='ml-1 text-xs'>{behind}</span>}
                                <ChevronDown className='ml-1 h-3 w-3' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                            <DropdownMenuItem onClick={() => { void handleQuickPull(); }}>
                                <Download className='mr-2 h-4 w-4' />
                                Pull
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { void handleQuickPullFastForwardOnly(); }}>
                                <Download className='mr-2 h-4 w-4 text-emerald-600' />
                                Pull (Fast-forward only)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant='ghost'
                        size='sm'
                        className='h-8 px-2'
                        onClick={() => { void handleQuickPush(); }}
                        disabled={!activeRepo || ahead === 0}
                        aria-label='Push to remote'
                        title={`Push (${String(ahead)} ahead)`}>
                        <Upload className='h-4 w-4' />
                        {ahead > 0 && <span className='ml-1 text-xs'>{ahead}</span>}
                    </Button>
                </div>
            </div>

            {(stagedSummary.files.length > 0 || unstagedSummary.files.length > 0 || ahead > 0 || behind > 0 || amendCommit) && (
                <div className='grid gap-2 border-t border-border/50 px-3 py-2 md:grid-cols-3'>
                    {stagedSummary.files.length > 0 && (
                        <div className='rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2'>
                            <div className='mb-1 flex items-center justify-between text-xs font-medium text-emerald-700 dark:text-emerald-300'>
                                <span>Ready for commit</span>
                                <span className='tabular-nums'>{stagedCount}</span>
                            </div>
                            <p className='mb-2 text-xs text-muted-foreground'>{commitScopeLabel}</p>
                            <div className='space-y-1'>
                                {stagedSummary.files.map((file) => (
                                    <div key={file} className='truncate text-xs text-muted-foreground'>
                                        {file}
                                    </div>
                                ))}
                                {stagedSummary.overflow > 0 && (
                                    <div className='text-xs text-muted-foreground'>
                                        +{stagedSummary.overflow} more staged files
                                    </div>
                                )}
                            </div>
                            <div className='mt-3 flex items-center gap-2'>
                                <Button size='sm' variant='outline' className='h-7 text-xs' onClick={() => { void handleUnstageAll(); }}>
                                    Unstage all
                                </Button>
                            </div>
                        </div>
                    )}
                    {unstagedSummary.files.length > 0 && (
                        <div className='rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2'>
                            <div className='mb-1 flex items-center justify-between text-xs font-medium text-amber-700 dark:text-amber-300'>
                                <span>Still in working tree</span>
                                <span className='tabular-nums'>{unstagedCount}</span>
                            </div>
                            <p className='mb-2 text-xs text-muted-foreground'>
                                {workingTreeReminder}
                                {untrackedCount > 0 ? ` (${String(untrackedCount)} untracked)` : ''}
                            </p>
                            <div className='space-y-1'>
                                {unstagedSummary.files.map((file) => (
                                    <div key={file} className='truncate text-xs text-muted-foreground'>
                                        {file}
                                    </div>
                                ))}
                                {unstagedSummary.overflow > 0 && (
                                    <div className='text-xs text-muted-foreground'>
                                        +{unstagedSummary.overflow} more unstaged files
                                    </div>
                                )}
                            </div>
                            <div className='mt-3 flex items-center gap-2'>
                                <Button size='sm' variant='outline' className='h-7 text-xs' onClick={() => { void handleStageAll(); }}>
                                    Stage all
                                </Button>
                            </div>
                        </div>
                    )}
                    {(ahead > 0 || behind > 0 || amendCommit) && (
                        <div className='rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2'>
                            <div className='mb-1 flex items-center justify-between text-xs font-medium text-sky-700 dark:text-sky-300'>
                                <span>{ahead > 0 || behind > 0 ? 'Sync readiness' : 'Commit context'}</span>
                                {currentBranch && <span className='truncate tabular-nums'>{currentBranch}</span>}
                            </div>
                            <p className='text-xs text-muted-foreground'>{syncSummary}</p>
                            {amendCommit && latestCommitSubject && (
                                <div className='mt-2 rounded border border-primary/15 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground'>
                                    <span className='font-medium text-foreground'>Amending:</span>{' '}
                                    {latestCommitDetails?.details?.hash.slice(0, 7)} {latestCommitSubject}
                                </div>
                            )}
                            <div className='mt-3 flex flex-wrap items-center gap-2'>
                                {behind > 0 && (
                                    <Button size='sm' variant='outline' className='h-7 text-xs' onClick={() => { void handleQuickPull(); }}>
                                        <Download className='mr-1 h-3.5 w-3.5' />
                                        Pull latest
                                    </Button>
                                )}
                                {ahead > 0 && (
                                    <Button size='sm' variant='outline' className='h-7 text-xs' onClick={() => { void handleQuickPush(); }}>
                                        <Upload className='mr-1 h-3.5 w-3.5' />
                                        Push branch
                                    </Button>
                                )}
                                {ahead === 0 && behind === 0 && amendCommit && (
                                    <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                                        <ArrowRight className='h-3.5 w-3.5' />
                                        Update the last commit without creating a new one
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default QuickActionsToolbar;

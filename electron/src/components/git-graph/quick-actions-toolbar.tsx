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
    Edit3,
    ArrowRight,
    Sparkles,
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
import { useOutcomePicker } from '@/components/outcome-preview/useOutcomePicker';

interface QuickActionsToolbarProps {
    className?: string;
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
    const { openIntegration } = useOutcomePicker();
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
    const untrackedCount = statusData?.unstaged.filter((entry) => entry.status === 'U').length ?? 0;
    const ahead = aheadBehindData?.ahead ?? 0;
    const behind = aheadBehindData?.behind ?? 0;
    const upstreamBranch =
        (aheadBehindData as { upstream?: string | null } | undefined)?.upstream ?? null;
    const latestCommitSubject =
        latestCommitDetails?.details?.body.split('\n')[0]?.trim() || latestCommitDetails?.details?.hash.slice(0, 7) || null;
    const hasCommitFocus = stagedCount > 0 || commitMessage.trim().length > 0 || amendCommit;
    const hasActionableState = hasCommitFocus || unstagedCount > 0 || ahead > 0 || behind > 0;
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

    const showCommitInput = stagedCount > 0 || amendCommit;
    const showStageAll = unstagedCount > 0 && stagedCount === 0;

    return (
        <div className={`border-border/60 bg-muted/15 border-b ${className || ''}`}>
            <div className='flex flex-wrap items-center gap-2 px-2.5 py-1.5'>
                {/* Working-tree status chips */}
                <div className='flex shrink-0 items-center gap-1.5'>
                    {stagedCount > 0 && (
                        <Badge variant='success' title={commitScopeLabel}>
                            <GitCommit className='h-2.5 w-2.5' />
                            <span className='tabular-nums'>{stagedCount}</span> staged
                        </Badge>
                    )}
                    {unstagedCount > 0 && (
                        <Badge variant='soft' title={workingTreeReminder}>
                            <span className='tabular-nums'>{unstagedCount}</span> unstaged
                            {untrackedCount > 0 ? ` · ${String(untrackedCount)} new` : ''}
                        </Badge>
                    )}
                    {behind > 0 && (
                        <Badge variant='warning' title={`${String(behind)} commits to pull`}>
                            <Download className='h-2.5 w-2.5' />
                            <span className='tabular-nums'>{behind}</span>
                        </Badge>
                    )}
                    {ahead > 0 && (
                        <Badge variant='info' title={`${String(ahead)} commits to push`}>
                            <Upload className='h-2.5 w-2.5' />
                            <span className='tabular-nums'>{ahead}</span>
                        </Badge>
                    )}
                    {amendCommit && (
                        <Badge variant='soft' className='bg-primary/10 text-primary border-primary/25'>
                            <Edit3 className='h-2.5 w-2.5' />
                            Amending
                        </Badge>
                    )}
                </div>

                {/* Inline commit input — appears only when there's something to commit */}
                {showCommitInput && (
                    <div className='flex min-w-[260px] flex-1 items-center gap-1.5 lg:max-w-xl'>
                        <Input
                            placeholder={amendCommit ? 'Optional amended message…' : 'Commit message…'}
                            value={commitMessage}
                            onChange={(e) => { setCommitMessage(e.target.value); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { void handleQuickCommit(); } }}
                            className='h-7 text-[0.8125rem]'
                            disabled={stagedCount === 0 && !amendCommit}
                        />
                        <Button
                            size='icon-sm'
                            variant={amendCommit ? 'default' : 'outline'}
                            className='shrink-0'
                            onClick={() => { setAmendCommit((current) => !current); }}
                            disabled={!latestCommitSubject}
                            aria-label='Toggle amend last commit'
                            title={latestCommitSubject ? `Amend ${latestCommitSubject}` : 'No commit available to amend'}>
                            <Edit3 className='h-3.5 w-3.5' />
                        </Button>
                        {aiProdEnabled && (
                            <Button
                                size='icon-sm'
                                variant='outline'
                                className='shrink-0'
                                onClick={() => {
                                    void handleGenerateCommitMessage();
                                }}
                                disabled={(stagedCount === 0 && !amendCommit) || isGeneratingMessage}
                                aria-label='Generate commit message with AI'
                                title='Generate commit message with AI'>
                                {isGeneratingMessage ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Wand2 className='h-3.5 w-3.5' />}
                            </Button>
                        )}
                        <Button
                            size='sm'
                            className='shrink-0'
                            onClick={() => { void handleQuickCommit(); }}
                            disabled={(stagedCount === 0 && !amendCommit) || isCommitting}
                            aria-label={amendCommit ? 'Amend last commit' : 'Create commit'}
                            title={amendCommit ? 'Amend last commit' : `Commit (${String(stagedCount)} staged)`}>
                            {isCommitting ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Check className='h-3.5 w-3.5' />}
                            <span>{amendCommit ? 'Amend' : 'Commit'}</span>
                        </Button>
                    </div>
                )}

                {showStageAll && !showCommitInput && (
                    <Button
                        size='xs'
                        variant='outline'
                        className='shrink-0'
                        onClick={() => { void handleStageAll(); }}>
                        Stage all
                    </Button>
                )}

                {/* Right-side sync cluster */}
                <div className='ml-auto flex items-center gap-0.5'>
                    <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => { void handleQuickFetch(); }}
                        disabled={!activeRepo}
                        aria-label='Fetch from remote'
                        title='Fetch'>
                        <RefreshCw className='h-3.5 w-3.5' />
                    </Button>

                    {behind > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className={`h-7 gap-1 px-2 text-[11px] tabular-nums ${
                                        ahead > 0
                                            ? 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'
                                            : ''
                                    }`}
                                    aria-label='Pull from remote'
                                    title={
                                        ahead > 0
                                            ? `Diverged: ${String(behind)} behind, ${String(ahead)} ahead — pick a result shape`
                                            : `Pull (${String(behind)} behind)`
                                    }>
                                    <Download className='h-3.5 w-3.5' />
                                    <span>{behind}</span>
                                    <ChevronDown className='h-3 w-3 opacity-60' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                {ahead > 0 && currentBranch && upstreamBranch ? (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            openIntegration({
                                                source: upstreamBranch,
                                                target: currentBranch,
                                            });
                                        }}>
                                        <Sparkles className='!text-primary' />
                                        Pick result shape…
                                    </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onClick={() => { void handleQuickPull(); }}>
                                    <Download />
                                    Pull
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { void handleQuickPullFastForwardOnly(); }}>
                                    <Download className='!text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]' />
                                    Pull (Fast-forward only)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {ahead > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 gap-1 px-2 text-[11px] tabular-nums'
                            onClick={() => { void handleQuickPush(); }}
                            disabled={!activeRepo}
                            aria-label='Push to remote'
                            title={`Push (${String(ahead)} ahead)`}>
                            <Upload className='h-3.5 w-3.5' />
                            <span>{ahead}</span>
                        </Button>
                    )}
                </div>
            </div>

            {amendCommit && latestCommitSubject && (
                <div className='border-t border-border/40 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground'>
                    <span className='font-mono'>{latestCommitDetails?.details?.hash.slice(0, 7)}</span>{' '}
                    <span className='text-foreground/85'>{latestCommitSubject}</span>
                    <span className='ml-2 inline-flex items-center gap-1'>
                        <ArrowRight className='h-3 w-3' />
                        Update the last commit without creating a new one
                    </span>
                </div>
            )}
        </div>
    );
}

export default QuickActionsToolbar;

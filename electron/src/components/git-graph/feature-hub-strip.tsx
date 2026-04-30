import {
    Activity,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    FolderGit2,
    Shield,
    Siren,
    Users,
    Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { ElementType } from 'react';

interface FeatureHubStripProps {
    worktreeCount: number;
    worktreeAttentionCount: number;
    workflowCount: number;
    workflowFailureCount: number;
    auditCount: number;
    protocolRegistered: boolean;
    collaborationSummary: {
        workspaceShares: number;
        patchShelf: number;
        syncEnabled: boolean;
        lastSyncStatus: string;
    };
    prSummary: {
        openPullRequests: number;
        needsAttention: boolean;
        stale: boolean;
        statusSignals: string[];
    };
    repoPolicy: {
        requireSignedCommits: boolean;
        requireUpToDate: boolean;
        enableStacking: boolean;
    };
    onOpenWorktrees: () => void;
    onOpenWorkflows: () => void;
    onOpenPullRequests: () => void;
    onOpenCollaboration: () => void;
    onOpenRepoPolicy: () => void;
    onOpenDiagnostics: () => void;
}

interface FeatureCardProps {
    title: string;
    summary: string;
    icon: ElementType;
    statusLabel: string;
    tone?: 'default' | 'attention' | 'success';
    onAction: () => void;
}

function FeatureCard({
    title,
    summary,
    icon: Icon,
    statusLabel,
    tone = 'default',
    onAction,
}: FeatureCardProps) {
    const badgeClassName =
        tone === 'attention'
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
            : tone === 'success'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
              : 'border-border/70 bg-background/80 text-muted-foreground';

    return (
        <button
            type='button'
            className='ui-surface group min-w-[210px] flex-1 rounded-lg border px-3 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-primary/35 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.99]'
            onClick={onAction}>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-1'>
                    <div className='flex items-center gap-2'>
                        <Icon className='text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors' />
                        <p className='truncate text-sm font-semibold'>{title}</p>
                    </div>
                    <p className='text-muted-foreground line-clamp-2 text-xs'>{summary}</p>
                </div>
                <Badge variant='outline' className={badgeClassName}>
                    {statusLabel}
                </Badge>
            </div>
        </button>
    );
}

export function FeatureHubStrip({
    worktreeCount,
    worktreeAttentionCount,
    workflowCount,
    workflowFailureCount,
    auditCount,
    protocolRegistered,
    collaborationSummary,
    prSummary,
    repoPolicy,
    onOpenWorktrees,
    onOpenWorkflows,
    onOpenPullRequests,
    onOpenCollaboration,
    onOpenRepoPolicy,
    onOpenDiagnostics,
}: FeatureHubStripProps) {
    const [expanded, setExpanded] = useState(false);
    const policySummary = repoPolicy.requireSignedCommits
        ? 'Signed commits enforced'
        : repoPolicy.requireUpToDate
          ? 'Up-to-date merges enforced'
          : repoPolicy.enableStacking
            ? 'Stacking defaults enabled'
            : 'Flexible';
    const attentionCount = useMemo(() => {
        let count = 0;
        if (worktreeAttentionCount > 0) count++;
        if (workflowFailureCount > 0) count++;
        if (prSummary.needsAttention || prSummary.stale) count++;
        if (!protocolRegistered) count++;
        return count;
    }, [prSummary.needsAttention, prSummary.stale, protocolRegistered, workflowFailureCount, worktreeAttentionCount]);
    const collaborationActive = collaborationSummary.syncEnabled || collaborationSummary.workspaceShares + collaborationSummary.patchShelf > 0;
    const policyActive = repoPolicy.requireSignedCommits || repoPolicy.requireUpToDate || repoPolicy.enableStacking;

    return (
        <div className='border-border/60 bg-muted/10 border-t border-b px-3 py-2'>
            <div className='flex min-h-9 flex-wrap items-center gap-1.5'>
                <div className='mr-2 flex min-w-0 flex-1 items-center gap-2'>
                    <p className='text-sm font-semibold'>Tools</p>
                    <Badge
                        variant='outline'
                        className={
                            attentionCount > 0
                                ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
                                : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                        }>
                        {attentionCount > 0 ? `${String(attentionCount)} alerts` : 'Quiet'}
                    </Badge>
                    {policyActive && (
                        <Badge variant='outline' className='hidden sm:inline-flex'>
                            <Shield className='h-3 w-3' />
                            Policy
                        </Badge>
                    )}
                </div>

                <Button variant='ghost' size='sm' className='h-8 gap-1.5 px-2 text-xs font-medium' onClick={onOpenWorktrees}>
                    <FolderGit2 className='h-3.5 w-3.5' />
                    Worktrees
                    <span className='text-muted-foreground'>{worktreeCount}</span>
                </Button>
                <Button variant='ghost' size='sm' className='h-8 gap-1.5 px-2 text-xs font-medium' onClick={onOpenPullRequests}>
                    <ClipboardList className='h-3.5 w-3.5' />
                    PRs
                    <span className='text-muted-foreground'>{prSummary.openPullRequests}</span>
                </Button>
                <Button variant='ghost' size='sm' className='h-8 gap-1.5 px-2 text-xs font-medium' onClick={onOpenWorkflows}>
                    <Workflow className='h-3.5 w-3.5' />
                    Workflows
                    <span className='text-muted-foreground'>{workflowCount}</span>
                </Button>
                <Button variant='ghost' size='sm' className='h-8 gap-1.5 px-2 text-xs font-medium' onClick={onOpenDiagnostics}>
                    {protocolRegistered ? <Activity className='h-3.5 w-3.5' /> : <Siren className='h-3.5 w-3.5' />}
                    Diagnostics
                </Button>
                <Button
                    variant='ghost'
                    size='sm'
                    className='ml-auto h-8 gap-1.5 text-xs font-medium'
                    onClick={() => { setExpanded((current) => !current); }}>
                    {expanded ? 'Done' : 'Details'}
                    {expanded ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
                </Button>
            </div>

            {expanded && (
                <div className='mt-2 grid gap-2 xl:grid-cols-3'>
                    <FeatureCard
                        title='Worktrees'
                        summary={`${String(worktreeCount)} checkout${worktreeCount === 1 ? '' : 's'}`}
                        icon={FolderGit2}
                        statusLabel={
                            worktreeAttentionCount > 0 ? `${String(worktreeAttentionCount)} attention` : 'healthy'
                        }
                        tone={worktreeAttentionCount > 0 ? 'attention' : 'success'}
                        onAction={onOpenWorktrees}
                    />
                    <FeatureCard
                        title='Workflows'
                        summary={`${String(workflowCount)} automation${workflowCount === 1 ? '' : 's'}`}
                        icon={Workflow}
                        statusLabel={workflowFailureCount > 0 ? `${String(workflowFailureCount)} failed run${workflowFailureCount === 1 ? '' : 's'}` : 'ready'}
                        tone={workflowFailureCount > 0 ? 'attention' : 'default'}
                        onAction={onOpenWorkflows}
                    />
                    <FeatureCard
                        title='Pull requests'
                        summary={
                            prSummary.openPullRequests > 0
                                ? `${String(prSummary.openPullRequests)} open${prSummary.statusSignals[0] ? ` · ${prSummary.statusSignals[0]}` : ''}`
                                : 'No open reviews'
                        }
                        icon={ClipboardList}
                        statusLabel={
                            prSummary.needsAttention
                                ? 'needs attention'
                                : prSummary.stale
                                  ? 'stale'
                                  : prSummary.openPullRequests > 0
                                    ? `${String(prSummary.openPullRequests)} open`
                                    : 'review hub'
                        }
                        tone={prSummary.needsAttention || prSummary.stale ? 'attention' : 'default'}
                        onAction={onOpenPullRequests}
                    />
                    <FeatureCard
                        title='Handoff'
                        summary={`${String(collaborationSummary.workspaceShares)} shared · ${String(collaborationSummary.patchShelf)} shelved`}
                        icon={Users}
                        statusLabel={
                            collaborationSummary.syncEnabled
                                ? collaborationSummary.lastSyncStatus
                                : collaborationActive
                                  ? 'active'
                                  : 'empty'
                        }
                        tone={
                            collaborationSummary.lastSyncStatus === 'error'
                                ? 'attention'
                                : collaborationActive
                                  ? 'success'
                                  : 'default'
                        }
                        onAction={onOpenCollaboration}
                    />
                    <FeatureCard
                        title='Policy'
                        summary={policySummary}
                        icon={Shield}
                        statusLabel={repoPolicy.requireSignedCommits || repoPolicy.requireUpToDate ? 'guardrails on' : 'flexible'}
                        tone={repoPolicy.requireSignedCommits || repoPolicy.requireUpToDate ? 'success' : 'default'}
                        onAction={onOpenRepoPolicy}
                    />
                    <FeatureCard
                        title='Diagnostics'
                        summary={`${String(auditCount)} audit entr${auditCount === 1 ? 'y' : 'ies'}`}
                        icon={protocolRegistered ? Activity : Siren}
                        statusLabel={protocolRegistered ? 'protocol ready' : 'protocol missing'}
                        tone={protocolRegistered ? 'success' : 'attention'}
                        onAction={onOpenDiagnostics}
                    />
                </div>
            )}
        </div>
    );
}

export default FeatureHubStrip;

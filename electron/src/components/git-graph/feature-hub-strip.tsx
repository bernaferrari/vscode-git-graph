import {
    Activity,
    ArrowUpRight,
    ClipboardList,
    FolderGit2,
    Shield,
    Siren,
    Users,
    Workflow,
} from 'lucide-react';
import type { ElementType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    subtitle: string;
    icon: ElementType;
    statusLabel: string;
    tone?: 'default' | 'attention' | 'success';
    actionLabel: string;
    onAction: () => void;
}

function FeatureCard({
    title,
    subtitle,
    icon: Icon,
    statusLabel,
    tone = 'default',
    actionLabel,
    onAction,
}: FeatureCardProps) {
    const badgeClassName =
        tone === 'attention'
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
            : tone === 'success'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
              : 'border-border/70 bg-background/80 text-muted-foreground';

    return (
        <div className='ui-surface min-w-[220px] flex-1 rounded-xl border px-3 py-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='space-y-1'>
                    <div className='flex items-center gap-2'>
                        <Icon className='h-4 w-4 text-foreground' />
                        <p className='text-sm font-semibold'>{title}</p>
                    </div>
                    <p className='text-muted-foreground text-xs'>{subtitle}</p>
                </div>
                <Badge variant='outline' className={badgeClassName}>
                    {statusLabel}
                </Badge>
            </div>
            <div className='mt-3'>
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 min-w-0 justify-start px-0 text-xs font-medium'
                    onClick={onAction}>
                    {actionLabel}
                    <ArrowUpRight className='ml-1 h-3.5 w-3.5' />
                </Button>
            </div>
        </div>
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
    const policySummary = repoPolicy.requireSignedCommits
        ? 'Signed commits enforced'
        : repoPolicy.requireUpToDate
          ? 'Up-to-date merges enforced'
          : repoPolicy.enableStacking
            ? 'Stacking defaults enabled'
            : 'No repo policy guardrails';

    return (
        <div className='border-border/60 bg-muted/20 border-t border-b px-3 py-3'>
            <div className='mb-2 flex items-center justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold'>Review and automation</p>
                    <p className='text-muted-foreground text-xs'>
                        High-value workflows and safeguards surfaced directly in the main shell.
                    </p>
                </div>
            </div>
            <div className='flex gap-3 overflow-x-auto pb-1'>
                <FeatureCard
                    title='Worktrees'
                    subtitle={`${worktreeCount} linked checkout${worktreeCount === 1 ? '' : 's'} ready for focused changes`}
                    icon={FolderGit2}
                    statusLabel={
                        worktreeAttentionCount > 0 ? `${worktreeAttentionCount} attention` : 'healthy'
                    }
                    tone={worktreeAttentionCount > 0 ? 'attention' : 'success'}
                    actionLabel='Open Worktree Center'
                    onAction={onOpenWorktrees}
                />
                <FeatureCard
                    title='Workflow Engine'
                    subtitle={`${workflowCount} saved automation${workflowCount === 1 ? '' : 's'} for repetitive Git work`}
                    icon={Workflow}
                    statusLabel={workflowFailureCount > 0 ? `${workflowFailureCount} failed run${workflowFailureCount === 1 ? '' : 's'}` : 'ready'}
                    tone={workflowFailureCount > 0 ? 'attention' : 'default'}
                    actionLabel='Open Workflow Engine'
                    onAction={onOpenWorkflows}
                />
                <FeatureCard
                    title='PR Review'
                    subtitle={
                        prSummary.openPullRequests > 0
                            ? `${prSummary.openPullRequests} open PR${prSummary.openPullRequests === 1 ? '' : 's'}${prSummary.statusSignals[0] ? ` · ${prSummary.statusSignals[0]}` : ''}`
                            : 'Open the review workspace, comments, merge controls, and AI PR helpers'
                    }
                    icon={ClipboardList}
                    statusLabel={
                        prSummary.needsAttention
                            ? 'needs attention'
                            : prSummary.stale
                              ? 'stale'
                              : prSummary.openPullRequests > 0
                                ? `${prSummary.openPullRequests} open`
                                : 'review hub'
                    }
                    tone={prSummary.needsAttention || prSummary.stale ? 'attention' : 'default'}
                    actionLabel='Open Pull Requests'
                    onAction={onOpenPullRequests}
                />
                <FeatureCard
                    title='Collaboration'
                    subtitle={`${collaborationSummary.workspaceShares} handoff${collaborationSummary.workspaceShares === 1 ? '' : 's'} · ${collaborationSummary.patchShelf} patch${collaborationSummary.patchShelf === 1 ? '' : 'es'} on shelf${collaborationSummary.syncEnabled ? ' · remote sync ready' : ''}`}
                    icon={Users}
                    statusLabel={
                        collaborationSummary.syncEnabled
                            ? collaborationSummary.lastSyncStatus
                            : collaborationSummary.workspaceShares + collaborationSummary.patchShelf > 0
                                ? 'active'
                                : 'empty'
                    }
                    tone={
                        collaborationSummary.lastSyncStatus === 'error'
                            ? 'attention'
                            : collaborationSummary.syncEnabled || collaborationSummary.workspaceShares + collaborationSummary.patchShelf > 0
                                ? 'success'
                                : 'default'
                    }
                    actionLabel='Open Collaboration Center'
                    onAction={onOpenCollaboration}
                />
                <FeatureCard
                    title='Repo Policy'
                    subtitle={policySummary}
                    icon={Shield}
                    statusLabel={repoPolicy.requireSignedCommits || repoPolicy.requireUpToDate ? 'guardrails on' : 'flexible'}
                    tone={repoPolicy.requireSignedCommits || repoPolicy.requireUpToDate ? 'success' : 'default'}
                    actionLabel='Edit Repo Policy'
                    onAction={onOpenRepoPolicy}
                />
                <FeatureCard
                    title='Diagnostics & Audit'
                    subtitle={`${auditCount} recent audit entr${auditCount === 1 ? 'y' : 'ies'} in this repo`}
                    icon={protocolRegistered ? Activity : Siren}
                    statusLabel={protocolRegistered ? 'protocol ready' : 'protocol missing'}
                    tone={protocolRegistered ? 'success' : 'attention'}
                    actionLabel='Open Diagnostics'
                    onAction={onOpenDiagnostics}
                />
            </div>
        </div>
    );
}

export default FeatureHubStrip;

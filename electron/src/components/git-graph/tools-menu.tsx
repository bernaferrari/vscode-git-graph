/**
 * Tools menu — single dropdown that replaces the FeatureHubStrip.
 *
 * Collapses Worktrees / Pull Requests / Workflows / Collaboration / Repo Policy /
 * Diagnostics into one launcher with a compact attention indicator. The previous
 * always-visible strip ate ~40px of vertical space and presented 6+ entry points
 * at once; this surfaces them on demand and lets the graph breathe.
 */

import {
    Activity,
    ClipboardList,
    FolderGit2,
    Layers,
    Shield,
    Siren,
    Users,
    Workflow,
} from 'lucide-react';
import { useMemo } from 'react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ToolsMenuProps {
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

export function ToolsMenu({
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
}: ToolsMenuProps) {
    const attentionCount = useMemo(() => {
        let count = 0;
        if (worktreeAttentionCount > 0) count++;
        if (workflowFailureCount > 0) count++;
        if (prSummary.needsAttention || prSummary.stale) count++;
        if (!protocolRegistered) count++;
        return count;
    }, [
        prSummary.needsAttention,
        prSummary.stale,
        protocolRegistered,
        workflowFailureCount,
        worktreeAttentionCount,
    ]);

    const policySummary = repoPolicy.requireSignedCommits
        ? 'Signed commits enforced'
        : repoPolicy.requireUpToDate
          ? 'Up-to-date merges enforced'
          : repoPolicy.enableStacking
            ? 'Stacking defaults enabled'
            : 'Flexible';

    const tooltipLabel = attentionCount > 0
        ? `Tools — ${String(attentionCount)} need${attentionCount === 1 ? 's' : ''} attention`
        : 'Tools';

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger render={
                    <DropdownMenuTrigger
                        aria-label='Tools menu'
                        className='relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45'>
                        <Layers className='h-3.5 w-3.5' />
                        {attentionCount > 0 && (
                            <span
                                aria-hidden
                                className='absolute -top-0.5 -right-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-[color-mix(in_oklch,var(--warning)_85%,transparent)] px-1 text-[9px] font-semibold leading-none text-background tabular-nums ring-2 ring-background'>
                                {attentionCount}
                            </span>
                        )}
                    </DropdownMenuTrigger>
                } />
                <TooltipContent>{tooltipLabel}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align='end' className='w-64'>
                <DropdownMenuLabel>Repository tools</DropdownMenuLabel>
                <DropdownMenuItem onClick={onOpenWorktrees}>
                    <FolderGit2 />
                    <span>Worktrees</span>
                    <DropdownMenuShortcut>
                        {worktreeAttentionCount > 0
                            ? `${String(worktreeCount)} · ${String(worktreeAttentionCount)} alert`
                            : String(worktreeCount)}
                    </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenPullRequests}>
                    <ClipboardList />
                    <span>Pull requests</span>
                    <DropdownMenuShortcut>
                        {prSummary.needsAttention
                            ? 'attention'
                            : prSummary.stale
                              ? 'stale'
                              : String(prSummary.openPullRequests)}
                    </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenWorkflows}>
                    <Workflow />
                    <span>Workflows</span>
                    <DropdownMenuShortcut>
                        {workflowFailureCount > 0
                            ? `${String(workflowFailureCount)} failed`
                            : String(workflowCount)}
                    </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenCollaboration}>
                    <Users />
                    <span>Collaboration</span>
                    <DropdownMenuShortcut>
                        {collaborationSummary.syncEnabled
                            ? collaborationSummary.lastSyncStatus
                            : collaborationSummary.workspaceShares + collaborationSummary.patchShelf > 0
                              ? 'active'
                              : '—'}
                    </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenRepoPolicy}>
                    <Shield />
                    <span>Repo policy</span>
                    <DropdownMenuShortcut>{policySummary === 'Flexible' ? '—' : 'on'}</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenDiagnostics}>
                    {protocolRegistered ? <Activity /> : <Siren />}
                    <span>Diagnostics</span>
                    <DropdownMenuShortcut>
                        {protocolRegistered ? String(auditCount) : 'missing'}
                    </DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default ToolsMenu;

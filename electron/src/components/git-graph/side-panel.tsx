/**
 * Git Graph Side Panel
 * Beautiful, clean sidebar for branches, tags, remotes, stashes
 */

import { AlertTriangle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BranchRenameDialog } from './branch-rename-dialog';
import {
    BranchItem,
    MoreItems,
    RemoteBranchItem,
    StashItem,
    SubmoduleItem,
    TagItem,
    WorktreeItem,
} from './side-panel-items';
import {
    BranchesSection,
    RemoteBranchesSection,
    StashesSection,
    SubmodulesSection,
    TagsSection,
    WorktreesSection,
} from './side-panel-sections';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

import type { AheadBehindEntry, SmartBranchEntry, WorktreeEntry, SubmoduleEntry } from './side-panel-types';

interface SidePanelProps {
    onBranchSelect?: (branch: string) => void;
    onCreateBranch?: () => void;
    onCreateTag?: () => void;
    onMergeBranch?: (branch: string) => void;
    enableBranchPinning?: boolean;
    onOpenWorktrees?: () => void;
}

interface AheadBehindResult {
    branches: AheadBehindEntry[];
    error?: string | null;
}

interface RepoInfoData {
    branches: string[];
    tags: string[];
    stashes: Array<{ message?: string }>;
    head: string | null;
}

interface WorktreesResult {
    worktrees: WorktreeEntry[];
}

interface RemoteEntry {
    name: string;
}

interface RemotesResult {
    remotes: RemoteEntry[];
}

interface SubmoduleListResult {
    submodules: SubmoduleEntry[];
}

interface LaunchpadRepoEntry {
    path: string;
    head: string | null;
    dirtyCount: number;
    ahead: number;
    behind: number;
    openPullRequests: number | null;
    needsAttention: boolean;
    stale: boolean;
    statusSignals: string[];
}

interface LaunchpadResult {
    repos: LaunchpadRepoEntry[];
}

interface PinnedBranchesResult {
    branches: string[];
}

interface SmartBranchesResult {
    branches: SmartBranchEntry[];
}

interface QueryOptions {
    enabled: boolean;
}

interface QueryResult<TData> {
    data?: TData;
}

interface TrpcGitShape {
    repoInfo: {
        useQuery: (
            input: {
                repo: string;
                showRemoteBranches: boolean;
                showStashes: boolean;
                hideRemotes: string[];
            },
            options: QueryOptions
        ) => QueryResult<RepoInfoData>;
    };
    worktree: {
        list: {
            useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<WorktreesResult>;
        };
    };
    remotes: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<RemotesResult>;
    };
    branch: {
        listPinned: {
            useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<PinnedBranchesResult>;
        };
        pin: {
            useMutation: () => {
                mutate: (input: { repo: string; branch: string }) => void;
                isPending: boolean;
            };
        };
        unpin: {
            useMutation: () => {
                mutate: (input: { repo: string; branch: string }) => void;
                isPending: boolean;
            };
        };
        smartList: {
            useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<SmartBranchesResult>;
        };
    };
    aheadBehindAll: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<AheadBehindResult>;
    };
    submodule: {
        list: {
            useQuery: (input: { repo: string }, options: QueryOptions) => QueryResult<SubmoduleListResult>;
        };
    };
}

interface TrpcClientShape {
    git: TrpcGitShape;
}

export function SidePanel({
    onBranchSelect,
    onCreateBranch,
    onCreateTag,
    onMergeBranch,
    enableBranchPinning = true,
    onOpenWorktrees,
}: SidePanelProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const trpcUtils = trpc.useUtils();
    const gitOps = useGitOperations();
    const revealMutation = trpc.system.revealInFinder.useMutation();

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        branches: true,
        remotes: true,
        tags: false,
        stashes: false,
        worktrees: false,
        submodules: false,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [branchChip, setBranchChip] = useState<'all' | 'pinned' | 'attention'>('all');
    const [renameBranchOpen, setRenameBranchOpen] = useState(false);
    const [renameBranchTarget, setRenameBranchTarget] = useState<string | null>(null);

    const { data: repoInfo } = typedTrpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: true,
            showStashes: true,
            hideRemotes: [],
        },
        { enabled: !!activeRepo }
    );

    const { data: worktreesData } = typedTrpc.git.worktree.list.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );
    const { data: remotesData } = typedTrpc.git.remotes.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );

    const { data: aheadBehindRawData } = typedTrpc.git.aheadBehindAll.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );
    const aheadBehindData = aheadBehindRawData;
    const { data: pinnedData } = trpc.git.branch.listPinned.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && enableBranchPinning }
    );
    const { data: smartBranchesData } = trpc.git.branch.smartList.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && enableBranchPinning }
    );
    const pinMutation = trpc.git.branch.pin.useMutation({
        onSuccess: () => {
            if (activeRepo) {
                void trpcUtils.git.branch.listPinned.invalidate({ repo: activeRepo });
            }
        },
    });
    const unpinMutation = trpc.git.branch.unpin.useMutation({
        onSuccess: () => {
            if (activeRepo) {
                void trpcUtils.git.branch.listPinned.invalidate({ repo: activeRepo });
            }
        },
    });

    const { data: submodulesData } = typedTrpc.git.submodule.list.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo }
    );
    const launchpadQuery = trpc.repo.launchpad.useQuery(
        { repos: activeRepo ? [activeRepo] : [], includePullRequests: true },
        { enabled: !!activeRepo, staleTime: 12_000 }
    );

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    if (!activeRepo) return null;

    const localBranches = repoInfo?.branches.filter((b) => !b.startsWith('remotes/')) ?? [];
    const remoteBranches = repoInfo?.branches.filter((b) => b.startsWith('remotes/') && !b.endsWith('/HEAD')) ?? [];
    const remoteBranchLookup = useMemo(() => new Set(remoteBranches), [remoteBranches]);
    const tags = repoInfo?.tags ?? [];
    const stashes = repoInfo?.stashes ?? [];
    const worktrees = worktreesData?.worktrees ?? [];
    const currentHead = repoInfo?.head;
    const launchpadEntry = (launchpadQuery.data as LaunchpadResult | undefined)?.repos[0];
    const hasOriginRemote = (remotesData?.remotes ?? []).some((remote) => remote.name === 'origin');

    const filterBySearch = <T extends string>(items: T[]): T[] =>
        searchQuery ? items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())) : items;

    const filteredLocalBranches = filterBySearch(localBranches);
    const filteredRemoteBranches = filterBySearch(remoteBranches);
    const filteredTags = filterBySearch(tags);
    const pinnedBranches = pinnedData?.branches ?? [];
    const aheadBehindLookup = useMemo(
        () =>
            new Map<string, AheadBehindEntry>(
                (aheadBehindData?.branches ?? []).map((entry: AheadBehindEntry) => [entry.branch, entry])
            ),
        [aheadBehindData?.branches]
    );
    const smartBranchesLookup = useMemo(
        () =>
            new Map<string, SmartBranchEntry>(
                (smartBranchesData?.branches ?? []).map((entry) => [entry.name, entry as SmartBranchEntry])
            ),
        [smartBranchesData?.branches]
    );
    const displayedLocalBranches = useMemo(() => {
        const base = [...filteredLocalBranches];
        base.sort((a, b) => {
            const rankA = smartBranchesLookup.get(a)?.score ?? 0;
            const rankB = smartBranchesLookup.get(b)?.score ?? 0;
            return rankB - rankA || a.localeCompare(b);
        });

        if (branchChip === 'pinned') {
            return base.filter((branch) => pinnedBranches.includes(branch));
        }
        if (branchChip === 'attention') {
            return base.filter((branch) => {
                const metrics = aheadBehindLookup.get(branch);
                return (metrics?.ahead ?? 0) > 0 || (metrics?.behind ?? 0) > 0;
            });
        }
        return base;
    }, [aheadBehindLookup, branchChip, filteredLocalBranches, pinnedBranches, smartBranchesLookup]);

    const branchesSectionProps = {
        expanded: !!expandedSections.branches,
        onToggle: () => {
            toggleSection('branches');
        },
        branchChip,
        setBranchChip,
        enableBranchPinning,
        displayedLocalBranches,
        currentHead,
        pinnedBranches,
        aheadBehindLookup,
        onCheckout: (branch) => {
            void gitOps.checkout(branch);
        },
        onDelete: (branch) => {
            void gitOps.deleteBranch(branch, false);
        },
        ...(hasOriginRemote
            ? {
                  onPublishBranch: (branch: string) => {
                      void gitOps.push(branch, 'origin', true, 'normal');
                  },
              }
            : {}),
        canTrackBranch: (branch) => remoteBranchLookup.has(`remotes/origin/${branch}`),
        onTrackBranch: (branch) => {
            const matchingUpstream = `origin/${branch}`;
            if (!remoteBranchLookup.has(`remotes/${matchingUpstream}`)) {
                return;
            }
            void gitOps.setBranchUpstream(branch, matchingUpstream);
        },
        onRenameBranch: (branch) => {
            setRenameBranchTarget(branch);
            setRenameBranchOpen(true);
        },
        onPinToggle: (branch, pinned) => {
            if (!enableBranchPinning) {
                return;
            }
            if (pinned) {
                unpinMutation.mutate({ repo: activeRepo, branch });
            } else {
                pinMutation.mutate({ repo: activeRepo, branch });
            }
        },
        renderBranchItem: (props) => <BranchItem key={props.branch} {...props} />,
    } as Parameters<typeof BranchesSection>[0];

    if (onCreateBranch) {
        branchesSectionProps.onCreateBranch = onCreateBranch;
    }
    if (onBranchSelect) {
        branchesSectionProps.onBranchSelect = onBranchSelect;
    }
    if (onMergeBranch) {
        branchesSectionProps.onMergeBranch = onMergeBranch;
    }

    return (
        <div className='ui-surface flex h-full w-64 shrink-0 flex-col rounded-none border-r-0'>
            {/* Header */}
            <div className='border-border/70 ui-toolbar border-b p-2.5'>
                <div className='relative'>
                    <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
                    <Input
                        placeholder='Filter...'
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); }}
                        className='border-border/70 bg-background/85 focus-visible:ring-primary/30 h-8 pl-8 text-sm focus-visible:ring-2'
                    />
                </div>
                {launchpadEntry && (
                    <RepoAttentionSummary
                        dirtyCount={launchpadEntry.dirtyCount}
                        ahead={launchpadEntry.ahead}
                        behind={launchpadEntry.behind}
                        openPullRequests={launchpadEntry.openPullRequests ?? 0}
                        needsAttention={launchpadEntry.needsAttention}
                        stale={launchpadEntry.stale}
                        statusSignals={launchpadEntry.statusSignals}
                    />
                )}
            </div>

            <ScrollArea className='flex-1'>
                <div className='ui-reveal space-y-1 p-2'>
                    <BranchesSection {...branchesSectionProps} />

                    <RemoteBranchesSection
                        expanded={!!expandedSections.remotes}
                        onToggle={() => { toggleSection('remotes'); }}
                        remoteBranches={remoteBranches}
                        filteredRemoteBranches={filteredRemoteBranches}
                        {...(onBranchSelect ? { onBranchSelect } : {})}
                        onCheckout={(branch) => {
                            void gitOps.checkout(branch);
                        }}
                        onDeleteRemoteBranch={(remote, branchName) => {
                            // eslint-disable-next-line no-alert
                            if (!confirm(`Delete remote branch ${remote}/${branchName}?`)) {
                                return;
                            }
                            void gitOps.deleteRemoteBranch(remote, branchName);
                        }}
                        renderRemoteBranchItem={(props) => <RemoteBranchItem key={props.branch} {...props} />}
                        renderMoreItems={({ label, count, children }) => (
                            <MoreItems label={label} count={count}>
                                {children}
                            </MoreItems>
                        )}
                    />

                    <TagsSection
                        expanded={!!expandedSections.tags}
                        onToggle={() => { toggleSection('tags'); }}
                        filteredTags={filteredTags}
                        {...(onCreateTag ? { onCreateTag } : {})}
                        renderTagItem={(tag) => (
                            <TagItem
                                key={tag}
                                tag={tag}
                                onDelete={() => {
                                    void gitOps.deleteTag(tag);
                                }}
                            />
                        )}
                        renderMoreItems={({ label, count, children }) => (
                            <MoreItems label={label} count={count}>
                                {children}
                            </MoreItems>
                        )}
                    />

                    <StashesSection
                        expanded={!!expandedSections.stashes}
                        onToggle={() => { toggleSection('stashes'); }}
                        stashes={stashes}
                        renderStashItem={(stash, index) => (
                            <StashItem
                                key={index}
                                stash={stash}
                                index={index}
                                onApply={() => {
                                    void gitOps.stashApply(index);
                                }}
                                onPop={() => {
                                    void gitOps.stashPop(index);
                                }}
                                onDrop={() => {
                                    void gitOps.stashDrop(index);
                                }}
                            />
                        )}
                    />

                    <WorktreesSection
                        expanded={!!expandedSections.worktrees}
                        onToggle={() => { toggleSection('worktrees'); }}
                        worktrees={worktrees}
                        {...(onOpenWorktrees ? { onOpenWorktrees } : {})}
                        onReveal={(path) => {
                            revealMutation.mutate({ path });
                        }}
                        renderWorktreeItem={(props) => <WorktreeItem key={props.worktree.path} {...props} />}
                    />

                    <SubmodulesSection
                        expanded={!!expandedSections.submodules}
                        onToggle={() => { toggleSection('submodules'); }}
                        submodules={submodulesData?.submodules ?? []}
                        renderSubmoduleItem={(submodule) => <SubmoduleItem key={submodule.path} submodule={submodule} />}
                    />
                </div>
            </ScrollArea>
            <BranchRenameDialog
                open={renameBranchOpen}
                onOpenChange={(open) => {
                    setRenameBranchOpen(open);
                    if (!open) {
                        setRenameBranchTarget(null);
                    }
                }}
                branchName={renameBranchTarget ?? ''}
                onRename={(oldName, newName, force) => {
                    void gitOps.renameBranch(oldName, newName, force);
                }}
            />
        </div>
    );
}

export function RepoAttentionSummary({
    dirtyCount,
    ahead,
    behind,
    openPullRequests,
    needsAttention,
    stale,
    statusSignals,
}: {
    dirtyCount: number;
    ahead: number;
    behind: number;
    openPullRequests: number;
    needsAttention: boolean;
    stale: boolean;
    statusSignals: string[];
}) {
    const chips = [
        dirtyCount > 0 ? `${String(dirtyCount)} changed` : null,
        ahead > 0 ? `${String(ahead)} ahead` : null,
        behind > 0 ? `${String(behind)} behind` : null,
        openPullRequests > 0 ? `${String(openPullRequests)} PR` : null,
        stale ? 'stale' : null,
    ].filter((value): value is string => Boolean(value));

    if (chips.length === 0 && statusSignals.length === 0 && !needsAttention) {
        return null;
    }

    return (
        <div className='mt-2 rounded-lg border border-border/70 bg-background/80 p-2'>
            <div className='mb-1 flex items-center gap-1.5'>
                <AlertTriangle className={`h-3.5 w-3.5 ${needsAttention ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className='text-[11px] font-semibold'>Repo attention</span>
            </div>
            <div className='flex flex-wrap gap-1'>
                {chips.map((chip) => (
                    <span
                        key={chip}
                        className='rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground'>
                        {chip}
                    </span>
                ))}
                {statusSignals.slice(0, 2).map((signal) => (
                    <span
                        key={signal}
                        className='rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-200'>
                        {signal}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default SidePanel;

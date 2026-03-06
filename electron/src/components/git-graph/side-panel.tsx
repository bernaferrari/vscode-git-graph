/**
 * Git Graph Side Panel
 * Beautiful, clean sidebar for branches, tags, remotes, stashes
 */

import {
    ChevronRight,
    ChevronDown,
    GitBranch,
    Tag,
    Archive,
    Globe,
    Plus,
    Trash2,
    Check,
    ArrowUp,
    ArrowDown,
    Search,
    FolderTree,
    GitMerge,
    Box,
    Ellipsis,
    Pin,
} from 'lucide-react';
import { useMemo, useState, type ElementType, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

const SIDE_ITEM_CLASS =
    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35';

interface SidePanelProps {
    onBranchSelect?: (branch: string) => void;
    onCreateBranch?: () => void;
    onCreateTag?: () => void;
    onMergeBranch?: (branch: string) => void;
    enableBranchPinning?: boolean;
}

interface AheadBehindEntry {
    branch: string;
    ahead: number;
    behind: number;
    upstream: string | null;
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

interface WorktreeEntry {
    path: string;
    branch?: string;
    isMain?: boolean;
}

interface WorktreesResult {
    worktrees: WorktreeEntry[];
}

interface SubmoduleEntry {
    path: string;
    status: string;
}

interface SubmoduleListResult {
    submodules: SubmoduleEntry[];
}

interface PinnedBranchesResult {
    branches: string[];
}

interface SmartBranchEntry {
    name: string;
    pinned: boolean;
    current: boolean;
    ahead: number;
    behind: number;
    score: number;
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
}: SidePanelProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const trpcUtils = trpc.useUtils();
    const gitOps = useGitOperations();

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

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    if (!activeRepo) return null;

    const localBranches = repoInfo?.branches.filter((b) => !b.startsWith('remotes/')) ?? [];
    const remoteBranches = repoInfo?.branches.filter((b) => b.startsWith('remotes/') && !b.endsWith('/HEAD')) ?? [];
    const tags = repoInfo?.tags ?? [];
    const stashes = repoInfo?.stashes ?? [];
    const worktrees = worktreesData?.worktrees ?? [];
    const currentHead = repoInfo?.head;

    const filterBySearch = <T extends string>(items: T[]): T[] =>
        searchQuery ? items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())) : items;

    const filteredLocalBranches = filterBySearch(localBranches);
    const filteredRemoteBranches = filterBySearch(remoteBranches);
    const filteredTags = filterBySearch(tags);
    const pinnedBranches = pinnedData?.branches ?? [];
    const aheadBehindLookup = useMemo(
        () =>
            new Map<string, AheadBehindEntry>(
                (aheadBehindData?.branches ?? []).map((entry) => [entry.branch, entry])
            ),
        [aheadBehindData?.branches]
    );
    const smartBranchesLookup = useMemo(
        () => new Map<string, SmartBranchEntry>((smartBranchesData?.branches ?? []).map((entry) => [entry.name, entry])),
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
            </div>

            <ScrollArea className='flex-1'>
                <div className='ui-reveal space-y-1 p-2'>
                    {/* Local Branches */}
                    <Section
                        title='Branches'
                        icon={GitBranch}
                        count={displayedLocalBranches.length}
                        expanded={!!expandedSections.branches}
                        onToggle={() => { toggleSection('branches'); }}
                        action={
                            <Button
                                variant='ghost'
                                size='sm'
                                className='hover:bg-accent h-5 w-5 p-0'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateBranch?.();
                                }}>
                                <Plus className='h-3 w-3' />
                            </Button>
                        }>
                        <div className='mb-1 flex gap-1'>
                            <FilterChip label='All' active={branchChip === 'all'} onClick={() => { setBranchChip('all'); }} />
                                <FilterChip
                                    label='Pinned'
                                    active={branchChip === 'pinned'}
                                    onClick={() => { setBranchChip('pinned'); }}
                                    disabled={!enableBranchPinning}
                                />
                            <FilterChip
                                label='Needs'
                                active={branchChip === 'attention'}
                                onClick={() => { setBranchChip('attention'); }}
                            />
                        </div>
                        {displayedLocalBranches.map((branch) => {
                            const aheadBehind = aheadBehindLookup.get(branch);
                            const pinned = pinnedBranches.includes(branch);
                            return (
                                <BranchItem
                                    key={branch}
                                    branch={branch}
                                    isCurrent={branch === currentHead}
                                    pinned={pinned}
                                    onCheckout={() => {
                                        void gitOps.checkout(branch);
                                    }}
                                    onDelete={() => {
                                        void gitOps.deleteBranch(branch, false);
                                    }}
                                    onSelect={onBranchSelect}
                                    onMerge={onMergeBranch ? () => { onMergeBranch(branch); } : undefined}
                                    ahead={aheadBehind?.ahead}
                                    behind={aheadBehind?.behind}
                                    onPinToggle={() => {
                                        if (!enableBranchPinning) {
                                            return;
                                        }
                                        if (pinned) {
                                            unpinMutation.mutate({ repo: activeRepo, branch });
                                        } else {
                                            pinMutation.mutate({ repo: activeRepo, branch });
                                        }
                                    }}
                                />
                            );
                        })}
                        {displayedLocalBranches.length === 0 && (
                            <div className='text-muted-foreground px-2 py-1 text-xs'>No local branches found</div>
                        )}
                    </Section>

                    {/* Remote Branches */}
                    {remoteBranches.length > 0 && (
                        <Section
                            title='Remote'
                            icon={Globe}
                            count={filteredRemoteBranches.length}
                            expanded={!!expandedSections.remotes}
                            onToggle={() => { toggleSection('remotes'); }}>
                            {filteredRemoteBranches.slice(0, 20).map((branch) => (
                                <RemoteBranchItem
                                    key={branch}
                                    branch={branch}
                                    onSelect={onBranchSelect}
                                    onCheckout={() => {
                                        void gitOps.checkout(branch);
                                    }}
                                />
                            ))}
                            {filteredRemoteBranches.length > 20 && (
                                <MoreItems
                                    label={`+${String(filteredRemoteBranches.length - 20)} more`}
                                    count={filteredRemoteBranches.length - 20}>
                                    {filteredRemoteBranches.slice(20).map((branch) => (
                                        <RemoteBranchItem
                                            key={branch}
                                            branch={branch}
                                            onSelect={onBranchSelect}
                                            onCheckout={() => {
                                                void gitOps.checkout(branch);
                                            }}
                                        />
                                    ))}
                                </MoreItems>
                            )}
                            {filteredRemoteBranches.length === 0 && (
                                <div className='text-muted-foreground px-2 py-1 text-xs'>No remote branches found</div>
                            )}
                        </Section>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                        <Section
                            title='Tags'
                            icon={Tag}
                            count={filteredTags.length}
                            expanded={!!expandedSections.tags}
                            onToggle={() => { toggleSection('tags'); }}
                            action={
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='hover:bg-accent h-5 w-5 p-0'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCreateTag?.();
                                    }}>
                                    <Plus className='h-3 w-3' />
                                </Button>
                            }>
                            {filteredTags.slice(0, 30).map((tag) => (
                                <TagItem
                                    key={tag}
                                    tag={tag}
                                    onDelete={() => {
                                        void gitOps.deleteTag(tag);
                                    }}
                                />
                            ))}
                            {filteredTags.length > 30 && (
                                <MoreItems
                                    label={`+${String(filteredTags.length - 30)} more`}
                                    count={filteredTags.length - 30}>
                                    {filteredTags.slice(30).map((tag) => (
                                        <TagItem
                                            key={tag}
                                            tag={tag}
                                            onDelete={() => {
                                                void gitOps.deleteTag(tag);
                                            }}
                                        />
                                    ))}
                                </MoreItems>
                            )}
                            {filteredTags.length === 0 && (
                                <div className='text-muted-foreground px-2 py-1 text-xs'>No tags found</div>
                            )}
                        </Section>
                    )}

                    {/* Stashes */}
                    {stashes.length > 0 && (
                        <Section
                            title='Stashes'
                            icon={Archive}
                            count={stashes.length}
                            expanded={!!expandedSections.stashes}
                            onToggle={() => { toggleSection('stashes'); }}>
                            {stashes.map((stash, index) => (
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
                            ))}
                        </Section>
                    )}

                    {/* Worktrees */}
                    {worktrees.length > 0 && (
                        <Section
                            title='Worktrees'
                            icon={FolderTree}
                            count={worktrees.length}
                            expanded={!!expandedSections.worktrees}
                            onToggle={() => { toggleSection('worktrees'); }}>
                            {worktrees.map((wt) => (
                                <WorktreeItem key={wt.path} worktree={wt} />
                            ))}
                        </Section>
                    )}

                    {/* Submodules */}
                    {submodulesData?.submodules && submodulesData.submodules.length > 0 && (
                        <Section
                            title='Submodules'
                            icon={Box}
                            count={submodulesData.submodules.length}
                            expanded={!!expandedSections.submodules}
                            onToggle={() => { toggleSection('submodules'); }}>
                            {submodulesData.submodules.map((sm) => (
                                <SubmoduleItem key={sm.path} submodule={sm} />
                            ))}
                        </Section>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Section component
function Section({
    title,
    icon: Icon,
    count,
    expanded,
    onToggle,
    action,
    children,
}: {
    title: string;
    icon: ElementType;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className='mb-1'>
            <div className='flex items-center gap-1'>
                <button
                    onClick={onToggle}
                    className='text-muted-foreground hover:bg-accent/55 hover:border-border/65 hover:text-foreground focus-visible:ring-primary/30 flex flex-1 items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:ring-2'>
                    {expanded ? (
                        <ChevronDown className='h-3.5 w-3.5 shrink-0' />
                    ) : (
                        <ChevronRight className='h-3.5 w-3.5 shrink-0' />
                    )}
                    <Icon className='h-3.5 w-3.5 shrink-0' />
                    <span className='flex-1 text-left'>{title}</span>
                    <span className='bg-muted/80 rounded px-1.5 py-0.5 text-[10px] tabular-nums'>{count}</span>
                </button>
                {action && <div className='shrink-0'>{action}</div>}
            </div>
            {expanded && <div className='mt-1 ml-1.5 space-y-0.5'>{children}</div>}
        </div>
    );
}

function FilterChip({
    label,
    active,
    onClick,
    disabled,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type='button'
            className={`rounded border px-1.5 py-0.5 text-[10px] ${active ? 'border-primary text-primary bg-primary/10' : 'text-muted-foreground border-border/60 hover:bg-accent'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={onClick}
            disabled={disabled}>
            {label}
        </button>
    );
}

// Branch item
function BranchItem({
    branch,
    isCurrent,
    pinned,
    ahead,
    behind,
    onSelect,
    onCheckout,
    onMerge,
    onDelete,
    onPinToggle,
}: {
    branch: string;
    isCurrent: boolean;
    pinned?: boolean;
    ahead?: number;
    behind?: number;
    onSelect?: (branch: string) => void;
    onCheckout: () => unknown;
    onMerge?: () => unknown;
    onDelete: () => unknown;
    onPinToggle?: () => void;
}) {
    const hasAheadBehind = (ahead ?? 0) > 0 || (behind ?? 0) > 0;

    return (
        <div
            className={`${SIDE_ITEM_CLASS} ${isCurrent ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-accent/45 active:bg-accent/60'}`}
            onClick={() => {
                onSelect?.(branch);
            }}
            onDoubleClick={() => {
                void onCheckout();
            }}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(branch);
                }
            }}>
            <GitBranch className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`flex-1 truncate ${isCurrent ? 'text-primary font-semibold' : 'font-medium'}`}>
                {branch}
            </span>
            {pinned && <Pin className='h-3 w-3 shrink-0 text-amber-500' />}
            {hasAheadBehind && (
                <span className='flex shrink-0 items-center gap-0.5 text-[10px]'>
                    {(ahead ?? 0) > 0 && (
                        <span className='flex items-center text-emerald-600 dark:text-emerald-400'>
                            <ArrowUp className='h-2.5 w-2.5' />
                            {ahead}
                        </span>
                    )}
                    {(behind ?? 0) > 0 && (
                        <span className='flex items-center text-amber-600 dark:text-amber-400'>
                            <ArrowDown className='h-2.5 w-2.5' />
                            {behind}
                        </span>
                    )}
                </span>
            )}
            {isCurrent && <Check className='text-primary h-3 w-3 shrink-0' />}
            {!isCurrent && (
                <ActionMenu>
                    {onPinToggle && (
                        <button
                            className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                            onClick={(e) => {
                                e.stopPropagation();
                                onPinToggle();
                            }}>
                            <Pin className='h-3.5 w-3.5' /> {pinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}
                    <button
                        className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect?.(branch);
                            void onCheckout();
                        }}>
                        <Check className='h-3.5 w-3.5' /> Checkout
                    </button>
                    <button
                        className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onMerge) {
                                void onMerge();
                            }
                        }}>
                        <GitMerge className='h-3.5 w-3.5' /> Merge
                    </button>
                    <div className='bg-border mx-2 my-1 h-px' />
                    <button
                        className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        onClick={(e) => {
                            e.stopPropagation();
                            void onDelete();
                        }}>
                        <Trash2 className='h-3.5 w-3.5' /> Delete
                    </button>
                </ActionMenu>
            )}
        </div>
    );
}

// Remote branch item
function RemoteBranchItem({
    branch,
    branchName,
    onSelect,
    onCheckout,
}: {
    branch: string;
    branchName?: string;
    onSelect?: (branch: string) => void;
    onCheckout: () => unknown;
}) {
    const displayBranch = branch.replace('remotes/', '');
    const [remote, ...rest] = displayBranch.split('/');
    const shortBranchName = rest.join('/');
    const resolvedBranch = branchName ?? shortBranchName;

    return (
        <div
            className={`${SIDE_ITEM_CLASS} hover:bg-accent/45 active:bg-accent/60`}
            onClick={() => {
                onSelect?.(branch);
            }}
            onDoubleClick={() => {
                void onCheckout();
            }}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(branch);
                }
            }}>
            <Globe className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
            <span className='text-muted-foreground shrink-0 text-[10px]'>{remote}/</span>
            <span className='flex-1 truncate font-medium'>{resolvedBranch}</span>
        </div>
    );
}

// Tag item
function TagItem({ tag, onDelete }: { tag: string; onDelete: () => void }) {
    return (
        <div className={`${SIDE_ITEM_CLASS} hover:bg-accent/45 active:bg-accent/60`}>
            <Tag className='h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />
            <span className='flex-1 truncate font-medium'>{tag}</span>
            <ActionMenu>
                <button
                    className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    onClick={() => { onDelete(); }}>
                    <Trash2 className='h-3.5 w-3.5' /> Delete
                </button>
            </ActionMenu>
        </div>
    );
}

// Stash item
function StashItem({
    stash,
    index,
    onApply,
    onPop,
    onDrop,
}: {
    stash: { message?: string };
    index: number;
    onApply: () => void;
    onPop: () => void;
    onDrop: () => void;
}) {
    return (
        <div className={`${SIDE_ITEM_CLASS} hover:bg-accent/45 active:bg-accent/60`}>
            <Archive className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
            <span className='flex-1 truncate font-medium'>{stash.message || `Stash ${String(index)}`}</span>
            <ActionMenu>
                <button
                    className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                    onClick={onApply}>
                    <ArrowDown className='h-3.5 w-3.5' /> Apply
                </button>
                <button className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs' onClick={onPop}>
                    <ArrowUp className='h-3.5 w-3.5' /> Pop
                </button>
                <div className='bg-border mx-2 my-1 h-px' />
                <button
                    className='flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    onClick={onDrop}>
                    <Trash2 className='h-3.5 w-3.5' /> Drop
                </button>
            </ActionMenu>
        </div>
    );
}

// Worktree item
function WorktreeItem({ worktree }: { worktree: { path: string; branch?: string; isMain?: boolean } }) {
    const folderName = worktree.path.split('/').pop();

    return (
        <div className='hover:bg-accent/45 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors'>
            <FolderTree
                className={`h-3.5 w-3.5 shrink-0 ${worktree.isMain ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className='flex-1 truncate' title={worktree.path}>
                {folderName}
            </span>
            {worktree.isMain && <span className='text-primary text-[10px] font-medium'>main</span>}
            {worktree.branch && !worktree.isMain && (
                <span className='text-muted-foreground truncate text-[10px]'>{worktree.branch}</span>
            )}
        </div>
    );
}

// Submodule item
function SubmoduleItem({ submodule }: { submodule: { path: string; status: string } }) {
    const getStatusIcon = () => {
        if (submodule.status === '+') return <span className='text-[10px] text-emerald-500'>●</span>;
        if (submodule.status === '-') return <span className='text-[10px] text-red-500'>●</span>;
        if (submodule.status === 'U') return <span className='text-[10px] text-amber-500'>●</span>;
        return null;
    };

    return (
        <div className='hover:bg-accent/45 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors'>
            <Box className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
            <span className='flex-1 truncate' title={submodule.path}>
                {submodule.path}
            </span>
            {getStatusIcon()}
        </div>
    );
}

// Action menu popover
function ActionMenu({ children }: { children: ReactNode }) {
    return (
        <Popover>
            <PopoverTrigger
                className='hover:bg-accent text-muted-foreground hover:text-foreground h-5 w-5 rounded p-0 opacity-0 transition-all duration-150 group-hover:opacity-100'
                onClick={(e) => { e.stopPropagation(); }}>
                <Ellipsis className='h-3.5 w-3.5' />
            </PopoverTrigger>
            <PopoverContent className='ui-inline-menu w-40 p-1' align='end' side='right' sideOffset={5}>
                {children}
            </PopoverContent>
        </Popover>
    );
}

// More items popover
function MoreItems({ label, count, children }: { label: string; count: number; children: ReactNode }) {
    return (
        <Popover>
            <PopoverTrigger className='text-primary hover:text-primary/85 w-full rounded px-2 py-1 text-left text-xs font-medium transition-colors hover:underline'>
                {label}
            </PopoverTrigger>
            <PopoverContent className='ui-inline-menu w-80 p-0' align='start' side='right' sideOffset={5}>
                <div className='bg-muted/30 flex items-center justify-between border-b px-3 py-2'>
                    <span className='text-sm font-medium'>{String(count)} items</span>
                </div>
                <ScrollArea className='h-[500px] max-h-[60vh]'>
                    <div className='py-1'>{children}</div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export default SidePanel;

import { Archive, Box, FolderTree, GitBranch, Globe, Plus, Tag, Wrench } from 'lucide-react';


import { Button } from '@/components/ui/button';

import type { AheadBehindEntry, StashEntry, SubmoduleEntry, WorktreeEntry } from './side-panel-types';
import type { ReactNode } from 'react';

export function SidePanelSection({
    title,
    icon,
    count,
    expanded,
    onToggle,
    action,
    children,
}: {
    title: string;
    icon: React.ElementType;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    action?: ReactNode;
    children: ReactNode;
}) {
    const Icon = icon;
    return (
        <div className='mb-1'>
            <div className='flex items-center gap-1'>
                <button
                    onClick={onToggle}
                    className='text-muted-foreground hover:bg-accent/55 hover:border-border/65 hover:text-foreground focus-visible:ring-primary/30 flex flex-1 items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:ring-2'>
                    {expanded ? (
                        <svg className='h-3.5 w-3.5 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='m6 9 6 6 6-6'/></svg>
                    ) : (
                        <svg className='h-3.5 w-3.5 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='m9 18 6-6-6-6'/></svg>
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

export function BranchesSection({
    expanded,
    onToggle,
    onCreateBranch,
    branchChip,
    setBranchChip,
    enableBranchPinning,
    displayedLocalBranches,
    currentHead,
    pinnedBranches,
    aheadBehindLookup,
    onBranchSelect,
    onCheckout,
    onDelete,
    onPublishBranch,
    canTrackBranch,
    onTrackBranch,
    onRenameBranch,
    onMergeBranch,
    onPinToggle,
    renderBranchItem,
}: {
    expanded: boolean;
    onToggle: () => void;
    onCreateBranch?: () => void;
    branchChip: 'all' | 'pinned' | 'attention';
    setBranchChip: (chip: 'all' | 'pinned' | 'attention') => void;
    enableBranchPinning: boolean;
    displayedLocalBranches: string[];
    currentHead?: string | null;
    pinnedBranches: string[];
    aheadBehindLookup: Map<string, AheadBehindEntry>;
    onBranchSelect?: (branch: string) => void;
    onCheckout: (branch: string) => void;
    onDelete: (branch: string) => void;
    onPublishBranch?: (branch: string) => void;
    canTrackBranch?: (branch: string) => boolean;
    onTrackBranch?: (branch: string) => void;
    onRenameBranch?: (branch: string) => void;
    onMergeBranch?: (branch: string) => void;
    onPinToggle: (branch: string, pinned: boolean) => void;
    renderBranchItem: (props: {
        branch: string;
        isCurrent: boolean;
        pinned: boolean;
        ahead?: number;
        behind?: number;
        upstream?: string | null;
        onSelect?: (branch: string) => void;
        onCheckout: () => unknown;
        onPublish?: () => unknown;
        onTrackUpstream?: () => unknown;
        onRename?: () => unknown;
        onMerge?: () => unknown;
        onDelete: () => unknown;
        onPinToggle?: () => void;
    }) => ReactNode;
}) {
    return (
        <SidePanelSection
            title='Branches'
            icon={GitBranch}
            count={displayedLocalBranches.length}
            expanded={expanded}
            onToggle={onToggle}
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
                return renderBranchItem({
                    branch,
                    isCurrent: branch === currentHead,
                    pinned,
                    ...(aheadBehind?.ahead !== undefined ? { ahead: aheadBehind.ahead } : {}),
                    ...(aheadBehind?.behind !== undefined ? { behind: aheadBehind.behind } : {}),
                    upstream: aheadBehind?.upstream ?? null,
                    ...(onBranchSelect ? { onSelect: onBranchSelect } : {}),
                    onCheckout: () => { onCheckout(branch); },
                    ...(onPublishBranch ? { onPublish: () => { onPublishBranch(branch); } } : {}),
                    ...(onTrackBranch && (!canTrackBranch || canTrackBranch(branch))
                        ? { onTrackUpstream: () => { onTrackBranch(branch); } }
                        : {}),
                    ...(onRenameBranch ? { onRename: () => { onRenameBranch(branch); } } : {}),
                    onDelete: () => { onDelete(branch); },
                    ...(onMergeBranch ? { onMerge: () => { onMergeBranch(branch); } } : {}),
                    onPinToggle: () => { onPinToggle(branch, pinned); },
                });
            })}
            {displayedLocalBranches.length === 0 && (
                <div className='text-muted-foreground px-2 py-1 text-xs'>No local branches found</div>
            )}
        </SidePanelSection>
    );
}

export function RemoteBranchesSection({
    expanded,
    onToggle,
    remoteBranches,
    filteredRemoteBranches,
    onBranchSelect,
    onCheckout,
    onDeleteRemoteBranch,
    renderRemoteBranchItem,
    renderMoreItems,
}: {
    expanded: boolean;
    onToggle: () => void;
    remoteBranches: string[];
    filteredRemoteBranches: string[];
    onBranchSelect?: (branch: string) => void;
    onCheckout: (branch: string) => void;
    onDeleteRemoteBranch?: (remote: string, branchName: string) => void;
    renderRemoteBranchItem: (props: {
        branch: string;
        onSelect?: (branch: string) => void;
        onCheckout: () => unknown;
        onDeleteRemote?: () => unknown;
    }) => ReactNode;
    renderMoreItems: (props: { label: string; count: number; children: ReactNode }) => ReactNode;
}) {
    if (remoteBranches.length === 0) {
        return null;
    }
    return (
        <SidePanelSection
            title='Remote'
            icon={Globe}
            count={filteredRemoteBranches.length}
            expanded={expanded}
            onToggle={onToggle}>
            {filteredRemoteBranches.slice(0, 20).map((branch) =>
                renderRemoteBranchItem({
                    branch,
                    ...(onBranchSelect ? { onSelect: onBranchSelect } : {}),
                    onCheckout: () => { onCheckout(branch); },
                    ...(onDeleteRemoteBranch ? { onDeleteRemote: () => {
                        const [remote, ...rest] = branch.replace(/^remotes\//, '').split('/');
                        if (remote && rest.length > 0) {
                            onDeleteRemoteBranch(remote, rest.join('/'));
                        }
                    } } : {}),
                })
            )}
            {filteredRemoteBranches.length > 20 &&
                renderMoreItems({
                    label: `+${String(filteredRemoteBranches.length - 20)} more`,
                    count: filteredRemoteBranches.length - 20,
                    children: filteredRemoteBranches.slice(20).map((branch) =>
                        renderRemoteBranchItem({
                            branch,
                            ...(onBranchSelect ? { onSelect: onBranchSelect } : {}),
                            onCheckout: () => { onCheckout(branch); },
                            ...(onDeleteRemoteBranch ? { onDeleteRemote: () => {
                                const [remote, ...rest] = branch.replace(/^remotes\//, '').split('/');
                                if (remote && rest.length > 0) {
                                    onDeleteRemoteBranch(remote, rest.join('/'));
                                }
                            } } : {}),
                        })
                    ),
                })}
            {filteredRemoteBranches.length === 0 && (
                <div className='text-muted-foreground px-2 py-1 text-xs'>No remote branches found</div>
            )}
        </SidePanelSection>
    );
}

export function WorktreesSection({
    expanded,
    onToggle,
    worktrees,
    onOpenWorktrees,
    onReveal,
    renderWorktreeItem,
}: {
    expanded: boolean;
    onToggle: () => void;
    worktrees: WorktreeEntry[];
    onOpenWorktrees?: () => void;
    onReveal: (path: string) => void;
    renderWorktreeItem: (props: {
        worktree: WorktreeEntry;
        onReveal: () => void;
        onOpenWorktrees?: () => void;
    }) => ReactNode;
}) {
    if (worktrees.length === 0) {
        return null;
    }
    return (
        <SidePanelSection
            title='Worktrees'
            icon={FolderTree}
            count={worktrees.length}
            expanded={expanded}
            onToggle={onToggle}
            action={
                onOpenWorktrees ? (
                    <Button
                        variant='ghost'
                        size='sm'
                        className='hover:bg-accent h-5 w-5 p-0'
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenWorktrees();
                        }}
                        aria-label='Open worktree center'>
                        <Wrench className='h-3 w-3' />
                    </Button>
                ) : undefined
            }>
            {worktrees.map((wt) =>
                renderWorktreeItem({
                    worktree: wt,
                    onReveal: () => { onReveal(wt.path); },
                    ...(onOpenWorktrees ? { onOpenWorktrees } : {}),
                })
            )}
        </SidePanelSection>
    );
}

export function TagsSection({
    expanded,
    onToggle,
    filteredTags,
    onCreateTag,
    renderTagItem,
    renderMoreItems,
}: {
    expanded: boolean;
    onToggle: () => void;
    filteredTags: string[];
    onCreateTag?: () => void;
    renderTagItem: (tag: string) => ReactNode;
    renderMoreItems: (props: { label: string; count: number; children: ReactNode }) => ReactNode;
}) {
    if (filteredTags.length === 0) {
        return null;
    }
    return (
        <SidePanelSection
            title='Tags'
            icon={Tag}
            count={filteredTags.length}
            expanded={expanded}
            onToggle={onToggle}
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
            {filteredTags.slice(0, 30).map((tag) => renderTagItem(tag))}
            {filteredTags.length > 30 &&
                renderMoreItems({
                    label: `+${String(filteredTags.length - 30)} more`,
                    count: filteredTags.length - 30,
                    children: filteredTags.slice(30).map((tag) => renderTagItem(tag)),
                })}
        </SidePanelSection>
    );
}

export function StashesSection({
    expanded,
    onToggle,
    stashes,
    renderStashItem,
}: {
    expanded: boolean;
    onToggle: () => void;
    stashes: StashEntry[];
    renderStashItem: (stash: StashEntry, index: number) => ReactNode;
}) {
    if (stashes.length === 0) {
        return null;
    }
    return (
        <SidePanelSection
            title='Stashes'
            icon={Archive}
            count={stashes.length}
            expanded={expanded}
            onToggle={onToggle}>
            {stashes.map((stash, index) => renderStashItem(stash, index))}
        </SidePanelSection>
    );
}

export function SubmodulesSection({
    expanded,
    onToggle,
    submodules,
    renderSubmoduleItem,
}: {
    expanded: boolean;
    onToggle: () => void;
    submodules: SubmoduleEntry[];
    renderSubmoduleItem: (submodule: SubmoduleEntry) => ReactNode;
}) {
    if (submodules.length === 0) {
        return null;
    }
    return (
        <SidePanelSection
            title='Submodules'
            icon={Box}
            count={submodules.length}
            expanded={expanded}
            onToggle={onToggle}>
            {submodules.map((submodule) => renderSubmoduleItem(submodule))}
        </SidePanelSection>
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

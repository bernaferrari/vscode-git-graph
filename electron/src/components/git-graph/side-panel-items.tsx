import {
    Archive,
    ArrowDown,
    ArrowUp,
    Box,
    Check,
    Ellipsis,
    FolderOpen,
    FolderTree,
    GitBranch,
    GitMerge,
    Globe,
    Pin,
    Tag,
    Trash2,
    Wrench,
} from 'lucide-react';


import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { StashEntry, SubmoduleEntry, WorktreeEntry } from './side-panel-types';
import type { ReactNode } from 'react';

const SIDE_ITEM_CLASS =
    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35';

export function BranchItem({
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

export function RemoteBranchItem({
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

export function TagItem({ tag, onDelete }: { tag: string; onDelete: () => void }) {
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

export function StashItem({
    stash,
    index,
    onApply,
    onPop,
    onDrop,
}: {
    stash: StashEntry;
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

export function WorktreeItem({
    worktree,
    onReveal,
    onOpenWorktrees,
}: {
    worktree: WorktreeEntry;
    onReveal: () => void;
    onOpenWorktrees?: () => void;
}) {
    const folderName = worktree.path.split('/').pop();

    return (
        <div className='group hover:bg-accent/45 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors'>
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
            <ActionMenu>
                <button
                    className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                    onClick={onReveal}>
                    <FolderOpen className='h-3.5 w-3.5' /> Reveal in Finder
                </button>
                {onOpenWorktrees && (
                    <button
                        className='hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-xs'
                        onClick={onOpenWorktrees}>
                        <Wrench className='h-3.5 w-3.5' /> Open Worktree Center
                    </button>
                )}
            </ActionMenu>
        </div>
    );
}

export function SubmoduleItem({ submodule }: { submodule: SubmoduleEntry }) {
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

export function MoreItems({ label, count, children }: { label: string; count: number; children: ReactNode }) {
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

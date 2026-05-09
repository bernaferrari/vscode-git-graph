import {
    Archive,
    ArrowDown,
    ArrowUp,
    Box,
    Check,
    Edit2,
    Ellipsis,
    FolderOpen,
    FolderTree,
    GitBranch,
    GitMerge,
    Globe,
    Pin,
    Sparkles,
    Upload,
    Tag,
    Trash2,
    Wrench,
} from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { StashEntry, SubmoduleEntry, WorktreeEntry } from './side-panel-types';
import type { ReactNode } from 'react';

const SIDE_ITEM_CLASS =
    'group/side-item relative flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[0.8125rem] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45';

const ACTION_MENU_ITEM =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-foreground/85 transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground';

const ACTION_MENU_DESTRUCTIVE =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-destructive transition-colors hover:bg-destructive/10 [&_svg]:size-3.5 [&_svg]:text-destructive';

export function BranchItem({
    branch,
    isCurrent,
    pinned,
    ahead,
    behind,
    upstream,
    onSelect,
    onCheckout,
    onPublish,
    onTrackUpstream,
    onRename,
    onMerge,
    onBringIn,
    onCreateWorktree,
    onDelete,
    onPinToggle,
}: {
    branch: string;
    isCurrent: boolean;
    pinned?: boolean;
    ahead?: number;
    behind?: number;
    upstream?: string | null;
    onSelect?: (branch: string) => void;
    onCheckout: () => unknown;
    onPublish?: () => unknown;
    onTrackUpstream?: () => unknown;
    onRename?: () => unknown;
    onMerge?: () => unknown;
    onBringIn?: () => unknown;
    onCreateWorktree?: () => unknown;
    onDelete: () => unknown;
    onPinToggle?: () => void;
}) {
    return (
        <div
            className={`${SIDE_ITEM_CLASS} ${
                isCurrent
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/85 hover:bg-accent/55 hover:text-foreground'
            }`}
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
            {isCurrent && (
                <span aria-hidden className='absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-primary' />
            )}
            <GitBranch
                className={`h-3 w-3 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span
                className={`flex-1 truncate ${
                    isCurrent ? 'font-semibold tracking-[-0.005em]' : 'font-medium'
                }`}>
                {branch}
            </span>

            {pinned && <Pin className='h-2.5 w-2.5 shrink-0 fill-[color-mix(in_oklch,var(--warning)_85%,transparent)] text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]' />}

            {/* Ahead/behind compact tabular display */}
            {((ahead ?? 0) > 0 || (behind ?? 0) > 0) && (
                <span className='inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] tabular-nums'>
                    {(ahead ?? 0) > 0 && (
                        <span className='inline-flex items-center text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]'>
                            <ArrowUp className='h-2.5 w-2.5' />
                            {ahead}
                        </span>
                    )}
                    {(behind ?? 0) > 0 && (
                        <span className='inline-flex items-center text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]'>
                            <ArrowDown className='h-2.5 w-2.5' />
                            {behind}
                        </span>
                    )}
                </span>
            )}

            {/* Upstream indicator — only shown when unpublished, since published is the norm */}
            {!upstream && (
                <span
                    title='Branch is not published'
                    className='inline-flex shrink-0 items-center rounded-sm bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] px-1 py-[1px] text-[9px] font-medium uppercase tracking-[0.04em] leading-none text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]'>
                    new
                </span>
            )}

            {isCurrent && <Check className='text-primary h-3 w-3 shrink-0' />}

            <ActionMenu>
                {onPinToggle && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPinToggle();
                        }}>
                        <Pin /> {pinned ? 'Unpin' : 'Pin'}
                    </button>
                )}
                {!upstream && onPublish && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onPublish();
                        }}>
                        <Upload /> Publish to origin
                    </button>
                )}
                {!upstream && onTrackUpstream && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onTrackUpstream();
                        }}>
                        <GitBranch /> Track matching remote
                    </button>
                )}
                <button
                    type='button'
                    className={ACTION_MENU_ITEM}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect?.(branch);
                        void onCheckout();
                    }}>
                    <Check /> Checkout
                </button>
                {onRename && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onRename();
                        }}>
                        <Edit2 /> Rename
                    </button>
                )}
                {onBringIn && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onBringIn();
                        }}>
                        <Sparkles /> Bring in here
                    </button>
                )}
                {onMerge && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onMerge();
                        }}>
                        <GitMerge /> Classic merge…
                    </button>
                )}
                {onCreateWorktree && (
                    <button
                        type='button'
                        className={ACTION_MENU_ITEM}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onCreateWorktree();
                        }}>
                        <FolderTree /> Open in new worktree
                    </button>
                )}
                {!isCurrent && (
                    <>
                        <div className='bg-border/60 my-1 h-px' />
                        <button
                            type='button'
                            className={ACTION_MENU_DESTRUCTIVE}
                            onClick={(e) => {
                                e.stopPropagation();
                                void onDelete();
                            }}>
                            <Trash2 /> Delete
                        </button>
                    </>
                )}
            </ActionMenu>
        </div>
    );
}

export function RemoteBranchItem({
    branch,
    branchName,
    onSelect,
    onCheckout,
    onDeleteRemote,
}: {
    branch: string;
    branchName?: string;
    onSelect?: (branch: string) => void;
    onCheckout: () => unknown;
    onDeleteRemote?: () => unknown;
}) {
    const displayBranch = branch.replace('remotes/', '');
    const [remote, ...rest] = displayBranch.split('/');
    const shortBranchName = rest.join('/');
    const resolvedBranch = branchName ?? shortBranchName;

    return (
        <div
            className={`${SIDE_ITEM_CLASS} text-foreground/85 hover:bg-accent/55 hover:text-foreground`}
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
            <Globe className='text-muted-foreground h-3 w-3 shrink-0' />
            <span className='text-muted-foreground/85 shrink-0 font-mono text-[10px]'>{remote}/</span>
            <span className='flex-1 truncate font-medium'>{resolvedBranch}</span>
            {onDeleteRemote && (
                <ActionMenu>
                    <button
                        type='button'
                        className={ACTION_MENU_DESTRUCTIVE}
                        onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteRemote();
                        }}>
                        <Trash2 /> Delete remote branch
                    </button>
                </ActionMenu>
            )}
        </div>
    );
}

export function TagItem({ tag, onDelete }: { tag: string; onDelete: () => void }) {
    return (
        <div className={`${SIDE_ITEM_CLASS} text-foreground/85 hover:bg-accent/55 hover:text-foreground`}>
            <Tag className='h-3 w-3 shrink-0 text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]' />
            <span className='flex-1 truncate font-medium'>{tag}</span>
            <ActionMenu>
                <button type='button' className={ACTION_MENU_DESTRUCTIVE} onClick={() => { onDelete(); }}>
                    <Trash2 /> Delete tag
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
        <div className={`${SIDE_ITEM_CLASS} text-foreground/85 hover:bg-accent/55 hover:text-foreground`}>
            <Archive className='text-muted-foreground h-3 w-3 shrink-0' />
            <span className='flex-1 truncate font-medium'>{stash.message || `Stash ${String(index)}`}</span>
            <ActionMenu>
                <button type='button' className={ACTION_MENU_ITEM} onClick={onApply}>
                    <ArrowDown /> Apply (keep stash)
                </button>
                <button type='button' className={ACTION_MENU_ITEM} onClick={onPop}>
                    <ArrowUp /> Pop (apply + drop)
                </button>
                <div className='bg-border/60 my-1 h-px' />
                <button type='button' className={ACTION_MENU_DESTRUCTIVE} onClick={onDrop}>
                    <Trash2 /> Drop
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
    const isCurrent = worktree.isCurrent ?? false;
    const dirty = worktree.dirtyCount ?? 0;
    const locked = worktree.isLocked ?? false;
    const prunable = worktree.isPrunable ?? false;

    return (
        <div
            className={`${SIDE_ITEM_CLASS} ${
                isCurrent
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/85 hover:bg-accent/55 hover:text-foreground'
            }`}
            title={worktree.path}>
            {isCurrent && (
                <span aria-hidden className='absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-primary' />
            )}
            <FolderTree
                className={`h-3 w-3 shrink-0 ${worktree.isMain || isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className='flex-1 truncate font-medium'>{folderName}</span>
            {worktree.branch && (
                <span className='hidden truncate font-mono text-[10px] text-muted-foreground/85 group-hover/side-item:inline'>
                    {worktree.branch}
                </span>
            )}
            <span className='ml-auto flex shrink-0 items-center gap-1'>
                {worktree.isMain && !isCurrent && (
                    <span className='inline-flex items-center rounded-sm bg-primary/10 px-1 py-[1px] text-[9px] font-semibold uppercase tracking-[0.04em] leading-none text-primary/85'>
                        main
                    </span>
                )}
                {isCurrent && (
                    <span className='inline-flex items-center rounded-sm bg-primary px-1 py-[1px] text-[9px] font-semibold uppercase tracking-[0.04em] leading-none text-primary-foreground'>
                        you
                    </span>
                )}
                {dirty > 0 && (
                    <span
                        title={`${String(dirty)} uncommitted change${dirty === 1 ? '' : 's'}`}
                        className='inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--warning)_25%,transparent)] px-1 font-mono text-[9px] font-semibold tabular-nums text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]'>
                        {dirty}
                    </span>
                )}
                {locked && (
                    <span
                        title='Locked'
                        aria-hidden
                        className='h-1.5 w-1.5 rounded-full bg-[color-mix(in_oklch,var(--info)_70%,var(--foreground))]'
                    />
                )}
                {prunable && (
                    <span
                        title='Prunable (working tree missing)'
                        aria-hidden
                        className='h-1.5 w-1.5 rounded-full bg-destructive'
                    />
                )}
            </span>
            <ActionMenu>
                <button type='button' className={ACTION_MENU_ITEM} onClick={onReveal}>
                    <FolderOpen /> Reveal in Finder
                </button>
                {onOpenWorktrees && (
                    <button type='button' className={ACTION_MENU_ITEM} onClick={onOpenWorktrees}>
                        <Wrench /> Open worktree center
                    </button>
                )}
            </ActionMenu>
        </div>
    );
}

export function SubmoduleItem({ submodule }: { submodule: SubmoduleEntry }) {
    const dot =
        submodule.status === '+'
            ? 'bg-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]'
            : submodule.status === '-'
              ? 'bg-destructive'
              : submodule.status === 'U'
                ? 'bg-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]'
                : null;

    return (
        <div className={`${SIDE_ITEM_CLASS} text-foreground/85 hover:bg-accent/55 hover:text-foreground`}>
            <Box className='text-muted-foreground h-3 w-3 shrink-0' />
            <span className='flex-1 truncate font-medium' title={submodule.path}>
                {submodule.path}
            </span>
            {dot && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
        </div>
    );
}

export function MoreItems({ label, count, children }: { label: string; count: number; children: ReactNode }) {
    return (
        <Popover>
            <PopoverTrigger className='text-primary hover:text-primary/85 hover:bg-primary/8 w-full rounded-md px-2 py-1 text-left text-[11px] font-medium transition-colors'>
                {label}
            </PopoverTrigger>
            <PopoverContent className='w-80 p-0' align='start' side='right' sideOffset={5}>
                <div className='bg-muted/40 flex items-center justify-between border-b border-border/60 px-3 py-1.5'>
                    <span className='text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
                        {String(count)} items
                    </span>
                </div>
                <ScrollArea className='h-[460px] max-h-[60vh]'>
                    <div className='space-y-0.5 p-1'>{children}</div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

function ActionMenu({ children }: { children: ReactNode }) {
    return (
        <Popover>
            <PopoverTrigger
                className='ml-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground/80 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover/side-item:opacity-100 focus-visible:opacity-100'
                onClick={(e) => { e.stopPropagation(); }}>
                <Ellipsis className='h-3 w-3' />
            </PopoverTrigger>
            <PopoverContent className='w-52 p-1' align='end' side='right' sideOffset={4}>
                {children}
            </PopoverContent>
        </Popover>
    );
}

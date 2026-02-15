/**
 * Virtualized Commit List
 * Handles 100k+ commits with efficient rendering using @tanstack/react-virtual
 */

import { useRef, useCallback, memo, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GraphLayout } from '@/lib/graph/layout';
import { getGravatarUrl } from '@/lib/gravatar';

// Minimal commit type for display
interface DisplayCommit {
    hash: string;
    parents: string[];
    author: string;
    email: string;
    date: number;
    message: string;
    heads?: string[];
    tags?: string[];
    remotes?: string[];
}

interface VirtualizedCommitListProps {
    commits: DisplayCommit[];
    layout: GraphLayout | null;
    refLookup?: {
        headsByHash: Record<string, string[]>;
        tagsByHash: Record<string, string[]>;
        remotesByHash: Record<string, string[]>;
    };
    selectedIndex: number | null;
    expandedIndex: number | null;
    onSelect: (index: number) => void;
    onExpand: (index: number | null) => void;
    onContextMenu?: (index: number, event: React.MouseEvent) => void;
    onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
    onScrollOffsetChange?: (offset: number) => void;
    showAvatars?: boolean;
    hideRefs?: boolean;
    estimatedRowHeight?: number;
    overscan?: number;
}

// Row height - must match graph grid Y spacing
export const ROW_HEIGHT = 32;
const COMMIT_ROW_BASE_CLASS =
    'commit-row group relative flex cursor-pointer items-center gap-2.5 border-b border-border/35 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-inset';

// Semantic commit types with colors
const COMMIT_TYPES: Record<string, { color: string; bg: string }> = {
    feat: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    fix: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    docs: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    style: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    refactor: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    perf: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    test: { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    build: { color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    ci: { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-900/30' },
    chore: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/30' },
    revert: { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30' },
};

// Parse semantic commit message
function parseCommitMessage(message: string): { type?: string; scope?: string; description: string } {
    const firstLine = message.split('\n')[0] ?? '';
    const match = firstLine.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.*)$/);
    if (match) {
        const parsed = {
            type: match[1] ?? '',
            description: match[3] ?? firstLine,
        };
        return match[2] ? { ...parsed, scope: match[2] } : parsed;
    }
    return { description: firstLine };
}

// Format date helper
function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'yday';
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Memoized commit row for performance
const CommitRow = memo(function CommitRow({
    commit,
    heads,
    tags,
    remotes,
    isSelected,
    isMuted,
    graphOffset,
    onSelect,
    onToggleExpand,
    onContextMenu,
    showAvatar,
    hideRefs,
}: {
    commit: DisplayCommit;
    heads: string[];
    tags: string[];
    remotes: string[];
    isSelected: boolean;
    isMuted: boolean;
    graphOffset: number;
    onSelect: () => void;
    onToggleExpand: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    showAvatar: boolean;
    hideRefs: boolean;
}) {
    const isUncommitted = commit.hash === '*';
    const parsed = useMemo(() => parseCommitMessage(commit.message), [commit.message]);
    const typeInfo = parsed.type ? COMMIT_TYPES[parsed.type] : null;

    return (
        <div
            className={`${COMMIT_ROW_BASE_CLASS} ${
                isSelected
                    ? 'bg-accent/45 shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                    : 'hover:bg-accent/20 active:bg-accent/35'
            } ${isMuted ? 'opacity-50' : ''}`}
            tabIndex={0}
            title={commit.message.split('\n')[0] ?? ''}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
            onClick={onSelect}
            onDoubleClick={onToggleExpand}
            onContextMenu={onContextMenu}
            style={{
                paddingLeft: graphOffset + 16,
                paddingRight: 16,
                height: ROW_HEIGHT,
            }}>
            {/* Avatar */}
            {showAvatar && !isUncommitted && (
                <img
                    src={getGravatarUrl(commit.email, 40)}
                    alt={commit.author}
                    className='border-border/60 h-5 w-5 shrink-0 rounded-full border opacity-90'
                    loading='lazy'
                />
            )}

            {/* Refs */}
            {!hideRefs && (
                <div className='flex shrink-0 items-center gap-1'>
                    {heads.length > 0 && (
                        <span className='bg-primary/15 text-primary border-primary/30 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-tight'>
                            <GitBranchIcon />
                            {heads[0]}
                        </span>
                    )}
                    {heads.slice(1).map((head) => (
                        <span
                            key={head}
                            className='bg-muted/75 text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px]'>
                            {head}
                        </span>
                    ))}
                    {remotes.map((remote, i) => (
                        <span
                            key={i}
                            className='border-border/70 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]'>
                            <GlobeIcon />
                            {remote}
                        </span>
                    ))}
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className='inline-flex items-center gap-1 rounded-md border border-amber-200/70 bg-amber-50/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400'>
                            <TagIcon />
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Commit message */}
            <span className='min-w-0 flex-1 truncate text-[13px]'>
                {isUncommitted ? (
                    <span className='text-muted-foreground italic'>Uncommitted Changes</span>
                ) : typeInfo && parsed.type ? (
                    <>
                        <span
                            className={`${typeInfo.bg} ${typeInfo.color} mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold`}>
                            {parsed.type}
                            {parsed.scope && <span className='opacity-70'>({parsed.scope})</span>}
                        </span>
                        <span className='truncate'>{parsed.description}</span>
                    </>
                ) : (
                    <span className='truncate'>{parsed.description}</span>
                )}
            </span>

            {/* Author, hash, date */}
            {!isUncommitted && (
                <div
                    className={`text-muted-foreground flex shrink-0 items-center gap-4 text-xs transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-45 group-hover:opacity-85'
                    }`}>
                    <span className='w-24 truncate font-medium'>{commit.author}</span>
                    <span className='bg-muted/85 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-tight'>
                        {commit.hash.slice(0, 7)}
                    </span>
                    <span className='w-16 text-right tabular-nums'>{formatDate(commit.date)}</span>
                </div>
            )}
        </div>
    );
});

// Icon components
function GitBranchIcon() {
    return (
        <svg
            className='h-3 w-3'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <line x1='6' y1='3' x2='6' y2='15' />
            <circle cx='18' cy='18' r='3' />
            <circle cx='6' cy='18' r='3' />
            <path d='M18 9a9 9 0 0 0-9-9' />
        </svg>
    );
}

function GlobeIcon() {
    return (
        <svg
            className='h-3 w-3'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <circle cx='12' cy='12' r='10' />
            <line x1='2' y1='12' x2='22' y2='12' />
            <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' />
        </svg>
    );
}

function TagIcon() {
    return (
        <svg
            className='h-3 w-3'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <path d='M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z' />
            <path d='M7 7h.01' />
        </svg>
    );
}

export function VirtualizedCommitList({
    commits,
    layout,
    refLookup,
    selectedIndex,
    expandedIndex,
    onSelect,
    onExpand,
    onContextMenu,
    onVisibleRangeChange,
    onScrollOffsetChange,
    showAvatars = false,
    hideRefs = false,
    overscan = 10,
}: VirtualizedCommitListProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const visibleRangeRef = useRef<{ start: number; end: number } | null>(null);
    const scrollFrameRef = useRef<number | null>(null);
    const lastScrollTopRef = useRef(0);

    // Create virtualizer instance
    const virtualizer = useVirtualizer({
        count: commits.length,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => ROW_HEIGHT, []),
        getItemKey: useCallback((index: number) => commits[index]?.hash ?? index, [commits]),
        overscan,
    });

    // Get visible items
    const virtualItems = virtualizer.getVirtualItems();

    // Notify parent of visible range changes
    useEffect(() => {
        if (onVisibleRangeChange && virtualItems.length > 0) {
            const firstItem = virtualItems[0];
            const lastItem = virtualItems[virtualItems.length - 1];
            if (firstItem && lastItem) {
                const nextRange = { start: firstItem.index, end: lastItem.index };
                const prevRange = visibleRangeRef.current;
                if (!prevRange || prevRange.start !== nextRange.start || prevRange.end !== nextRange.end) {
                    visibleRangeRef.current = nextRange;
                    onVisibleRangeChange(nextRange.start, nextRange.end);
                }
            }
        }
    }, [virtualItems, onVisibleRangeChange]);

    // Scroll to selected commit
    useEffect(() => {
        if (selectedIndex !== null && selectedIndex >= 0) {
            virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
        }
    }, [selectedIndex, virtualizer]);

    useEffect(() => {
        if (!onScrollOffsetChange) return;

        const element = parentRef.current;
        if (!element) return;

        const handleScroll = () => {
            lastScrollTopRef.current = element.scrollTop;
            if (scrollFrameRef.current !== null) {
                return;
            }
            scrollFrameRef.current = window.requestAnimationFrame(() => {
                scrollFrameRef.current = null;
                onScrollOffsetChange(lastScrollTopRef.current);
            });
        };

        handleScroll();
        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
                scrollFrameRef.current = null;
            }
            element.removeEventListener('scroll', handleScroll);
        };
    }, [onScrollOffsetChange]);

    // Total size for scrollbar
    const totalSize = virtualizer.getTotalSize();

    return (
        <div ref={parentRef} className='h-full overflow-auto' style={{ contain: 'strict' }}>
            <div className='relative w-full' style={{ height: `${totalSize}px` }}>
                {virtualItems.map((virtualRow) => {
                    const commit = commits[virtualRow.index];
                    if (!commit) return null;
                    const heads = refLookup?.headsByHash[commit.hash] ?? commit.heads ?? [];
                    const tags = refLookup?.tagsByHash[commit.hash] ?? commit.tags ?? [];
                    const remotes = refLookup?.remotesByHash[commit.hash] ?? commit.remotes ?? [];

                    return (
                        <div
                            key={commit.hash}
                            data-index={virtualRow.index}
                            className='absolute top-0 left-0 w-full'
                            style={{
                                transform: `translateY(${virtualRow.start}px)`,
                            }}>
                            <CommitRow
                                commit={commit}
                                heads={heads}
                                tags={tags}
                                remotes={remotes}
                                isSelected={selectedIndex === virtualRow.index}
                                isMuted={layout?.mutedCommits[virtualRow.index] ?? false}
                                graphOffset={layout?.widthsAtVertices[virtualRow.index] ?? 0}
                                onSelect={() => onSelect(virtualRow.index)}
                                onToggleExpand={() =>
                                    onExpand(expandedIndex === virtualRow.index ? null : virtualRow.index)
                                }
                                showAvatar={showAvatars}
                                hideRefs={hideRefs}
                                {...(onContextMenu
                                    ? { onContextMenu: (e: React.MouseEvent) => onContextMenu(virtualRow.index, e) }
                                    : {})}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Also export a hook for virtualization utilities
export function useCommitVirtualization(commits: DisplayCommit[]) {
    return useMemo(
        () => ({
            totalHeight: commits.length * ROW_HEIGHT,
            getOffsetForIndex: (index: number) => index * ROW_HEIGHT,
            getIndexForOffset: (offset: number) => Math.floor(offset / ROW_HEIGHT),
        }),
        [commits.length]
    );
}

export default VirtualizedCommitList;

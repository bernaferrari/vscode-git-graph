/**
 * Git Graph Commit List
 * Renders the list of commits aligned with the graph
 */

import { GitBranch, Globe2, Tag } from 'lucide-react';

import { CIStatusMini } from './ci-status';
import { getGravatarUrl } from '@/lib/gravatar';

import type { GraphLayout } from '@/lib/graph/layout';

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

interface CommitListProps {
    commits: DisplayCommit[];
    layout: GraphLayout | null;
    selectedIndex: number | null;
    /** Hashes of all rows currently in the multi-select set (>= 2 entries). */
    multiSelectedHashes?: ReadonlySet<string>;
    expandedIndex: number | null;
    onSelect: (index: number, modifiers?: { shift?: boolean; meta?: boolean }) => void;
    onExpand: (index: number | null) => void;
    onContextMenu?: (index: number, event: React.MouseEvent) => void;
    showAvatars?: boolean;
    hideRefs?: boolean;
    repo?: string;
}

// Row height - must match graph grid Y spacing
// eslint-disable-next-line react-refresh/only-export-components
export const ROW_HEIGHT = 30;
const COMMIT_ROW_BASE_CLASS =
    'commit-row ui-commit-row group relative flex cursor-pointer items-center gap-2.5 border-b border-border/25 transition-[background-color,box-shadow,opacity] duration-100 focus-visible:outline-none focus-visible:bg-accent/40';

// Semantic commit type chips — soft tinted, low chroma, used for at-a-glance scanning
const COMMIT_TYPES: Record<string, { color: string; bg: string }> = {
    feat:     { color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',  bg: 'bg-[color-mix(in_oklch,var(--success)_12%,transparent)]' },
    fix:      { color: 'text-destructive dark:text-destructive',        bg: 'bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)]' },
    docs:     { color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',          bg: 'bg-[color-mix(in_oklch,var(--info)_12%,transparent)]' },
    style:    { color: 'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',    bg: 'bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]' },
    refactor: { color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',      bg: 'bg-[color-mix(in_oklch,var(--warning)_12%,transparent)]' },
    perf:     { color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',    bg: 'bg-[color-mix(in_oklch,var(--warning)_12%,transparent)]' },
    test:     { color: 'text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))]',        bg: 'bg-[color-mix(in_oklch,var(--chart-7)_12%,transparent)]' },
    build:    { color: 'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',    bg: 'bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]' },
    ci:       { color: 'text-slate-700 dark:text-slate-300',      bg: 'bg-slate-500/12' },
    chore:    { color: 'text-zinc-700 dark:text-zinc-300',        bg: 'bg-zinc-500/12' },
    revert:   { color: 'text-[color-mix(in_oklch,var(--chart-4)_75%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--chart-4)_75%,var(--foreground))]',        bg: 'bg-[color-mix(in_oklch,var(--chart-4)_12%,transparent)]' },
};

// Parse semantic commit message
function parseCommitMessage(message: string): { type?: string; scope?: string; description: string } {
    const firstLine = message.split('\n')[0] ?? '';
    // Match: type(scope): description or type: description
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

export function CommitList({
    commits,
    layout,
    selectedIndex,
    multiSelectedHashes,
    expandedIndex,
    onSelect,
    onExpand,
    onContextMenu,
    showAvatars = false,
    hideRefs = false,
    repo,
}: CommitListProps) {
    return (
        <div className='commit-list'>
            {commits.map((commit, index) => (
                <CommitRow
                    key={commit.hash}
                    commit={commit}
                    index={index}
                    isSelected={selectedIndex === index}
                    isMultiSelected={multiSelectedHashes?.has(commit.hash) ?? false}
                    isMuted={layout?.mutedCommits[index] ?? false}
                    graphOffset={layout?.widthsAtVertices[index] ?? 0}
                    onSelect={(modifiers) => { onSelect(index, modifiers); }}
                    onToggleExpand={() => { onExpand(expandedIndex === index ? null : index); }}
                    showAvatar={showAvatars}
                    hideRefs={hideRefs}
                    {...(repo !== undefined ? { repo } : {})}
                    {...(onContextMenu ? { onContextMenu: (e: React.MouseEvent) => { onContextMenu(index, e); } } : {})}
                />
            ))}
        </div>
    );
}

interface CommitRowProps {
    commit: DisplayCommit;
    index: number;
    isSelected: boolean;
    isMultiSelected?: boolean;
    isMuted: boolean;
    graphOffset: number;
    onSelect: (modifiers?: { shift?: boolean; meta?: boolean }) => void;
    onToggleExpand: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    showAvatar?: boolean;
    hideRefs?: boolean;
    repo?: string;
}

function CommitRow({
    commit,
    index,
    isSelected,
    isMultiSelected,
    isMuted,
    graphOffset,
    onSelect,
    onToggleExpand,
    onContextMenu,
    showAvatar = false,
    hideRefs = false,
    repo,
}: CommitRowProps) {
    const isUncommitted = commit.hash === '*';
    const highlighted = isSelected || isMultiSelected;

    return (
        <div
            data-index={index}
            className={`${COMMIT_ROW_BASE_CLASS} ${
                highlighted
                    ? isMultiSelected
                        ? 'bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] shadow-[inset_2px_0_0_0_var(--primary)]'
                        : 'bg-accent/55 shadow-[inset_2px_0_0_0_var(--primary)]'
                    : 'hover:bg-accent/25 active:bg-accent/40'
            } ${isMuted ? 'opacity-45' : ''}`}
            tabIndex={0}
            title={commit.message.split('\n')[0] ?? ''}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
            onClick={(event) => {
                onSelect({ shift: event.shiftKey, meta: event.metaKey || event.ctrlKey });
            }}
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
            {/* Refs - branches, tags, remotes (only if not hidden) */}
            {!hideRefs && (
                <div className='flex shrink-0 items-center gap-1'>
                    {/* Current branch (first head) — primary chip */}
                    {commit.heads && commit.heads.length > 0 && (
                        <span className='bg-primary/12 text-primary border-primary/25 inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-semibold leading-none'>
                            <GitBranch className='h-2.5 w-2.5' />
                            {commit.heads[0]}
                        </span>
                    )}
                    {/* Other heads — muted */}
                    {commit.heads?.slice(1).map((head: string) => (
                        <span
                            key={head}
                            className='bg-muted text-muted-foreground border-border/50 rounded-md border px-1.5 py-[1px] text-[10px] leading-none'>
                            {head}
                        </span>
                    ))}
                    {/* Remotes */}
                    {commit.remotes?.map((remote: string, i: number) => (
                        <span
                            key={i}
                            className='border-border/60 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] leading-none'>
                            <Globe2 className='h-2.5 w-2.5' />
                            {remote}
                        </span>
                    ))}
                    {/* Tags — semantic warning */}
                    {commit.tags?.map((tag: string) => (
                        <span
                            key={tag}
                            className='inline-flex items-center gap-1 rounded-md border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] px-1.5 py-[1px] text-[10px] font-medium leading-none text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]'>
                            <Tag className='h-2.5 w-2.5' />
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Commit message with semantic highlighting */}
            <span className='min-w-0 flex-1 truncate text-[13px]'>
                {isUncommitted ? (
                    <span className='text-muted-foreground italic'>Uncommitted Changes</span>
                ) : (
                    <CommitMessage message={commit.message} />
                )}
            </span>

            {/* Author, hash, date */}
            {!isUncommitted && (
                <div
                    className={`text-muted-foreground flex shrink-0 items-center gap-3.5 text-[11px] transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-55 group-hover:opacity-90'
                    }`}>
                    <span className='w-24 truncate font-medium'>{commit.author}</span>
                    <CIStatusMini commitHash={commit.hash} {...(repo !== undefined ? { repo } : {})} />
                    <span className='font-mono text-[10.5px] text-muted-foreground/75 tracking-[0.01em]'>
                        {commit.hash.slice(0, 7)}
                    </span>
                    <span className='w-12 text-right tabular-nums text-muted-foreground/85'>{formatDate(commit.date)}</span>
                </div>
            )}
        </div>
    );
}

// Commit message with semantic type highlighting
function CommitMessage({ message }: { message: string }) {
    const parsed = parseCommitMessage(message);
    const typeInfo = parsed.type ? COMMIT_TYPES[parsed.type] : null;

    if (typeInfo && parsed.type) {
        return (
            <>
                <span
                    className={`${typeInfo.bg} ${typeInfo.color} mr-1.5 inline-flex items-center rounded-md px-1.5 py-[1px] text-[10px] font-semibold leading-none tracking-[0.005em]`}>
                    {parsed.type}
                    {parsed.scope && <span className='opacity-70'>({parsed.scope})</span>}
                </span>
                <span className='truncate'>{parsed.description}</span>
            </>
        );
    }

    return <span className='truncate'>{parsed.description}</span>;
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${String(diffMins)}m`;
    if (diffHours < 24) return `${String(diffHours)}h`;
    if (diffDays === 1) return 'yday';
    if (diffDays < 7) return `${String(diffDays)}d`;
    if (diffDays < 30) return `${String(Math.floor(diffDays / 7))}w`;
    if (diffDays < 365) return `${String(Math.floor(diffDays / 30))}mo`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

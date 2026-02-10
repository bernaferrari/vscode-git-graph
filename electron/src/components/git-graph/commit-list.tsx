/**
 * Git Graph Commit List
 * Renders the list of commits aligned with the graph
 */

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
	expandedIndex: number | null;
	onSelect: (index: number) => void;
	onExpand: (index: number | null) => void;
	onContextMenu?: (index: number, event: React.MouseEvent) => void;
}

// Row height - must match graph grid Y spacing
export const ROW_HEIGHT = 32;

export function CommitList({
	commits,
	layout,
	selectedIndex,
	expandedIndex,
	onSelect,
	onExpand,
	onContextMenu,
}: CommitListProps) {
	return (
		<div className="commit-list">
			{commits.map((commit, index) => (
				<CommitRow
					key={commit.hash}
					commit={commit}
					index={index}
					isSelected={selectedIndex === index}
					isMuted={layout?.mutedCommits[index] ?? false}
					graphOffset={layout?.widthsAtVertices[index] ?? 0}
					onSelect={() => onSelect(index)}
					onToggleExpand={() => onExpand(expandedIndex === index ? null : index)}
					onContextMenu={onContextMenu ? (e) => onContextMenu(index, e) : undefined}
				/>
			))}
		</div>
	);
}

interface CommitRowProps {
	commit: DisplayCommit;
	index: number;
	isSelected: boolean;
	isMuted: boolean;
	graphOffset: number;
	onSelect: () => void;
	onToggleExpand: () => void;
	onContextMenu?: (e: React.MouseEvent) => void;
}

function CommitRow({
	commit,
	index,
	isSelected,
	isMuted,
	graphOffset,
	onSelect,
	onToggleExpand,
	onContextMenu,
}: CommitRowProps) {
	const isUncommitted = commit.hash === '*';

	return (
		<div
			data-index={index}
			className={`commit-row group flex items-center gap-3 cursor-pointer transition-colors border-b border-transparent ${
				isSelected
					? 'bg-accent/40'
					: 'hover:bg-accent/20'
			} ${isMuted ? 'opacity-50' : ''}`}
			onClick={onSelect}
			onDoubleClick={onToggleExpand}
			onContextMenu={onContextMenu}
			style={{
				paddingLeft: graphOffset + 16,
				paddingRight: 16,
				height: ROW_HEIGHT,
			}}
		>
			{/* Refs - branches, tags, remotes */}
			<div className="flex items-center gap-1.5 shrink-0">
				{/* Current branch (first head) */}
				{commit.heads && commit.heads.length > 0 && (
					<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/15 text-primary border border-primary/20">
						<GitBranchIcon className="w-3 h-3" />
						{commit.heads[0]}
					</span>
				)}
				{/* Other heads */}
				{commit.heads?.slice(1).map((head: string) => (
					<span
						key={head}
						className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
					>
						{head}
					</span>
				))}
				{/* Remotes */}
				{commit.remotes?.map((remote: string, i: number) => (
					<span
						key={i}
						className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border border-border text-muted-foreground"
					>
						<GlobeIcon className="w-3 h-3" />
						{remote}
					</span>
				))}
				{/* Tags */}
				{commit.tags?.map((tag: string) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
					>
						<TagIcon className="w-3 h-3" />
						{tag}
					</span>
				))}
			</div>

			{/* Commit message */}
			<span className="text-sm truncate flex-1 min-w-0">
				{isUncommitted ? (
					<span className="text-muted-foreground italic">Uncommitted Changes</span>
				) : (
					commit.message.split('\n')[0]
				)}
			</span>

			{/* Author, hash, date */}
			{!isUncommitted && (
				<div className={`flex items-center gap-4 text-xs text-muted-foreground shrink-0 transition-opacity ${
					isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
				}`}>
					<span className="w-24 truncate">{commit.author}</span>
					<span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{commit.hash.slice(0, 7)}</span>
					<span className="w-16 text-right tabular-nums">{formatDate(commit.date)}</span>
				</div>
			)}
		</div>
	);
}

// Simple icon components
function GitBranchIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="6" y1="3" x2="6" y2="15" />
			<circle cx="18" cy="18" r="3" />
			<circle cx="6" cy="18" r="3" />
			<path d="M18 9a9 9 0 0 0-9-9" />
		</svg>
	);
}

function GlobeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<line x1="2" y1="12" x2="22" y2="12" />
			<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}

function TagIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
			<path d="M7 7h.01" />
		</svg>
	);
}

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

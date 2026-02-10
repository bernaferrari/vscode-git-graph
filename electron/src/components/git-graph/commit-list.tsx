/**
 * Git Graph Commit List
 * Renders the list of commits with time-based separators
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

// Row height - matches graph grid
const ROW_HEIGHT = 24;

// Time groupings
function getTimeGroup(timestamp: number): string {
	const now = Date.now();
	const date = timestamp * 1000;
	const diffMs = now - date;
	const diffHours = diffMs / (1000 * 60 * 60);
	const diffDays = diffHours / 24;

	if (diffHours < 1) return 'Just now';
	if (diffHours < 24) return 'Today';
	if (diffDays < 2) return 'Yesterday';
	if (diffDays < 7) return 'This week';
	if (diffDays < 30) return 'This month';
	if (diffDays < 365) return 'This year';
	return 'Older';
}

// Group commits by time
function groupCommitsByTime(commits: DisplayCommit[]): { label: string; commits: { commit: DisplayCommit; index: number }[] }[] {
	const groups: Map<string, { commit: DisplayCommit; index: number }[]> = new Map();

	commits.forEach((commit, index) => {
		const group = getTimeGroup(commit.date);
		if (!groups.has(group)) {
			groups.set(group, []);
		}
		groups.get(group)!.push({ commit, index });
	});

	// Order groups
	const order = ['Just now', 'Today', 'Yesterday', 'This week', 'This month', 'This year', 'Older'];
	const result: { label: string; commits: { commit: DisplayCommit; index: number }[] }[] = [];

	for (const label of order) {
		const groupCommits = groups.get(label);
		if (groupCommits && groupCommits.length > 0) {
			result.push({ label, commits: groupCommits });
		}
	}

	return result;
}

export function CommitList({
	commits,
	layout,
	selectedIndex,
	expandedIndex,
	onSelect,
	onExpand,
	onContextMenu,
}: CommitListProps) {
	const groups = groupCommitsByTime(commits);

	return (
		<div className="commit-list">
			{groups.map((group) => (
				<div key={group.label}>
					{/* Time separator */}
					<div className="sticky top-0 z-10 px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/50 backdrop-blur-sm border-b">
						{group.label}
					</div>
					{/* Commits in this group */}
					{group.commits.map(({ commit, index }) => (
						<CommitRow
							key={commit.hash}
							commit={commit}
							index={index}
							isSelected={selectedIndex === index}
							isMuted={layout?.mutedCommits[index] ?? false}
							width={layout?.widthsAtVertices[index] ?? 0}
							onSelect={() => onSelect(index)}
							onToggleExpand={() => onExpand(expandedIndex === index ? null : index)}
							onContextMenu={onContextMenu ? (e) => onContextMenu(index, e) : undefined}
						/>
					))}
				</div>
			))}
		</div>
	);
}

interface CommitRowProps {
	commit: DisplayCommit;
	index: number;
	isSelected: boolean;
	isMuted: boolean;
	width: number;
	onSelect: () => void;
	onToggleExpand: () => void;
	onContextMenu?: (e: React.MouseEvent) => void;
}

function CommitRow({
	commit,
	index,
	isSelected,
	isMuted,
	width,
	onSelect,
	onToggleExpand,
	onContextMenu,
}: CommitRowProps) {
	const isUncommitted = commit.hash === '*';

	return (
		<div
			data-index={index}
			className={`commit-row group flex items-center border-b border-border/30 cursor-pointer transition-colors ${
				isSelected
					? 'bg-accent/50'
					: 'hover:bg-accent/30'
			} ${isMuted ? 'opacity-50' : ''}`}
			onClick={onSelect}
			onDoubleClick={onToggleExpand}
			onContextMenu={onContextMenu}
			style={{
				paddingLeft: width + 12,
				paddingRight: 12,
				height: ROW_HEIGHT,
				minHeight: ROW_HEIGHT,
			}}
		>
			{/* Refs - branches, tags, remotes */}
			<div className="flex items-center gap-1 shrink-0 mr-2">
				{/* Current branch (first head) */}
				{commit.heads && commit.heads.length > 0 && (
					<span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-primary/15 text-primary">
						<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="6" y1="3" x2="6" y2="15" />
							<circle cx="18" cy="18" r="3" />
							<circle cx="6" cy="18" r="3" />
							<path d="M18 9a9 9 0 0 0-9-9" />
						</svg>
						{commit.heads[0]}
					</span>
				)}
				{/* Other heads */}
				{commit.heads?.slice(1).map((head: string) => (
					<span
						key={head}
						className="px-1.5 py-0.5 text-xs rounded bg-secondary text-secondary-foreground"
					>
						{head}
					</span>
				))}
				{/* Remotes */}
				{commit.remotes?.map((remote: string, i: number) => (
					<span
						key={i}
						className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground"
					>
						<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="2" y1="12" x2="22" y2="12" />
							<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
						</svg>
						{remote}
					</span>
				))}
				{/* Tags */}
				{commit.tags?.map((tag: string) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
					>
						<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
							<path d="M7 7h.01" />
						</svg>
						{tag}
					</span>
				))}
			</div>

			{/* Commit message */}
			<span className="text-sm truncate flex-1 min-w-0 mr-2">
				{isUncommitted ? (
					<span className="text-muted-foreground italic">Uncommitted Changes</span>
				) : (
					commit.message.split('\n')[0]
				)}
			</span>

			{/* Author, hash, date - shown on hover or when selected */}
			{!isUncommitted && (
				<div className={`flex items-center gap-3 text-xs text-muted-foreground shrink-0 transition-opacity ${
					isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
				}`}>
					<span className="max-w-24 truncate">{commit.author}</span>
					<span className="font-mono text-muted-foreground/70">{commit.hash.slice(0, 7)}</span>
					<span className="w-20 text-right tabular-nums">{formatDate(commit.date)}</span>
				</div>
			)}
		</div>
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

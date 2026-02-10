/**
 * Git Graph Commit List
 * Renders the list of commits with details
 */

import type { GraphLayout } from '@/lib/graph/layout';

// Minimal commit type for display (matches tRPC response)
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
					width={layout?.widthsAtVertices[index] ?? 0}
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
			className={`commit-row flex items-center border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors ${
				isSelected ? 'bg-accent' : ''
			} ${isMuted ? 'opacity-50' : ''}`}
			onClick={onSelect}
			onDoubleClick={onToggleExpand}
			onContextMenu={onContextMenu}
			style={{
				paddingLeft: width + 8,
				height: ROW_HEIGHT,
				minHeight: ROW_HEIGHT,
			}}
		>
			{/* Commit Info */}
			<div className="flex-1 min-w-0 flex items-center gap-2">
				{/* Refs */}
				<div className="flex items-center gap-1 shrink-0">
					{commit.heads?.map((head: string, i: number) => (
						<span
							key={head}
							className={`px-1.5 py-0.5 text-xs rounded ${
								i === 0
									? 'bg-primary/20 text-primary'
									: 'bg-muted text-muted-foreground'
							}`}
						>
							{head}
						</span>
					))}
					{commit.remotes?.map((remote: string, i: number) => (
						<span key={i} className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
							{remote}
						</span>
					))}
					{commit.tags?.map((tag: string) => (
						<span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
							{tag}
						</span>
					))}
				</div>

				{/* Commit message */}
				<span className="text-sm truncate flex-1">
					{isUncommitted ? 'Uncommitted Changes' : commit.message}
				</span>

				{/* Author and Date */}
				{!isUncommitted && (
					<span className="text-xs text-muted-foreground shrink-0 flex items-center gap-2">
						<span>{commit.author}</span>
						<span className="font-mono text-muted-foreground/70">{commit.hash.slice(0, 7)}</span>
						<span className="w-20 text-right">{formatDate(commit.date)}</span>
					</span>
				)}
			</div>
		</div>
	);
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		if (diffHours === 0) {
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			return `${diffMinutes}m ago`;
		}
		return `${diffHours}h ago`;
	} else if (diffDays === 1) {
		return 'Yesterday';
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else if (diffDays < 30) {
		return `${Math.floor(diffDays / 7)}w ago`;
	} else if (diffDays < 365) {
		return `${Math.floor(diffDays / 30)}mo ago`;
	}
	return `${Math.floor(diffDays / 365)}y ago`;
}

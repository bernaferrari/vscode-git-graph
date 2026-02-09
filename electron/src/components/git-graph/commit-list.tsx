/**
 * Git Graph Commit List
 * Renders the list of commits with details
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { GitCommit } from '@/lib/types/git';
import type { GraphLayout } from '@/lib/graph/layout';

interface CommitListProps {
	commits: GitCommit[];
	layout: GraphLayout | null;
	selectedIndex: number | null;
	expandedIndex: number | null;
	onSelect: (index: number) => void;
	onExpand: (index: number | null) => void;
}

export function CommitList({
	commits,
	layout,
	selectedIndex,
	expandedIndex,
	onSelect,
	onExpand,
}: CommitListProps) {
	const commitElements = useMemo(() => {
		return commits.map((commit, index) => (
			<CommitRow
				key={commit.hash}
				commit={commit}
				index={index}
				isSelected={selectedIndex === index}
				isMuted={layout?.mutedCommits[index] ?? false}
				width={layout?.widthsAtVertices[index] ?? 0}
				onSelect={() => onSelect(index)}
				onToggleExpand={() => onExpand(expandedIndex === index ? null : index)}
			/>
		));
	}, [commits, layout, selectedIndex, expandedIndex, onSelect, onExpand]);

	return <div className="commit-list flex flex-col">{commitElements}</div>;
}

interface CommitRowProps {
	commit: GitCommit;
	index: number;
	isSelected: boolean;
	isMuted: boolean;
	width: number;
	onSelect: () => void;
	onToggleExpand: () => void;
}

function CommitRow({
	commit,
	index,
	isSelected,
	isMuted,
	width,
	onSelect,
	onToggleExpand,
}: CommitRowProps) {
	const isUncommitted = commit.hash === '*';

	return (
		<div
			data-index={index}
			className={`commit-row flex items-start gap-2 px-2 py-1 border-b border-border/50 cursor-pointer hover:bg-accent/50 ${
				isSelected ? 'bg-accent' : ''
			} ${isMuted ? 'opacity-50' : ''}`}
			onClick={onSelect}
			onDoubleClick={onToggleExpand}
			style={{ paddingLeft: width }}
		>
			{/* Commit Info */}
			<div className="flex-1 min-w-0">
				{/* Refs */}
				{(commit.heads.length > 0 || commit.tags.length > 0 || commit.remotes.length > 0) && (
					<div className="flex flex-wrap gap-1 mb-1">
						{/* Current HEAD */}
						{commit.heads.length > 0 && (
							<Badge variant="default" className="text-xs">
								{commit.heads[0]}
							</Badge>
						)}
						{/* Other heads */}
						{commit.heads.slice(1).map((head) => (
							<Badge key={head} variant="secondary" className="text-xs">
								{head}
							</Badge>
						))}
						{/* Remotes */}
						{commit.remotes.map((remote, i) => (
							<Badge key={i} variant="outline" className="text-xs">
								{remote.name}
							</Badge>
						))}
						{/* Tags */}
						{commit.tags.map((tag) => (
							<Badge key={tag.name} variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30">
								{tag.name}
							</Badge>
						))}
					</div>
				)}

				{/* Stash indicator */}
				{commit.stash && (
					<div className="flex items-center gap-1 mb-1">
						<Badge variant="secondary" className="text-xs">
							Stash: {commit.stash.selector}
						</Badge>
					</div>
				)}

				{/* Commit message */}
				<div className="text-sm font-medium truncate">
					{isUncommitted ? 'Uncommitted Changes' : commit.message}
				</div>

				{/* Author and Date */}
				{!isUncommitted && (
					<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
						<span>{commit.author}</span>
						<span>•</span>
						<span>{formatDate(commit.date)}</span>
						<span>•</span>
						<span className="font-mono">{commit.hash.slice(0, 7)}</span>
					</div>
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
			return `${diffMinutes} minutes ago`;
		}
		return `${diffHours} hours ago`;
	} else if (diffDays === 1) {
		return 'Yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else if (diffDays < 30) {
		return `${Math.floor(diffDays / 7)} weeks ago`;
	} else if (diffDays < 365) {
		return `${Math.floor(diffDays / 30)} months ago`;
	}
	return `${Math.floor(diffDays / 365)} years ago`;
}

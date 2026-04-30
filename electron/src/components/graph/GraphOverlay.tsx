/**
 * Graph Overlay Visualization
 * Shows before/after commit graph with ghost commits
 */

import {
	ArrowRight,
	Plus,
	Minus,
	RefreshCw,
	Eye,
	EyeOff,
} from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface GraphCommitNode {
	hash: string;
	message: string;
	author: string;
	parents: string[];
	branch?: string;
	tags?: string[];
}

export interface GraphOverlayProps {
	before: GraphCommitNode[];
	after: GraphCommitNode[];
	highlightCommits?: string[];
	showGhosts?: boolean;
	onGhostToggle?: () => void;
	className?: string;
}

export function GraphOverlay({
	before,
	after,
	highlightCommits = [],
	showGhosts = true,
	onGhostToggle,
	className,
}: GraphOverlayProps) {
	// Analyze changes between before and after
	const changes = useMemo(() => {
		const beforeHashes = new Set(before.map(c => c.hash));
		const afterHashes = new Set(after.map(c => c.hash));

		const result: Array<{
			commit: GraphCommitNode;
			action: 'unchanged' | 'new' | 'rewritten' | 'dropped';
			oldHash?: string;
		}> = [];

		// Check each "after" commit
		after.forEach(commit => {
			if (!beforeHashes.has(commit.hash)) {
				// New commit - check if it might be rewritten (same message, different hash)
				const original = before.find(c => c.message === commit.message);
				if (original) {
					result.push({ commit, action: 'rewritten', oldHash: original.hash });
				} else {
					result.push({ commit, action: 'new' });
				}
			} else {
				result.push({ commit, action: 'unchanged' });
			}
		});

		// Check for dropped commits
		after.forEach(commit => {
			if (!afterHashes.has(commit.hash) && beforeHashes.has(commit.hash)) {
				const original = before.find(c => c.hash === commit.hash);
				if (original) {
					result.push({ commit: original, action: 'dropped' });
				}
			}
		});

		// Also find commits that are in before but not in after
		before.forEach(commit => {
			if (!afterHashes.has(commit.hash)) {
				const exists = result.some(r => r.commit.hash === commit.hash);
				if (!exists) {
					result.push({ commit, action: 'dropped' });
				}
			}
		});

		return result;
	}, [before, after]);

	// Stats
	const stats = useMemo(() => ({
		unchanged: changes.filter(c => c.action === 'unchanged').length,
		new: changes.filter(c => c.action === 'new').length,
		rewritten: changes.filter(c => c.action === 'rewritten').length,
		dropped: changes.filter(c => c.action === 'dropped').length,
	}), [changes]);

	const actionColors = {
		unchanged: 'bg-blue-500',
		new: 'bg-green-500',
		rewritten: 'bg-amber-500',
		dropped: 'bg-red-500',
	};

	const actionLabels = {
		unchanged: 'Unchanged',
		new: 'New',
		rewritten: 'Rewritten',
		dropped: 'Dropped',
	};

	return (
		<div className={cn('space-y-3', className)}>
			{/* Toggle & Legend */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					{Object.entries(stats).map(([action, count]) => (
						count > 0 && (
							<div key={action} className="flex items-center gap-1.5 text-xs">
								<div className={cn('w-2 h-2 rounded-full', actionColors[action as keyof typeof actionColors])} />
								<span className="text-muted-foreground">{actionLabels[action as keyof typeof actionLabels]}:</span>
								<span className="font-medium">{count}</span>
							</div>
						)
					))}
				</div>
				{onGhostToggle && (
					<Button variant="ghost" size="sm" onClick={onGhostToggle} className="h-7 gap-1.5">
						{showGhosts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
						{showGhosts ? 'Hide' : 'Show'} ghosts
					</Button>
				)}
			</div>

			{/* Graph visualization */}
			<div className="relative min-h-[150px] bg-muted/30 rounded-lg p-4 overflow-x-auto">
				{/* Branch lines */}
				<div className="flex gap-8">
					{/* Before */}
					<div className="flex-1 min-w-[200px]">
						<p className="text-xs text-muted-foreground mb-2 font-medium">Before</p>
						<div className="space-y-1">
					{before.slice(0, 6).map((commit) => {
								const change = changes.find(c => c.commit.hash === commit.hash);
								const action = change?.action || 'unchanged';
								const isHighlighted = highlightCommits.includes(commit.hash);

								return (
									<div
										key={commit.hash}
										className={cn(
											'flex items-center gap-2 p-1.5 rounded text-xs transition-all',
											isHighlighted && 'ring-2 ring-primary',
											action === 'dropped' && 'opacity-50 line-through',
											!showGhosts && action !== 'unchanged' && 'hidden'
										)}
									>
										<div className={cn(
											'w-2 h-2 rounded-full shrink-0',
											actionColors[action]
										)} />
										<span className="font-mono text-[10px] text-muted-foreground">
											{commit.hash.substring(0, 7)}
										</span>
										<span className="truncate">{commit.message.substring(0, 25)}</span>
									</div>
								);
							})}
							{before.length > 6 && (
								<p className="text-xs text-muted-foreground pl-3">
									+{before.length - 6} more
								</p>
							)}
						</div>
					</div>

					{/* Arrow */}
					<div className="flex items-center justify-center">
						<ArrowRight className="h-5 w-5 text-muted-foreground" />
					</div>

					{/* After */}
					<div className="flex-1 min-w-[200px]">
						<p className="text-xs text-muted-foreground mb-2 font-medium">After</p>
						<div className="space-y-1">
					{after.slice(0, 6).map((commit) => {
								const change = changes.find(c => c.commit.hash === commit.hash);
								const action = change?.action || 'unchanged';
								const isHighlighted = highlightCommits.includes(commit.hash);

								return (
									<div
										key={commit.hash}
										className={cn(
											'flex items-center gap-2 p-1.5 rounded text-xs transition-all',
											isHighlighted && 'ring-2 ring-primary',
											action === 'new' && 'bg-green-50 dark:bg-green-950/30 border border-green-200',
											action === 'rewritten' && 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200',
											!showGhosts && action !== 'unchanged' && 'hidden'
										)}
									>
										<div className={cn(
											'w-2 h-2 rounded-full shrink-0',
											actionColors[action]
										)} />
										<span className="font-mono text-[10px] text-muted-foreground">
											{commit.hash.substring(0, 7)}
										</span>
										<span className="truncate">{commit.message.substring(0, 25)}</span>
									</div>
								);
							})}
							{after.length > 6 && (
								<p className="text-xs text-muted-foreground pl-3">
									+{after.length - 6} more
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Summary */}
			<div className="flex items-center gap-4 text-xs text-muted-foreground">
				{stats.dropped > 0 && (
					<span className="flex items-center gap-1 text-red-600">
						<Minus className="h-3 w-3" />
						{stats.dropped} commit(s) will be removed
					</span>
				)}
				{stats.new > 0 && (
					<span className="flex items-center gap-1 text-green-600">
						<Plus className="h-3 w-3" />
						{stats.new} new commit(s)
					</span>
				)}
				{stats.rewritten > 0 && (
					<span className="flex items-center gap-1 text-amber-600">
						<RefreshCw className="h-3 w-3" />
						{stats.rewritten} rewritten (new hashes)
					</span>
				)}
			</div>
		</div>
	);
}

// Compact version for inline use
export function CompactGraphDiff({
	stats,
}: {
	stats: { unchanged: number; new: number; rewritten: number; dropped: number };
	showDetails?: boolean;
}) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-1.5">
				<div className="w-2 h-2 rounded-full bg-blue-500" />
				<span className="text-xs">{stats.unchanged}</span>
			</div>
			{stats.new > 0 && (
				<div className="flex items-center gap-1.5 text-green-600">
					<Plus className="h-3 w-3" />
					<span className="text-xs font-medium">+{stats.new}</span>
				</div>
			)}
			{stats.rewritten > 0 && (
				<div className="flex items-center gap-1.5 text-amber-600">
					<RefreshCw className="h-3 w-3" />
					<span className="text-xs font-medium">{stats.rewritten}</span>
				</div>
			)}
			{stats.dropped > 0 && (
				<div className="flex items-center gap-1.5 text-red-600">
					<Minus className="h-3 w-3" />
					<span className="text-xs font-medium">-{stats.dropped}</span>
				</div>
			)}
		</div>
	);
}

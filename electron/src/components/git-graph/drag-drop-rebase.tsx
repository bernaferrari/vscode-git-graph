/**
 * Drag and Drop Interactive Rebase
 * Improved UX with drag-to-reorder commits
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

interface RebaseCommit {
	hash: string;
	message: string;
	author: string;
	date: string;
	action: RebaseAction;
}

const ACTION_CONFIG: Record<RebaseAction, { label: string; color: string; description: string }> = {
	pick: { label: 'Pick', color: 'bg-blue-500', description: 'Use this commit' },
	reword: { label: 'Reword', color: 'bg-yellow-500', description: 'Edit commit message' },
	edit: { label: 'Edit', color: 'bg-orange-500', description: 'Stop to amend' },
	squash: { label: 'Squash', color: 'bg-purple-500', description: 'Merge with previous, edit message' },
	fixup: { label: 'Fixup', color: 'bg-pink-500', description: 'Merge with previous, discard message' },
	drop: { label: 'Drop', color: 'bg-red-500', description: 'Remove this commit' },
};

interface DragDropRebaseProps {
	repo: string;
	commits: RebaseCommit[];
	onto: string;
	onCancel: () => void;
	onComplete: () => void;
}

export function DragDropRebase({
	repo,
	commits: initialCommits,
	onto,
	onCancel,
	onComplete,
}: DragDropRebaseProps) {
	const [commits, setCommits] = useState<RebaseCommit[]>(initialCommits);
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	const utils = trpc.useUtils();
	const rebaseMutation = trpc.git.rebase.useMutation({
		onSuccess: () => {
			utils.git.commits.invalidate();
			onComplete();
		},
	});

	// Drag handlers
	const handleDragStart = (index: number) => (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = 'move';
		setDraggedIndex(index);
	};

	const handleDragOver = (index: number) => (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		setDragOverIndex(index);
	};

	const handleDragLeave = () => {
		setDragOverIndex(null);
	};

	const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === targetIndex) {
			setDraggedIndex(null);
			setDragOverIndex(null);
			return;
		}

		const newCommits = [...commits];
		const [draggedCommit] = newCommits.splice(draggedIndex, 1);
		if (draggedCommit) {
			newCommits.splice(targetIndex, 0, draggedCommit);
		}
		setCommits(newCommits);
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
		setDragOverIndex(null);
	};

	// Change action
	const handleActionChange = (index: number, action: RebaseAction) => {
		const newCommits = [...commits];
		const existing = newCommits[index];
		if (existing) {
			newCommits[index] = { ...existing, action };
		}
		setCommits(newCommits);
	};

	// Execute rebase
	const handleRebase = () => {
		// In a real implementation, we'd write the commands to a file
		// and run git rebase with GIT_SEQUENCE_EDITOR
		rebaseMutation.mutate({
			repo,
			onto,
			interactive: true,
		});
	};

	// Stats
	const stats = useMemo(() => {
		const result = { pick: 0, reword: 0, edit: 0, squash: 0, fixup: 0, drop: 0 };
		for (const c of commits) {
			result[c.action]++;
		}
		return result;
	}, [commits]);

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-2 shrink-0">
				<CardTitle className="text-sm flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>Interactive Rebase onto</span>
						<Badge variant="outline" className="font-mono">{onto}</Badge>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						{stats.drop > 0 && <span className="text-red-600">{stats.drop} dropped</span>}
						{stats.squash + stats.fixup > 0 && (
							<span className="text-purple-600">{stats.squash + stats.fixup} squashed</span>
						)}
					</div>
				</CardTitle>
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden p-0">
				<ScrollArea className="h-full">
					<div className="p-4 space-y-1">
						{/* Legend */}
						<div className="flex flex-wrap gap-2 mb-4 text-xs">
							{Object.entries(ACTION_CONFIG).map(([action, config]) => (
								<div key={action} className="flex items-center gap-1">
									<span className={cn('w-2 h-2 rounded-full', config.color)} />
									<span>{config.label}</span>
								</div>
							))}
						</div>

						{/* Commit list */}
						{commits.map((commit, index) => (
							<div
								key={commit.hash}
								draggable
								onDragStart={handleDragStart(index)}
								onDragOver={handleDragOver(index)}
								onDragLeave={handleDragLeave}
								onDrop={handleDrop(index)}
								onDragEnd={handleDragEnd}
								className={cn(
									'flex items-center gap-2 p-2 rounded border transition-colors',
									'cursor-grab active:cursor-grabbing',
									draggedIndex === index && 'opacity-50',
									dragOverIndex === index && 'border-primary bg-primary/5',
									commit.action === 'drop' && 'opacity-40'
								)}
							>
								{/* Drag handle */}
								<GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

								{/* Action selector */}
								<Select
									value={commit.action}
									onValueChange={(v) => handleActionChange(index, v as RebaseAction)}
								>
									<SelectTrigger className={cn(
										'w-24 h-7 text-xs',
										ACTION_CONFIG[commit.action].color,
										'text-white border-0'
									)}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(ACTION_CONFIG).map(([action, config]) => (
											<SelectItem key={action} value={action}>
												<div className="flex items-center gap-2">
													<span className={cn('w-2 h-2 rounded-full', config.color)} />
													<span>{config.label}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{/* Commit info */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs text-muted-foreground">
											{commit.hash.slice(0, 7)}
										</span>
										<span className="text-sm truncate">{commit.message}</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>

			<CardFooter className="justify-between shrink-0 border-t pt-4">
				<p className="text-xs text-muted-foreground">
					Drag commits to reorder • Click action to change
				</p>
				<div className="flex gap-2">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={handleRebase} disabled={rebaseMutation.isPending}>
						{rebaseMutation.isPending ? 'Rebasing...' : 'Start Rebase'}
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

/**
 * Keyboard shortcuts for quick actions
 */
export const REBASE_SHORTCUTS = {
	'p': 'pick',
	'r': 'reword',
	'e': 'edit',
	's': 'squash',
	'f': 'fixup',
	'd': 'drop',
} as const;

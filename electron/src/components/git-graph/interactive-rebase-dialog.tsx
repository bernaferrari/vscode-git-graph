/**
 * Interactive Rebase Dialog
 * Allows reordering, squashing, and editing commits during rebase
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';


interface RebaseCommit {
	hash: string;
	shortHash: string;
	message: string;
	author: string;
	date: string;
	action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
}

interface InteractiveRebaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	repo: string;
	onto: string;
	commits: RebaseCommit[];
	onComplete: () => void;
}

const ACTION_LABELS: Record<RebaseCommit['action'], { label: string; description: string; color: string }> = {
	pick: { label: 'pick', description: 'Use commit', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
	reword: { label: 'reword', description: 'Use commit, but edit message', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
	edit: { label: 'edit', description: 'Use commit, but stop for amending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
	squash: { label: 'squash', description: 'Use commit, meld into previous', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100' },
	fixup: { label: 'fixup', description: 'Like squash, but discard message', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100' },
	drop: { label: 'drop', description: 'Remove commit', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
};

export function InteractiveRebaseDialog({
	open,
	onOpenChange,
	repo,
	onto,
	commits: initialCommits,
	onComplete,
}: InteractiveRebaseDialogProps) {
	const [commits, setCommits] = useState<RebaseCommit[]>([]);
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const utils = trpc.useUtils();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const sanitizeTodoMessage = useCallback((message: string) => {
		return message.trim().replace(/[\r\n]+/g, ' ');
	}, []);

	const rebaseMutation = trpc.git.rebase.useMutation({
		onSuccess: () => {
			void utils.git.commits.invalidate();
			void utils.git.repoInfo.invalidate();
		},
	});

	useEffect(() => {
		setCommits(initialCommits.map((c) => ({ ...c, action: 'pick' as const })));
	}, [initialCommits]);

	const handleActionChange = useCallback((index: number, action: RebaseCommit['action']) => {
		setCommits((prev) => {
			const updated = [...prev];
			const commit = updated[index];
			if (commit) {
				updated[index] = { ...commit, action };
			}
			return updated;
		});
	}, []);

	const handleDragStart = useCallback((index: number) => {
		setDraggedIndex(index);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		setCommits((prev) => {
			const updated = [...prev];
			const removed = updated[draggedIndex];
			if (removed) {
				updated.splice(draggedIndex, 1);
				updated.splice(index, 0, removed);
			}
			return updated;
		});
		setDraggedIndex(index);
	}, [draggedIndex]);

	const handleDragEnd = useCallback(() => {
		setDraggedIndex(null);
	}, []);

	const handleRebase = useCallback(async () => {
		const activeCommits = commits.filter((commit) => commit.action !== 'drop');
		if (activeCommits.length === 0) {
			toast.error('No commits selected for rebase.');
			return;
		}

		const todoContent = activeCommits
			.map((commit) => `${commit.action} ${commit.hash} ${sanitizeTodoMessage(commit.message)}`)
			.join('\n');

		setIsSubmitting(true);
		try {
			const result = await rebaseMutation.mutateAsync({
				repo,
				onto,
				interactive: true,
				todos: todoContent,
			});

			if (result.error) {
				toast.error(result.error);
				return;
			}

			onComplete();
			onOpenChange(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to start rebase');
		} finally {
			setIsSubmitting(false);
		}
	}, [commits, onto, repo, onComplete, onOpenChange, rebaseMutation, sanitizeTodoMessage]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="fixed inset-0 bg-black/55" onClick={() => { onOpenChange(false); }} />
			<Card className="relative z-50 w-full ui-surface max-w-2xl mx-4 max-h-[80vh]">
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>Interactive Rebase onto {onto.slice(0, 7)}</span>
						<Badge variant="outline">{commits.length} commits</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-4">
						Drag commits to reorder. Click on an action to change it.
					</p>

					<ScrollArea className="h-[400px]">
						<div className="space-y-1">
							{commits.map((commit, index) => (
								<div
									key={commit.hash}
									draggable
									onDragStart={() => { handleDragStart(index); }}
									onDragOver={(e) => { handleDragOver(e, index); }}
									onDragEnd={handleDragEnd}
									className={`flex items-center gap-2 p-2 rounded border cursor-move ${
										draggedIndex === index ? 'opacity-50 bg-muted' : 'bg-card hover:bg-accent'
									}`}
								>
									<div className="cursor-grab text-muted-foreground">
										<svg width="16" height="16" viewBox="0 0 16 16">
											<path
												d="M4 4h2v2H4V4zm6 0h2v2h-2V4zM4 7h2v2H4V7zm6 0h2v2h-2V7zM4 10h2v2H4v-2zm6 0h2v2h-2v-2z"
												fill="currentColor"
											/>
										</svg>
									</div>

									<DropdownMenu>
										<DropdownMenuTrigger
											render={<Badge className={`cursor-pointer ${ACTION_LABELS[commit.action].color}`} />}
										/>
										<DropdownMenuContent>
											{(Object.keys(ACTION_LABELS) as RebaseCommit['action'][]).map((action) => (
												<DropdownMenuItem
													key={action}
													onClick={() => { handleActionChange(index, action); }}
												>
													<Badge className={`mr-2 ${ACTION_LABELS[action].color}`}>
														{ACTION_LABELS[action].label}
													</Badge>
													<span className="text-xs text-muted-foreground">
														{ACTION_LABELS[action].description}
													</span>
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>

									<span className="font-mono text-xs text-muted-foreground">
										{commit.shortHash}
									</span>

									<span className="flex-1 truncate text-sm">
										{commit.message.split('\n')[0]}
									</span>

									<span className="text-xs text-muted-foreground">{commit.author}</span>
								</div>
							))}
						</div>
					</ScrollArea>

					<div className="flex justify-end gap-2 mt-4">
						<Button variant="outline" onClick={() => { onOpenChange(false); }}>
							Cancel
						</Button>
						<Button
							onClick={() => { void handleRebase(); }}
							disabled={isSubmitting || rebaseMutation.isPending}
						>
							{isSubmitting || rebaseMutation.isPending ? 'Rebasing...' : 'Start Rebase'}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

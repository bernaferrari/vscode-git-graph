/**
 * Interactive Rebase Panel
 * Drag-drop to reorder, squash, edit, drop commits
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	GripVertical,
	ChevronDown,
	ChevronUp,
	Trash2,
	RotateCcw,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';
import { toast } from 'sonner';

interface InteractiveRebaseProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	baseCommit: string;
	commits: Array<{ hash: string; message: string; author: string; date: number }>;
	onComplete?: () => void;
}

type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

interface RebaseCommit {
	hash: string;
	message: string;
	author: string;
	date: number;
	action: RebaseAction;
	originalIndex: number;
}

const ACTION_CONFIG: Record<RebaseAction, { label: string; color: string; shortcut: string }> = {
	pick: { label: 'Pick', color: 'text-primary', shortcut: 'p' },
	reword: { label: 'Reword', color: 'text-blue-500', shortcut: 'r' },
	edit: { label: 'Edit', color: 'text-amber-500', shortcut: 'e' },
	squash: { label: 'Squash', color: 'text-green-500', shortcut: 's' },
	fixup: { label: 'Fixup', color: 'text-purple-500', shortcut: 'f' },
	drop: { label: 'Drop', color: 'text-destructive', shortcut: 'd' },
};

export function InteractiveRebase({
	open,
	onOpenChange,
	baseCommit,
	commits,
	onComplete,
}: InteractiveRebaseProps) {
	const gitOps = useGitOperations();
	const [rebaseCommits, setRebaseCommits] = useState<RebaseCommit[]>([]);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const sanitizeTodoMessage = useCallback((message: string) => {
		return message
			.trim()
			.replace(/[\r\n]+/g, ' ')
			.replace(/^\s*#/, '#');
	}, []);

	// Initialize commits when dialog opens
	useEffect(() => {
		if (open && commits.length > 0) {
			setRebaseCommits(
				commits.map((c, i) => ({
					...c,
					action: 'pick' as RebaseAction,
					originalIndex: i,
				}))
			);
		} else if (!open) {
			setRebaseCommits([]);
		}
	}, [open, commits]);

	// Handle drag and drop
	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		setDropIndex(index);
	};

	const handleDrop = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (dragIndex !== null && dragIndex !== index) {
			const newCommits = [...rebaseCommits];
			const [dragged] = newCommits.splice(dragIndex, 1);
			newCommits.splice(index, 0, dragged!);
			setRebaseCommits(newCommits);
		}
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	// Change action for a commit
	const changeAction = (index: number, action: RebaseAction) => {
		setRebaseCommits((prev) => {
			const next = [...prev];
			if (next[index]) {
				next[index] = { ...next[index]!, action };
			}
			return next;
		});
	};

	// Move commit up/down
	const moveCommit = (index: number, direction: 'up' | 'down') => {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= rebaseCommits.length) return;

		const newCommits = [...rebaseCommits];
		[newCommits[index], newCommits[newIndex]] = [newCommits[newIndex]!, newCommits[index]!];
		setRebaseCommits(newCommits);
	};

	// Reset to original order
	const resetOrder = () => {
		setRebaseCommits(
			commits.map((c, i) => ({
				...c,
				action: 'pick' as RebaseAction,
				originalIndex: i,
			}))
		);
	};

	// Execute rebase
	const executeRebase = async () => {
		if (rebaseCommits.filter((c) => c.action !== 'drop').length === 0) {
			toast.error('No commits selected for rebase. Mark at least one commit to apply.');
			return;
		}

		setIsSubmitting(true);
		const todoContent = rebaseCommits
			.filter((c) => c.action !== 'drop')
			.map((c) => `${c.action} ${c.hash} ${sanitizeTodoMessage(c.message)}`)
			.join('\n');

		try {
			const result = await gitOps.rebase(baseCommit, true, todoContent);
			if (result && typeof result === 'object' && 'error' in result && result.error) {
				toast.error(result.error);
				return;
			}
		} finally {
			setIsSubmitting(false);
		}

		if (onComplete) {
			onComplete();
		}
		onOpenChange(false);
	};

	const validCommits = rebaseCommits.filter((c) => c.action !== 'drop');

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle>Interactive Rebase onto {baseCommit.slice(0, 7)}</DialogTitle>
				</DialogHeader>

				<div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
					<span>Drag to reorder</span>
					<span>•</span>
					<span>Click action to change</span>
					<span>•</span>
					<Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={resetOrder}>
						<RotateCcw className="h-3 w-3 mr-1" />
						Reset
					</Button>
				</div>

				<ScrollArea className="flex-1 -mx-6 px-6">
					<div className="space-y-1">
						{rebaseCommits.map((commit, index) => {
							const config = ACTION_CONFIG[commit.action];
							const isDragging = dragIndex === index;
							const isDropTarget = dropIndex === index;

							return (
								<div
									key={commit.hash}
									draggable
									onDragStart={() => handleDragStart(index)}
									onDragOver={(e) => handleDragOver(e, index)}
									onDrop={(e) => handleDrop(e, index)}
									onDragEnd={handleDragEnd}
									className={`flex items-center gap-2 p-2 rounded border transition-all ${
										isDragging
											? 'opacity-50 border-dashed'
											: isDropTarget
											? 'border-primary bg-primary/5'
											: 'border-transparent hover:border-border'
									} ${commit.action === 'drop' ? 'opacity-40 line-through' : ''}`}
								>
									<GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />

									<select
										value={commit.action}
										onChange={(e) => changeAction(index, e.target.value as RebaseAction)}
										className={`text-xs font-medium bg-transparent border-0 cursor-pointer ${config.color}`}
									>
										{Object.entries(ACTION_CONFIG).map(([action, cfg]) => (
											<option key={action} value={action}>
												{cfg.label} ({cfg.shortcut})
											</option>
										))}
									</select>

									<span className="font-mono text-xs text-muted-foreground shrink-0">
										{commit.hash.slice(0, 7)}
									</span>

									<span className="flex-1 text-sm truncate">
										{commit.message.split('\n')[0]}
									</span>

									<span className="text-xs text-muted-foreground shrink-0">
										{commit.author}
									</span>

									<div className="flex items-center gap-0.5 shrink-0">
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={() => moveCommit(index, 'up')}
											disabled={index === 0}
										>
											<ChevronUp className="h-3 w-3" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={() => moveCommit(index, 'down')}
											disabled={index === rebaseCommits.length - 1}
										>
											<ChevronDown className="h-3 w-3" />
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</ScrollArea>

				<DialogFooter className="ui-toolbar">
					<div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
						{validCommits.length} commits will be applied
					</div>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={executeRebase} disabled={isSubmitting || validCommits.length === 0}>
						{isSubmitting ? 'Starting Rebase...' : 'Start Rebase'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

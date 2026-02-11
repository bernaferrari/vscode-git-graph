/**
 * Visual Rebase Todo Editor
 * Edit rebase todo list with drag and drop
 */

import { useState, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	GitCommit,
	GripVertical,
	Trash2,
	Edit3,
	MessageSquare,
	Square,
	ChevronUp,
	Loader2,
	AlertTriangle,
	Check,
	ArrowUp,
	ArrowDown,
	RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

type TodoAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop' | 'exec' | 'break';

interface TodoItem {
	id: string;
	action: TodoAction;
	hash: string;
	message: string;
	originalAction: TodoAction;
	originalIndex: number;
}

interface VisualRebaseTodoEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	ontoBranch?: string;
	fromCommit?: string;
}

const ACTION_CONFIG: Record<TodoAction, { label: string; color: string; icon: React.ReactNode; description: string }> = {
	pick: { 
		label: 'pick', 
		color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', 
		icon: <Check className="h-3 w-3" />,
		description: 'Use commit'
	},
	reword: { 
		label: 'reword', 
		color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30', 
		icon: <Edit3 className="h-3 w-3" />,
		description: 'Use commit, but edit the commit message'
	},
	edit: { 
		label: 'edit', 
		color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30', 
		icon: <Square className="h-3 w-3" />,
		description: 'Use commit, but stop for amending'
	},
	squash: { 
		label: 'squash', 
		color: 'text-green-600 bg-green-50 dark:bg-green-950/30', 
		icon: <ChevronUp className="h-3 w-3" />,
		description: 'Use commit, meld into previous commit'
	},
	fixup: { 
		label: 'fixup', 
		color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30', 
		icon: <ChevronUp className="h-3 w-3" />,
		description: 'Like squash, but discard commit message'
	},
	drop: { 
		label: 'drop', 
		color: 'text-red-600 bg-red-50 dark:bg-red-950/30', 
		icon: <Trash2 className="h-3 w-3" />,
		description: 'Remove commit'
	},
	exec: { 
		label: 'exec', 
		color: 'text-gray-600 bg-gray-50 dark:bg-gray-950/30', 
		icon: <MessageSquare className="h-3 w-3" />,
		description: 'Run command'
	},
	break: { 
		label: 'break', 
		color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30', 
		icon: <Square className="h-3 w-3" />,
		description: 'Stop here'
	},
};

export function VisualRebaseTodoEditor({
	open,
	onOpenChange,
	ontoBranch,
	fromCommit,
}: VisualRebaseTodoEditorProps) {
	const { activeRepo } = useAppStore();
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);
	const [isExecuting, setIsExecuting] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedTodo, setSelectedTodo] = useState<string | null>(null);

	// Load commits when dialog opens
	const loadCommits = useCallback(async () => {
		if (!open || !activeRepo || !fromCommit) return;

		setIsLoading(true);
		try {
			const result = await trpc.git.log.query({
				repo: activeRepo,
				startHash: fromCommit,
				limit: 50,
			});

			const todoItems: TodoItem[] = (result.commits || []).map((commit: any, index: number) => ({
				id: commit.hash,
				action: 'pick' as TodoAction,
				hash: commit.hash,
				message: commit.message.split('\n')[0],
				originalAction: 'pick' as TodoAction,
				originalIndex: index,
			}));

			setTodos(todoItems);
		} catch (error) {
			toast.error('Failed to load commits');
		} finally {
			setIsLoading(false);
		}
	}, [open, activeRepo, fromCommit]);

	// Load on open
	useState(() => {
		if (open) loadCommits();
	});

	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		setDropIndex(index);
	};

	const handleDrop = (index: number) => {
		if (dragIndex === null || dragIndex === index) {
			setDragIndex(null);
			setDropIndex(null);
			return;
		}

		const newTodos = [...todos];
		const [draggedItem] = newTodos.splice(dragIndex, 1);
		newTodos.splice(index, 0, draggedItem);
		setTodos(newTodos);
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	const moveUp = (index: number) => {
		if (index === 0) return;
		const newTodos = [...todos];
		[newTodos[index - 1], newTodos[index]] = [newTodos[index], newTodos[index - 1]];
		setTodos(newTodos);
	};

	const moveDown = (index: number) => {
		if (index === todos.length - 1) return;
		const newTodos = [...todos];
		[newTodos[index], newTodos[index + 1]] = [newTodos[index + 1], newTodos[index]];
		setTodos(newTodos);
	};

	const changeAction = (id: string, action: TodoAction) => {
		setTodos(prev => prev.map(todo => 
			todo.id === id ? { ...todo, action } : todo
		));
	};

	const removeTodo = (id: string) => {
		setTodos(prev => prev.filter(todo => todo.id !== id));
	};

	const resetTodo = (id: string) => {
		setTodos(prev => prev.map(todo => 
			todo.id === id ? { ...todo, action: todo.originalAction } : todo
		));
	};

	const resetAll = () => {
		setTodos(prev => prev.map(todo => ({ ...todo, action: todo.originalAction })));
	};

	const hasChanges = todos.some((todo, index) => 
		todo.action !== todo.originalAction || index !== todo.originalIndex
	);

	const handleContinueRebase = async () => {
		if (!activeRepo) return;

		setIsExecuting(true);
		try {
			// Generate todo file content
			const todoContent = todos
				.filter(t => t.action !== 'drop')
				.map(t => `${t.action} ${t.hash.substring(0, 7)} ${t.message}`)
				.join('\n');

			// Continue rebase with edited todos
			await trpc.git.continueRebase.mutate({
				repo: activeRepo,
				todos: todoContent,
			});

			toast.success('Rebase continued');
			onOpenChange(false);
		} catch (error) {
			toast.error('Failed to continue rebase');
		} finally {
			setIsExecuting(false);
		}
	};

	const handleAbort = async () => {
		if (!activeRepo) return;
		if (!confirm('Abort the rebase? All changes will be lost.')) return;

		try {
			await trpc.git.abortRebase.mutate({ repo: activeRepo });
			toast.success('Rebase aborted');
			onOpenChange(false);
		} catch (error) {
			toast.error('Failed to abort rebase');
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GripVertical className="h-5 w-5" />
						Rebase Todo Editor
						{ontoBranch && (
							<span className="text-sm font-normal text-muted-foreground">
								onto {ontoBranch}
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				{/* Action Legend */}
				<div className="flex flex-wrap gap-2 py-2 border-b text-xs">
					{Object.entries(ACTION_CONFIG).slice(0, 6).map(([key, config]) => (
						<Badge 
							key={key} 
							variant="outline" 
							className={`${config.color} border-0 cursor-pointer`}
							onClick={() => selectedTodo && changeAction(selectedTodo, key as TodoAction)}
						>
							{config.icon}
							<span className="ml-1">{config.label}</span>
						</Badge>
					))}
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : todos.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No commits to rebase</p>
						</div>
					) : (
						<div className="divide-y">
							{todos.map((todo, index) => {
								const config = ACTION_CONFIG[todo.action];
								const isModified = todo.action !== todo.originalAction || index !== todo.originalIndex;
								const isSelected = selectedTodo === todo.id;
								const isDropTarget = dropIndex === index;

								return (
									<div
										key={todo.id}
										draggable
										onDragStart={() => handleDragStart(index)}
										onDragOver={(e) => handleDragOver(e, index)}
										onDrop={() => handleDrop(index)}
										onDragEnd={handleDragEnd}
										onClick={() => setSelectedTodo(isSelected ? null : todo.id)}
										className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
											isSelected ? 'bg-accent' : 'hover:bg-accent/50'
										} ${isDropTarget ? 'border-t-2 border-primary' : ''} ${
											todo.action === 'drop' ? 'opacity-50' : ''
										}`}
									>
										{/* Drag Handle */}
										<div className="cursor-grab text-muted-foreground">
											<GripVertical className="h-4 w-4" />
										</div>

										{/* Action Badge */}
										<Badge 
											variant="outline" 
											className={`${config.color} border-0 min-w-[60px] justify-center`}
										>
											{config.icon}
											<span className="ml-1">{config.label}</span>
										</Badge>

										{/* Hash */}
										<code className="text-xs font-mono text-blue-600">
											{todo.hash.substring(0, 7)}
										</code>

										{/* Message */}
										<span className="flex-1 text-sm truncate">
											{todo.message}
										</span>

										{/* Modification Indicator */}
										{isModified && (
											<Badge variant="outline" className="text-xs">
												{todo.action !== todo.originalAction ? 'changed' : 'moved'}
											</Badge>
										)}

										{/* Actions */}
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												onClick={(e) => {
													e.stopPropagation();
													moveUp(index);
												}}
												disabled={index === 0}
											>
												<ArrowUp className="h-3 w-3" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												onClick={(e) => {
													e.stopPropagation();
													moveDown(index);
												}}
												disabled={index === todos.length - 1}
											>
												<ArrowDown className="h-3 w-3" />
											</Button>
											{isModified && (
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0"
													onClick={(e) => {
														e.stopPropagation();
														resetTodo(todo.id);
													}}
												>
													<RotateCcw className="h-3 w-3" />
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0 text-red-600"
												onClick={(e) => {
													e.stopPropagation();
													changeAction(todo.id, 'drop');
												}}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>

				<DialogFooter className="flex items-center justify-between border-t pt-4">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span>
							Drag to reorder • Click to select • Use badges to change action
						</span>
					</div>
					<div className="flex items-center gap-2">
						{hasChanges && (
							<Button variant="outline" onClick={resetAll}>
								<RotateCcw className="h-4 w-4 mr-1" />
								Reset
							</Button>
						)}
						<Button variant="outline" onClick={handleAbort} className="text-red-600">
							Abort
						</Button>
						<Button
							onClick={handleContinueRebase}
							disabled={isExecuting || todos.filter(t => t.action !== 'drop').length === 0}
						>
							{isExecuting ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Check className="h-4 w-4 mr-2" />
							)}
							Continue Rebase
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default VisualRebaseTodoEditor;

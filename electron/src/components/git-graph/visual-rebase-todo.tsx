/**
 * Visual Rebase Todo Editor
 * Edit rebase todo list with drag and drop
 */

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
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpcClient } from '@/lib/trpcClient';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


type CommandTodoAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop' | 'exec' | 'break' | 'label' | 'reset' | 'merge' | 'noop';
type NonCommandTodoAction = 'comment' | 'raw';
type TodoAction = CommandTodoAction | NonCommandTodoAction;

type TodoItemKind = 'command' | 'comment' | 'raw';

interface TodoItem {
	id: string;
	kind: TodoItemKind;
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

const ACTION_CONFIG: Record<CommandTodoAction, { label: string; color: string; icon: React.ReactNode; description: string }> = {
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
	label: {
		label: 'label',
		color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
		icon: <MessageSquare className="h-3 w-3" />,
		description: 'Create a branch label'
	},
	reset: {
		label: 'reset',
		color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30',
		icon: <RotateCcw className="h-3 w-3" />,
		description: 'Reset HEAD to commit'
	},
	merge: {
		label: 'merge',
		color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30',
		icon: <GitCommit className="h-3 w-3" />,
		description: 'Create a merge commit'
	},
	noop: {
		label: 'noop',
		color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30',
		icon: <Square className="h-3 w-3" />,
		description: 'No-op placeholder'
	},
};

const COMMAND_ACTIONS_WITH_HASH = new Set<CommandTodoAction>([
	'pick',
	'reword',
	'edit',
	'squash',
	'fixup',
	'drop',
]);

const COMMAND_ACTIONS_WITHOUT_HASH = new Set<CommandTodoAction>(['exec', 'break']);

const COMMAND_ACTIONS_WITH_OPTIONAL_HASH = new Set<CommandTodoAction>([
	'label',
	'reset',
	'merge',
	'noop',
]);

const KNOWN_COMMAND_ACTIONS = new Set<CommandTodoAction>([
	'pick',
	'reword',
	'edit',
	'squash',
	'fixup',
	'drop',
	'exec',
	'break',
	'label',
	'reset',
	'merge',
	'noop',
]);

const isCommandAction = (action: TodoAction): action is CommandTodoAction => {
	return KNOWN_COMMAND_ACTIONS.has(action as CommandTodoAction);
};

const isHashLike = (value: string): boolean => /^[0-9a-f]{7,40}$/i.test(value);

const parseRebaseTodoLine = (line: string, index: number): TodoItem | null => {
	const rawLine = line.trim();
	if (!rawLine) {
		return null;
	}

	if (rawLine.startsWith('#')) {
		return {
			id: `comment-${index}`,
			kind: 'comment',
			action: 'comment',
			hash: '',
			message: line.trimEnd(),
			originalAction: 'comment',
			originalIndex: index,
		};
	}

	const [action, ...restParts] = rawLine.split(/\s+/);
	if (!action) return null;

	const normalizedAction = action.toLowerCase();
	const rest = restParts.join(' ');
	if (!KNOWN_COMMAND_ACTIONS.has(normalizedAction as CommandTodoAction)) {
		return {
			id: `raw-${index}`,
			kind: 'raw',
			action: 'raw',
			hash: '',
			message: rawLine,
			originalAction: 'raw',
			originalIndex: index,
		};
	}

	const commandAction = normalizedAction as CommandTodoAction;

	if (COMMAND_ACTIONS_WITH_HASH.has(commandAction) || COMMAND_ACTIONS_WITH_OPTIONAL_HASH.has(commandAction)) {
		const hash = restParts[0] ?? '';

		if (COMMAND_ACTIONS_WITH_HASH.has(commandAction)) {
			if (!hash || !isHashLike(hash)) {
				return {
					id: `${commandAction}-${index}`,
					kind: 'raw',
					action: 'raw',
					hash: '',
					message: rawLine,
					originalAction: commandAction,
					originalIndex: index,
				};
			}

			return {
				id: hash,
				kind: 'command',
				action: commandAction,
				hash,
				message: rest.substring(hash.length).trim(),
				originalAction: commandAction,
				originalIndex: index,
			};
		}

		if (COMMAND_ACTIONS_WITH_OPTIONAL_HASH.has(commandAction)) {
			if (hash && isHashLike(hash)) {
				return {
					id: `${commandAction}-${index}`,
					kind: 'command',
					action: commandAction,
					hash,
					message: rest.substring(hash.length).trim(),
					originalAction: commandAction,
					originalIndex: index,
				};
			}

			return {
				id: `${commandAction}-${index}`,
				kind: 'command',
				action: commandAction,
				hash: '',
				message: rest,
				originalAction: commandAction,
				originalIndex: index,
			};
		}
	}

	return {
		id: `${commandAction}-${index}`,
		kind: 'command',
		action: commandAction,
		hash: '',
		message: rest,
		originalAction: commandAction,
		originalIndex: index,
	};
};

const buildTodoLine = (todo: TodoItem, sanitizeTodoMessage: (message: string) => string): string => {
	if (todo.kind === 'comment' || todo.kind === 'raw') {
		return todo.message;
	}
	if (!isCommandAction(todo.action)) {
		return todo.message;
	}

	const commandAction = todo.action;
	if (commandAction === 'drop') {
		return '';
	}

	const message = sanitizeTodoMessage(todo.message);
	const parts: string[] = [commandAction];

	if (!COMMAND_ACTIONS_WITHOUT_HASH.has(commandAction)) {
		if (todo.hash) {
			parts.push(todo.hash);
		}
	}

	if (message) {
		parts.push(message);
	}

	return parts.join(' ');
};

export function VisualRebaseTodoEditor({
	open,
	onOpenChange,
	ontoBranch,
	fromCommit,
}: VisualRebaseTodoEditorProps) {
	const { activeRepo } = useAppStore();
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [loadedTodoSource, setLoadedTodoSource] = useState('');
	const [hasLocalChanges, setHasLocalChanges] = useState(false);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dropIndex, setDropIndex] = useState<number | null>(null);
	const [isExecuting, setIsExecuting] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedTodo, setSelectedTodo] = useState<string | null>(null);

	const { data: activeRebaseTodo } = trpc.git.rebaseTodo.useQuery(
		{ repo: activeRepo ?? '' },
		{
			enabled: open && !!activeRepo && !fromCommit,
			refetchInterval: open && !!activeRepo && !fromCommit && !hasLocalChanges ? 2000 : false,
		}
	);
	const activeTodoSource =
		typeof activeRebaseTodo?.rawTodo === 'string' ? (activeRebaseTodo.rawTodo as string) : '';

	const sanitizeTodoMessage = useCallback((message: string) => {
		return message.trim().replace(/[\r\n]+/g, ' ');
	}, []);

	// Load commits when dialog opens
	const loadCommits = useCallback(async () => {
		if (!open || !activeRepo) return;

		setIsLoading(true);
		try {
			if (!fromCommit) {
				if (!activeTodoSource) {
					setTodos([]);
					setLoadedTodoSource('');
					setHasLocalChanges(false);
					return;
				}

				const parsedTodoItems: TodoItem[] = activeTodoSource
					.split('\n')
					.map((line: string, index: number) => parseRebaseTodoLine(line, index))
					.filter((todo): todo is TodoItem => Boolean(todo))
					.map((todo: TodoItem) => ({
						...todo,
						message: sanitizeTodoMessage(todo.message ?? ''),
					}));

				setTodos(parsedTodoItems);
				setLoadedTodoSource(activeTodoSource);
				setHasLocalChanges(false);
				return;
			}

			const result = await trpcClient.git.log.query({
				repo: activeRepo,
				startHash: fromCommit,
				maxCommits: 50,
			});

			if (result.error) {
				toast.error(result.error);
				setTodos([]);
				setLoadedTodoSource(`from:${fromCommit}`);
				setHasLocalChanges(false);
				return;
			}

			const commits = Array.isArray(result.commits) ? (result.commits as Array<{ hash: string; message: string }>) : [];
			const todoItems: TodoItem[] = commits.map((commit, index) => ({
				id: commit.hash,
				kind: 'command',
				action: 'pick',
				hash: commit.hash,
				message: sanitizeTodoMessage(commit.message).split('\n')[0] ?? '',
				originalAction: 'pick',
				originalIndex: index,
			}));

			setTodos(todoItems);
			setLoadedTodoSource(`from:${fromCommit}`);
			setHasLocalChanges(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to load commits');
		} finally {
			setIsLoading(false);
		}
	}, [open, activeRepo, fromCommit, sanitizeTodoMessage, activeTodoSource]);

	// Load on open and keep in sync when not editing.
	useEffect(() => {
		if (!open) {
			return;
		}

		if (fromCommit) {
			if (loadedTodoSource === `from:${fromCommit}`) return;
			void loadCommits();
			return;
		}

		if (hasLocalChanges) return;
		if (activeTodoSource === loadedTodoSource) return;

		void loadCommits();
	}, [open, fromCommit, hasLocalChanges, loadedTodoSource, activeTodoSource, loadCommits]);

	useEffect(() => {
		if (!open) {
			setTodos([]);
			setLoadedTodoSource('');
			setHasLocalChanges(false);
			setSelectedTodo(null);
		}
	}, [open]);

	const handleDragStart = (index: number) => {
		if (todos[index]?.kind !== 'command') {
			return;
		}
		setDragIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		if (dragIndex === null || todos[index]?.kind !== 'command') {
			return;
		}
		e.preventDefault();
		setDropIndex(index);
	};

	const handleDrop = (index: number) => {
		if (dragIndex === null || dragIndex === index || todos[index]?.kind !== 'command') {
			setDragIndex(null);
			setDropIndex(null);
			return;
		}

		const newTodos = [...todos];
		const [draggedItem] = newTodos.splice(dragIndex, 1);
		if (!draggedItem) {
			setDragIndex(null);
			setDropIndex(null);
			return;
		}
		newTodos.splice(index, 0, draggedItem);
		setTodos(newTodos);
		setHasLocalChanges(true);
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	const moveUp = (index: number) => {
		if (index === 0) return;
		if (todos[index]?.kind !== 'command') return;
		const destinationIndex = (() => {
			for (let i = index - 1; i >= 0; i--) {
				if (todos[i]?.kind === 'command') return i;
			}
			return null;
		})();
		if (destinationIndex === null) return;

		const newTodos = [...todos];
		const current = newTodos[index];
		const destination = newTodos[destinationIndex];
		if (!current || !destination) return;
		[newTodos[destinationIndex], newTodos[index]] = [current, destination];
		setTodos(newTodos);
		setHasLocalChanges(true);
	};

	const moveDown = (index: number) => {
		if (index === todos.length - 1) return;
		if (todos[index]?.kind !== 'command') return;
		let destinationIndex: number | null = null;
		for (let i = index + 1; i < todos.length; i++) {
			if (todos[i]?.kind === 'command') {
				destinationIndex = i;
				break;
			}
		}
		if (destinationIndex === null) return;

		const newTodos = [...todos];
		const current = newTodos[index];
		const destination = newTodos[destinationIndex];
		if (!current || !destination) return;
		[newTodos[index], newTodos[destinationIndex]] = [destination, current];
		setTodos(newTodos);
		setHasLocalChanges(true);
	};

	const changeAction = (id: string, action: TodoAction) => {
		if (!isCommandAction(action)) return;
		setTodos(prev => prev.map(todo => 
			todo.id === id ? { ...todo, action } : todo
		));
		setHasLocalChanges(true);
	};

	const resetTodo = (id: string) => {
		const target = todos.find((todo) => todo.id === id);
		if (!target || target.kind !== 'command') return;
		setTodos(prev => prev.map(todo => 
			todo.id === id ? { ...todo, action: todo.originalAction } : todo
		));
		setHasLocalChanges(true);
	};

	const resetAll = () => {
		setTodos(prev => prev
			.map((todo) => ({
				...todo,
				action: todo.kind === 'command' ? todo.originalAction : todo.action,
			}))
			.sort((a, b) => a.originalIndex - b.originalIndex));
		setHasLocalChanges(false);
	};

	const hasChanges = todos.some((todo, index) => 
		todo.kind === 'command' && (todo.action !== todo.originalAction || index !== todo.originalIndex)
	);

	const handleContinueRebase = async () => {
		if (!activeRepo) return;

		const activeTodos = todos.filter((t) => t.kind === 'command' && t.action !== 'drop');
		if (activeTodos.length === 0) {
			toast.error('No commits selected for rebase.');
			return;
		}

		setIsExecuting(true);
		try {
			const todoContent = todos
				.map((todo) => buildTodoLine(todo, sanitizeTodoMessage))
				.filter((line): line is string => Boolean(line))
				.join('\n');

			// Continue rebase with edited todos
			const result = await trpcClient.git.rebaseContinue.mutate({
				repo: activeRepo,
				todos: todoContent,
			});
			if (result?.error) {
				toast.error(result.error);
				return;
			}

			toast.success('Rebase continued');
			onOpenChange(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to continue rebase');
		} finally {
			setIsExecuting(false);
		}
	};

	const handleAbort = async () => {
		if (!activeRepo) return;
		if (!confirm('Abort the rebase? All changes will be lost.')) return;

		try {
			await trpcClient.git.rebaseAbort.mutate({ repo: activeRepo });
			toast.success('Rebase aborted');
			onOpenChange(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to abort rebase');
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col ui-surface">
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
					{Object.entries(ACTION_CONFIG).map(([key, config]) => (
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
								const config = todo.kind === 'command'
									? ACTION_CONFIG[todo.action as CommandTodoAction]
									: null;
								const isModified = todo.kind === 'command' && (
									todo.action !== todo.originalAction || index !== todo.originalIndex
								);
								const isSelected = selectedTodo === todo.id;
								const isDropTarget = dropIndex === index;
								const isDraggable = todo.kind === 'command';

								return (
									<div
										key={todo.id}
										draggable={isDraggable}
										onDragStart={() => isDraggable && handleDragStart(index)}
										onDragOver={(e) => { isDraggable ? handleDragOver(e, index) : undefined; }}
										onDrop={() => { isDraggable ? handleDrop(index) : undefined; }}
										onDragEnd={handleDragEnd}
										onClick={() => isDraggable && setSelectedTodo(isSelected ? null : todo.id)}
										className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
											isDraggable ? 'group' : 'cursor-default opacity-90'
										} ${
											isSelected ? 'bg-accent' : 'hover:bg-accent/50'
										} ${isDropTarget ? 'border-t-2 border-primary' : ''} ${
											todo.action === 'drop' ? 'opacity-60' : ''
										}`}
									>
										{/* Drag Handle */}
										{isDraggable && (
											<div className="cursor-grab text-muted-foreground">
												<GripVertical className="h-4 w-4" />
											</div>
										)}

										{!isDraggable && <div className="w-4" />}

										{/* Action Badge */}
										{config ? (
											<Badge 
												variant="outline" 
												className={`${config.color} border-0 min-w-[60px] justify-center`}
											>
												{config.icon}
												<span className="ml-1">{config.label}</span>
											</Badge>
										) : (
											<Badge variant="outline" className="min-w-[60px] justify-center border-0 text-muted-foreground">
												{todo.kind === 'comment' ? '#' : 'raw'}
											</Badge>
										)}

										{/* Hash */}
										{todo.kind === 'command' && (
											<code className="text-xs font-mono text-blue-600">
												{todo.hash ? todo.hash.substring(0, 7) : '—'}
											</code>
										)}

										{/* Message */}
										<span className={`flex-1 text-sm truncate ${
											todo.kind === 'comment' ? 'italic text-muted-foreground' : ''
										}`}>
											{todo.message}
										</span>

										{/* Modification Indicator */}
										{isModified && (
											<Badge variant="outline" className="text-xs">
												{todo.action !== todo.originalAction ? 'changed' : 'moved'}
											</Badge>
										)}

										{/* Actions */}
										{isDraggable && (
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
										)}
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
							disabled={isExecuting || todos.filter((t) => t.kind === 'command' && t.action !== 'drop').length === 0}
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

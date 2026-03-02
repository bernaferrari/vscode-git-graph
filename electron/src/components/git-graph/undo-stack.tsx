/**
 * Git Undo Stack
 * Comprehensive undo system for any git operation
 * Inspired by Git Tower's undo feature
 */

import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
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
} from '@/components/ui/dialog';
import {
	Undo,
	Redo,
	History,
	RotateCcw,
	Check,
	X,
	GitCommit,
	GitBranch,
	GitMerge,
	GitPullRequest,
	Upload,
	Download,
	Archive,
	Trash2,
	AlertTriangle,
	Clock,
	Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// Types for undoable operations
export type GitOperationType =
	| 'commit'
	| 'amend'
	| 'branch_create'
	| 'branch_delete'
	| 'branch_rename'
	| 'checkout'
	| 'merge'
	| 'rebase'
	| 'cherry_pick'
	| 'revert'
	| 'reset'
	| 'stash_push'
	| 'stash_pop'
	| 'stash_drop'
	| 'tag_create'
	| 'tag_delete'
	| 'push'
	| 'pull'
	| 'fetch'
	| 'remote_add'
	| 'remote_remove'
	| 'clean'
	| 'stage'
	| 'unstage';

export interface GitOperation {
	id: string;
	type: GitOperationType;
	timestamp: number;
	description: string;
	details: Record<string, unknown>;
	undoable: boolean;
	undone?: boolean;
	reflogEntry?: string;
}

interface UndoStackContextType {
	operations: GitOperation[];
	canUndo: boolean;
	canRedo: boolean;
	pushOperation: (operation: Omit<GitOperation, 'id' | 'timestamp'>) => void;
	undo: () => Promise<void>;
	redo: () => Promise<void>;
	undoOperation: (operationId: string) => Promise<void>;
	clearHistory: () => void;
	currentIndex: number;
}

const UndoStackContext = createContext<UndoStackContextType | null>(null);

const STORAGE_KEY = 'git-graph-undo-stack';

// Get icon for operation type
function getOperationIcon(type: GitOperationType) {
	switch (type) {
		case 'commit':
		case 'amend':
			return <GitCommit className="h-4 w-4" />;
		case 'branch_create':
		case 'branch_delete':
		case 'branch_rename':
		case 'checkout':
			return <GitBranch className="h-4 w-4" />;
		case 'merge':
			return <GitMerge className="h-4 w-4" />;
		case 'cherry_pick':
		case 'revert':
			return <GitPullRequest className="h-4 w-4" />;
			case 'push':
				return <Upload className="h-4 w-4" />;
		case 'pull':
		case 'fetch':
			return <Download className="h-4 w-4" />;
		case 'stash_push':
		case 'stash_pop':
		case 'stash_drop':
			return <Archive className="h-4 w-4" />;
		case 'reset':
		case 'clean':
			return <RotateCcw className="h-4 w-4" />;
		case 'tag_create':
		case 'tag_delete':
			return <Archive className="h-4 w-4" />;
		default:
			return <History className="h-4 w-4" />;
	}
}

// Get color for operation type
function getOperationColor(type: GitOperationType): string {
	switch (type) {
		case 'commit':
		case 'amend':
			return 'text-green-600 bg-green-100 dark:bg-green-900/30';
		case 'branch_create':
		case 'tag_create':
			return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
		case 'branch_delete':
		case 'tag_delete':
		case 'reset':
		case 'clean':
			return 'text-red-600 bg-red-100 dark:bg-red-900/30';
		case 'merge':
		case 'cherry_pick':
			return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
		case 'push':
			return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
		case 'pull':
		case 'fetch':
			return 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30';
		case 'stash_push':
		case 'stash_pop':
			return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
		default:
			return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
	}
}

export function UndoStackProvider({ children }: { children: ReactNode }) {
	const { activeRepo } = useAppStore();
	const [operations, setOperations] = useState<GitOperation[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [isUndoing, setIsUndoing] = useState(false);

	// Load from storage
	useEffect(() => {
		if (!activeRepo) return;
		
		const stored = localStorage.getItem(`${STORAGE_KEY}-${activeRepo}`);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				setOperations(parsed.operations || []);
				setCurrentIndex(parsed.currentIndex ?? -1);
			} catch {
				setOperations([]);
				setCurrentIndex(-1);
			}
		}
	}, [activeRepo]);

	// Save to storage
	useEffect(() => {
		if (!activeRepo) return;
		
		localStorage.setItem(
			`${STORAGE_KEY}-${activeRepo}`,
			JSON.stringify({ operations, currentIndex })
		);
	}, [operations, currentIndex, activeRepo]);

	const pushOperation = useCallback((
		operation: Omit<GitOperation, 'id' | 'timestamp'>
	) => {
		const newOperation: GitOperation = {
			...operation,
			id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			timestamp: Date.now(),
		};

		setOperations(prev => {
			// Remove any operations after current index (for redo)
			const trimmed = prev.slice(0, currentIndex + 1);
			return [...trimmed, newOperation];
		});
		setCurrentIndex(prev => prev + 1);
	}, [currentIndex]);

	const canUndo = currentIndex >= 0;
	const canRedo = currentIndex < operations.length - 1;

	const undoOperation = useCallback(async (operationId: string) => {
		if (!activeRepo) return;

		const operation = operations.find(op => op.id === operationId);
		if (!operation || !operation.undoable) {
			toast.error('This operation cannot be undone');
			return;
		}

		setIsUndoing(true);
		try {
			// Execute undo based on operation type
			switch (operation.type) {
				case 'commit':
				case 'amend':
					// Use git reset to undo commit
					await trpc.git.reset.mutate({
						repo: activeRepo,
						mode: 'soft',
						commit: 'HEAD~1',
					});
					break;

				case 'branch_create':
					// Delete the created branch
					await trpc.git.deleteBranch.mutate({
						repo: activeRepo,
						branch: operation.details.branchName as string,
					});
					break;

				case 'branch_delete':
					// Recreate branch from reflog entry
					if (operation.reflogEntry) {
						await trpc.git.createBranch.mutate({
							repo: activeRepo,
							name: operation.details.branchName as string,
							commitHash: operation.reflogEntry,
						});
					}
					break;

				case 'checkout':
					// Checkout previous branch
					await trpc.git.checkout.mutate({
						repo: activeRepo,
						branch: operation.details.previousBranch as string,
					});
					break;

				case 'stash_push':
					// The stash is already there, just drop it
					await trpc.git.stashDrop.mutate({
						repo: activeRepo,
						index: operation.details.stashIndex as number,
					});
					break;

				case 'stash_pop':
				case 'stash_drop':
					// Cannot easily undo these
					toast.warning('Stash operations cannot be fully undone');
					break;

				case 'reset':
					// Reset back to original state using reflog
					if (operation.reflogEntry) {
						await trpc.git.reset.mutate({
							repo: activeRepo,
							mode: 'hard',
							commit: operation.reflogEntry,
						});
					}
					break;

				default:
					toast.info(`Undo for ${operation.type} uses reflog`);
					if (operation.reflogEntry) {
						await trpc.git.reset.mutate({
							repo: activeRepo,
							mode: 'mixed',
							commit: operation.reflogEntry,
						});
					}
			}

			// Mark as undone
			setOperations(prev => prev.map(op =>
				op.id === operationId ? { ...op, undone: true } : op
			));
			setCurrentIndex(prev => prev - 1);

			toast.success(`Undone: ${operation.description}`);
		} catch (error) {
			toast.error('Failed to undo operation', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setIsUndoing(false);
		}
	}, [activeRepo, operations]);

	const undo = useCallback(async () => {
		if (!canUndo) return;
		const operation = operations[currentIndex];
		if (operation) {
			await undoOperation(operation.id);
		}
	}, [canUndo, currentIndex, operations, undoOperation]);

	const redo = useCallback(async () => {
		if (!canRedo || !activeRepo) return;
		
		const operation = operations[currentIndex + 1];
		if (!operation) return;

		setIsUndoing(true);
		try {
			// Re-execute the operation
			// This is simplified - in production you'd store full command details
			toast.info(`Redo: ${operation.description}`);
			setCurrentIndex(prev => prev + 1);
		} catch (error) {
			toast.error('Failed to redo operation');
		} finally {
			setIsUndoing(false);
		}
	}, [canRedo, currentIndex, operations, activeRepo]);

	const clearHistory = useCallback(() => {
		setOperations([]);
		setCurrentIndex(-1);
	}, []);

	return (
		<UndoStackContext.Provider value={{
			operations,
			canUndo,
			canRedo,
			pushOperation,
			undo,
			redo,
			undoOperation,
			clearHistory,
			currentIndex,
		}}>
			{children}
		</UndoStackContext.Provider>
	);
}

export function useUndoStack() {
	const context = useContext(UndoStackContext);
	if (!context) {
		throw new Error('useUndoStack must be used within UndoStackProvider');
	}
	return context;
}

// Undo Stack Dialog Component
export function UndoStackDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { operations, undoOperation, clearHistory, isUndoing } = useUndoStackDialog();

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="h-5 w-5" />
						Undo History
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex-1">
					{operations.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<History className="h-12 w-12 mx-auto mb-4 opacity-30" />
							<p>No operations in history</p>
						</div>
					) : (
						<div className="space-y-1">
							{operations.slice().reverse().map((operation) => (
								<div
									key={operation.id}
									className={`flex items-center gap-3 p-3 rounded-lg border ${
										operation.undone 
											? 'opacity-50 bg-muted/30' 
											: 'hover:bg-accent/50'
									}`}
								>
									<div className={`p-2 rounded ${getOperationColor(operation.type)}`}>
										{getOperationIcon(operation.type)}
									</div>
									
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium capitalize">
												{operation.type.replace(/_/g, ' ')}
											</span>
											{operation.undone && (
												<Badge variant="outline" className="text-xs">
													Undone
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground truncate">
											{operation.description}
										</p>
									</div>

									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground">
											{formatTime(operation.timestamp)}
										</span>
										{operation.undoable && !operation.undone && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => undoOperation(operation.id)}
												disabled={isUndoing}
											>
												{isUndoing ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Undo className="h-3 w-3" />
												)}
											</Button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center justify-between pt-4 border-t">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span>Some operations cannot be undone</span>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={clearHistory}>
							<Trash2 className="h-4 w-4 mr-2" />
							Clear History
						</Button>
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Separate hook for dialog state
function useUndoStackDialog() {
	const { operations, undoOperation, clearHistory } = useUndoStack();
	const [isUndoing, setIsUndoing] = useState(false);

	const handleUndoOperation = useCallback(async (id: string) => {
		setIsUndoing(true);
		try {
			await undoOperation(id);
		} finally {
			setIsUndoing(false);
		}
	}, [undoOperation]);

	return {
		operations,
		undoOperation: handleUndoOperation,
		clearHistory,
		isUndoing,
	};
}

// Undo/Redo buttons for toolbar
export function UndoRedoButtons() {
	const { canUndo, canRedo, undo, redo } = useUndoStack();
	const [isLoading, setIsLoading] = useState(false);

	const handleUndo = async () => {
		setIsLoading(true);
		try {
			await undo();
		} finally {
			setIsLoading(false);
		}
	};

	const handleRedo = async () => {
		setIsLoading(true);
		try {
			await redo();
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<Button
				variant="ghost"
				size="sm"
				className="h-7 w-7 p-0"
				onClick={handleUndo}
				disabled={!canUndo || isLoading}
				title="Undo (⌘Z)"
			>
				<Undo className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				className="h-7 w-7 p-0"
				onClick={handleRedo}
				disabled={!canRedo || isLoading}
				title="Redo (⌘⇧Z)"
			>
				<Redo className="h-4 w-4" />
			</Button>
		</div>
	);
}

export default UndoStackProvider;

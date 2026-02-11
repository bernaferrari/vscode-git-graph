/**
 * Drag Commit to Branch
 * Drag and drop commits onto branches to cherry-pick
 */

import { useState, useCallback, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	GitBranch,
	GitCommit,
	ArrowRight,
	AlertTriangle,
	Check,
	Loader2,
	Copy,
	X,
} from 'lucide-react';
import { toast } from 'sonner';

interface DragCommitProps {
	commitHash: string;
	commitMessage: string;
	onComplete?: () => void;
}

interface DropTarget {
	type: 'branch' | 'commit' | 'tag';
	name: string;
	value: string;
}

// Drag state
let draggedCommit: { hash: string; message: string } | null = null;

export function useDragCommit() {
	const startDrag = useCallback((hash: string, message: string) => {
		draggedCommit = { hash, message };
	}, []);

	const getDraggedCommit = useCallback(() => draggedCommit, []);

	const endDrag = useCallback(() => {
		draggedCommit = null;
	}, []);

	return { startDrag, getDraggedCommit, endDrag };
}

// Draggable commit wrapper
export function DraggableCommit({
	hash,
	message,
	children,
	onDragStart,
}: {
	hash: string;
	message: string;
	children: React.ReactNode;
	onDragStart?: () => void;
}) {
	const { startDrag } = useDragCommit();

	return (
		<div
			draggable
			onDragStart={(e) => {
				e.dataTransfer.setData('text/plain', hash);
				e.dataTransfer.effectAllowed = 'copy';
				startDrag(hash, message);
				onDragStart?.();
			}}
			className="cursor-grab active:cursor-grabbing"
		>
			{children}
		</div>
	);
}

// Drop zone for branches
export function BranchDropZone({
	branchName,
	onDrop,
	children,
}: {
	branchName: string;
	onDrop: (commitHash: string) => void;
	children: React.ReactNode;
}) {
	const [isOver, setIsOver] = useState(false);

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = 'copy';
				setIsOver(true);
			}}
			onDragLeave={() => setIsOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setIsOver(false);
				const commitHash = e.dataTransfer.getData('text/plain');
				if (commitHash) {
					onDrop(commitHash);
				}
			}}
			className={`transition-colors ${
				isOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : ''
			}`}
		>
			{children}
		</div>
	);
}

// Confirmation dialog for cherry-pick
export function DragCherryPickDialog({
	open,
	onOpenChange,
	commitHash,
	commitMessage,
	targetBranch,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commitHash: string;
	commitMessage: string;
	targetBranch: string;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Copy className="h-5 w-5" />
						Cherry-pick to Branch
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
						<GitCommit className="h-5 w-5 text-muted-foreground" />
						<div className="flex-1 min-w-0">
							<code className="text-xs text-muted-foreground">{commitHash.slice(0, 7)}</code>
							<p className="text-sm truncate">{commitMessage.split('\n')[0]}</p>
						</div>
					</div>

					<div className="flex items-center justify-center">
						<ArrowRight className="h-5 w-5 text-muted-foreground" />
					</div>

					<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
						<GitBranch className="h-5 w-5 text-muted-foreground" />
						<div className="flex-1 min-w-0">
							<p className="font-medium">{targetBranch}</p>
							<p className="text-xs text-muted-foreground">Target branch</p>
						</div>
					</div>

					<div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
						<AlertTriangle className="h-4 w-4" />
						<span>This will checkout the branch and cherry-pick the commit</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onConfirm}>
						<Check className="h-4 w-4 mr-2" />
						Cherry-pick
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Main component that handles the cherry-pick operation
export function DragCommitHandler({
	commitHash,
	commitMessage,
	targetBranch,
	open,
	onOpenChange,
	onComplete,
}: DragCommitProps & {
	targetBranch: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { activeRepo } = useAppStore();
	const [isExecuting, setIsExecuting] = useState(false);

	const handleConfirm = useCallback(async () => {
		if (!activeRepo) return;

		setIsExecuting(true);
		try {
			// Checkout the target branch
			await trpc.git.checkout.mutate({
				repo: activeRepo,
				branch: targetBranch,
			});

			// Cherry-pick the commit
			await trpc.git.cherryPick.mutate({
				repo: activeRepo,
				commitHash,
			});

			toast.success(`Cherry-picked ${commitHash.slice(0, 7)} to ${targetBranch}`);
			onOpenChange(false);
			onComplete?.();
		} catch (error) {
			toast.error('Failed to cherry-pick', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setIsExecuting(false);
		}
	}, [activeRepo, commitHash, targetBranch, onOpenChange, onComplete]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{isExecuting ? (
							<Loader2 className="h-5 w-5 animate-spin" />
						) : (
							<Copy className="h-5 w-5" />
						)}
						Cherry-pick to Branch
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
						<GitCommit className="h-5 w-5 text-muted-foreground" />
						<div className="flex-1 min-w-0">
							<code className="text-xs text-muted-foreground">{commitHash.slice(0, 7)}</code>
							<p className="text-sm truncate">{commitMessage.split('\n')[0]}</p>
						</div>
					</div>

					<div className="flex items-center justify-center">
						<ArrowRight className="h-5 w-5 text-muted-foreground" />
					</div>

					<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
						<GitBranch className="h-5 w-5 text-muted-foreground" />
						<div className="flex-1 min-w-0">
							<p className="font-medium">{targetBranch}</p>
							<p className="text-xs text-muted-foreground">Target branch</p>
						</div>
					</div>

					<div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
						<AlertTriangle className="h-4 w-4" />
						<span>This will checkout the branch and cherry-pick the commit</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isExecuting}>
						Cancel
					</Button>
					<Button onClick={handleConfirm} disabled={isExecuting}>
						{isExecuting ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Check className="h-4 w-4 mr-2" />
						)}
						Cherry-pick
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Visual indicator when dragging over drop zones
export function DropIndicator({ isVisible }: { isVisible: boolean }) {
	if (!isVisible) return null;

	return (
		<div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none flex items-center justify-center">
			<div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
				Drop to cherry-pick
			</div>
		</div>
	);
}

export default DragCommitHandler;

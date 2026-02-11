/**
 * Bulk Commit Operations
 * Select multiple commits and perform batch actions
 */

import { useState, useCallback, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	CheckSquare,
	Square,
	X,
	GitCommit,
	GitBranch,
	ArrowRight,
	Copy,
	RotateCcw,
	Trash2,
	MoreHorizontal,
	Loader2,
	Check,
	AlertTriangle,
	Plus,
	Minus,
} from 'lucide-react';
import { toast } from 'sonner';

interface Commit {
	hash: string;
	message: string;
	author: string;
	date: number;
	parents: string[];
}

interface BulkOperationsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commits: Commit[];
	onComplete?: () => void;
}

type BulkAction = 'cherry-pick' | 'revert' | 'copy-hash' | 'create-branch' | 'archive';

export function BulkCommitOperations({
	open,
	onOpenChange,
	commits,
	onComplete,
}: BulkOperationsProps) {
	const { activeRepo } = useAppStore();
	const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
	const [isExecuting, setIsExecuting] = useState(false);
	const [targetBranch, setTargetBranch] = useState('');
	const [showBranchInput, setShowBranchInput] = useState(false);

	// Reset selection when dialog opens
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setSelectedHashes(new Set());
			setShowBranchInput(false);
		}
		onOpenChange(newOpen);
	};

	// Toggle commit selection
	const toggleCommit = useCallback((hash: string) => {
		setSelectedHashes(prev => {
			const next = new Set(prev);
			if (next.has(hash)) {
				next.delete(hash);
			} else {
				next.add(hash);
			}
			return next;
		});
	}, []);

	// Select all
	const selectAll = useCallback(() => {
		setSelectedHashes(new Set(commits.map(c => c.hash)));
	}, [commits]);

	// Deselect all
	const deselectAll = useCallback(() => {
		setSelectedHashes(new Set());
	}, []);

	// Select range
	const selectRange = useCallback((startHash: string, endHash: string) => {
		const startIndex = commits.findIndex(c => c.hash === startHash);
		const endIndex = commits.findIndex(c => c.hash === endHash);
		
		if (startIndex === -1 || endIndex === -1) return;

		const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
		const newSelection = new Set(selectedHashes);
		
		for (let i = from; i <= to; i++) {
			newSelection.add(commits[i].hash);
		}
		
		setSelectedHashes(newSelection);
	}, [commits, selectedHashes]);

	// Get selected commits in order
	const selectedCommits = useMemo(() => {
		return commits.filter(c => selectedHashes.has(c.hash));
	}, [commits, selectedHashes]);

	// Execute bulk action
	const executeAction = useCallback(async (action: BulkAction) => {
		if (selectedHashes.size === 0) {
			toast.error('No commits selected');
			return;
		}

		if (action === 'copy-hash') {
			const hashes = selectedCommits.map(c => c.hash.slice(0, 7)).join('\n');
			navigator.clipboard.writeText(hashes);
			toast.success(`Copied ${selectedHashes.size} commit hashes`);
			return;
		}

		if (action === 'create-branch') {
			if (!targetBranch.trim()) {
				setShowBranchInput(true);
				return;
			}
		}

		setIsExecuting(true);

		try {
			switch (action) {
				case 'cherry-pick':
					// Cherry-pick commits in order (oldest first)
					const orderedCommits = [...selectedCommits].reverse();
					for (const commit of orderedCommits) {
						await trpc.git.cherryPick.mutate({
							repo: activeRepo ?? '',
							commitHash: commit.hash,
						});
					}
					toast.success(`Cherry-picked ${selectedHashes.size} commits`);
					break;

				case 'revert':
					// Revert commits in order (newest first for reverts)
					for (const commit of selectedCommits) {
						await trpc.git.revert.mutate({
							repo: activeRepo ?? '',
							commitHash: commit.hash,
						});
					}
					toast.success(`Reverted ${selectedHashes.size} commits`);
					break;

				case 'create-branch':
					if (selectedCommits.length > 0) {
						await trpc.git.createBranch.mutate({
							repo: activeRepo ?? '',
							name: targetBranch,
							commitHash: selectedCommits[0].hash,
						});
						await trpc.git.checkout.mutate({
							repo: activeRepo ?? '',
							branch: targetBranch,
						});
						// Cherry-pick remaining commits
						const remaining = selectedCommits.slice(1);
						for (const commit of remaining) {
							await trpc.git.cherryPick.mutate({
								repo: activeRepo ?? '',
								commitHash: commit.hash,
							});
						}
						toast.success(`Created branch ${targetBranch} with ${selectedHashes.size} commits`);
					}
					break;

				default:
					break;
			}

			setSelectedHashes(new Set());
			setShowBranchInput(false);
			onComplete?.();
			onOpenChange(false);
		} catch (error) {
			toast.error(`Failed to ${action}`, {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setIsExecuting(false);
		}
	}, [activeRepo, selectedCommits, selectedHashes, targetBranch, onComplete, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CheckSquare className="h-5 w-5" />
						Bulk Commit Operations
						{selectedHashes.size > 0 && (
							<Badge variant="secondary">
								{selectedHashes.size} selected
							</Badge>
						)}
					</DialogTitle>
				</DialogHeader>

				{/* Toolbar */}
				<div className="flex items-center justify-between border-b pb-3">
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={selectAll}>
							<Plus className="h-4 w-4 mr-1" />
							Select All
						</Button>
						<Button variant="outline" size="sm" onClick={deselectAll}>
							<Minus className="h-4 w-4 mr-1" />
							Deselect All
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => executeAction('copy-hash')}
							disabled={selectedHashes.size === 0}
						>
							<Copy className="h-4 w-4 mr-1" />
							Copy Hashes
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="default"
									size="sm"
									disabled={selectedHashes.size === 0}
								>
									Actions
									<MoreHorizontal className="h-4 w-4 ml-1" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => executeAction('cherry-pick')}>
									<GitCommit className="h-4 w-4 mr-2" />
									Cherry-pick Selected
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => executeAction('revert')}>
									<RotateCcw className="h-4 w-4 mr-2" />
									Revert Selected
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => setShowBranchInput(true)}>
									<GitBranch className="h-4 w-4 mr-2" />
									Create Branch with Selected
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Branch name input */}
				{showBranchInput && (
					<div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
						<GitBranch className="h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="New branch name..."
							value={targetBranch}
							onChange={(e) => setTargetBranch(e.target.value)}
							className="flex-1 bg-transparent border-none outline-none text-sm"
							autoFocus
						/>
						<Button
							size="sm"
							onClick={() => executeAction('create-branch')}
							disabled={!targetBranch.trim() || isExecuting}
						>
							{isExecuting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Check className="h-4 w-4" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowBranchInput(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}

				{/* Commit list */}
				<ScrollArea className="flex-1">
					<div className="space-y-1">
						{commits.map((commit, index) => {
							const isSelected = selectedHashes.has(commit.hash);
							const prevCommit = commits[index - 1];
							const nextCommit = commits[index + 1];

							return (
								<div
									key={commit.hash}
									className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
										isSelected 
											? 'bg-primary/10 border border-primary/30' 
											: 'hover:bg-accent/50'
									}`}
									onClick={(e) => {
										if (e.shiftKey && prevCommit && selectedHashes.has(prevCommit.hash)) {
											selectRange(prevCommit.hash, commit.hash);
										} else {
											toggleCommit(commit.hash);
										}
									}}
								>
									<Checkbox
										checked={isSelected}
										className="pointer-events-none"
									/>
									
									<code className="text-xs font-mono text-blue-600 w-16">
										{commit.hash.slice(0, 7)}
									</code>
									
									<span className="flex-1 text-sm truncate">
										{commit.message.split('\n')[0]}
									</span>
									
									<span className="text-xs text-muted-foreground w-24 truncate">
										{commit.author}
									</span>
								</div>
							);
						})}
					</div>
				</ScrollArea>

				{/* Footer */}
				<div className="flex items-center justify-between pt-4 border-t">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span>Shift+Click to select range</span>
					</div>
					<Button variant="ghost" onClick={() => handleOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Mini button to open bulk operations
export function BulkOperationsButton({
	commits,
	onOpen,
}: {
	commits: Commit[];
	onOpen: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onOpen}
			title="Bulk operations"
		>
			<CheckSquare className="h-4 w-4" />
		</Button>
	);
}

export default BulkCommitOperations;

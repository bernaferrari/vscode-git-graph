/**
 * Worktree Management
 * Create, manage, and switch between git worktrees
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
	FolderGit2,
	Plus,
	Trash2,
	FolderOpen,
	Loader2,
	AlertCircle,
	Check,
	GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';

interface Worktree {
	path: string;
	head: string;
	branch: string;
	commitHash: string;
	detached?: boolean;
}

interface WorktreeManagementProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function WorktreeManagement({ open, onOpenChange }: WorktreeManagementProps) {
	const { activeRepo, setActiveRepo } = useAppStore();
	const [isCreating, setIsCreating] = useState(false);
	const [newWorktree, setNewWorktree] = useState({
		path: '',
		branch: '',
		createBranch: false,
		newBranchName: '',
	});

	// Fetch worktrees
	const { data: worktreeData, isLoading, refetch } = trpc.git.worktree.list.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Create worktree mutation
	const createMutation = trpc.git.worktree.add.useMutation({
		onSuccess: () => {
			toast.success('Worktree created successfully');
			setIsCreating(false);
			setNewWorktree({ path: '', branch: '', createBranch: false, newBranchName: '' });
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to create worktree', { description: error.message });
		},
	});

	// Remove worktree mutation
	const removeMutation = trpc.git.worktree.remove.useMutation({
		onSuccess: () => {
			toast.success('Worktree removed');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to remove worktree', { description: error.message });
		},
	});

	// Prune worktrees mutation
	const pruneMutation = trpc.git.worktree.prune.useMutation({
		onSuccess: () => {
			toast.success('Pruned stale worktrees');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to prune worktrees', { description: error.message });
		},
	});

	// Fetch branches for dropdown
	const { data: branchData } = trpc.git.branches.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const worktrees: Worktree[] = worktreeData?.worktrees ?? [];
	const branches = branchData?.branches ?? [];

	const handleCreateWorktree = () => {
		if (!newWorktree.path) {
			toast.error('Please enter a path for the worktree');
			return;
		}

		if (newWorktree.createBranch && !newWorktree.newBranchName) {
			toast.error('Please enter a branch name');
			return;
		}

		if (!newWorktree.createBranch && !newWorktree.branch) {
			toast.error('Please select a branch');
			return;
		}

		createMutation.mutate({
			repo: activeRepo ?? '',
			path: newWorktree.path,
			branch: newWorktree.createBranch ? newWorktree.newBranchName : newWorktree.branch,
			createBranch: newWorktree.createBranch,
		});
	};

	const handleRemoveWorktree = (path: string) => {
		if (confirm(`Remove worktree at ${path}?`)) {
			removeMutation.mutate({ repo: activeRepo ?? '', path });
		}
	};

	const handleOpenWorktree = (path: string) => {
		setActiveRepo(path);
		onOpenChange(false);
		toast.success(`Switched to worktree: ${path}`);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderGit2 className="h-5 w-5" />
						Worktrees
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<span className="text-sm text-muted-foreground">
						{worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => pruneMutation.mutate({ repo: activeRepo ?? '' })}
							disabled={pruneMutation.isPending}
						>
							<Trash2 className="h-4 w-4 mr-1" />
							Prune
						</Button>
						<Button
							size="sm"
							onClick={() => setIsCreating(!isCreating)}
						>
							<Plus className="h-4 w-4 mr-1" />
							New Worktree
						</Button>
					</div>
				</div>

				{/* Create Worktree Form */}
				{isCreating && (
					<div className="p-4 border rounded-lg bg-muted/30 space-y-3">
						<h4 className="font-medium">Create New Worktree</h4>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-xs font-medium mb-1 block">Path</label>
								<Input
									placeholder="../my-feature"
									value={newWorktree.path}
									onChange={(e) => setNewWorktree(prev => ({ ...prev, path: e.target.value }))}
								/>
							</div>
							<div className="flex items-end gap-2">
								<input
									type="checkbox"
									id="createBranch"
									checked={newWorktree.createBranch}
									onChange={(e) => setNewWorktree(prev => ({ ...prev, createBranch: e.target.checked }))}
								/>
								<label htmlFor="createBranch" className="text-sm">Create new branch</label>
							</div>
						</div>

						{newWorktree.createBranch ? (
							<Input
								placeholder="New branch name"
								value={newWorktree.newBranchName}
								onChange={(e) => setNewWorktree(prev => ({ ...prev, newBranchName: e.target.value }))}
							/>
						) : (
							<select
								className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
								value={newWorktree.branch}
								onChange={(e) => setNewWorktree(prev => ({ ...prev, branch: e.target.value }))}
							>
								<option value="">Select branch...</option>
								{branches.map((b) => (
									<option key={b.name} value={b.name}>{b.name}</option>
								))}
							</select>
						)}

						<div className="flex justify-end gap-2">
							<Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleCreateWorktree}
								disabled={createMutation.isPending}
							>
								{createMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<FolderGit2 className="h-4 w-4 mr-1" />
								)}
								Create
							</Button>
						</div>
					</div>
				)}

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : worktrees.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No worktrees found</p>
						</div>
					) : (
						<div className="space-y-2">
							{worktrees.map((wt, index) => (
								<div
									key={wt.path}
									className={`flex items-center gap-3 p-3 rounded-lg border ${
										wt.path === activeRepo ? 'border-primary bg-accent/50' : 'hover:bg-accent/30'
									}`}
								>
									<div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
										<FolderGit2 className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-mono text-sm truncate">
												{wt.path.split('/').pop()}
											</span>
											{wt.path === activeRepo && (
												<Badge variant="outline" className="text-xs">
													<Check className="h-3 w-3 mr-1 text-green-600" />
													Active
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<GitBranch className="h-3 w-3" />
											<span>{wt.branch || 'detached'}</span>
											<span className="font-mono">({wt.commitHash?.slice(0, 7)})</span>
										</div>
										<div className="text-xs text-muted-foreground truncate mt-0.5">
											{wt.path}
										</div>
									</div>
									<div className="flex items-center gap-1">
										{wt.path !== activeRepo && (
											<>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleOpenWorktree(wt.path)}
												>
													<FolderOpen className="h-4 w-4 mr-1" />
													Open
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-red-600"
													onClick={() => handleRemoveWorktree(wt.path)}
													disabled={removeMutation.isPending}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Worktrees allow you to checkout multiple branches simultaneously in separate directories.
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default WorktreeManagement;

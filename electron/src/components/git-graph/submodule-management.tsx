/**
 * Submodule Management
 * Add, update, and manage git submodules
 */

import {
	Package,
	Plus,
	Trash2,
	RefreshCw,
	ExternalLink,
	Loader2,
	GitBranch,
	Check,
	AlertCircle,
	Download,
	Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface Submodule {
	name: string;
	path: string;
	url: string;
	branch?: string;
	head?: string;
	status?: string;
}

interface SubmoduleManagementProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SubmoduleManagement({ open, onOpenChange }: SubmoduleManagementProps) {
	const { activeRepo } = useAppStore();
	const [isAdding, setIsAdding] = useState(false);
	const [newSubmodule, setNewSubmodule] = useState({
		url: '',
		path: '',
		branch: '',
	});

	// Fetch submodules
	const { data: submoduleData, isLoading, refetch } = trpc.git.submodule.list.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Add submodule mutation
	const addMutation = trpc.git.submodule.add.useMutation({
		onSuccess: () => {
			toast.success('Submodule added successfully');
			setIsAdding(false);
			setNewSubmodule({ url: '', path: '', branch: '' });
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to add submodule', { description: error.message });
		},
	});

	// Update submodule mutation
	const updateMutation = trpc.git.submodule.update.useMutation({
		onSuccess: () => {
			toast.success('Submodule updated');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to update submodule', { description: error.message });
		},
	});

	// Remove submodule mutation
	const removeMutation = trpc.git.submodule.remove.useMutation({
		onSuccess: () => {
			toast.success('Submodule removed');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to remove submodule', { description: error.message });
		},
	});

	// Sync submodule mutation
	const syncMutation = trpc.git.submodule.sync.useMutation({
		onSuccess: () => {
			toast.success('Submodule synced');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to sync submodule', { description: error.message });
		},
	});

	const submodules: Submodule[] = submoduleData?.submodules ?? [];

	const handleAddSubmodule = () => {
		if (!newSubmodule.url || !newSubmodule.path) {
			toast.error('Please enter URL and path');
			return;
		}

		addMutation.mutate({
			repo: activeRepo ?? '',
			url: newSubmodule.url,
			path: newSubmodule.path,
			branch: newSubmodule.branch || undefined,
		});
	};

	const handleUpdateSubmodule = (path: string) => {
		updateMutation.mutate({ repo: activeRepo ?? '', path });
	};

	const handleRemoveSubmodule = (path: string) => {
		if (confirm(`Remove submodule at ${path}?`)) {
			removeMutation.mutate({ repo: activeRepo ?? '', path });
		}
	};

	const handleSyncSubmodule = (path: string) => {
		syncMutation.mutate({ repo: activeRepo ?? '', path });
	};

	const handleUpdateAll = () => {
		submodules.forEach(sm => {
			updateMutation.mutate({ repo: activeRepo ?? '', path: sm.path });
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Package className="h-5 w-5" />
						Submodules
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<span className="text-sm text-muted-foreground">
						{submodules.length} submodule{submodules.length !== 1 ? 's' : ''}
					</span>
					<div className="flex items-center gap-2">
						{submodules.length > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleUpdateAll}
								disabled={updateMutation.isPending}
							>
								<Download className="h-4 w-4 mr-1" />
								Update All
							</Button>
						)}
						<Button
							size="sm"
							onClick={() => { setIsAdding(!isAdding); }}
						>
							<Plus className="h-4 w-4 mr-1" />
							Add Submodule
						</Button>
					</div>
				</div>

				{/* Add Submodule Form */}
				{isAdding && (
					<div className="p-4 border rounded-lg bg-muted/30 space-y-3">
						<h4 className="font-medium">Add Submodule</h4>
						<div className="space-y-2">
							<Input
								placeholder="Repository URL (e.g., https://github.com/user/repo)"
								value={newSubmodule.url}
								onChange={(e) => { setNewSubmodule(prev => ({ ...prev, url: e.target.value })); }}
							/>
							<Input
								placeholder="Local path (e.g., lib/my-module)"
								value={newSubmodule.path}
								onChange={(e) => { setNewSubmodule(prev => ({ ...prev, path: e.target.value })); }}
							/>
							<Input
								placeholder="Branch (optional, defaults to default branch)"
								value={newSubmodule.branch}
								onChange={(e) => { setNewSubmodule(prev => ({ ...prev, branch: e.target.value })); }}
							/>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" size="sm" onClick={() => { setIsAdding(false); }}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleAddSubmodule}
								disabled={addMutation.isPending}
							>
								{addMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Plus className="h-4 w-4 mr-1" />
								)}
								Add
							</Button>
						</div>
					</div>
				)}

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : submodules.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No submodules found</p>
							<p className="text-xs mt-1">
								Submodules allow you to include other Git repositories as subdirectories.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{submodules.map((sm) => (
								<div
									key={sm.path}
									className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30"
								>
									<div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
										<Package className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-mono text-sm">{sm.path}</span>
											{sm.branch && (
												<Badge variant="outline" className="text-xs">
													<GitBranch className="h-3 w-3 mr-1" />
													{sm.branch}
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground truncate mb-1">
											{sm.url}
										</div>
										{sm.head && (
											<div className="text-xs font-mono text-muted-foreground">
												@ {sm.head.slice(0, 7)}
											</div>
										)}
										{sm.status && (
											<div className="text-xs text-amber-600 mt-1">
												{sm.status}
											</div>
										)}
									</div>
									<div className="flex items-center gap-1 shrink-0">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => window.open(sm.url, '_blank')}
										>
											<ExternalLink className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => { handleSyncSubmodule(sm.path); }}
											disabled={syncMutation.isPending}
										>
											<RefreshCw className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => { handleUpdateSubmodule(sm.path); }}
											disabled={updateMutation.isPending}
										>
											<Download className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-red-600"
											onClick={() => { handleRemoveSubmodule(sm.path); }}
											disabled={removeMutation.isPending}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-2">
					<AlertCircle className="h-3 w-3" />
					<span>
						Changes to submodules require commit after add/remove.
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default SubmoduleManagement;

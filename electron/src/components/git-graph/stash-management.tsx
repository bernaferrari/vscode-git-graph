/**
 * Stash Management Dialog
 * View, apply, drop, and pop stashes
 */

import {
	Archive,
	Plus,
	Trash2,
	Download,
	Check,
	Loader2,
	GitBranch,
	AlertCircle,
	Eye,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface StashEntry {
	index: number;
	message: string;
	branch: string;
	hash: string;
	date: string;
	files: { path: string; additions: number; deletions: number }[];
}

interface StashManagementProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function StashManagement({ open, onOpenChange }: StashManagementProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [newStashMessage, setNewStashMessage] = useState('');
	const [viewingStash, setViewingStash] = useState<number | null>(null);
	const [branchDrafts, setBranchDrafts] = useState<Record<number, string>>({});
	const [branchComposerIndex, setBranchComposerIndex] = useState<number | null>(null);

	// Fetch stashes
	const { data: stashData, isLoading, refetch } = trpc.git.stashList.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const stashes: StashEntry[] = stashData?.stashes ?? [];

	// Create stash mutation
	const createMutation = trpc.git.stashPush.useMutation({
		onSuccess: () => {
			toast.success('Stash created');
			setNewStashMessage('');
			void refetch();
		},
		onError: (error: unknown) => {
			toast.error('Failed to create stash', { description: error instanceof Error ? error.message : 'Unknown error' });
		},
	});

	// Apply stash mutation
	const applyMutation = trpc.git.stashApply.useMutation({
		onSuccess: () => {
			toast.success('Stash applied');
			void refetch();
		},
		onError: (error: unknown) => {
			toast.error('Failed to apply stash', { description: error instanceof Error ? error.message : 'Unknown error' });
		},
	});

	// Drop stash mutation
	const dropMutation = trpc.git.stashDrop.useMutation({
		onSuccess: () => {
			toast.success('Stash dropped');
			void refetch();
		},
		onError: (error: unknown) => {
			toast.error('Failed to drop stash', { description: error instanceof Error ? error.message : 'Unknown error' });
		},
	});

	// Pop stash mutation
	const popMutation = trpc.git.stashPop.useMutation({
		onSuccess: () => {
			toast.success('Stash popped and applied');
			void refetch();
		},
		onError: (error: unknown) => {
			toast.error('Failed to pop stash', { description: error instanceof Error ? error.message : 'Unknown error' });
		},
	});

	const handleCreateStash = () => {
		createMutation.mutate(
			newStashMessage
				? { repo: activeRepo ?? '', message: newStashMessage }
				: { repo: activeRepo ?? '' }
		);
	};

	const handleApplyStash = (index: number, keepInList: boolean) => {
		if (keepInList) {
			applyMutation.mutate({ repo: activeRepo ?? '', index });
		} else {
			popMutation.mutate({ repo: activeRepo ?? '', index });
		}
	};

	const handleDropStash = (index: number) => {
				// eslint-disable-next-line no-alert
		if (confirm(`Drop stash@{${String(index)}}?`)) {
			dropMutation.mutate({ repo: activeRepo ?? '', index });
		}
	};

	const handleCreateBranchFromStash = async (index: number) => {
		const branchName = branchDrafts[index]?.trim();
		if (!branchName) {
			toast.error('Enter a branch name first');
			return;
		}

		try {
			await gitOps.stashBranch(index, branchName);
			setBranchDrafts((current) =>
				Object.fromEntries(
					Object.entries(current).filter(([key]) => key !== String(index))
				) as Record<number, string>
			);
			setBranchComposerIndex((current) => (current === index ? null : current));
			void refetch();
		} catch {
			// Error is surfaced by the mutation toast.
		}
	};

	const formatDate = (dateStr: string) => {
		try {
			const date = new Date(dateStr);
			return date.toLocaleString();
		} catch {
			return dateStr;
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Archive className="h-5 w-5" />
						Stash Management
						<span className="text-sm font-normal text-muted-foreground">
							{stashes.length} stash{stashes.length !== 1 ? 'es' : ''}
						</span>
					</DialogTitle>
				</DialogHeader>

				{/* Create new stash */}
				<div className="flex items-center gap-2 py-2 border-b">
					<Input
						placeholder="Stash message (optional)"
						value={newStashMessage}
						onChange={(e) => { setNewStashMessage(e.target.value); }}
						className="flex-1"
					/>
					<Button
						size="sm"
						onClick={handleCreateStash}
						disabled={createMutation.isPending}
					>
						{createMutation.isPending ? (
							<Loader2 className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<Plus className="h-4 w-4 mr-1" />
						)}
						Stash
					</Button>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : stashes.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No stashes</p>
							<p className="text-xs mt-1">
								Stash your changes to save them temporarily.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{stashes.map((stash, idx) => (
								<div key={stash.index} className="border rounded-lg overflow-hidden">
									<div className="p-3 hover:bg-accent/30">
										<div className="flex items-start gap-3">
											<div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 shrink-0 text-sm font-medium">
												{stash.index}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<span className="font-medium text-sm">
														{stash.message || `stash@{${String(stash.index)}}`}
													</span>
													{stash.branch && (
														<span className="text-xs px-1.5 py-0.5 rounded bg-muted flex items-center gap-1">
															<GitBranch className="h-3 w-3" />
															{stash.branch}
														</span>
													)}
												</div>
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<span className="font-mono">{stash.hash.slice(0, 7)}</span>
													<span>•</span>
													<span>{formatDate(stash.date)}</span>
												</div>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => { setViewingStash(viewingStash === idx ? null : idx); }}
												>
													<Eye className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setBranchComposerIndex((current) =>
															current === stash.index ? null : stash.index
														);
														setBranchDrafts((current) => ({
															...current,
															[stash.index]: current[stash.index] ?? stash.branch,
														}));
													}}
													aria-label={`Create branch from stash ${String(stash.index)}`}
													title="Create branch from stash"
												>
													<GitBranch className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => { handleApplyStash(stash.index, true); }}
													disabled={applyMutation.isPending}
													title="Apply (keep in list)"
												>
													<Download className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => { handleApplyStash(stash.index, false); }}
													disabled={popMutation.isPending}
													title="Pop (remove from list)"
												>
													<Check className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-red-600"
													onClick={() => { handleDropStash(stash.index); }}
													disabled={dropMutation.isPending}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>

										{branchComposerIndex === stash.index && (
											<div className="mt-3 border-t pt-3">
												<div className="flex flex-col gap-2 sm:flex-row">
													<Input
														value={branchDrafts[stash.index] ?? ''}
														onChange={(e) => {
															const value = e.target.value;
															setBranchDrafts((current) => ({
																...current,
																[stash.index]: value,
															}));
														}}
														placeholder="feature/recover-stashed-work"
														className="flex-1"
														onKeyDown={(e) => {
															if (e.key === 'Enter') {
																void handleCreateBranchFromStash(stash.index);
															}
														}}
													/>
													<Button
														size="sm"
														onClick={() => { void handleCreateBranchFromStash(stash.index); }}
														disabled={gitOps.isLoading || !(branchDrafts[stash.index] ?? '').trim()}
													>
														<GitBranch className="mr-1 h-4 w-4" />
														Create Branch
													</Button>
												</div>
												<p className="mt-2 text-xs text-muted-foreground">
													This checks out a new branch, applies the stash, and removes it when successful.
												</p>
											</div>
										)}

										{/* Files in stash */}
										{viewingStash === idx && stash.files.length > 0 && (
											<div className="mt-3 pt-3 border-t">
												<p className="text-xs text-muted-foreground mb-2">
													{stash.files.length} file{stash.files.length !== 1 ? 's' : ''} changed
												</p>
												<div className="space-y-1 max-h-40 overflow-y-auto">
													{stash.files.map((file, fileIdx) => (
														<div
															key={fileIdx}
															className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/50"
														>
															<span className="truncate">{file.path}</span>
															<div className="flex items-center gap-2 text-muted-foreground">
																{file.additions > 0 && (
																	<span className="text-green-600">+{file.additions}</span>
																)}
																{file.deletions > 0 && (
																	<span className="text-red-600">-{file.deletions}</span>
																)}
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
					<AlertCircle className="h-3 w-3" />
					<span>
						Apply keeps the stash in the list. Pop applies and removes it.
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default StashManagement;

/**
 * LFS Support
 * Manage Git LFS tracking and files
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Package,
	Plus,
	Trash2,
	RefreshCw,
	Loader2,
	HardDrive,
	AlertCircle,
	Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface LFSSupportProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function LFSSupport({ open, onOpenChange }: LFSSupportProps) {
	const { activeRepo } = useAppStore();
	const [newPattern, setNewPattern] = useState('');

	// LFS status query
	const { data: lfsStatus, isLoading, refetch } = trpc.git.lfs.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Track pattern mutation
	const trackMutation = trpc.git.lfs.track.useMutation({
		onSuccess: () => {
			toast.success('LFS tracking pattern added');
			setNewPattern('');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to add tracking pattern', { description: error.message });
		},
	});

	// Untrack pattern mutation
	const untrackMutation = trpc.git.lfs.untrack.useMutation({
		onSuccess: () => {
			toast.success('LFS tracking pattern removed');
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to remove tracking pattern', { description: error.message });
		},
	});

	// Pull LFS mutation
	const pullMutation = trpc.git.lfs.pull.useMutation({
		onSuccess: () => {
			toast.success('LFS files pulled successfully');
		},
		onError: (error) => {
			toast.error('Failed to pull LFS files', { description: error.message });
		},
	});

	// Push LFS mutation
	const pushMutation = trpc.git.lfs.push.useMutation({
		onSuccess: () => {
			toast.success('LFS files pushed successfully');
		},
		onError: (error) => {
			toast.error('Failed to push LFS files', { description: error.message });
		},
	});

	// Prune LFS mutation
	const pruneMutation = trpc.git.lfs.prune.useMutation({
		onSuccess: () => {
			toast.success('LFS objects pruned successfully');
		},
		onError: (error) => {
			toast.error('Failed to prune LFS objects', { description: error.message });
		},
	});

	const handleAddPattern = () => {
		if (!newPattern) return;
		trackMutation.mutate({ repo: activeRepo ?? '', pattern: newPattern });
	};

	const handleRemovePattern = (pattern: string) => {
		untrackMutation.mutate({ repo: activeRepo ?? '', pattern });
	};

	const isInstalled = lfsStatus?.installed ?? false;
	const trackingPatterns = lfsStatus?.trackingPatterns ?? lfsStatus?.tracking ?? [];
	const trackedFiles = lfsStatus?.trackedFiles ?? [];
	const summary = lfsStatus?.summary;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Package className="h-5 w-5" />
						Git LFS
						{isInstalled && (
							<span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-normal">
								Installed
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : !isInstalled ? (
					<div className="text-center py-8">
						<AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
						<h3 className="font-medium mb-2">Git LFS Not Installed</h3>
						<p className="text-sm text-muted-foreground mb-4">
							Install Git LFS to manage large files in your repository.
						</p>
						<a
							href="https://git-lfs.github.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-blue-600 hover:underline"
						>
							Learn how to install Git LFS
						</a>
					</div>
				) : (
						<>
							{/* LFS Actions */}
							<div className="flex items-center gap-2 pb-4 border-b">
							<Button
								variant="outline"
								size="sm"
								onClick={() => pullMutation.mutate({ repo: activeRepo ?? '' })}
								disabled={pullMutation.isPending}
							>
								{pullMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Package className="h-4 w-4 mr-1" />
								)}
								Pull LFS
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => pushMutation.mutate({ repo: activeRepo ?? '' })}
								disabled={pushMutation.isPending}
							>
								{pushMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Package className="h-4 w-4 mr-1" />
								)}
								Push LFS
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => pruneMutation.mutate({ repo: activeRepo ?? '' })}
								disabled={pruneMutation.isPending}
							>
								{pruneMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Trash2 className="h-4 w-4 mr-1" />
								)}
								Prune
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => refetch()}
							>
								<RefreshCw className="h-4 w-4" />
								</Button>
							</div>

							{/* LFS Summary */}
							<div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
								<div className="rounded-md border bg-muted/30 p-2">
									<p className="text-[11px] text-muted-foreground">Patterns</p>
									<p className="text-sm font-semibold">{summary?.trackedPatternCount ?? trackingPatterns.length}</p>
								</div>
								<div className="rounded-md border bg-muted/30 p-2">
									<p className="text-[11px] text-muted-foreground">Tracked files</p>
									<p className="text-sm font-semibold">{summary?.trackedFileCount ?? trackedFiles.length}</p>
								</div>
								<div className="rounded-md border bg-muted/30 p-2">
									<p className="text-[11px] text-muted-foreground">Known size</p>
									<p className="text-sm font-semibold">{summary?.totalSizeLabel ?? 'N/A'}</p>
								</div>
								<div className="rounded-md border bg-muted/30 p-2">
									<p className="text-[11px] text-muted-foreground">Unknown size files</p>
									<p className="text-sm font-semibold">{summary?.unknownSizeFileCount ?? 0}</p>
								</div>
							</div>

							{/* Add tracking pattern */}
							<div className="flex items-center gap-2 py-3">
							<Input
								placeholder="Add tracking pattern (e.g., *.psd)"
								value={newPattern}
								onChange={(e) => setNewPattern(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
								className="flex-1"
							/>
							<Button
								size="sm"
								onClick={handleAddPattern}
								disabled={!newPattern || trackMutation.isPending}
							>
								{trackMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Plus className="h-4 w-4" />
								)}
							</Button>
						</div>

						{/* Tracking patterns */}
							<ScrollArea className="flex-1">
								<h4 className="text-sm font-medium mb-3">Tracking Patterns</h4>
							{trackingPatterns.length === 0 ? (
								<div className="text-center py-4 text-muted-foreground text-sm">
									No LFS tracking patterns configured
								</div>
							) : (
								<div className="space-y-2">
									{trackingPatterns.map((pattern, index) => (
										<div
											key={`${pattern}-${index}`}
											className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
										>
											<code className="text-sm font-mono">{pattern}</code>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-red-600"
												onClick={() => handleRemovePattern(pattern)}
												disabled={untrackMutation.isPending}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
								)}

								<h4 className="text-sm font-medium mt-6 mb-3">Tracked LFS Files</h4>
								{trackedFiles.length === 0 ? (
									<div className="text-center py-4 text-muted-foreground text-sm">
										No tracked LFS files yet
									</div>
								) : (
									<div className="space-y-2">
										{trackedFiles.map((file) => (
											<div
												key={`${file.path}-${file.oid}`}
												className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2 py-1.5"
											>
												<div className="min-w-0">
													<p className="truncate text-xs font-mono">{file.path}</p>
													<p className="text-[11px] text-muted-foreground">
														{file.sizeLabel ? file.sizeLabel : 'size unknown'}
													</p>
												</div>
												<HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
											</div>
										))}
									</div>
								)}

								{/* Common patterns */}
								<h4 className="text-sm font-medium mt-6 mb-3">Common Patterns</h4>
							<div className="grid grid-cols-2 gap-2">
								{[
									'*.psd',
									'*.ai',
									'*.zip',
									'*.mp4',
									'*.mov',
									'*.exe',
									'*.dll',
									'*.bin',
								].map((pattern) => (
									<Button
										key={pattern}
										variant="outline"
										size="sm"
										className="justify-start font-mono"
										onClick={() => {
											setNewPattern(pattern);
											trackMutation.mutate({ repo: activeRepo ?? '', pattern });
										}}
										disabled={trackMutation.isPending}
									>
										<Plus className="h-3 w-3 mr-2" />
										{pattern}
									</Button>
								))}
							</div>
						</ScrollArea>

							<div className="text-xs text-muted-foreground pt-2 border-t">
								<div className="flex items-center gap-1">
									<Check className="h-3.5 w-3.5 text-emerald-600" />
									<span>LFS stores large files outside the Git repository for faster clones and fetches.</span>
								</div>
							</div>
						</>
					)}
			</DialogContent>
		</Dialog>
	);
}

export default LFSSupport;

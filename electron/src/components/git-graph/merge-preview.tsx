/**
 * Merge Preview
 * Preview merge before executing
 */

	import {
			GitMerge,
			GitBranch,
			AlertTriangle,
			Check,
			X,
			Loader2,
			ArrowRight,
			FileCode,
			FileText,
			Image,
			ChevronDown,
			ChevronRight,
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
	DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpcClient } from '@/lib/trpcClient';
import { trpc } from '@/trpc/client';


interface MergePreviewProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceBranch?: string;
	targetBranch?: string;
}

interface MergePreviewData {
	canMerge: boolean;
	conflicts: string[];
	aheadCommits: Array<{ hash: string; message: string; author: string; date: string }>;
	files: Array<{ 
		path: string; 
		status: 'added' | 'modified' | 'deleted' | 'renamed';
		additions: number;
		deletions: number;
	}>;
	warnings: string[];
}

export function MergePreview({
	open,
	onOpenChange,
	sourceBranch,
	targetBranch,
}: MergePreviewProps) {
	const { activeRepo } = useAppStore();
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [isMerging, setIsMerging] = useState(false);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(['commits', 'files', 'conflicts'])
	);

	// Get branches
	const { data: repoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: false,
			showStashes: false,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo && open }
	);

	// Local state for branch selection
	const [localSource, setLocalSource] = useState(sourceBranch || '');
	const [localTarget, setLocalTarget] = useState(targetBranch || 'main');

	// Fetch merge preview
	const { data: previewData, isLoading } = trpc.git.mergePreview.useQuery(
		{ 
			repo: activeRepo ?? '', 
			source: localSource, 
			target: localTarget 
		},
		{ enabled: !!activeRepo && !!localSource && !!localTarget && open }
	);

	const preview = previewData as MergePreviewData | undefined;
	const branches = repoInfo?.branches ?? [];

	const toggleSection = (section: string) => {
		setExpandedSections(prev => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	const handleMerge = async () => {
		if (!activeRepo || !localSource || !localTarget) return;

			setIsMerging(true);
			try {
				await trpcClient.git.checkout.mutate({
					repo: activeRepo,
					ref: localTarget,
				});
				await trpcClient.git.merge.mutate({
					repo: activeRepo,
					branch: localSource,
				});
				toast.success(`Merged ${localSource} into ${localTarget}`);
				onOpenChange(false);
		} catch (error) {
			toast.error('Merge failed', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setIsMerging(false);
		}
	};

	const getFileIcon = (path: string) => {
		const ext = path.split('.').pop()?.toLowerCase();
		if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext ?? '')) {
			return <Image className="h-4 w-4 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]" />;
		}
		if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs'].includes(ext ?? '')) {
			return <FileCode className="h-4 w-4 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]" />;
		}
		return <FileText className="h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]" />;
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'added':
				return <Badge className="bg-[color-mix(in_oklch,var(--success)_15%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--success)_30%,transparent)] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">A</Badge>;
			case 'deleted':
				return <Badge className="bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] text-destructive dark:bg-[color-mix(in_oklch,var(--destructive)_30%,transparent)] dark:text-destructive">D</Badge>;
			case 'renamed':
				return <Badge className="bg-[color-mix(in_oklch,var(--info)_15%,transparent)] text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--info)_30%,transparent)] dark:text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]">R</Badge>;
			default:
				return <Badge className="bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">M</Badge>;
		}
	};

	const totalAdditions = preview?.files.reduce((sum, f) => sum + (f.additions || 0), 0) || 0;
	const totalDeletions = preview?.files.reduce((sum, f) => sum + (f.deletions || 0), 0) || 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitMerge className="h-5 w-5" />
						Merge Preview
					</DialogTitle>
				</DialogHeader>

				{/* Branch Selection */}
				<div className="flex items-center gap-4 py-4 border-b">
					<div className="flex-1">
						<label className="text-xs text-muted-foreground mb-1 block">Source Branch</label>
						<select
							className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
							value={localSource}
							onChange={(e) => { setLocalSource(e.target.value); }}
						>
							<option value="">Select branch to merge...</option>
									{branches.filter((branch) => branch !== localTarget).map((branch) => (
				<option key={branch} value={branch}>{branch}</option>
			))}
						</select>
					</div>
					<ArrowRight className="h-4 w-4 text-muted-foreground mt-4" />
					<div className="flex-1">
						<label className="text-xs text-muted-foreground mb-1 block">Target Branch</label>
						<select
							className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
							value={localTarget}
							onChange={(e) => { setLocalTarget(e.target.value); }}
						>
				{branches.map((branch) => (
					<option key={branch} value={branch}>{branch}</option>
				))}
						</select>
					</div>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : !localSource || !localTarget ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitMerge className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>Select source and target branches</p>
						</div>
					) : (
						<div className="space-y-4 p-4">
							{/* Warnings */}
							{preview?.warnings && preview.warnings.length > 0 && (
								<div className="bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)] rounded-lg p-3">
									<div className="flex items-center gap-2 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] text-sm font-medium mb-2">
										<AlertTriangle className="h-4 w-4" />
										Warnings
									</div>
									<ul className="text-sm text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] space-y-1">
										{preview.warnings.map((warning, i) => (
											<li key={i}>• {warning}</li>
										))}
									</ul>
								</div>
							)}

							{/* Conflicts */}
							{preview?.conflicts && preview.conflicts.length > 0 && (
								<div className="bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--destructive)_30%,transparent)] rounded-lg p-3">
									<button
										className="flex items-center gap-2 text-destructive dark:text-destructive text-sm font-medium w-full"
										onClick={() => { toggleSection('conflicts'); }}
									>
										{expandedSections.has('conflicts') ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
										<AlertTriangle className="h-4 w-4" />
										Conflicts ({preview.conflicts.length})
									</button>
									{expandedSections.has('conflicts') && (
										<ul className="mt-2 text-sm text-destructive dark:text-destructive space-y-1 ml-6">
											{preview.conflicts.map((conflict, i) => (
												<li key={i} className="flex items-center gap-2">
													<X className="h-3 w-3" />
													{conflict}
												</li>
											))}
										</ul>
									)}
								</div>
							)}

							{/* Commits to be merged */}
							{preview?.aheadCommits && preview.aheadCommits.length > 0 && (
								<div className="border rounded-lg overflow-hidden">
									<button
										className="flex items-center gap-2 px-4 py-2 bg-muted/50 w-full text-left"
										onClick={() => { toggleSection('commits'); }}
									>
										{expandedSections.has('commits') ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
										<GitBranch className="h-4 w-4" />
										<span className="font-medium">
											Commits to Merge ({preview.aheadCommits.length})
										</span>
									</button>
									{expandedSections.has('commits') && (
										<div className="divide-y">
						{preview.aheadCommits.map((commit) => (
												<div key={commit.hash} className="flex items-center gap-3 px-4 py-2">
													<code className="text-xs font-mono text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]">
														{commit.hash.substring(0, 7)}
													</code>
													<span className="flex-1 text-sm truncate">
														{commit.message}
													</span>
													<span className="text-xs text-muted-foreground">
														{commit.author}
													</span>
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{/* Files Changed */}
							{preview?.files && preview.files.length > 0 && (
								<div className="border rounded-lg overflow-hidden">
									<button
										className="flex items-center gap-2 px-4 py-2 bg-muted/50 w-full text-left"
										onClick={() => { toggleSection('files'); }}
									>
										{expandedSections.has('files') ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
										<FileText className="h-4 w-4" />
										<span className="font-medium">
											Files Changed ({preview.files.length})
										</span>
										<span className="ml-auto text-xs text-muted-foreground">
											<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">+{totalAdditions}</span>
											{' / '}
											<span className="text-destructive">-{totalDeletions}</span>
										</span>
									</button>
									{expandedSections.has('files') && (
										<div className="divide-y max-h-64 overflow-y-auto">
						{preview.files.map((file) => (
													<div
														key={file.path}
													className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent/50 ${
														selectedFile === file.path ? 'bg-accent' : ''
													}`}
													onClick={() => { setSelectedFile(file.path); }}
												>
													{getFileIcon(file.path)}
													<span className="flex-1 text-sm truncate">{file.path}</span>
													{getStatusBadge(file.status)}
													{(file.additions > 0 || file.deletions > 0) && (
														<div className="flex items-center gap-2 text-xs">
															{file.additions > 0 && (
																<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">+{file.additions}</span>
															)}
															{file.deletions > 0 && (
																<span className="text-destructive">-{file.deletions}</span>
															)}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{/* No changes */}
							{preview && preview.aheadCommits.length === 0 && preview.files.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									<Check className="h-12 w-12 mx-auto mb-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
									<p>Branches are up to date</p>
									<p className="text-sm">Nothing to merge</p>
								</div>
							)}
						</div>
					)}
				</ScrollArea>

				<DialogFooter className="flex items-center justify-between border-t pt-4">
					<div className="text-sm text-muted-foreground">
						{preview?.conflicts && preview.conflicts.length > 0 ? (
							<span className="text-destructive flex items-center gap-1">
								<AlertTriangle className="h-4 w-4" />
								Merge will have conflicts
							</span>
						) : preview?.aheadCommits && preview.aheadCommits.length > 0 ? (
							<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] flex items-center gap-1">
								<Check className="h-4 w-4" />
								Ready to merge {preview.aheadCommits.length} commits
							</span>
						) : (
							<span>No commits to merge</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => { onOpenChange(false); }}>
							Cancel
						</Button>
						<Button
							onClick={() => { void handleMerge(); }}
							disabled={
								isMerging || 
								!preview?.canMerge || 
								!preview.aheadCommits.length
							}
						>
							{isMerging ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<GitMerge className="h-4 w-4 mr-2" />
							)}
							Merge
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default MergePreview;

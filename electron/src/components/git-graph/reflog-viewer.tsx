/**
 * Reflog Viewer
 * View and recover from reflog entries
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	History,
	RotateCcw,
	GitBranch,
	Trash2,
	Copy,
	Check,
	ArrowRight,
	Loader2,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';
import { toast } from 'sonner';

interface ReflogEntry {
	hash: string;
	head: string;
	operation: string;
	ref: string;
	message: string;
	date: number;
}

interface ReflogViewerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ReflogViewer({ open, onOpenChange }: ReflogViewerProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [copiedHash, setCopiedHash] = useState<string | null>(null);

	const { data: reflogData, isLoading, refetch } = trpc.git.reflog.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const entries: ReflogEntry[] = reflogData?.entries ?? [];

	const handleCopyHash = (hash: string) => {
		navigator.clipboard.writeText(hash);
		setCopiedHash(hash);
		setTimeout(() => setCopiedHash(null), 2000);
	};

	const handleResetTo = (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
		gitOps.reset(hash, mode);
		onOpenChange(false);
	};

	const handleCreateBranch = (hash: string) => {
		// This would open the create branch dialog with the hash as target
		console.log('Create branch at:', hash);
	};

	const getOperationIcon = (operation: string) => {
		switch (operation.toLowerCase()) {
			case 'commit':
				return <Check className="h-3 w-3 text-green-600" />;
			case 'reset':
				return <RotateCcw className="h-3 w-3 text-amber-600" />;
			case 'checkout':
				return <GitBranch className="h-3 w-3 text-blue-600" />;
			case 'rebase':
				return <History className="h-3 w-3 text-purple-600" />;
			case 'merge':
				return <GitBranch className="h-3 w-3 text-cyan-600" />;
			case 'branch':
				return <GitBranch className="h-3 w-3 text-indigo-600" />;
			case 'cherry-pick':
				return <ArrowRight className="h-3 w-3 text-pink-600" />;
			case 'pull':
			case 'clone':
				return <History className="h-3 w-3 text-teal-600" />;
			default:
				return <History className="h-3 w-3 text-muted-foreground" />;
		}
	};

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
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
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="h-5 w-5" />
						Reflog
						<span className="text-sm font-normal text-muted-foreground">
							Recent HEAD movements
						</span>
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<span className="text-sm text-muted-foreground">
						{entries.length} entries
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetch()}
					>
						<RotateCcw className="h-4 w-4 mr-1" />
						Refresh
					</Button>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : entries.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<History className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No reflog entries found</p>
						</div>
					) : (
						<div className="divide-y">
							{entries.map((entry, index) => (
								<div
									key={`${entry.hash}-${index}`}
									className="p-3 hover:bg-accent/50 group"
								>
									<div className="flex items-start gap-3">
										<div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
											{getOperationIcon(entry.operation)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
													{entry.hash.slice(0, 7)}
												</code>
												<span className="text-xs px-1.5 py-0.5 rounded bg-muted/50">
													{entry.operation}
												</span>
												{entry.ref && (
													<span className="text-xs text-muted-foreground">
														{entry.ref}
													</span>
												)}
												<span className="text-xs text-muted-foreground ml-auto">
													{formatDate(entry.date)}
												</span>
											</div>
											<p className="text-sm truncate" title={entry.message}>
												{entry.message || entry.head}
											</p>
										</div>
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0"
												onClick={() => handleCopyHash(entry.hash)}
											>
												{copiedHash === entry.hash ? (
													<Check className="h-3 w-3 text-green-600" />
												) : (
													<Copy className="h-3 w-3" />
												)}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs"
												onClick={() => handleCreateBranch(entry.hash)}
											>
												<GitBranch className="h-3 w-3 mr-1" />
												Branch
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs text-amber-600"
												onClick={() => handleResetTo(entry.hash, 'mixed')}
											>
												<RotateCcw className="h-3 w-3 mr-1" />
												Reset
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
					<p>
						Reflog tracks all HEAD movements. Use it to recover lost commits.
					</p>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

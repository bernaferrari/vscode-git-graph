/**
 * Reflog Viewer
 * View and recover from reflog entries
 */

import {
	History,
	RotateCcw,
	GitBranch,
	Copy,
	Check,
	ArrowRight,
	Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface ReflogEntry {
	hash: string;
	ref?: string;
	action?: string;
	message?: string;
	date?: string;
}

interface ReflogViewerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateBranchFromHash?: (hash: string) => void;
}

export function ReflogViewer({ open, onOpenChange, onCreateBranchFromHash }: ReflogViewerProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [copiedHash, setCopiedHash] = useState<string | null>(null);

	const { data: reflogData, isLoading, refetch } = trpc.git.reflog.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const entries: ReflogEntry[] = (reflogData?.entries ?? [])
		.filter((entry) => typeof entry.hash === 'string' && entry.hash.length > 0)
		.map((entry) => ({
			hash: entry.hash as string,
			...(entry.ref ? { ref: entry.ref } : {}),
			...(entry.action ? { action: entry.action } : {}),
			...(entry.message ? { message: entry.message } : {}),
			...(entry.date ? { date: entry.date } : {}),
		}));

	const handleCopyHash = (hash: string) => {
		void navigator.clipboard.writeText(hash);
		setCopiedHash(hash);
		setTimeout(() => { setCopiedHash(null); }, 2000);
	};

	const handleResetTo = (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
		void gitOps.reset(hash, mode);
		onOpenChange(false);
	};

	const handleCreateBranch = (hash: string) => {
		onCreateBranchFromHash?.(hash);
	};

	const getOperationIcon = (operation: string) => {
		switch (operation.toLowerCase()) {
			case 'commit':
				return <Check className="h-3 w-3 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />;
			case 'reset':
				return <RotateCcw className="h-3 w-3 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]" />;
			case 'checkout':
				return <GitBranch className="h-3 w-3 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]" />;
			case 'rebase':
				return <History className="h-3 w-3 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]" />;
			case 'merge':
				return <GitBranch className="h-3 w-3 text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))]" />;
			case 'branch':
				return <GitBranch className="h-3 w-3 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]" />;
			case 'cherry-pick':
				return <ArrowRight className="h-3 w-3 text-[color-mix(in_oklch,var(--chart-4)_75%,var(--foreground))]" />;
			case 'pull':
			case 'clone':
				return <History className="h-3 w-3 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />;
			default:
				return <History className="h-3 w-3 text-muted-foreground" />;
		}
	};

	const formatDate = (timestamp: number) => {
		if (!Number.isFinite(timestamp)) {
			return 'Unknown';
		}
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${String(diffMins)}m ago`;
		if (diffHours < 24) return `${String(diffHours)}h ago`;
		if (diffDays < 7) return `${String(diffDays)}d ago`;
		return date.toLocaleDateString();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col ui-surface">
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
						onClick={() => { void refetch(); }}
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
									key={`${entry.hash}-${String(index)}`}
									className="p-3 hover:bg-accent/50 group"
								>
									<div className="flex items-start gap-3">
										<div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
													{getOperationIcon(entry.action ?? '')}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
													{entry.hash.slice(0, 7)}
												</code>
												<span className="text-xs px-1.5 py-0.5 rounded bg-muted/50">
														{entry.action ?? 'unknown'}
												</span>
												{entry.ref && (
													<span className="text-xs text-muted-foreground">
														{entry.ref}
													</span>
												)}
												<span className="text-xs text-muted-foreground ml-auto">
														{formatDate(Date.parse(entry.date ?? ''))}
												</span>
											</div>
											<p className="text-sm truncate" title={entry.message}>
													{entry.message ?? ''}
											</p>
										</div>
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0"
												onClick={() => { handleCopyHash(entry.hash); }}
											>
												{copiedHash === entry.hash ? (
													<Check className="h-3 w-3 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
												) : (
													<Copy className="h-3 w-3" />
												)}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs"
												onClick={() => { handleCreateBranch(entry.hash); }}
											>
												<GitBranch className="h-3 w-3 mr-1" />
												Branch
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]"
												onClick={() => { handleResetTo(entry.hash, 'mixed'); }}
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
					<Button variant="outline" size="sm" onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

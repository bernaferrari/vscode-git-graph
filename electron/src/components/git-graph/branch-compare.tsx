/**
 * Branch Compare Modal
 * Compare two branches and show diff
 */

import {
	GitBranch,
	ArrowRight,
	Plus,
	Minus,
	FileText,
} from 'lucide-react';
import { useState } from 'react';

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface BranchCompareProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	branches: string[];
	initialFrom?: string;
	initialTo?: string;
}

export function BranchCompare({
	open,
	onOpenChange,
	branches,
	initialFrom,
	initialTo,
}: BranchCompareProps) {
	const { activeRepo } = useAppStore();
	const [fromBranch, setFromBranch] = useState(initialFrom ?? '');
	const [toBranch, setToBranch] = useState(initialTo ?? '');

	const { data: compareData, isLoading } = trpc.git.compareBranches.useQuery(
		{
			repo: activeRepo ?? '',
			from: fromBranch,
			to: toBranch,
		},
		{ enabled: !!activeRepo && !!fromBranch && !!toBranch && open }
	);

	const commits = (compareData?.commits ?? []) as Array<{ hash: string; message: string }>;
	const files = (compareData?.files ?? []) as Array<{ status: string; path: string }>;
	const additions = compareData?.additions ?? 0;
	const deletions = compareData?.deletions ?? 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[80vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle>Compare Branches</DialogTitle>
				</DialogHeader>

				{/* Branch selectors */}
				<div className="flex items-center gap-4 py-2">
					<Select value={fromBranch} onValueChange={(v) => { if (v) setFromBranch(v); }}>
						<SelectTrigger className="w-[200px]">
							<SelectValue placeholder="Select base branch" />
						</SelectTrigger>
						<SelectContent>
							{branches.map((branch) => (
								<SelectItem key={branch} value={branch}>
									{branch}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<ArrowRight className="h-4 w-4 text-muted-foreground" />

					<Select value={toBranch} onValueChange={(v) => { if (v) setToBranch(v); }}>
						<SelectTrigger className="w-[200px]">
							<SelectValue placeholder="Select compare branch" />
						</SelectTrigger>
						<SelectContent>
							{branches.map((branch) => (
								<SelectItem key={branch} value={branch}>
									{branch}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Stats */}
				{fromBranch && toBranch && !isLoading && (
					<div className="flex items-center gap-4 py-2 text-sm border-b">
						<span className="font-medium">{commits.length} commits</span>
						<span className="text-muted-foreground">•</span>
						<span>{files.length} files changed</span>
						<span className="text-muted-foreground">•</span>
						<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">+{additions}</span>
						<span className="text-destructive">-{deletions}</span>
					</div>
				)}

				<ScrollArea className="flex-1">
					{!fromBranch || !toBranch ? (
						<div className="text-center py-8 text-muted-foreground text-sm">
							Select two branches to compare
						</div>
					) : isLoading ? (
						<div className="text-center py-8 text-muted-foreground text-sm">
							Loading...
						</div>
					) : (
						<div className="space-y-4">
							{/* Commits */}
							{commits.length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
										<GitBranch className="h-4 w-4" />
										Commits ({commits.length})
									</h4>
									<div className="space-y-1">
										{commits.map((commit: { hash: string; message: string }) => (
											<div
												key={commit.hash}
												className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/50 text-sm"
											>
												<span className="font-mono text-xs text-muted-foreground">
													{commit.hash.slice(0, 7)}
												</span>
												<span className="truncate">{commit.message}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Files */}
							{files.length > 0 && (
								<div>
									<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
										<FileText className="h-4 w-4" />
										Changed Files ({files.length})
									</h4>
									<div className="space-y-1">
										{files.map((file: { status: string; path: string }, i: number) => (
											<div
												key={i}
												className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/50 text-sm"
											>
												{file.status === 'A' && (
													<Plus className="h-3.5 w-3.5 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
												)}
												{file.status === 'D' && (
													<Minus className="h-3.5 w-3.5 text-destructive" />
												)}
												{file.status === 'M' && (
													<FileText className="h-3.5 w-3.5 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]" />
												)}
												<span className="truncate flex-1">{file.path}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{commits.length === 0 && files.length === 0 && (
								<div className="text-center py-8 text-muted-foreground text-sm">
									No differences found between branches
								</div>
							)}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

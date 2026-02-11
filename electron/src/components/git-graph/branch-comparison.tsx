/**
 * Branch Comparison View
 * Compare two branches side by side
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	GitBranch,
	ArrowRight,
	Plus,
	Minus,
	RefreshCw,
	Loader2,
	FileCode,
	FileText,
	Image,
} from 'lucide-react';

interface BranchComparisonProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialBase?: string;
	initialCompare?: string;
}

export function BranchComparison({ 
	open, 
	onOpenChange, 
	initialBase, 
	initialCompare 
}: BranchComparisonProps) {
	const { activeRepo } = useAppStore();
	const [baseBranch, setBaseBranch] = useState(initialBase || 'main');
	const [compareBranch, setCompareBranch] = useState(initialCompare || '');

	// Get branches
	const { data: branchData } = trpc.git.branches.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Compare branches
	const { data: compareData, isLoading, refetch } = trpc.git.compareBranches.useQuery(
		{ 
			repo: activeRepo ?? '', 
			base: baseBranch, 
			compare: compareBranch 
		},
		{ enabled: !!activeRepo && !!baseBranch && !!compareBranch }
	);

	const branches = branchData?.branches ?? [];
	const ahead = compareData?.ahead ?? [];
	const behind = compareData?.behind ?? [];
	const files = compareData?.files ?? [];

	const totalChanges = files.length;
	const additions = files.reduce((sum: number, f: any) => sum + (f.additions || 0), 0);
	const deletions = files.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0);

	const getFileIcon = (path: string) => {
		const ext = path.split('.').pop()?.toLowerCase();
		if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext ?? '')) {
			return <Image className="h-4 w-4 text-purple-500" />;
		}
		if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs'].includes(ext ?? '')) {
			return <FileCode className="h-4 w-4 text-blue-500" />;
		}
		return <FileText className="h-4 w-4 text-amber-500" />;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitBranch className="h-5 w-5" />
						Compare Branches
					</DialogTitle>
				</DialogHeader>

				{/* Branch selectors */}
				<div className="flex items-center gap-4 py-4">
					<div className="flex-1">
						<label className="text-xs text-muted-foreground mb-1 block">Base</label>
						<select
							className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
							value={baseBranch}
							onChange={(e) => setBaseBranch(e.target.value)}
						>
							<option value="">Select base branch...</option>
							{branches.map((b) => (
								<option key={b.name} value={b.name}>{b.name}</option>
							))}
						</select>
					</div>
					<ArrowRight className="h-4 w-4 text-muted-foreground mt-4" />
					<div className="flex-1">
						<label className="text-xs text-muted-foreground mb-1 block">Compare</label>
						<select
							className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
							value={compareBranch}
							onChange={(e) => setCompareBranch(e.target.value)}
						>
							<option value="">Select branch to compare...</option>
							{branches.filter(b => b.name !== baseBranch).map((b) => (
								<option key={b.name} value={b.name}>{b.name}</option>
							))}
						</select>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="mt-4"
						onClick={() => refetch()}
						disabled={!baseBranch || !compareBranch}
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>

				{/* Summary */}
				{compareBranch && baseBranch && (
					<div className="flex items-center gap-4 py-2 border-b text-sm">
						<Badge variant="outline">
							{ahead.length} ahead
						</Badge>
						<Badge variant="outline">
							{behind.length} behind
						</Badge>
						<span className="text-muted-foreground">•</span>
						<span>{totalChanges} files changed</span>
						<span className="text-green-600 flex items-center">
							<Plus className="h-3 w-3 mr-1" />
							{additions}
						</span>
						<span className="text-red-600 flex items-center">
							<Minus className="h-3 w-3 mr-1" />
							{deletions}
						</span>
					</div>
				)}

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : !baseBranch || !compareBranch ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>Select two branches to compare</p>
						</div>
					) : files.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No differences between branches</p>
						</div>
					) : (
						<div className="space-y-1">
							{files.map((file: any, index: number) => (
								<div
									key={index}
									className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent/50"
								>
									{getFileIcon(file.path)}
									<span className="flex-1 text-sm truncate">{file.path}</span>
									<span className={`text-xs font-mono ${
										file.status === 'added' ? 'text-green-600' :
										file.status === 'deleted' ? 'text-red-600' :
										'text-amber-600'
									}`}>
										{file.status?.toUpperCase() || 'M'}
									</span>
									{(file.additions > 0 || file.deletions > 0) && (
										<div className="flex items-center gap-2 text-xs">
											{file.additions > 0 && (
												<span className="text-green-600">+{file.additions}</span>
											)}
											{file.deletions > 0 && (
												<span className="text-red-600">-{file.deletions}</span>
											)}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex justify-end pt-4 border-t">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default BranchComparison;

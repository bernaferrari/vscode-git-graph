/**
 * Stacked Branches Panel
 * Visualize and manage branch stacks like GitButler/Graphite
 */

import { useStackedBranches, getStackOrder, type StackedBranch } from '@/lib/stackedBranches';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import {
	GitBranch,
	GitPullRequest,
	ArrowUp,
	ArrowDown,
	Plus,
	Trash2,
	RefreshCw,
	ExternalLink,
	Check,
	Clock,
	AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

const STATUS_CONFIG: Record<StackedBranch['status'], { icon: React.ElementType; color: string; label: string }> = {
	draft: { icon: Clock, color: 'text-yellow-500', label: 'Draft' },
	ready: { icon: Check, color: 'text-green-500', label: 'Ready' },
	merged: { icon: GitPullRequest, color: 'text-purple-500', label: 'Merged' },
	stale: { icon: AlertCircle, color: 'text-gray-500', label: 'Stale' },
};

interface StackedBranchesPanelProps {
	children?: React.ReactNode;
}

export function StackedBranchesPanel({ children }: StackedBranchesPanelProps) {
	const { activeRepo } = useAppStore();
	const { getStack, removeBranch, reorderBranch } = useStackedBranches();

	const stack = activeRepo ? getStack(activeRepo) : [];
	const sortedStack = getStackOrder(stack);

	if (!activeRepo) {
		return null;
	}

	return (
		<Sheet>
			<SheetTrigger asChild>
				{children || (
					<Button variant="ghost" size="sm" className="gap-1.5">
						<GitBranch className="h-4 w-4" />
						<span className="hidden sm:inline">Stack</span>
						{stack.length > 0 && (
							<Badge variant="secondary" className="h-5 px-1.5 text-xs">
								{stack.length}
							</Badge>
						)}
					</Button>
				)}
			</SheetTrigger>
			<SheetContent className="w-80 sm:w-96">
				<SheetHeader className="mb-4">
					<SheetTitle className="flex items-center gap-2">
						<GitBranch className="h-5 w-5" />
						Branch Stack
					</SheetTitle>
				</SheetHeader>

				<ScrollArea className="h-[calc(100vh-8rem)]">
					{sortedStack.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
							<p>No stacked branches</p>
							<p className="text-xs mt-1">
								Create dependent branches to build a stack
							</p>
							<Button variant="outline" size="sm" className="mt-4">
								<Plus className="h-4 w-4 mr-1" />
								Add to Stack
							</Button>
						</div>
					) : (
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground mb-3">
								{sortedStack.length} branch{sortedStack.length !== 1 ? 'es' : ''} in stack
							</p>
							{sortedStack.map((branch, index) => (
								<StackedBranchItem
									key={branch.id}
									branch={branch}
									index={index}
									isLast={index === sortedStack.length - 1}
									onMoveUp={() => {
										if (index > 0) {
											const above = sortedStack[index - 1];
											reorderBranch(activeRepo, branch.id, above.parentId);
										}
									}}
									onMoveDown={() => {
										if (index < sortedStack.length - 1) {
											const below = sortedStack[index + 1];
											reorderBranch(activeRepo, branch.id, below.id);
										}
									}}
									onRemove={() => removeBranch(activeRepo, branch.id)}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}

interface StackedBranchItemProps {
	branch: StackedBranch;
	index: number;
	isLast: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
}

function StackedBranchItem({
	branch,
	index,
	isLast,
	onMoveUp,
	onMoveDown,
	onRemove,
}: StackedBranchItemProps) {
	const StatusIcon = STATUS_CONFIG[branch.status].icon;
	const statusConfig = STATUS_CONFIG[branch.status];

	return (
		<div className="relative">
			{!isLast && (
				<div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
			)}
			<div
				className={cn(
					'flex items-start gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
					index === 0 && 'border-green-500/30'
				)}
			>
				<div className="mt-0.5">
					<GitBranch className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm truncate">{branch.name}</span>
						<Badge
							variant="secondary"
							className={cn('gap-1 text-xs', statusConfig.color)}
						>
							<StatusIcon className="h-3 w-3" />
							{statusConfig.label}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Based on: {branch.baseBranch}
					</p>
					{branch.prUrl && (
						<a
							href={branch.prUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
						>
							<GitPullRequest className="h-3 w-3" />
							View PR
							<ExternalLink className="h-2 w-2" />
						</a>
					)}
				</div>
				<div className="flex flex-col gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={onMoveUp}
						disabled={index === 0}
					>
						<ArrowUp className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={onMoveDown}
						disabled={isLast}
					>
						<ArrowDown className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 text-red-500"
						onClick={onRemove}
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</div>
	);
}

/**
 * Operation Timeline Panel
 * Shows recent Git operations with undo capability
 */

import { useOperationLog, formatOperationDescription, getOperationStatusColor, type OperationReceipt } from '@/lib/operationLog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import {
	History,
	RotateCcw,
	GitCommit,
	GitBranch,
	Tag,
	Archive,
	Upload,
	Download,
	Merge,
	AlertCircle,
	CheckCircle2,
	XCircle,
	Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const OPERATION_ICONS: Record<string, React.ElementType> = {
	commit: GitCommit,
	rebase: GitBranch,
	merge: Merge,
	'cherry-pick': GitCommit,
	revert: GitCommit,
	reset: RotateCcw,
	'branch-create': GitBranch,
	'branch-delete': GitBranch,
	'branch-rename': GitBranch,
	'tag-create': Tag,
	'tag-delete': Tag,
	stash: Archive,
	push: Upload,
	pull: Download,
	fetch: Download,
	'force-push': Upload,
	amend: GitCommit,
};

interface OperationTimelineProps {
	children?: React.ReactNode;
}

export function OperationTimeline({ children }: OperationTimelineProps) {
	const { operations, markAsUndone, clearOperations, getRecentOperations } = useOperationLog();
	const recentOps = getRecentOperations(20);

	return (
		<Sheet>
			<SheetTrigger asChild>
				{children || (
					<Button variant="ghost" size="sm" className="gap-1.5">
						<History className="h-4 w-4" />
						<span className="hidden sm:inline">History</span>
					</Button>
				)}
			</SheetTrigger>
			<SheetContent className="w-80 sm:w-96">
				<SheetHeader className="mb-4">
					<div className="flex items-center justify-between">
						<SheetTitle className="flex items-center gap-2">
							<History className="h-5 w-5" />
							Operation History
						</SheetTitle>
						{operations.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={clearOperations}
								className="text-muted-foreground"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
				</SheetHeader>

				<ScrollArea className="h-[calc(100vh-8rem)]">
					{recentOps.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<History className="h-12 w-12 mx-auto mb-3 opacity-30" />
							<p>No operations yet</p>
							<p className="text-xs mt-1">
								Your Git actions will appear here
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{recentOps.map((op) => (
								<OperationItem
									key={op.id}
									operation={op}
									onUndo={
										op.undoAction && op.status === 'success'
											? () => markAsUndone(op.id)
											: undefined
									}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}

interface OperationItemProps {
	operation: OperationReceipt;
	onUndo?: () => void;
}

function OperationItem({ operation, onUndo }: OperationItemProps) {
	const Icon = OPERATION_ICONS[operation.type] || GitCommit;
	const statusColor = getOperationStatusColor(operation.status);

	const StatusIcon =
		operation.status === 'success'
			? CheckCircle2
			: operation.status === 'failed'
			? XCircle
			: History;

	return (
		<div
			className={cn(
				'p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
				operation.status === 'undone' && 'opacity-60'
			)}
		>
			<div className="flex items-start gap-2">
				<Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						<span className={cn('font-medium text-sm', statusColor)}>
							{formatOperationDescription(operation)}
						</span>
						<StatusIcon
							className={cn(
								'h-3.5 w-3.5',
								operation.status === 'success' && 'text-green-500',
								operation.status === 'failed' && 'text-red-500',
								operation.status === 'undone' && 'text-muted-foreground'
							)}
						/>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						{formatDistanceToNow(operation.timestamp, { addSuffix: true })}
					</p>
					{operation.error && (
						<p className="text-xs text-red-500 mt-1 flex items-center gap-1">
							<AlertCircle className="h-3 w-3" />
							{operation.error}
						</p>
					)}
					{operation.affectedBranches.length > 0 && (
						<p className="text-xs text-muted-foreground mt-1">
							Affected: {operation.affectedBranches.join(', ')}
						</p>
					)}
				</div>
				{onUndo && operation.status === 'success' && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onUndo}
						className="h-7 px-2 shrink-0"
						title="Undo this operation"
					>
						<RotateCcw className="h-3.5 w-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}

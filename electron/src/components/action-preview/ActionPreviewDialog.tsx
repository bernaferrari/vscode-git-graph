/**
 * Action Preview Dialog
 * Shows what will happen before risky Git operations
 */

import {
	AlertTriangle,
	GitBranch,
	GitCommit,
	Upload,
	Merge,
	RotateCcw,
	ArrowRight,
	Info,
	Check,
	X,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ActionType = 
	| 'rebase'
	| 'merge'
	| 'push'
	| 'force-push'
	| 'reset'
	| 'cherry-pick'
	| 'revert'
	| 'squash';

export interface ActionPreview {
	type: ActionType;
	title: string;
	description: string;
	willChange: {
		commits?: number;
		branches?: string[];
		files?: number;
		remotes?: string[];
	};
	risks: string[];
	undoAvailable: boolean;
	gitCommands: string[];
}

interface ActionPreviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preview: ActionPreview | null;
	onConfirm: () => void;
	onCancel?: () => void;
	isLoading?: boolean;
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
	rebase: GitBranch,
	merge: Merge,
	push: Upload,
	'force-push': Upload,
	reset: RotateCcw,
	'cherry-pick': GitCommit,
	revert: GitCommit,
	squash: GitCommit,
};

const ACTION_COLORS: Record<ActionType, string> = {
	rebase: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
	merge: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
	push: 'text-green-500 border-green-500/30 bg-green-500/10',
	'force-push': 'text-red-500 border-red-500/30 bg-red-500/10',
	reset: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
	'cherry-pick': 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10',
	revert: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
	squash: 'text-pink-500 border-pink-500/30 bg-pink-500/10',
};

export function ActionPreviewDialog({
	open,
	onOpenChange,
	preview,
	onConfirm,
	onCancel,
	isLoading,
}: ActionPreviewDialogProps) {
	if (!preview) return null;

	const Icon = ACTION_ICONS[preview.type];
	const colorClass = ACTION_COLORS[preview.type];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Icon className={cn('h-5 w-5', colorClass.replace('bg-', 'text-').replace('/30', ''))} />
						{preview.title}
					</DialogTitle>
					<DialogDescription>{preview.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* What will change */}
					<div className="rounded-lg border p-4 space-y-3">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<ArrowRight className="h-4 w-4 text-muted-foreground" />
							What will happen
						</h4>
						<div className="grid grid-cols-2 gap-3">
							{preview.willChange.commits !== undefined && (
								<div className="flex items-center gap-2 text-sm">
									<GitCommit className="h-4 w-4 text-muted-foreground" />
									<span>{preview.willChange.commits} commit(s)</span>
								</div>
							)}
							{preview.willChange.branches && preview.willChange.branches.length > 0 && (
								<div className="flex items-center gap-2 text-sm">
									<GitBranch className="h-4 w-4 text-muted-foreground" />
									<span>{preview.willChange.branches.join(', ')}</span>
								</div>
							)}
							{preview.willChange.files !== undefined && (
								<div className="flex items-center gap-2 text-sm">
									<span className="text-green-500">+{preview.willChange.files}</span>
									<span className="text-muted-foreground">files</span>
								</div>
							)}
							{preview.willChange.remotes && preview.willChange.remotes.length > 0 && (
								<div className="flex items-center gap-2 text-sm">
									<Upload className="h-4 w-4 text-muted-foreground" />
									<span>{preview.willChange.remotes.join(', ')}</span>
								</div>
							)}
						</div>
					</div>

					{/* Risks */}
					{preview.risks.length > 0 && (
						<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
							<h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
								<AlertTriangle className="h-4 w-4" />
								Consider before proceeding
							</h4>
							<ul className="text-sm text-muted-foreground space-y-1">
								{preview.risks.map((risk, i) => (
									<li key={i} className="flex items-start gap-2">
										<X className="h-3 w-3 mt-1 text-amber-500 shrink-0" />
										<span>{risk}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Git commands that will run */}
					<div className="rounded-lg border p-4 space-y-2">
						<h4 className="text-sm font-medium flex items-center gap-2">
							<Info className="h-4 w-4 text-muted-foreground" />
							Git commands
						</h4>
						<div className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
							{preview.gitCommands.map((cmd, i) => (
								<div key={i} className="text-muted-foreground">
									$ {cmd}
								</div>
							))}
						</div>
					</div>

					{/* Undo available */}
					{preview.undoAvailable && (
						<div className="flex items-center gap-2 text-sm text-green-600">
							<Check className="h-4 w-4" />
							<span>This action can be undone</span>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onCancel || (() => { onOpenChange(false); })}>
						Cancel
					</Button>
					<Button 
						variant={preview.type === 'force-push' ? 'destructive' : 'default'}
						onClick={onConfirm}
						disabled={isLoading}
					>
						{isLoading ? 'Processing...' : 'Continue'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Hook for managing action previews
export function useActionPreview() {
	const [preview, setPreview] = useState<ActionPreview | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

	const showPreview = (preview: ActionPreview, action: () => void) => {
		setPreview(preview);
		setPendingAction(() => action);
		setIsOpen(true);
	};

	const handleConfirm = () => {
		if (pendingAction) {
			pendingAction();
		}
		setIsOpen(false);
		setPreview(null);
		setPendingAction(null);
	};

	const handleCancel = () => {
		setIsOpen(false);
		setPreview(null);
		setPendingAction(null);
	};

	return {
		preview,
		isOpen,
		showPreview,
		handleConfirm,
		handleCancel,
		Dialog: (
			<ActionPreviewDialog
				open={isOpen}
				onOpenChange={setIsOpen}
				preview={preview}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		),
	};
}

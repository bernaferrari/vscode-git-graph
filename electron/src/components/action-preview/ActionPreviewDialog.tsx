/**
 * Action Preview Dialog
 * Shows what will happen before risky Git operations
 */

import { AlertTriangle, ArrowRight, Check, GitBranch, GitCommit, Info, Merge, RotateCcw, Upload, X } from 'lucide-react';
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
	confirmLabel?: string;
	severity?: 'default' | 'warning' | 'destructive';
	safetyNote?: string;
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

const DEFAULT_CONFIRM_LABELS: Record<ActionType, string> = {
	rebase: 'Start Rebase',
	merge: 'Merge Branch',
	push: 'Push Changes',
	'force-push': 'Force Push',
	reset: 'Confirm Reset',
	'cherry-pick': 'Cherry-pick Commit',
	revert: 'Create Revert Commit',
	squash: 'Apply Squash Merge',
};

function getPreviewSeverity(preview: ActionPreview) {
	return preview.severity ?? (preview.type === 'force-push' ? 'destructive' : preview.type === 'reset' ? 'warning' : 'default');
}

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
	const severity = getPreviewSeverity(preview);
	const confirmLabel = preview.confirmLabel ?? DEFAULT_CONFIRM_LABELS[preview.type];
	const summaryItems = [
		preview.willChange.commits !== undefined
			? {
					label: 'Commits affected',
					value: String(preview.willChange.commits),
					icon: GitCommit,
			  }
			: null,
		preview.willChange.files !== undefined
			? {
					label: 'Files touched',
					value: String(preview.willChange.files),
					icon: ArrowRight,
			  }
			: null,
		preview.willChange.branches && preview.willChange.branches.length > 0
			? {
					label: preview.willChange.branches.length === 1 ? 'Branch' : 'Branches',
					value: preview.willChange.branches.join(' -> '),
					icon: GitBranch,
			  }
			: null,
		preview.willChange.remotes && preview.willChange.remotes.length > 0
			? {
					label: preview.willChange.remotes.length === 1 ? 'Remote' : 'Remotes',
					value: preview.willChange.remotes.join(', '),
					icon: Upload,
			  }
			: null,
	].filter((item): item is NonNullable<typeof item> => item !== null);
	const toneClass =
		severity === 'destructive'
			? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
			: severity === 'warning'
				? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
				: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Icon className={cn('h-5 w-5', colorClass.replace('bg-', 'text-').replace('/30', ''))} />
						{preview.title}
					</DialogTitle>
					<DialogDescription className="max-w-[58ch]">{preview.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className={cn('rounded-xl border p-4', toneClass)}>
						<div className="flex items-start gap-3">
							<div className={cn('rounded-lg border p-2', colorClass)}>
								<Icon className="h-4 w-4" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-semibold">Before you continue</p>
								<p className="text-sm leading-relaxed opacity-90">
									{preview.safetyNote ??
										(preview.undoAvailable
											? 'This action changes repository state, but recovery is available if the result is not what you expected.'
											: 'This action changes repository state and may be difficult to reverse after it runs.')}
								</p>
							</div>
						</div>
					</div>

					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<div className="rounded-xl border p-4">
							<h4 className="flex items-center gap-2 text-sm font-medium">
								<ArrowRight className="h-4 w-4 text-muted-foreground" />
								Impact summary
							</h4>
							<div className="mt-3 grid gap-3 sm:grid-cols-2">
								{summaryItems.map((item) => {
									const SummaryIcon = item.icon;
									return (
										<div key={item.label} className="rounded-lg border bg-background/60 p-3">
											<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
												<SummaryIcon className="h-3.5 w-3.5" />
												<span>{item.label}</span>
											</div>
											<p className="line-clamp-2 text-sm font-medium tabular-nums">{item.value}</p>
										</div>
									);
								})}
								{summaryItems.length === 0 && (
									<div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
										No structural changes to summarize before execution.
									</div>
								)}
							</div>
						</div>

						<div className="space-y-4">
							{preview.risks.length > 0 && (
								<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
									<h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-200">
										<AlertTriangle className="h-4 w-4" />
										Things to verify first
									</h4>
									<ul className="mt-3 space-y-2 text-sm text-amber-950 dark:text-amber-50">
										{preview.risks.map((risk, i) => (
											<li key={i} className="flex items-start gap-2">
												<X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
												<span>{risk}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							<div className="rounded-xl border p-4">
								<h4 className="flex items-center gap-2 text-sm font-medium">
									<Info className="h-4 w-4 text-muted-foreground" />
									Git commands
								</h4>
								<div className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
									{preview.gitCommands.map((cmd, i) => (
										<div key={i} className="text-muted-foreground">
											$ {cmd}
										</div>
									))}
								</div>
							</div>
						</div>
					</div>

					<div
						className={cn(
							'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
							preview.undoAvailable
								? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
								: 'border-border/70 bg-muted/30 text-muted-foreground'
						)}>
						{preview.undoAvailable ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
						<span>
							{preview.undoAvailable
								? 'Recovery path available after this action.'
								: 'No automatic recovery path is available once this action completes.'}
						</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onCancel || (() => { onOpenChange(false); })}>
						Cancel
					</Button>
					<Button 
						variant={severity === 'destructive' ? 'destructive' : 'default'}
						onClick={onConfirm}
						disabled={isLoading}
					>
						{isLoading ? 'Processing...' : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


// Hook for managing action previews
export function useActionPreview() { // eslint-disable-line react-refresh/only-export-components
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

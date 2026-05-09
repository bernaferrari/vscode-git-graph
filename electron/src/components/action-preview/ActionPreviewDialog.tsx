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

const ACTION_TONES: Record<ActionType, { text: string; bg: string; ring: string }> = {
	rebase: {
		text: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--info)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--info)_28%,transparent)]',
	},
	merge: {
		text: 'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--primary)_28%,transparent)]',
	},
	push: {
		text: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--success)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--success)_28%,transparent)]',
	},
	'force-push': {
		text: 'text-destructive',
		bg: 'bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--destructive)_30%,transparent)]',
	},
	reset: {
		text: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--warning)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--warning)_28%,transparent)]',
	},
	'cherry-pick': {
		text: 'text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--chart-7)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--chart-7)_28%,transparent)]',
	},
	revert: {
		text: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--warning)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--warning)_28%,transparent)]',
	},
	squash: {
		text: 'text-[color-mix(in_oklch,var(--chart-4)_75%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--chart-4)_10%,transparent)]',
		ring: 'ring-[color-mix(in_oklch,var(--chart-4)_28%,transparent)]',
	},
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
	const tone = ACTION_TONES[preview.type];
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
	const safetyBannerClass =
		severity === 'destructive'
			? 'ui-banner-error'
			: severity === 'warning'
				? 'ui-banner-warning'
				: 'ui-banner-info';

	const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-2xl'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className={cn('grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset', tone.bg, tone.ring)}>
							<Icon className={cn('h-3.5 w-3.5', tone.text)} />
						</span>
						<span className='font-semibold'>{preview.title}</span>
					</DialogTitle>
					<DialogDescription className='max-w-[58ch] text-[11px] text-muted-foreground/85'>
						{preview.description}
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-3 px-5 py-4'>
					<div className={cn('ui-banner flex items-start gap-2 rounded-lg border', safetyBannerClass)}>
						<Info className='h-4 w-4 shrink-0 mt-0.5 text-foreground/70' />
						<div className='space-y-0.5'>
							<p className='text-[0.8125rem] font-medium'>Before you continue</p>
							<p className='text-[11px] leading-snug text-muted-foreground/90'>
								{preview.safetyNote ??
									(preview.undoAvailable
										? 'This action changes repository state, but recovery is available if the result is not what you expected.'
										: 'This action changes repository state and may be difficult to reverse after it runs.')}
							</p>
						</div>
					</div>

					<div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
						<section className='rounded-xl border border-border/70 bg-card/40 p-3'>
							<h4 className={cn(SECTION_LABEL, 'mb-2 flex items-center gap-1.5')}>
								<ArrowRight className='h-3 w-3' />
								Impact
							</h4>
							{summaryItems.length === 0 ? (
								<p className='rounded-md border border-dashed border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground/85'>
									No structural changes to summarize before execution.
								</p>
							) : (
								<ul className='space-y-1.5'>
									{summaryItems.map((item) => {
										const SummaryIcon = item.icon;
										return (
											<li key={item.label} className='flex items-center justify-between gap-2'>
												<span className='flex items-center gap-1.5 text-[11px] text-muted-foreground/85'>
													<SummaryIcon className='h-3 w-3' />
													{item.label}
												</span>
												<span className='truncate font-mono text-[11px] tabular-nums text-foreground/90'>
													{item.value}
												</span>
											</li>
										);
									})}
								</ul>
							)}
						</section>

						<div className='space-y-3'>
							{preview.risks.length > 0 && (
								<section className='ui-banner ui-banner-warning rounded-xl border'>
									<h4 className='flex items-center gap-1.5 text-[0.8125rem] font-medium text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
										<AlertTriangle className='h-3.5 w-3.5' />
										Things to verify first
									</h4>
									<ul className='mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground/90'>
										{preview.risks.map((risk, i) => (
											<li key={i} className='flex items-start gap-1.5'>
												<X className='mt-0.5 h-3 w-3 shrink-0 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
												<span>{risk}</span>
											</li>
										))}
									</ul>
								</section>
							)}

							<section className='rounded-xl border border-border/70 bg-card/40 p-3'>
								<h4 className={cn(SECTION_LABEL, 'mb-2 flex items-center gap-1.5')}>
									<Info className='h-3 w-3' />
									Git commands
								</h4>
								<pre className='overflow-x-auto rounded-md bg-muted/40 p-2.5 font-mono text-[11px] leading-snug text-muted-foreground'>
									{preview.gitCommands.map((cmd, i) => (
										<div key={i}>
											<span className='select-none text-muted-foreground/60'>$ </span>
											<span className='text-foreground/85'>{cmd}</span>
										</div>
									))}
								</pre>
							</section>
						</div>
					</div>

					<div
						className={cn(
							'flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.8125rem]',
							preview.undoAvailable
								? 'border-[color-mix(in_oklch,var(--success)_30%,transparent)] bg-[color-mix(in_oklch,var(--success)_8%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'
								: 'border-border/70 bg-muted/30 text-muted-foreground'
						)}>
						{preview.undoAvailable ? <Check className='h-3.5 w-3.5' /> : <AlertTriangle className='h-3.5 w-3.5' />}
						<span>
							{preview.undoAvailable
								? 'Recovery path available after this action.'
								: 'No automatic recovery path is available once this action completes.'}
						</span>
					</div>
				</div>

				<DialogFooter className='gap-2 border-t border-border/60 px-5 py-3'>
					<Button variant='outline' size='sm' onClick={onCancel || (() => { onOpenChange(false); })}>
						Cancel
					</Button>
					<Button
						variant={severity === 'destructive' ? 'destructive' : 'default'}
						size='sm'
						onClick={onConfirm}
						disabled={isLoading}>
						{isLoading ? 'Processing…' : confirmLabel}
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

/**
 * Outcome Preview Dialog
 * Shows what will happen before merge/rebase operations.
 */

import {
	GitCommit,
	Merge,
	RotateCcw,
	AlertTriangle,
	CheckCircle2,
	ArrowRight,
	Shield,
	ShieldAlert,
	ShieldCheck,
	AlertCircle,
	Files,
	Loader2,
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

import type { OutcomePreview } from '@/lib/outcomePreview';

interface OutcomePreviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preview: OutcomePreview | null;
	onApply: () => void;
	onCancel: () => void;
	isLoading?: boolean;
}

const RISK_CONFIG = {
	low: {
		icon: ShieldCheck,
		bannerClass: 'ui-banner-info',
		accentText: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
		label: 'Low risk',
	},
	medium: {
		icon: Shield,
		bannerClass: 'ui-banner-warning',
		accentText: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
		label: 'Medium risk',
	},
	high: {
		icon: ShieldAlert,
		bannerClass: 'ui-banner-error',
		accentText: 'text-destructive',
		label: 'High risk',
	},
} as const;

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

export function OutcomePreviewDialog({
	open,
	onOpenChange,
	preview,
	onApply,
	onCancel,
	isLoading,
}: OutcomePreviewDialogProps) {
	const [showGhostOverlay, setShowGhostOverlay] = useState(true);

	if (!preview) return null;

	const riskConfig = RISK_CONFIG[preview.riskLevel];
	const RiskIcon = riskConfig.icon;

	const operationIcon =
		preview.operation === 'merge' ? Merge : preview.operation === 'rebase' ? RotateCcw : GitCommit;
	const OperationIcon = operationIcon;
	const operationLabel = preview.operation.charAt(0).toUpperCase() + preview.operation.slice(1);
	const visibleCommits = preview.commits.filter((c) => c.action !== 'dropped');

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[90vh] overflow-hidden flex flex-col gap-0 sm:max-w-3xl'>
				<DialogHeader className='space-y-1.5 border-b border-border/60 pb-3'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<OperationIcon className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>{operationLabel}</span>
						<span className='font-mono text-[0.8125rem] text-muted-foreground/85'>
							{preview.sourceRef} → {preview.targetRef}
						</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						See exactly what will happen before applying anything.
					</DialogDescription>
				</DialogHeader>

				<div className='flex-1 space-y-3 overflow-y-auto py-3'>
					{/* Risk banner */}
					<div className={cn('ui-banner flex items-start gap-3 rounded-lg border', riskConfig.bannerClass)}>
						<RiskIcon className={cn('h-4 w-4 mt-0.5', riskConfig.accentText)} />
						<div className='flex-1 space-y-1'>
							<div className='flex items-center gap-2'>
								<span className={cn('text-[0.8125rem] font-medium', riskConfig.accentText)}>
									{riskConfig.label}
								</span>
								<span className='font-mono text-[10px] tabular-nums text-muted-foreground/85'>
									~{preview.estimatedDuration}
								</span>
							</div>
							{preview.riskReasons.length > 0 && (
								<ul className='space-y-0.5 text-[11px] text-muted-foreground/90'>
									{preview.riskReasons.map((reason, index) => (
										<li key={index} className='flex items-start gap-1.5 leading-snug'>
											<span aria-hidden className='mt-0.5 select-none text-muted-foreground/60'>·</span>
											<span>{reason}</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					{/* Impact tiles */}
					<div className='grid grid-cols-3 gap-2'>
						<ImpactTile
							icon={GitCommit}
							value={visibleCommits.length}
							label='Commits'
							tone='info'
						/>
						<ImpactTile
							icon={Files}
							value={preview.filesChanged}
							label='Files'
							tone='success'
						/>
						<ImpactTile
							icon={preview.conflictsCount > 0 ? AlertCircle : CheckCircle2}
							value={preview.conflictsCount}
							label='Conflicts'
							tone={preview.conflictsCount > 0 ? 'destructive' : 'success'}
						/>
					</div>

					{/* Warnings */}
					{preview.willRewriteHistory && (
						<WarningStrip
							tone='warning'
							title='Rewrites history'
							body="Commit hashes will change. If this branch is shared, you'll need to force push."
						/>
					)}
					{preview.willForcePush && (
						<WarningStrip
							tone='destructive'
							title='Force push required'
							body='The remote already has commits. Use force-with-lease for safety.'
						/>
					)}

					{/* Graph preview */}
					<section className='rounded-xl border border-border/70 bg-card/40 p-3'>
						<header className='mb-2 flex items-center justify-between'>
							<h3 className={SECTION_LABEL}>Commit graph</h3>
							<label className='flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground/85'>
								<input
									type='checkbox'
									checked={showGhostOverlay}
									onChange={(e) => { setShowGhostOverlay(e.target.checked); }}
									className='h-3 w-3 rounded accent-primary'
								/>
								Highlight changes
							</label>
						</header>

						<div className='grid grid-cols-[1fr_auto_1fr] gap-3 rounded-lg bg-muted/25 p-3'>
							<GraphColumn label='Before' commits={preview.commits.slice(0, 6)} side='before' showGhostOverlay={false} />
							<div className='flex items-center'>
								<ArrowRight className='h-3.5 w-3.5 text-muted-foreground/70' />
							</div>
							<GraphColumn label='After' commits={preview.commits.slice(0, 6)} side='after' showGhostOverlay={showGhostOverlay} />
						</div>

						<div className='mt-2.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/85'>
							<LegendDot tone='info' label='Unchanged' />
							<LegendDot tone='success' label='New' />
							<LegendDot tone='warning' label='Rewritten' />
							<LegendDot tone='destructive' label='Dropped' />
						</div>
					</section>

					{/* Git commands */}
					<section className='rounded-xl border border-border/70 bg-card/40 p-3'>
						<h3 className={cn(SECTION_LABEL, 'mb-2')}>Equivalent commands</h3>
						<pre className='overflow-x-auto rounded-md bg-muted/40 p-2.5 font-mono text-[11px] leading-snug text-muted-foreground'>
							{preview.gitCommands.map((cmd, index) => (
								<div key={index}>
									<span className='select-none text-muted-foreground/60'>$ </span>
									<span className='text-foreground/85'>{cmd}</span>
								</div>
							))}
						</pre>
					</section>
				</div>

				<DialogFooter className='gap-2 border-t border-border/60 pt-3'>
					<Button variant='outline' size='sm' onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant={preview.riskLevel === 'high' ? 'destructive' : 'default'}
						size='sm'
						onClick={onApply}
						disabled={isLoading}>
						{isLoading ? (
							<>
								<Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
								Applying…
							</>
						) : (
							<>
								<CheckCircle2 className='mr-1.5 h-3.5 w-3.5' />
								Apply {preview.operation}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

type Tone = 'info' | 'success' | 'warning' | 'destructive';

const TONE_DOT: Record<Tone, string> = {
	info: 'bg-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
	success: 'bg-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
	warning: 'bg-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
	destructive: 'bg-destructive',
};

const TONE_TEXT: Record<Tone, string> = {
	info: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
	success: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
	warning: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
	destructive: 'text-destructive',
};

function ImpactTile({
	icon: Icon,
	value,
	label,
	tone,
}: {
	icon: typeof GitCommit;
	value: number;
	label: string;
	tone: Tone;
}) {
	return (
		<div className='rounded-lg border border-border/70 bg-card/40 p-2.5'>
			<div className='flex items-center gap-1.5'>
				<Icon className={cn('h-3.5 w-3.5', TONE_TEXT[tone])} />
				<span className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
					{label}
				</span>
			</div>
			<p className={cn('mt-0.5 text-[1.5rem] font-semibold leading-none tabular-nums', TONE_TEXT[tone])}>
				{value}
			</p>
		</div>
	);
}

function WarningStrip({ tone, title, body }: { tone: 'warning' | 'destructive'; title: string; body: string }) {
	return (
		<div
			className={cn(
				'ui-banner flex items-start gap-2 rounded-lg border',
				tone === 'warning' ? 'ui-banner-warning' : 'ui-banner-error'
			)}>
			<AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', TONE_TEXT[tone])} />
			<div className='space-y-0.5'>
				<p className={cn('text-[0.8125rem] font-medium', TONE_TEXT[tone])}>{title}</p>
				<p className='text-[11px] leading-snug text-muted-foreground/90'>{body}</p>
			</div>
		</div>
	);
}

function commitTone(action: string): Tone {
	if (action === 'unchanged') return 'info';
	if (action === 'new') return 'success';
	if (action === 'rewritten') return 'warning';
	return 'destructive';
}

function GraphColumn({
	label,
	commits,
	side,
	showGhostOverlay,
}: {
	label: string;
	commits: OutcomePreview['commits'];
	side: 'before' | 'after';
	showGhostOverlay: boolean;
}) {
	return (
		<div>
			<p className={cn(SECTION_LABEL, 'mb-2')}>{label}</p>
			<ol className='space-y-0.5'>
				{commits.map((commit) => {
					const newHash = (commit as { newHash?: string }).newHash;
					const isAfter = side === 'after';
					const tone = isAfter ? commitTone(commit.action) : 'info';
					const dropped = commit.action === 'dropped';

					return (
						<li
							key={`${side}-${commit.hash}`}
							className={cn(
								'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors',
								isAfter && showGhostOverlay && commit.action !== 'unchanged' && !dropped && 'bg-[color-mix(in_oklch,var(--success)_10%,transparent)]',
								dropped && 'opacity-60 line-through'
							)}>
							<span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
							<span className='shrink-0 font-mono tabular-nums text-muted-foreground/85'>
								{isAfter && commit.action !== 'unchanged'
									? newHash?.substring(0, 7) ?? '—'
									: commit.hash.substring(0, 7)}
							</span>
							<span className='truncate text-foreground/85'>{commit.message}</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

function LegendDot({ tone, label }: { tone: Tone; label: string }) {
	return (
		<div className='flex items-center gap-1'>
			<span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />
			<span>{label}</span>
		</div>
	);
}

export default OutcomePreviewDialog;

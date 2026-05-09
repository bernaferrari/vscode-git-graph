/**
 * CommitDotQuickActions
 *
 * The hovercard that appears when a user clicks a commit dot in the graph.
 * Shows the commit at-a-glance — author, SHA, parent count, mini message —
 * plus four primary actions, each routed through a flow that explains itself
 * and is undoable: Bring this in, Cherry-pick, Revert, Reset to here.
 *
 * Cards-not-verbs philosophy: "Bring this in here…" is the default, primary,
 * sparkles-coloured action. Cherry-pick / Revert / Reset are secondary text
 * buttons. The user does not need to know which Git verb to reach for.
 */

import {
	GitCommit,
	History,
	Hash,
	RotateCcw,
	Scissors,
	Sparkles,
	User,
	X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useOutcomePicker } from '@/components/outcome-preview/useOutcomePicker';
import { useGitOperations } from '@/hooks/useGitOperations';
import { cn } from '@/lib/utils';

export interface CommitDotQuickActionsTarget {
	hash: string;
	message: string;
	author: string;
	email?: string;
	parents?: string[];
	timestamp?: number;
}

interface CommitDotQuickActionsProps {
	open: boolean;
	position: { x: number; y: number };
	commit: CommitDotQuickActionsTarget | null;
	currentBranch?: string | null;
	onClose: () => void;
	onOpenFullDetails?: (hash: string) => void;
}

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

export function CommitDotQuickActions({
	open,
	position,
	commit,
	currentBranch,
	onClose,
	onOpenFullDetails,
}: CommitDotQuickActionsProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const gitOps = useGitOperations();
	const { openIntegration } = useOutcomePicker();

	useEffect(() => {
		if (!open) return;
		const handlePointerDown = (event: MouseEvent) => {
			if (!cardRef.current) return;
			if (cardRef.current.contains(event.target as Node)) return;
			onClose();
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('mousedown', handlePointerDown, true);
		window.addEventListener('keydown', handleKey, true);
		return () => {
			window.removeEventListener('mousedown', handlePointerDown, true);
			window.removeEventListener('keydown', handleKey, true);
		};
	}, [open, onClose]);

	if (!open || !commit) return null;

	const sha = commit.hash.slice(0, 7);
	const subject = commit.message.split('\n')[0] ?? '';
	const parentCount = commit.parents?.length ?? 0;

	// Constrain the card so it doesn't render off-screen for late-night clicks
	// near the bottom-right of the window.
	const CARD_WIDTH = 320;
	const CARD_HEIGHT = 280;
	const left = Math.min(position.x, window.innerWidth - CARD_WIDTH - 12);
	const top = Math.min(position.y, window.innerHeight - CARD_HEIGHT - 12);

	return (
		<div
			ref={cardRef}
			role='dialog'
			aria-label={`Quick actions for ${sha}`}
			className='fixed z-50 w-[20rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] animate-in fade-in-0 zoom-in-[0.98] duration-150'
			style={{ left, top }}
			onClick={(e) => { e.stopPropagation(); }}>
			{/* Header */}
			<header className='flex items-start gap-2.5 border-b border-border/60 px-3.5 py-3'>
				<span className='mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
					<GitCommit className='h-3.5 w-3.5 text-primary' />
				</span>
				<div className='min-w-0 flex-1 space-y-1'>
					<p className='line-clamp-2 text-[0.8125rem] font-medium leading-snug'>{subject}</p>
					<div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/85'>
						<span className='flex items-center gap-1'>
							<Hash className='h-3 w-3' />
							<span className='font-mono tabular-nums'>{sha}</span>
						</span>
						<span aria-hidden className='text-muted-foreground/60'>·</span>
						<span className='flex max-w-[140px] items-center gap-1 truncate'>
							<User className='h-3 w-3' />
							<span className='truncate'>{commit.author}</span>
						</span>
						{parentCount > 1 ? (
							<>
								<span aria-hidden className='text-muted-foreground/60'>·</span>
								<span className='font-mono text-[10px] text-muted-foreground/85'>
									{parentCount} parents
								</span>
							</>
						) : null}
					</div>
				</div>
				<button
					type='button'
					onClick={onClose}
					aria-label='Close quick actions'
					className='-mr-1 rounded p-1 text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground'>
					<X className='h-3.5 w-3.5' />
				</button>
			</header>

			{/* Primary action: cards-not-verbs entry */}
			<div className='space-y-2 p-3'>
				<p className={SECTION_LABEL}>What do you want to do?</p>
				{currentBranch ? (
					<button
						type='button'
						onClick={() => {
							openIntegration({ source: commit.hash, target: currentBranch });
							onClose();
						}}
						className={cn(
							'group/primary flex w-full items-center gap-2.5 rounded-lg border border-primary/40 bg-[color-mix(in_oklch,var(--primary)_8%,var(--popover))] px-2.5 py-2 text-left transition-all',
							'hover:border-primary/60 hover:bg-[color-mix(in_oklch,var(--primary)_12%,var(--popover))]',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45'
						)}>
						<span className='grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/25'>
							<Sparkles className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='min-w-0 flex-1'>
							<span className='block text-[0.8125rem] font-semibold leading-tight'>
								Bring this in here
							</span>
							<span className='block truncate font-mono text-[10px] text-muted-foreground/85'>
								onto {currentBranch}
							</span>
						</span>
					</button>
				) : (
					<div className='flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground/85'>
						<Sparkles className='h-3.5 w-3.5' />
						<span>Detached HEAD — pick a branch first to bring this in.</span>
					</div>
				)}

				{/* Secondary verbs */}
				<div className='grid grid-cols-3 gap-1.5 pt-1'>
					<SecondaryAction
						icon={Scissors}
						label='Cherry-pick'
						hint='Onto here'
						onClick={() => {
							void gitOps.cherryPick(commit.hash);
							onClose();
						}}
					/>
					<SecondaryAction
						icon={History}
						label='Revert'
						hint='Undo this'
						onClick={() => {
							void gitOps.revert(commit.hash);
							onClose();
						}}
					/>
					<SecondaryAction
						icon={RotateCcw}
						label='Reset to here'
						hint='Move HEAD'
						destructive
						onClick={() => {
							void gitOps.reset(commit.hash, 'mixed');
							onClose();
						}}
					/>
				</div>
			</div>

			{/* Footer reassurance + escape hatch to full details */}
			<footer className='flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-2'>
				<span className='text-[10px] text-muted-foreground/85'>
					Every change can be undone.
				</span>
				{onOpenFullDetails ? (
					<Button
						variant='ghost'
						size='xs'
						className='h-5 px-1.5 text-[11px]'
						onClick={() => {
							onOpenFullDetails(commit.hash);
							onClose();
						}}>
						See full details
					</Button>
				) : null}
			</footer>
		</div>
	);
}

function SecondaryAction({
	icon: Icon,
	label,
	hint,
	onClick,
	destructive,
}: {
	icon: typeof Scissors;
	label: string;
	hint: string;
	onClick: () => void;
	destructive?: boolean;
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'group/sec flex flex-col items-start gap-0.5 rounded-md border border-border/60 bg-card/40 px-2 py-1.5 text-left transition-colors',
				'hover:border-border hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45',
				destructive && 'hover:border-[color-mix(in_oklch,var(--destructive)_30%,var(--border))] hover:bg-[color-mix(in_oklch,var(--destructive)_6%,transparent)]'
			)}>
			<span className='flex items-center gap-1 text-[11px] font-medium'>
				<Icon className={cn('h-3 w-3', destructive ? 'text-destructive' : 'text-muted-foreground')} />
				{label}
			</span>
			<span className='text-[10px] text-muted-foreground/85'>{hint}</span>
		</button>
	);
}

export default CommitDotQuickActions;

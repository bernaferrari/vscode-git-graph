/**
 * CommitMultiSelectBar
 *
 * Slides up from the bottom-center when 2+ commits are selected. Shows the
 * selected SHAs as compact chips and offers the cards-not-verbs entry point
 * for batch operations: a single primary "Bring these in / Pick a result…"
 * button opens the OutcomePicker in batch mode (cherry-pick / squash / drop).
 *
 * Escape clears the selection. ⎋ also dismisses the bar.
 */

import { ListChecks, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useOutcomePicker } from '@/components/outcome-preview/useOutcomePicker';
import { cn } from '@/lib/utils';

export interface MultiSelectCommit {
	hash: string;
	message: string;
}

interface CommitMultiSelectBarProps {
	selectedCommits: MultiSelectCommit[];
	currentBranch?: string | null;
	/**
	 * Whether the selection is contiguous on the current branch. Drives which
	 * batch strategies the picker offers (squash / drop). Optional — defaults
	 * to false so the conservative/safe path is used.
	 */
	contiguous?: boolean;
	/** Are all selected commits on the current branch? */
	onCurrentBranch?: boolean;
	onClear: () => void;
}

export function CommitMultiSelectBar({
	selectedCommits,
	currentBranch,
	contiguous = false,
	onCurrentBranch = false,
	onClear,
}: CommitMultiSelectBarProps) {
	const { openBatch } = useOutcomePicker();

	useEffect(() => {
		if (selectedCommits.length < 2) return;
		const handleKey = (event: KeyboardEvent) => {
			// Escape clears, but don't fight inputs.
			if (event.key !== 'Escape') return;
			const target = event.target as HTMLElement | null;
			if (
				target?.tagName === 'INPUT' ||
				target?.tagName === 'TEXTAREA' ||
				target?.isContentEditable
			) {
				return;
			}
			onClear();
		};
		window.addEventListener('keydown', handleKey);
		return () => { window.removeEventListener('keydown', handleKey); };
	}, [selectedCommits.length, onClear]);

	if (selectedCommits.length < 2) return null;

	const visible = selectedCommits.slice(0, 4);
	const overflow = Math.max(0, selectedCommits.length - visible.length);

	return (
		<div
			role='toolbar'
			aria-label={`${String(selectedCommits.length)} commits selected`}
			className='pointer-events-none fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 justify-center'>
			<div
				className={cn(
					'pointer-events-auto flex max-w-[min(720px,calc(100vw-32px))] items-center gap-2 rounded-2xl border border-border bg-popover/95 px-2.5 py-1.5 text-popover-foreground shadow-[var(--shadow-popover)] backdrop-blur-md backdrop-saturate-150',
					'animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
				)}>
				{/* Count tile */}
				<span className='grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
					<ListChecks className='h-3.5 w-3.5 text-primary' />
				</span>
				<div className='flex min-w-0 flex-col leading-tight'>
					<span className='text-[0.8125rem] font-semibold'>
						{selectedCommits.length} commits selected
					</span>
					<div className='flex items-center gap-1 overflow-hidden font-mono text-[10px] text-muted-foreground/85'>
						{visible.map((c) => (
							<span
								key={c.hash}
								title={c.message}
								className='shrink-0 rounded-sm bg-muted/60 px-1 py-[1px] tabular-nums'>
								{c.hash.slice(0, 7)}
							</span>
						))}
						{overflow > 0 && (
							<span className='shrink-0 rounded-sm bg-muted/60 px-1 py-[1px] tabular-nums'>
								+{overflow}
							</span>
						)}
					</div>
				</div>

				<span aria-hidden className='mx-1 h-7 w-px shrink-0 bg-border/70' />

				<Button
					size='sm'
					className='gap-1.5'
					onClick={() => {
						if (!currentBranch) return;
						openBatch({
							commits: selectedCommits,
							target: currentBranch,
							contiguous,
							onCurrentBranch,
						});
					}}
					disabled={!currentBranch}>
					<Sparkles className='h-3.5 w-3.5' />
					Pick a result…
				</Button>

				<Button
					variant='ghost'
					size='sm'
					className='h-7 w-7 p-0 text-muted-foreground/85 hover:text-foreground'
					onClick={onClear}
					aria-label='Clear selection'>
					<X className='h-3.5 w-3.5' />
				</Button>
			</div>
		</div>
	);
}

export default CommitMultiSelectBar;

/**
 * Commit Graph Legend
 * Explain graph visualization elements
 */

import { GitMerge, GitBranch, Info, Tag, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface CommitGraphLegendProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const SECTION_LABEL =
	'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

const LANE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-7)'];

export function CommitGraphLegend({ open, onOpenChange }: CommitGraphLegendProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-2xl gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<Info className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>How to read the graph</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Every shape here means something. Once you spot the pattern, history reads itself.
					</DialogDescription>
				</DialogHeader>

				<div className='grid grid-cols-1 gap-5 p-5 md:grid-cols-2'>
					{/* Commit Types */}
					<section className='space-y-2.5'>
						<h3 className={SECTION_LABEL}>Commit shapes</h3>
						<ul className='space-y-2'>
							<LegendRow
								glyph={<DotGlyph color='var(--chart-1)' />}
								title='Regular commit'
								description='A single parent — the typical case.' />
							<LegendRow
								glyph={<MergeGlyph />}
								title='Merge commit'
								description='Two parents come together at this dot.'
								icon={<GitMerge className='h-3 w-3 text-primary' />}
							/>
							<LegendRow
								glyph={<BranchGlyph />}
								title='Branch point'
								description='Where a branch peels off the lane.'
								icon={<GitBranch className='h-3 w-3 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />}
							/>
							<LegendRow
								glyph={<DotGlyph color='var(--primary)' highlight />}
								title='Selected commit'
								description='The current focus. Outlined with a halo and primary rail.'
								icon={<Sparkles className='h-3 w-3 text-primary' />}
							/>
						</ul>
					</section>

					{/* Refs */}
					<section className='space-y-2.5'>
						<h3 className={SECTION_LABEL}>Reference chips</h3>
						<ul className='space-y-2'>
							<RefRow
								chip={<RefChip kind='head'>HEAD</RefChip>}
								description='Where the working tree currently sits.'
							/>
							<RefRow
								chip={<RefChip kind='local'>main</RefChip>}
								description='A local branch.'
							/>
							<RefRow
								chip={<RefChip kind='remote'>origin/main</RefChip>}
								description='A remote-tracking branch.'
							/>
							<RefRow
								chip={
									<RefChip kind='tag'>
										<Tag className='h-2.5 w-2.5' />v1.0.0
									</RefChip>
								}
								description='A tag — usually a release.'
							/>
						</ul>
					</section>

					{/* Branch lanes */}
					<section className='col-span-1 space-y-2 md:col-span-2'>
						<h3 className={SECTION_LABEL}>Branch lanes</h3>
						<p className='text-[11px] leading-relaxed text-muted-foreground/85'>
							Each active branch gets its own lane and a color. Follow a color to follow a branch.
						</p>
						<div className='flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/15 p-3'>
							{LANE_COLORS.map((c, i) => (
								<div key={i} className='flex flex-1 flex-col items-center gap-1'>
									<span
										className='block h-1 w-full rounded-full'
										style={{ background: c }}
										aria-hidden
									/>
									<span
										className='block h-2.5 w-2.5 rounded-full ring-2 ring-card'
										style={{ background: c }}
										aria-hidden
									/>
								</div>
							))}
						</div>
					</section>

					{/* Navigation */}
					<section className='col-span-1 space-y-2 md:col-span-2'>
						<h3 className={SECTION_LABEL}>Navigation</h3>
						<dl className='grid grid-cols-1 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-2'>
							<NavTip keys={['Click']} description='Select and show details' />
							<NavTip keys={['Right-click']} description='Context menu' />
							<NavTip keys={['Double-click']} description='Expand details' />
							<NavTip keys={['j', '/', 'k']} description='Move down / up' />
							<NavTip keys={['↑', '/', '↓']} description='Move down / up' />
							<NavTip keys={['⌘', 'click']} description='Add to multi-select' />
							<NavTip keys={['⇧', 'click']} description='Range select' />
							<NavTip keys={['?']} description='Show all shortcuts' />
						</dl>
					</section>
				</div>

				<footer className='flex items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<p className='text-[11px] text-muted-foreground/85'>
						You can also access this from the toolbar overflow menu.
					</p>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}

function LegendRow({
	glyph,
	title,
	description,
	icon,
}: {
	glyph: React.ReactNode;
	title: string;
	description: string;
	icon?: React.ReactNode;
}) {
	return (
		<li className='flex items-start gap-2.5'>
			<span className='shrink-0'>{glyph}</span>
			<div className='min-w-0 flex-1 leading-tight'>
				<div className='flex items-center gap-1.5'>
					<span className='text-[12px] font-semibold tracking-[-0.005em]'>{title}</span>
					{icon}
				</div>
				<p className='text-[11px] leading-relaxed text-muted-foreground/85'>{description}</p>
			</div>
		</li>
	);
}

function RefRow({ chip, description }: { chip: React.ReactNode; description: string }) {
	return (
		<li className='flex items-center justify-between gap-2'>
			{chip}
			<span className='text-[11px] text-muted-foreground/85'>{description}</span>
		</li>
	);
}

function RefChip({
	kind,
	children,
}: {
	kind: 'head' | 'local' | 'remote' | 'tag';
	children: React.ReactNode;
}) {
	const styles: Record<typeof kind, string> = {
		head: 'border-primary/30 bg-primary/10 text-primary',
		local: 'border-border/70 bg-card/70 text-foreground/85',
		remote: 'border-[color-mix(in_oklch,var(--info)_30%,transparent)] bg-[color-mix(in_oklch,var(--info)_10%,transparent)] text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
		tag: 'border-[color-mix(in_oklch,var(--warning)_30%,transparent)] bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
	};
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${styles[kind]}`}>
			{children}
		</span>
	);
}

function DotGlyph({ color, highlight }: { color: string; highlight?: boolean }) {
	return (
		<span className='relative grid h-7 w-7 place-items-center'>
			{highlight && (
				<span
					aria-hidden
					className='absolute inset-0 rounded-full opacity-25'
					style={{ background: color }}
				/>
			)}
			<span
				className='block h-2.5 w-2.5 rounded-full ring-2 ring-card'
				style={{ background: color }}
				aria-hidden
			/>
		</span>
	);
}

function MergeGlyph() {
	return (
		<svg viewBox='0 0 28 28' aria-hidden className='h-7 w-7'>
			<path d='M6 22 C6 14 18 14 22 6' stroke='var(--chart-3)' strokeWidth='1.5' fill='none' />
			<path d='M6 22 L22 22' stroke='var(--chart-1)' strokeWidth='1.5' fill='none' />
			<circle cx={6} cy={22} r={3} fill='var(--chart-1)' stroke='var(--card)' strokeWidth='1.5' />
			<circle cx={22} cy={22} r={3} fill='var(--chart-1)' stroke='var(--card)' strokeWidth='1.5' />
			<circle cx={22} cy={6} r={2.5} fill='var(--chart-3)' stroke='var(--card)' strokeWidth='1.5' />
		</svg>
	);
}

function BranchGlyph() {
	return (
		<svg viewBox='0 0 28 28' aria-hidden className='h-7 w-7'>
			<path d='M14 22 L14 6' stroke='var(--chart-1)' strokeWidth='1.5' fill='none' />
			<path d='M14 14 C14 10 22 10 22 6' stroke='var(--chart-3)' strokeWidth='1.5' fill='none' />
			<circle cx={14} cy={14} r={3} fill='var(--chart-1)' stroke='var(--card)' strokeWidth='1.5' />
			<circle cx={22} cy={6} r={2.5} fill='var(--chart-3)' stroke='var(--card)' strokeWidth='1.5' />
		</svg>
	);
}

function NavTip({ keys, description }: { keys: string[]; description: string }) {
	return (
		<div className='flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0'>
			<span className='flex items-center gap-0.5'>
				{keys.map((k, i) =>
					k === '/' ? (
						<span key={i} className='px-0.5 text-muted-foreground/60'>or</span>
					) : (
						<kbd
							key={i}
							className='inline-flex items-center justify-center rounded-md border border-border/70 bg-card/90 px-1.5 py-px font-mono text-[10px] font-semibold text-foreground/85 shadow-[inset_0_-1px_0_color-mix(in_oklch,var(--border)_60%,transparent)]'>
							{k}
						</kbd>
					),
				)}
			</span>
			<span className='text-[11px] text-muted-foreground/85'>{description}</span>
		</div>
	);
}

export default CommitGraphLegend;

/**
 * Lens Switcher Component
 * Allows users to switch between Guided/Craft/Control modes
 */

import {
	Compass,
	Wand2,
	Terminal,
	ChevronDown,
	Check,
} from 'lucide-react';

import { useLensMode, type LensMode } from './useLensMode';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { ElementType } from 'react';

const LENS_ICONS: Record<LensMode, ElementType> = {
	guided: Compass,
	craft: Wand2,
	control: Terminal,
};

const LENS_COLORS: Record<LensMode, string> = {
	guided:
		'text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--success)_35%,transparent)] bg-[color-mix(in_oklch,var(--success)_10%,transparent)]',
	craft:
		'text-[color-mix(in_oklch,var(--info)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--info)_35%,transparent)] bg-[color-mix(in_oklch,var(--info)_10%,transparent)]',
	control:
		'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))] border-[color-mix(in_oklch,var(--primary)_35%,transparent)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]',
};

interface LensSwitcherProps {
	className?: string;
	showLabel?: boolean;
	variant?: 'header' | 'toolbar' | 'inline';
}

export function LensSwitcher({
	className,
	showLabel = true,
	variant = 'header',
}: LensSwitcherProps) {
	const { mode, config, setLensMode, lensOptions } = useLensMode();

	const CurrentIcon = LENS_ICONS[mode];

	if (variant === 'inline' || variant === 'toolbar') {
		return (
			<div className='inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/40 p-0.5'>
				{lensOptions.map((lens) => {
					const Icon = LENS_ICONS[lens.mode];
					const isActive = lens.mode === mode;
					return (
						<Button
							key={lens.mode}
							variant='ghost'
							size='xs'
							onClick={() => { setLensMode(lens.mode); }}
							className={cn(
								'h-6 gap-1.5 px-2 text-[11px] font-medium',
								isActive
									? 'bg-background ring-1 ring-border shadow-[var(--shadow-xs)]'
									: 'text-muted-foreground/85 hover:text-foreground',
								isActive && LENS_COLORS[lens.mode],
								className
							)}
							title={lens.description}>
							<Icon className='h-3.5 w-3.5' />
							{showLabel && <span>{lens.label}</span>}
						</Button>
					);
				})}
			</div>
		);
	}

	// Header variant (dropdown)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={cn(
						'h-8 gap-1.5',
						LENS_COLORS[mode],
						className
					)}>
					<CurrentIcon className='h-4 w-4' />
					{showLabel && (
						<>
							<span>{config.label}</span>
							<ChevronDown className='h-3 w-3 opacity-60' />
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-64'>
				<div className='px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
					Select lens
				</div>
				<DropdownMenuSeparator />
				{lensOptions.map((lens) => {
					const Icon = LENS_ICONS[lens.mode];
					const isActive = lens.mode === mode;
					return (
						<DropdownMenuItem
							key={lens.mode}
							onClick={() => { setLensMode(lens.mode); }}
							className={cn(
								'flex cursor-pointer items-start gap-2 px-2 py-1.5',
								isActive && 'bg-accent/70'
							)}>
							<Icon className={cn('mt-0.5 h-4 w-4', isActive ? 'opacity-100' : 'opacity-60')} />
							<div className='flex min-w-0 flex-1 flex-col leading-snug'>
								<span className='text-[0.8125rem] font-medium'>{lens.label}</span>
								<span className='text-[11px] text-muted-foreground/85'>
									{lens.description}
								</span>
							</div>
							{isActive && <Check className='ml-auto h-3.5 w-3.5 text-primary' />}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<div className='flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-muted-foreground/85'>
					<span>Quick switch</span>
					<span className='flex items-center gap-1'>
						<kbd className='ui-kbd'>⌃1</kbd>
						<kbd className='ui-kbd'>⌃2</kbd>
						<kbd className='ui-kbd'>⌃3</kbd>
					</span>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

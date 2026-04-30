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
	guided: 'text-green-500 border-green-500/30 bg-green-500/10',
	craft: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
	control: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
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

	if (variant === 'inline') {
		return (
			<div className="flex items-center gap-1">
				{lensOptions.map((lens) => {
					const Icon = LENS_ICONS[lens.mode];
					const isActive = lens.mode === mode;
					return (
						<Button
							key={lens.mode}
							variant={isActive ? 'default' : 'ghost'}
							size="sm"
							onClick={() => { setLensMode(lens.mode); }}
							className={cn(
								'h-7 px-2 gap-1.5',
								isActive && LENS_COLORS[lens.mode],
								className
							)}
						>
							<Icon className="h-3.5 w-3.5" />
							{showLabel && <span>{lens.label}</span>}
						</Button>
					);
				})}
			</div>
		);
	}

	if (variant === 'toolbar') {
		return (
			<div className="flex items-center gap-1">
				{lensOptions.map((lens) => {
					const Icon = LENS_ICONS[lens.mode];
					const isActive = lens.mode === mode;
					return (
						<Button
							key={lens.mode}
							variant={isActive ? 'secondary' : 'ghost'}
							size="sm"
							onClick={() => { setLensMode(lens.mode); }}
							className={cn(
								'h-7 px-2 gap-1',
								isActive && LENS_COLORS[lens.mode],
								className
							)}
							title={lens.description}
						>
							<Icon className="h-3.5 w-3.5" />
							{showLabel && <span className="text-xs">{lens.label}</span>}
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
					variant="outline"
					size="sm"
					className={cn(
						'h-8 gap-1.5 border-dashed',
						LENS_COLORS[mode],
						className
					)}
				>
					<CurrentIcon className="h-4 w-4" />
					{showLabel && (
						<>
							<span>{config.label} Mode</span>
							<ChevronDown className="h-3 w-3 opacity-50" />
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
					Select Lens Mode
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
								'flex items-center gap-2 cursor-pointer',
								isActive && 'bg-accent'
							)}
						>
							<Icon
								className={cn(
									'h-4 w-4',
									isActive ? 'opacity-100' : 'opacity-50'
								)}
							/>
							<div className="flex flex-col">
								<span className="font-medium">{lens.label}</span>
								<span className="text-xs text-muted-foreground">
									{lens.description}
								</span>
							</div>
							{isActive && <Check className="h-4 w-4 ml-auto" />}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<div className="px-2 py-1.5 text-xs text-muted-foreground">
					<p>Press Ctrl+1, Ctrl+2, Ctrl+3 to quickly switch</p>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

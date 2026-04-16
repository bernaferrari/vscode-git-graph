/**
 * What-If Preview Button
 * Quick preview for merge/rebase operations in the toolbar
 */

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	GitBranch,
	Merge,
	RotateCcw,
	Eye,
	ArrowRight,
	AlertTriangle,
	CheckCircle2,
	Clock,
	Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLensMode } from '@/components/lens';

interface WhatIfPreviewButtonProps {
	branch?: string;
	onPreviewMerge?: () => void;
	onPreviewRebase?: () => void;
	onPreviewSquash?: () => void;
	className?: string;
}

export function WhatIfPreviewButton({
	onPreviewMerge,
	onPreviewRebase,
	onPreviewSquash,
	className,
}: WhatIfPreviewButtonProps) {
	const { isGuided } = useLensMode();

	// In Guided mode, show a simple "Preview" button
	// In Craft/Control, show options
	if (isGuided) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn('gap-1.5', className)}
						onClick={onPreviewMerge}
					>
						<Eye className="h-4 w-4" />
						<span>Preview</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>See what will happen before making changes</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn('gap-1.5', className)}
				>
					<Eye className="h-4 w-4" />
					<span>Preview</span>
					<ArrowRight className="h-3 w-3 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
					Preview Operation
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem {...(onPreviewMerge ? { onClick: onPreviewMerge } : {})} className="gap-2">
					<Merge className="h-4 w-4 text-purple-500" />
					<div className="flex flex-col">
						<span>Merge</span>
						<span className="text-xs text-muted-foreground">
							Combine branches (keeps history)
						</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem {...(onPreviewRebase ? { onClick: onPreviewRebase } : {})} className="gap-2">
					<RotateCcw className="h-4 w-4 text-blue-500" />
					<div className="flex flex-col">
						<span>Rebase</span>
						<span className="text-xs text-muted-foreground">
							Put your work on top (rewrites)
						</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem {...(onPreviewSquash ? { onClick: onPreviewSquash } : {})} className="gap-2">
					<GitBranch className="h-4 w-4 text-amber-500" />
					<div className="flex flex-col">
						<span>Squash</span>
						<span className="text-xs text-muted-foreground">
							Combine commits into one
						</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="gap-2 text-muted-foreground">
					<Sparkles className="h-4 w-4" />
					<span>AI suggests best approach</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Compact inline preview indicator
export function PreviewIndicator({
	status,
	conflicts,
	willRewrite,
}: {
	status: 'idle' | 'previewing' | 'ready' | 'error';
	conflicts?: number;
	willRewrite?: boolean;
}) {
	if (status === 'idle') {
		return (
			<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Eye className="h-4 w-4" />
				<span>Click Preview to see results</span>
			</div>
		);
	}

	if (status === 'previewing') {
		return (
			<div className="flex items-center gap-1.5 text-sm text-blue-500">
				<Clock className="h-4 w-4 animate-pulse" />
				<span>Generating preview...</span>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<div className="flex items-center gap-1.5 text-sm text-red-500">
				<AlertTriangle className="h-4 w-4" />
				<span>Preview failed</span>
			</div>
		);
	}

	// Ready state
	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-1.5 text-sm text-green-600">
				<CheckCircle2 className="h-4 w-4" />
				<span>Ready to apply</span>
			</div>
			{conflicts !== undefined && conflicts > 0 && (
				<Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
					<AlertTriangle className="h-3 w-3" />
					{conflicts} conflict{conflicts !== 1 ? 's' : ''}
				</Badge>
			)}
			{willRewrite && (
				<Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
					<RotateCcw className="h-3 w-3" />
					Rewrites history
				</Badge>
			)}
		</div>
	);
}

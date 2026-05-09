/**
 * Status Indicators
 * Visual feedback for repository state
 */

import {
	GitBranch,
	Cloud,
	CloudOff,
	AlertCircle,
	CheckCircle2,
	ArrowUp,
	ArrowDown,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RepoStatusIndicatorProps {
	branch?: string;
	ahead?: number;
	behind?: number;
	hasStagedChanges?: boolean;
	hasUnstagedChanges?: boolean;
	hasConflicts?: boolean;
	isFetching?: boolean;
	isRebasing?: boolean;
	isMerging?: boolean;
	protectedBranch?: boolean;
	className?: string;
}

export function RepoStatusIndicator({
	branch,
	ahead = 0,
	behind = 0,
	hasStagedChanges = false,
	hasUnstagedChanges = false,
	hasConflicts = false,
	isFetching = false,
	isRebasing = false,
	isMerging = false,
	protectedBranch = false,
	className,
}: RepoStatusIndicatorProps) {
	const status = useMemo(() => {
		if (isRebasing) return { type: 'rebase', label: 'Rebasing', color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]', icon: RefreshCw };
		if (isMerging) return { type: 'merge', label: 'Merging', color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]', icon: RefreshCw };
		if (hasConflicts) return { type: 'conflict', label: 'Conflicts', color: 'text-destructive', icon: AlertCircle };
		if (isFetching) return { type: 'fetching', label: 'Fetching', color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]', icon: RefreshCw };
		if (behind > 0 && ahead > 0) return { type: 'diverged', label: `${String(behind)} behind, ${String(ahead)} ahead`, color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]', icon: ArrowUp };
		if (behind > 0) return { type: 'behind', label: `${String(behind)} behind`, color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]', icon: ArrowDown };
		if (ahead > 0) return { type: 'ahead', label: `${String(ahead)} ahead`, color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]', icon: ArrowUp };
		if (hasStagedChanges || hasUnstagedChanges) return { type: 'changes', label: 'Changes pending', color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]', icon: GitBranch };
		if (protectedBranch) return { type: 'protected', label: 'Protected', color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]', icon: ShieldCheck };
		return { type: 'clean', label: 'Up to date', color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]', icon: CheckCircle2 };
	}, [isRebasing, isMerging, hasConflicts, isFetching, behind, ahead, hasStagedChanges, hasUnstagedChanges, protectedBranch]);

	const StatusIcon = status.icon;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge
					variant="outline"
					className={cn(
						'gap-1.5 font-normal',
						status.color,
						className
					)}
				>
					<StatusIcon className={cn(
						'h-3.5 w-3.5',
						(isRebasing || isMerging || isFetching) && 'animate-spin'
					)} />
					<span className="text-xs">
						{status.type === 'clean' ? (
							<CheckCircle2 className="h-3 w-3" />
						) : branch ? (
							branch
						) : (
							status.label
						)}
					</span>
					{status.type === 'diverged' && (
						<>
							<ArrowDown className="h-3 w-3" />
							<span className="text-xs">{behind}</span>
							<ArrowUp className="h-3 w-3" />
							<span className="text-xs">{ahead}</span>
						</>
					)}
					{status.type === 'behind' && (
						<>
							<ArrowDown className="h-3 w-3" />
							<span className="text-xs">{behind}</span>
						</>
					)}
					{status.type === 'ahead' && (
						<>
							<ArrowUp className="h-3 w-3" />
							<span className="text-xs">{ahead}</span>
						</>
					)}
				</Badge>
			</TooltipTrigger>
			<TooltipContent>
				<p>{status.label}</p>
				{protectedBranch && (
					<p className="text-xs text-muted-foreground">This branch is protected</p>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

// Compact version for toolbar
export function CompactStatusIndicator({
	ahead = 0,
	behind = 0,
	hasStagedChanges = false,
	hasUnstagedChanges = false,
	hasConflicts = false,
	isFetching = false,
}: {
	ahead?: number;
	behind?: number;
	hasStagedChanges?: boolean;
	hasUnstagedChanges?: boolean;
	hasConflicts?: boolean;
	isFetching?: boolean;
}) {
	const hasChanges = hasStagedChanges || hasUnstagedChanges;

	if (isFetching) {
		return (
			<div className="flex items-center gap-1 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]">
				<RefreshCw className="h-3.5 w-3.5 animate-spin" />
				<span className="text-xs">Syncing...</span>
			</div>
		);
	}

	if (hasConflicts) {
		return (
			<div className="flex items-center gap-1 text-destructive">
				<AlertCircle className="h-3.5 w-3.5" />
				<span className="text-xs font-medium">Conflicts</span>
			</div>
		);
	}

	if (behind > 0) {
		return (
			<div className="flex items-center gap-1 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">
				<Cloud className="h-3.5 w-3.5" />
				<span className="text-xs">{behind} behind</span>
			</div>
		);
	}

	if (ahead > 0) {
		return (
			<div className="flex items-center gap-1 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">
				<Cloud className="h-3.5 w-3.5" />
				<span className="text-xs">{ahead} ahead</span>
			</div>
		);
	}

	if (hasChanges) {
		return (
			<div className="flex items-center gap-1 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]">
				<GitBranch className="h-3.5 w-3.5" />
				<span className="text-xs">Changes</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">
			<CloudOff className="h-3.5 w-3.5" />
			<span className="text-xs">Synced</span>
		</div>
	);
}

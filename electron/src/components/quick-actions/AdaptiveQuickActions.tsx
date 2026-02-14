/**
 * Adaptive Quick Actions Toolbar
 * Context-aware actions based on lens mode and current state
 */

import { useMemo } from 'react';
import { useLensMode, type LensMode } from '@/components/lens';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
	GitBranch,
	GitPullRequest,
	Merge,
	RotateCcw,
	Trash2,
	Edit,
	Eye,
	Share,
	Download,
	Upload,
	RefreshCw,
	Plus,
	MoreHorizontal,
	Sparkles,
	Keyboard,
	Terminal,
	Compass,
	Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
	id: string;
	label: string;
	icon: React.ElementType;
	action: () => void;
	badge?: string;
	priority: 'high' | 'medium' | 'low';
	requiresSelection?: boolean;
	lensModes: LensMode[];
}

interface AdaptiveQuickActionsProps {
	hasSelection: boolean;
	hasStagedChanges: boolean;
	hasUnstagedChanges: boolean;
	hasConflicts: boolean;
	currentBranch?: string;
	onAction: (actionId: string) => void;
	className?: string;
}

// Actions available in different contexts
const ACTIONS: Record<string, Omit<QuickAction, 'action'>> = {
	commit: {
		id: 'commit',
		label: 'Commit',
		icon: Edit,
		priority: 'high',
		lensModes: ['guided', 'craft', 'control'],
	},
	sync: {
		id: 'sync',
		label: 'Sync',
		icon: RefreshCw,
		priority: 'high',
		lensModes: ['guided'],
	},
	fetch: {
		id: 'fetch',
		label: 'Fetch',
		icon: Download,
		priority: 'medium',
		lensModes: ['craft', 'control'],
	},
	pull: {
		id: 'pull',
		label: 'Pull',
		icon: GitBranch,
		priority: 'medium',
		lensModes: ['craft', 'control'],
	},
	push: {
		id: 'push',
		label: 'Push',
		icon: Upload,
		priority: 'medium',
		lensModes: ['craft', 'control'],
	},
	pr: {
		id: 'pr',
		label: 'Create PR',
		icon: GitPullRequest,
		badge: 'NEW',
		priority: 'high',
		lensModes: ['guided', 'craft'],
	},
	merge: {
		id: 'merge',
		label: 'Merge',
		icon: Merge,
		priority: 'medium',
		lensModes: ['craft', 'control'],
	},
	rebase: {
		id: 'rebase',
		label: 'Rebase',
		icon: RotateCcw,
		priority: 'medium',
		lensModes: ['craft', 'control'],
	},
	ai: {
		id: 'ai',
		label: 'AI Assist',
		icon: Sparkles,
		badge: 'AI',
		priority: 'high',
		lensModes: ['craft', 'control'],
	},
	terminal: {
		id: 'terminal',
		label: 'Terminal',
		icon: Terminal,
		priority: 'low',
		lensModes: ['control'],
	},
	undo: {
		id: 'undo',
		label: 'Undo',
		icon: RotateCcw,
		priority: 'medium',
		lensModes: ['guided', 'craft'],
	},
	discard: {
		id: 'discard',
		label: 'Discard',
		icon: Trash2,
		priority: 'low',
		lensModes: ['control'],
	},
	view: {
		id: 'view',
		label: 'View',
		icon: Eye,
		priority: 'low',
		lensModes: ['guided'],
	},
};

export function AdaptiveQuickActions({
	hasSelection,
	hasStagedChanges,
	hasUnstagedChanges,
	hasConflicts,
	currentBranch,
	onAction,
	className,
}: AdaptiveQuickActionsProps) {
	const { mode, config, isGuided, isCraft, isControl } = useLensMode();

	// Filter and prioritize actions based on lens mode and state
	const availableActions = useMemo(() => {
		let filtered = Object.values(ACTIONS).filter((action) =>
			action.lensModes.includes(mode)
		);

		// Remove unavailable actions based on state
		filtered = filtered.filter((action) => {
			// If no staged changes, don't show commit
			if (action.id === 'commit' && !hasStagedChanges && !hasUnstagedChanges) {
				return false;
			}
			// If conflicts, only show conflict-related actions
			if (hasConflicts && !['commit', 'view'].includes(action.id)) {
				return false;
			}
			// If no selection, don't show selection-dependent actions
			if (!hasSelection && ['view'].includes(action.id)) {
				return false;
			}
			return true;
		});

		// Sort by priority
		const priorityOrder = { high: 0, medium: 1, low: 2 };
		filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

		return filtered;
	}, [mode, hasSelection, hasStagedChanges, hasUnstagedChanges, hasConflicts]);

	// Get lens-specific icon
	const getLensIcon = () => {
		if (isGuided) return Compass;
		if (isCraft) return Wand2;
		return Terminal;
	};

	const LensIcon = getLensIcon();

	return (
		<div className={cn('flex items-center gap-1', className)}>
			{/* Lens indicator */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
						<LensIcon className="h-4 w-4" />
						<span className="hidden sm:inline text-xs font-medium">{config.label}</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Current mode: {config.label}</p>
					<p className="text-xs text-muted-foreground">{config.description}</p>
				</TooltipContent>
			</Tooltip>

			<div className="h-5 w-px bg-border mx-1" />

			{/* Quick actions */}
			{availableActions.slice(0, isGuided ? 3 : 5).map((action) => {
				const ActionIcon = action.icon;
				return (
					<Tooltip key={action.id}>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 gap-1.5"
								onClick={() => onAction(action.id)}
								disabled={
									(action.id === 'commit' && !hasStagedChanges && !hasUnstagedChanges) ||
									(action.id === 'ai' && !hasStagedChanges)
								}
							>
								<ActionIcon className="h-4 w-4" />
								<span className="hidden sm:inline text-xs">{action.label}</span>
								{action.badge && (
									<Badge
										variant="secondary"
										className="h-4 px-1 text-[10px] font-medium"
									>
										{action.badge}
									</Badge>
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{action.label}</p>
							{hasConflicts && action.id !== 'commit' && (
								<p className="text-xs text-amber-500">Resolve conflicts first</p>
							)}
						</TooltipContent>
					</Tooltip>
				);
			})}

			{/* More actions dropdown for Craft/Control */}
			{(isCraft || isControl) && availableActions.length > 5 && (
				<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
					<MoreHorizontal className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}

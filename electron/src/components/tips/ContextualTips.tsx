/**
 * Contextual Help Tips
 * Shows helpful tips based on current state and lens mode
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLensMode } from '@/components/lens';
import { Lightbulb, X, ChevronRight, Sparkles, Keyboard, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tip {
	id: string;
	message: string;
	action?: string;
	icon: React.ElementType;
	lensModes: ('guided' | 'craft' | 'control')[];
	triggers?: {
		type: 'noChanges' | 'hasConflicts' | 'hasStash' | 'firstTime' | 'always';
	};
}

const TIPS: Tip[] = [
	{
		id: 'commit-changes',
		message: 'You have uncommitted changes. Stage and commit them to save your work.',
		action: 'Go to staging',
		icon: Lightbulb,
		lensModes: ['guided'],
		triggers: { type: 'noChanges' },
	},
	{
		id: 'resolve-conflicts',
		message: 'Merge conflicts detected. Resolve them before continuing.',
		action: 'Open conflict editor',
		icon: Sparkles,
		lensModes: ['guided', 'craft'],
		triggers: { type: 'hasConflicts' },
	},
	{
		id: 'use-stash',
		message: 'Stashed changes available. Apply or pop them to restore your work.',
		action: 'View stashes',
		icon: Lightbulb,
		lensModes: ['craft', 'control'],
		triggers: { type: 'hasStash' },
	},
	{
		id: 'keyboard-power',
		message: 'Press ? to see all keyboard shortcuts. Be a keyboard ninja!',
		icon: Keyboard,
		lensModes: ['craft'],
		triggers: { type: 'always' },
	},
	{
		id: 'safe-rebase',
		message: 'Rebasing rewrites history. Use with caution on shared branches.',
		icon: Shield,
		lensModes: ['control'],
		triggers: { type: 'always' },
	},
	{
		id: 'ai-assist',
		message: 'Try AI commit assistant to generate descriptive commit messages.',
		action: 'Generate message',
		icon: Sparkles,
		lensModes: ['craft', 'control'],
		triggers: { type: 'noChanges' },
	},
	{
		id: 'sync-shortcut',
		message: 'Press Ctrl+S to sync (fetch + pull) in one click.',
		icon: Zap,
		lensModes: ['guided'],
		triggers: { type: 'always' },
	},
];

interface ContextualTipsProps {
	onAction?: (tipId: string) => void;
	hasChanges?: boolean;
	hasConflicts?: boolean;
	hasStash?: boolean;
	className?: string;
}

export function ContextualTips({
	onAction,
	hasChanges = false,
	hasConflicts = false,
	hasStash = false,
	className,
}: ContextualTipsProps) {
	const { mode } = useLensMode();
	const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
	const [currentTip, setCurrentTip] = useState<Tip | null>(null);

	useEffect(() => {
		// Find applicable tips for current lens mode and state
		const applicableTips = TIPS.filter((tip) => {
			if (!tip.lensModes.includes(mode)) return false;
			if (dismissedTips.has(tip.id)) return false;

			if (tip.triggers) {
				switch (tip.triggers.type) {
					case 'noChanges':
						return !hasChanges;
					case 'hasConflicts':
						return hasConflicts;
					case 'hasStash':
						return hasStash;
					case 'always':
						return true;
					default:
						return false;
				}
			}
			return false;
		});

		// Pick a random tip from applicable ones
		if (applicableTips.length > 0) {
			const randomIndex = Math.floor(Math.random() * applicableTips.length);
			setCurrentTip(applicableTips[randomIndex]);
		} else {
			setCurrentTip(null);
		}
	}, [mode, hasChanges, hasConflicts, hasStash, dismissedTips]);

	const handleDismiss = () => {
		if (currentTip) {
			setDismissedTips((prev) => new Set([...prev, currentTip.id]));
		}
	};

	const handleAction = () => {
		if (currentTip && onAction) {
			onAction(currentTip.id);
		}
	};

	if (!currentTip) return null;

	const Icon = currentTip.icon;

	return (
		<Card className={cn('bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', className)}>
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<div className="flex items-center gap-2">
					<Icon className="h-4 w-4 text-amber-600" />
					<CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
						Tip
					</CardTitle>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleDismiss}
					className="h-6 w-6 p-0 text-amber-700"
				>
					<X className="h-3 w-3" />
				</Button>
			</CardHeader>
			<CardContent className="pt-0">
				<p className="text-sm text-amber-800 dark:text-amber-200">
					{currentTip.message}
				</p>
				{currentTip.action && (
					<Button
						variant="link"
						size="sm"
						onClick={handleAction}
						className="h-6 px-0 text-amber-700 mt-1"
					>
						{currentTip.action}
						<ChevronRight className="h-3 w-3 ml-1" />
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// Compact inline version for toolbar
export function InlineTip({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
	return (
		<div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
			<Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
			<span className="text-xs text-amber-900 dark:text-amber-100 flex-1">{message}</span>
			{onDismiss && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onDismiss}
					className="h-5 w-5 p-0 text-amber-700"
				>
					<X className="h-3 w-3" />
				</Button>
			)}
		</div>
	);
}

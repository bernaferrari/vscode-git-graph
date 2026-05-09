/**
 * Contextual Help Tips
 * Shows helpful tips based on current state and lens mode
 */

import { Lightbulb, X, ChevronRight, Sparkles, Keyboard, Shield, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

import { useLensMode } from '@/components/lens';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
				setCurrentTip(applicableTips[randomIndex] ?? null);
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
		<Card className={cn('bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)] border-[color-mix(in_oklch,var(--warning)_35%,transparent)] dark:border-[color-mix(in_oklch,var(--warning)_35%,transparent)]', className)}>
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<div className="flex items-center gap-2">
					<Icon className="h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]" />
					<CardTitle className="text-sm font-medium text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">
						Tip
					</CardTitle>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleDismiss}
					className="h-6 w-6 p-0 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]"
				>
					<X className="h-3 w-3" />
				</Button>
			</CardHeader>
			<CardContent className="pt-0">
				<p className="text-sm text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">
					{currentTip.message}
				</p>
				{currentTip.action && (
					<Button
						variant="link"
						size="sm"
						onClick={handleAction}
						className="h-6 px-0 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] mt-1"
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
		<div className="flex items-center gap-2 px-3 py-1.5 bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)] rounded-md border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] dark:border-[color-mix(in_oklch,var(--warning)_35%,transparent)]">
			<Lightbulb className="h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] shrink-0" />
			<span className="text-xs text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] flex-1">{message}</span>
			{onDismiss && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onDismiss}
					className="h-5 w-5 p-0 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]"
				>
					<X className="h-3 w-3" />
				</Button>
			)}
		</div>
	);
}

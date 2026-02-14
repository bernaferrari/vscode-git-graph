/**
 * Lens Mode Onboarding
 * Explains the lens system to new users
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Compass,
	Wand2,
	Terminal,
	ArrowRight,
	Check,
	Sparkles,
	Keyboard,
	Shield,
	Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLensMode, type LensMode } from '@/components/lens';

interface LensOnboardingProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const LENS_DETAILS = [
	{
		mode: 'guided' as LensMode,
		icon: Compass,
		title: 'Guided Mode',
		subtitle: 'Safe & Simple',
		color: 'text-green-500',
		bgColor: 'bg-green-500/10',
		borderColor: 'border-green-500/30',
		features: [
			{ icon: Shield, text: 'Safety first - previews show what will happen' },
			{ icon: Sparkles, text: 'Simple "Sync" button for fetch + pull + push' },
			{ icon: ArrowRight, text: 'Clear guidance on next best actions' },
			{ icon: Check, text: 'One-click undo for any operation' },
		],
		bestFor: 'New Git users, safe exploration, code review focus',
	},
	{
		mode: 'craft' as LensMode,
		icon: Wand2,
		title: 'Craft Mode',
		subtitle: 'Balanced Power',
		color: 'text-blue-500',
		bgColor: 'bg-blue-500/10',
		borderColor: 'border-blue-500/30',
		features: [
			{ icon: Zap, text: 'Keyboard-first workflow with shortcuts' },
			{ icon: ArrowRight, text: 'Full staging granularity (hunks, lines)' },
			{ icon: Keyboard, text: 'Command palette for everything' },
			{ icon: Check, text: 'Advanced operations when you need them' },
		],
		bestFor: 'Daily development, power users, efficient workflows',
	},
	{
		mode: 'control' as LensMode,
		icon: Terminal,
		title: 'Control Mode',
		subtitle: 'Full Power',
		color: 'text-purple-500',
		bgColor: 'bg-purple-500/10',
		borderColor: 'border-purple-500/30',
		features: [
			{ icon: Terminal, text: 'See raw Git commands as they run' },
			{ icon: Zap, text: 'Full access to advanced Git operations' },
			{ icon: Keyboard, text: 'Custom keybindings support' },
			{ icon: Check, text: 'Reflog, bisect, and expert tools visible' },
		],
		bestFor: 'Maintainers, release engineers, complex workflows',
	},
];

export function LensOnboarding({ open, onOpenChange }: LensOnboardingProps) {
	const { mode, setLensMode } = useLensMode();
	const [selectedLens, setSelectedLens] = useState<LensMode>(mode);

	const handleConfirm = () => {
		setLensMode(selectedLens);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<Sparkles className="h-5 w-5 text-amber-500" />
						Choose Your Experience
					</DialogTitle>
					<DialogDescription className="text-base">
						Git Graph adapts to your skill level. Select the mode that fits you best - you can always change it later.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
					{LENS_DETAILS.map((lens) => {
						const Icon = lens.icon;
						const isSelected = selectedLens === lens.mode;
						
						return (
							<button
								key={lens.mode}
								onClick={() => setSelectedLens(lens.mode)}
								className={cn(
									'relative flex flex-col p-4 rounded-xl border-2 transition-all text-left',
									lens.borderColor,
									lens.bgColor,
									isSelected ? 'ring-2 ring-offset-2 ring-primary' : 'hover:opacity-80'
								)}
							>
								{isSelected && (
									<div className="absolute top-2 right-2">
										<Check className={cn('h-5 w-5', lens.color)} />
									</div>
								)}
								
								<div className={cn('mb-3', lens.color)}>
									<Icon className="h-8 w-8" />
								</div>
								
								<h3 className="font-semibold text-lg">{lens.title}</h3>
								<p className={cn('text-sm font-medium mb-3', lens.color)}>
									{lens.subtitle}
								</p>
								
								<ul className="space-y-2 flex-1">
									{lens.features.map((feature, i) => {
										const FeatureIcon = feature.icon;
										return (
											<li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
												<FeatureIcon className="h-4 w-4 mt-0.5 shrink-0" />
												<span>{feature.text}</span>
											</li>
										);
									})}
								</ul>
								
								<div className="mt-4 pt-3 border-t">
									<p className="text-xs text-muted-foreground">
										<strong>Best for:</strong> {lens.bestFor}
									</p>
								</div>
							</button>
						);
					})}
				</div>

				<div className="bg-muted rounded-lg p-4 mt-2">
					<p className="text-sm text-muted-foreground flex items-center gap-2">
						<Keyboard className="h-4 w-4" />
						<span>
							<strong>Quick switch:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-background border text-xs">Ctrl+1</kbd> for Guided,{' '}
							<kbd className="px-1.5 py-0.5 rounded bg-background border text-xs">Ctrl+2</kbd> for Craft,{' '}
							<kbd className="px-1.5 py-0.5 rounded bg-background border text-xs">Ctrl+3</kbd> for Control
						</span>
					</p>
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Skip for now
					</Button>
					<Button onClick={handleConfirm}>
						Start with {LENS_DETAILS.find(l => l.mode === selectedLens)?.title}
						<ArrowRight className="h-4 w-4 ml-2" />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Hook to manage lens onboarding state
export function useLensOnboarding() {
	const [showOnboarding, setShowOnboarding] = useState(false);
	const { settings } = useSettings();

	useEffect(() => {
		// Show onboarding if user hasn't selected a preferred lens yet
		// and this is first run or they've been using default
		const hasSeenOnboarding = localStorage.getItem('git-graph-lens-onboarding-seen');
		if (!hasSeenOnboarding) {
			setShowOnboarding(true);
			localStorage.setItem('git-graph-lens-onboarding-seen', 'true');
		}
	}, []);

	const dismissOnboarding = () => {
		setShowOnboarding(false);
	};

	return {
		showOnboarding,
		dismissOnboarding,
		LensOnboardingDialog: () => (
			<LensOnboarding open={showOnboarding} onOpenChange={setShowOnboarding} />
		),
	};
}

// Import useSettings from settings-dialog
import { useSettings } from './settings-dialog';

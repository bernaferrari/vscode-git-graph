/**
 * Onboarding Tour
 * First-time user walkthrough highlighting key features
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OnboardingStep {
	id: string;
	title: string;
	description: string;
	target?: string;
	position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		id: 'welcome',
		title: 'Welcome to Git Graph! 👋',
		description: 'This is a powerful Git client with a visual commit graph. Let\'s take a quick tour to help you get started.',
	},
	{
		id: 'graph',
		title: 'Commit Graph',
		description: 'The main view shows your commit history as an interactive graph. Click on commits to see details, right-click for actions.',
		target: '[data-tour="commit-graph"]',
		position: 'right',
	},
	{
		id: 'branches',
		title: 'Branch Management',
		description: 'Switch branches, create new ones, and see which branch you\'re on. Branches are shown with different colors in the graph.',
		target: '[data-tour="branch-dropdown"]',
		position: 'bottom',
	},
	{
		id: 'actions',
		title: 'Git Actions',
		description: 'Push, pull, fetch, merge, rebase, and more - all your Git operations are available from the toolbar and context menus.',
		target: '[data-tour="actions-bar"]',
		position: 'bottom',
	},
	{
		id: 'command-palette',
		title: 'Command Palette ⌘K',
		description: 'Press ⌘K (or Ctrl+K) to open the command palette for quick access to all actions without leaving your keyboard.',
	},
	{
		id: 'context-menu',
		title: 'Right-Click Everything',
		description: 'Right-click on commits, branches, and tags to see context-sensitive actions like checkout, merge, rebase, delete, etc.',
	},
	{
		id: 'stash',
		title: 'Stash Your Changes',
		description: 'Need to switch branches but have uncommitted work? Use the stash panel to save and restore your changes.',
		target: '[data-tour="stash-panel"]',
		position: 'left',
	},
	{
		id: 'conflicts',
		title: 'Merge Conflicts',
		description: 'When conflicts occur, you\'ll see a visual merge editor to pick changes line-by-line from each side.',
	},
	{
		id: 'shortcuts',
		title: 'Keyboard Shortcuts',
		description: 'Press ? to see all keyboard shortcuts. Power users can do everything without touching the mouse!',
	},
	{
		id: 'done',
		title: 'You\'re All Set! 🎉',
		description: 'You\'re ready to use Git Graph like a pro. If you need help, check the Settings menu or press ? for shortcuts.',
	},
];

const ONBOARDING_KEY = 'git-graph-onboarding-completed';

interface OnboardingTourProps {
	onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		// Check if onboarding was completed
		const completed = localStorage.getItem(ONBOARDING_KEY);
		if (!completed) {
			setIsVisible(true);
		}
	}, []);

	const handleNext = () => {
		if (currentStep < ONBOARDING_STEPS.length - 1) {
			setCurrentStep((prev) => prev + 1);
		} else {
			handleComplete();
		}
	};

	const handlePrevious = () => {
		if (currentStep > 0) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleSkip = () => {
		handleComplete();
	};

	const handleComplete = () => {
		localStorage.setItem(ONBOARDING_KEY, 'true');
		setIsVisible(false);
		onComplete();
	};

	if (!isVisible) return null;

	const step = ONBOARDING_STEPS[currentStep];
	if (!step) return null;
	
	const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 z-50 bg-black/55" onClick={handleSkip} />

			{/* Tour card */}
			<div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
				<Card className="shadow-2xl ui-surface">
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">
								Step {currentStep + 1} of {ONBOARDING_STEPS.length}
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={handleSkip}
							>
								Skip tour
							</Button>
						</div>
						<Progress value={progress} className="h-1" />
						<CardTitle className="text-lg pt-2">{step.title}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">{step.description}</p>
					</CardContent>
					<CardFooter className="justify-between">
						<Button
							variant="ghost"
							onClick={handlePrevious}
							disabled={currentStep === 0}
						>
							Previous
						</Button>
						<Button onClick={handleNext}>
							{currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
						</Button>
					</CardFooter>
				</Card>
			</div>
		</>
	);
}

/**
 * Hook to check and manage onboarding state
 */
export function useOnboarding() {
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);

	useEffect(() => {
		const completed = localStorage.getItem(ONBOARDING_KEY);
		setIsCompleted(!!completed);
		setShowOnboarding(!completed);
	}, []);

	const completeOnboarding = () => {
		localStorage.setItem(ONBOARDING_KEY, 'true');
		setIsCompleted(true);
		setShowOnboarding(false);
	};

	const resetOnboarding = () => {
		localStorage.removeItem(ONBOARDING_KEY);
		setIsCompleted(false);
		setShowOnboarding(true);
	};

	return {
		showOnboarding,
		setShowOnboarding,
		isCompleted,
		completeOnboarding,
		resetOnboarding,
	};
}

/**
 * Restart onboarding button for settings
 */
export function RestartOnboardingButton() {
	const { resetOnboarding } = useOnboarding();

	return (
		<Button variant="outline" size="sm" onClick={resetOnboarding}>
			Restart Onboarding Tour
		</Button>
	);
}

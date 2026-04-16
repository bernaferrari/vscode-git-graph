/**
 * Onboarding Component
 * Welcome guide for new users
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	CheckCircle2,
	ChevronRight,
	ChevronLeft,
	GitBranch,
	GitCommit,
	GitPullRequest,
	Settings,
	Keyboard,
	FolderOpen,
	Terminal,
	Search,
	Sparkles,
} from 'lucide-react';
import { trpc } from '@/trpc/client';

interface OnboardingStep {
	id: string;
	title: string;
	description: string;
	icon: React.ReactNode;
	content: React.ReactNode;
}

export function OnboardingDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [currentStep, setCurrentStep] = useState(0);
    const utils = trpc.useUtils();
    const setOnboardingStateMutation = trpc.config.setOnboardingState.useMutation({
        onSuccess: async () => {
            await utils.config.onboardingState.invalidate();
        },
    });

	const steps: OnboardingStep[] = [
		{
			id: 'welcome',
			title: 'Welcome to Git Graph',
			description: 'A beautiful, powerful Git client',
			icon: <Sparkles className="h-8 w-8" />,
			content: (
				<div className="space-y-4 text-center">
					<p className="text-lg">
						Git Graph helps you visualize and manage your Git repositories with ease.
					</p>
					<p className="text-muted-foreground">
						Let's take a quick tour of the key features.
					</p>
				</div>
			),
		},
		{
			id: 'graph',
			title: 'Commit Graph',
			description: 'Visualize your history',
			icon: <GitBranch className="h-8 w-8" />,
			content: (
				<div className="space-y-4">
					<p>
						The commit graph shows your repository's history with branches, merges, and tags.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Click commits to see details
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Right-click for context actions
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Use filters to find commits
						</li>
					</ul>
				</div>
			),
		},
		{
			id: 'commit',
			title: 'Staging & Committing',
			description: 'Stage and commit changes',
			icon: <GitCommit className="h-8 w-8" />,
			content: (
				<div className="space-y-4">
					<p>
						Stage individual lines or hunks, write commit messages, and commit with ease.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Stage by line, hunk, or file
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Inline diff preview
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Commit templates available
						</li>
					</ul>
				</div>
			),
		},
		{
			id: 'branches',
			title: 'Branch Operations',
			description: 'Manage branches easily',
			icon: <GitPullRequest className="h-8 w-8" />,
			content: (
				<div className="space-y-4">
					<p>
						Create, merge, rebase, and compare branches with visual tools.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Drag commits to branches
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Visual merge conflict editor
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-500" />
							Git Flow automation
						</li>
					</ul>
				</div>
			),
		},
		{
			id: 'keyboard',
			title: 'Keyboard Shortcuts',
			description: 'Work faster with shortcuts',
			icon: <Keyboard className="h-8 w-8" />,
			content: (
				<div className="space-y-4">
					<p>
						Git Graph is designed for keyboard efficiency.
					</p>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div className="flex justify-between">
							<span>Command Palette</span>
							<kbd className="ui-kbd">⌘⇧P</kbd>
						</div>
						<div className="flex justify-between">
							<span>Find</span>
							<kbd className="ui-kbd">⌘F</kbd>
						</div>
						<div className="flex justify-between">
							<span>Create Branch</span>
							<kbd className="ui-kbd">⌘B</kbd>
						</div>
						<div className="flex justify-between">
							<span>Commit</span>
							<kbd className="ui-kbd">⌘⏎</kbd>
						</div>
						<div className="flex justify-between">
							<span>Push</span>
							<kbd className="ui-kbd">⌘P</kbd>
						</div>
						<div className="flex justify-between">
							<span>Pull</span>
							<kbd className="ui-kbd">⌘⇧P</kbd>
						</div>
					</div>
				</div>
			),
		},
		{
			id: 'tools',
			title: 'Powerful Tools',
			description: 'Advanced features at your fingertips',
			icon: <Terminal className="h-8 w-8" />,
			content: (
				<div className="space-y-4">
					<p>
						Git Graph includes powerful tools for advanced workflows.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<Search className="h-4 w-4" />
							Search across all commits
						</li>
						<li className="flex items-center gap-2">
							<FolderOpen className="h-4 w-4" />
							Worktrees & Submodules
						</li>
						<li className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Git Configuration Editor
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4" />
							Real Undo Stack
						</li>
					</ul>
				</div>
			),
		},
	];

	const handleNext = () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep(currentStep + 1);
		} else {
			completeOnboarding();
		}
	};

	const handlePrevious = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	};

	const completeOnboarding = () => {
		setOnboardingStateMutation.mutate({ gitGraphCompleted: true });
		onOpenChange(false);
	};

	const handleSkip = () => {
		completeOnboarding();
	};

	const step = steps[currentStep] ?? steps[0];
	if (!step) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{step.icon}
							{step.title}
						</div>
						<Button variant="ghost" size="sm" onClick={handleSkip}>
							Skip
						</Button>
					</DialogTitle>
				</DialogHeader>

				<div className="py-4">
					<p className="text-muted-foreground mb-4">{step.description}</p>
					{step.content}
				</div>

				{/* Progress dots */}
				<div className="flex items-center justify-center gap-2 mb-4">
					{steps.map((_, i) => (
						<div
							key={i}
							className={`h-2 w-2 rounded-full transition-colors ${
								i === currentStep ? 'bg-primary' : 'bg-muted'
							}`}
						/>
					))}
				</div>

				{/* Navigation */}
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						onClick={handlePrevious}
						disabled={currentStep === 0}
					>
						<ChevronLeft className="h-4 w-4 mr-1" />
						Back
					</Button>
					<Button onClick={handleNext}>
						{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
						{currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Hook to check if onboarding should be shown
export function useOnboarding() {
	const [shouldShow, setShouldShow] = useState(false);
    const onboardingQuery = trpc.config.onboardingState.useQuery(undefined, { staleTime: 10_000 });
    const utils = trpc.useUtils();
    const setOnboardingStateMutation = trpc.config.setOnboardingState.useMutation({
        onSuccess: async () => {
            await utils.config.onboardingState.invalidate();
        },
    });

	useEffect(() => {
		setShouldShow(!onboardingQuery.data?.state.gitGraphCompleted);
	}, [onboardingQuery.data?.state.gitGraphCompleted]);

	const completeOnboarding = () => {
		setOnboardingStateMutation.mutate({ gitGraphCompleted: true });
		setShouldShow(false);
	};

	return { shouldShow, completeOnboarding };
}

export default OnboardingDialog;

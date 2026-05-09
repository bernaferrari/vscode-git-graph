/**
 * Onboarding Component
 * Welcome guide for new users
 */

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
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
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
			description: 'A review-first Git client',
			icon: <Sparkles className="h-8 w-8" />,
			content: (
				<div className="space-y-4 text-center">
					<p className="text-lg">
						Git Graph keeps branch state, local changes, and commit review in one shell.
					</p>
					<p className="text-muted-foreground">
						This tour focuses on the flows you will use every day.
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
						The graph is the primary navigation surface for branch state, merge history, and commit selection.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Select commits to open review details and file-level patches
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Use the side panel to inspect branch tracking, publish status, and stashes
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Search and filter when the visible graph gets noisy
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
						Stage individual lines or hunks, review local diffs, then commit without leaving the main shell.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Stage by line, hunk, or file
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Quick review of staged versus unstaged files before you commit
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Commit templates and signing are built in
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
						Create, publish, rename, compare, and recover branches with a safer default workflow.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Publish and track upstream branches without dropping to the terminal
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Use force-with-lease for rewrite-history pushes
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							Create a branch from a stash when recovery is safer than re-applying in place
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
						The shell is designed around a small set of reliable shortcuts.
					</p>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div className="flex justify-between">
							<span>Fuzzy Finder</span>
							<kbd className="ui-kbd">⌘K</kbd>
						</div>
						<div className="flex justify-between">
							<span>Command Palette</span>
							<kbd className="ui-kbd">⌘⇧P</kbd>
						</div>
						<div className="flex justify-between">
							<span>Commit Search</span>
							<kbd className="ui-kbd">⌘⇧F</kbd>
						</div>
						<div className="flex justify-between">
							<span>Find in View</span>
							<kbd className="ui-kbd">⌘F</kbd>
						</div>
						<div className="flex justify-between">
							<span>Create Branch</span>
							<kbd className="ui-kbd">⌘B</kbd>
						</div>
						<div className="flex justify-between">
							<span>Settings</span>
							<kbd className="ui-kbd">⌘,</kbd>
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
						Advanced tools stay available, but they stay secondary until you need them.
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<Search className="h-4 w-4" />
							Search across all commits and jump straight to the result
						</li>
						<li className="flex items-center gap-2">
							<FolderOpen className="h-4 w-4" />
							Worktrees, submodules, and stash recovery
						</li>
						<li className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Diagnostics, repo policy, and Git configuration
						</li>
						<li className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4" />
							Undo stack and safer action previews for risky operations
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
// eslint-disable-next-line react-refresh/only-export-components
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

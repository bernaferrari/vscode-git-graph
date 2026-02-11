/**
 * Welcome Screen
 * Displayed when no repository is open
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	FolderGit2,
	Github,
	GitBranch,
	Plus,
	Star,
	Keyboard,
	Zap,
	Shield,
	GitPullRequest,
	Archive,
	Search,
	Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface WelcomeScreenProps {
	onOpenRepo: () => void;
}

export function WelcomeScreen({ onOpenRepo }: WelcomeScreenProps) {
	const { activeRepo, setActiveRepo } = useAppStore();
	const [isLoading, setIsLoading] = useState(false);

	// Clone repo mutation (placeholder)
	const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();

	const handleClone = async () => {
		// For now, just open the folder dialog
		// In a full implementation, this would show a clone dialog
		try {
			setIsLoading(true);
			const result = await showOpenDialog({
				title: 'Clone Repository',
				properties: ['openDirectory'],
			});
			if (result.filePaths && result.filePaths.length > 0) {
				setActiveRepo(result.filePaths[0]);
			}
		} catch (error) {
			toast.error('Failed to clone repository');
		} finally {
			setIsLoading(false);
		}
	};

	const features = [
		{
			icon: <GitBranch className="h-5 w-5" />,
			title: 'Visual Graph',
			description: 'See your commit history as an interactive graph',
		},
		{
			icon: <GitPullRequest className="h-5 w-5" />,
			title: 'Pull Requests',
			description: 'Create and manage PRs directly from the app',
		},
		{
			icon: <Archive className="h-5 w-5" />,
			title: 'Stash Management',
			description: 'Easy stash, pop, and apply operations',
		},
		{
			icon: <Search className="h-5 w-5" />,
			title: 'Full-Text Search',
			description: 'Search across all commits instantly',
		},
		{
			icon: <Keyboard className="h-5 w-5" />,
			title: 'Keyboard Shortcuts',
			description: 'Navigate and act without leaving the keyboard',
		},
		{
			icon: <Shield className="h-5 w-5" />,
			title: 'Commit Signing',
			description: 'Sign commits with GPG or SSH keys',
		},
	];

	const quickStarts = [
		{
			icon: <FolderGit2 className="h-8 w-8" />,
			title: 'Open Repository',
			description: 'Open an existing Git repository on your computer',
			action: onOpenRepo,
			primary: true,
		},
		{
			icon: <Github className="h-8 w-8" />,
			title: 'Clone Repository',
			description: 'Clone a repository from a remote URL',
			action: handleClone,
			primary: false,
		},
	];

	return (
		<div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-8 overflow-auto">
			<div className="max-w-4xl w-full space-y-8">
				{/* Hero */}
				<div className="text-center space-y-4">
					<div className="flex items-center justify-center gap-3 mb-4">
						<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
							<GitBranch className="h-8 w-8 text-primary-foreground" />
						</div>
					</div>
					<h1 className="text-4xl font-bold tracking-tight">
						Welcome to Git Graph
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						A powerful, GitKraken-style Git client for visualizing and managing your repositories.
					</p>
				</div>

				{/* Quick Start */}
				<div className="grid md:grid-cols-2 gap-4">
					{quickStarts.map((item, index) => (
						<Card
							key={index}
							className={`cursor-pointer transition-all hover:shadow-lg ${
								item.primary
									? 'border-primary/50 hover:border-primary'
									: 'hover:border-muted-foreground/30'
							}`}
							onClick={item.action}
						>
							<CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
								<div className={`p-2 rounded-lg ${item.primary ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
									{item.icon}
								</div>
								<div className="flex-1">
									<CardTitle className="text-lg">{item.title}</CardTitle>
									<CardDescription>{item.description}</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="pt-0">
								<Button
									variant={item.primary ? 'default' : 'outline'}
									className="w-full"
									disabled={isLoading}
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Plus className="h-4 w-4 mr-2" />
									)}
									{item.title}
								</Button>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Features */}
				<div className="space-y-4">
					<h2 className="text-xl font-semibold text-center">Features</h2>
					<div className="grid md:grid-cols-3 gap-4">
						{features.map((feature, index) => (
							<div
								key={index}
								className="flex items-start gap-3 p-4 rounded-lg border bg-card"
							>
								<div className="p-2 rounded-lg bg-muted shrink-0">
									{feature.icon}
								</div>
								<div>
									<h3 className="font-medium text-sm">{feature.title}</h3>
									<p className="text-xs text-muted-foreground mt-1">
										{feature.description}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Keyboard shortcut hint */}
				<div className="text-center text-sm text-muted-foreground">
					<p>
						Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">?</kbd> for keyboard shortcuts or{' '}
						<kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘K</kbd> to open the fuzzy finder
					</p>
				</div>
			</div>
		</div>
	);
}

export default WelcomeScreen;

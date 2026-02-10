/**
 * Empty States
 * Helpful guidance when nothing to show
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FolderGit2, GitBranch, GitMerge, GitPullRequest, History, Archive, Tag } from 'lucide-react';

interface EmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	description: string;
	action?: {
		label: string;
		onClick: () => void;
	} | undefined;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center justify-center py-12 text-center">
				{icon && (
					<div className="mb-4 text-muted-foreground">{icon}</div>
				)}
				<h3 className="font-medium text-lg mb-1">{title}</h3>
				<p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
				{action && (
					<Button onClick={action.onClick}>{action.label}</Button>
				)}
			</CardContent>
		</Card>
	);
}

// Specific empty states

export function NoRepoSelected({ onSelectRepo }: { onSelectRepo: () => void }) {
	return (
		<EmptyState
			icon={<FolderGit2 className="h-12 w-12" />}
			title="No Repository Selected"
			description="Open a Git repository to view its commit history and manage your code."
			action={{ label: 'Open Repository', onClick: onSelectRepo }}
		/>
	);
}

export function NoCommits({ onCommit }: { onCommit?: () => void }) {
	return (
		<EmptyState
			icon={<History className="h-12 w-12" />}
			title="No Commits Yet"
			description="This repository doesn't have any commits. Make your first commit to get started!"
			action={onCommit ? { label: 'Create Initial Commit', onClick: onCommit } : undefined}
		/>
	);
}

export function NoBranches({ onCreateBranch }: { onCreateBranch: () => void }) {
	return (
		<EmptyState
			icon={<GitBranch className="h-12 w-12" />}
			title="No Branches"
			description="Create a branch to start working on a new feature or fix."
			action={{ label: 'Create Branch', onClick: onCreateBranch }}
		/>
	);
}

export function NoStashes({ onStash }: { onStash?: () => void }) {
	return (
		<EmptyState
			icon={<Archive className="h-12 w-12" />}
			title="No Stashes"
			description="Stashes let you save your work temporarily. You don't have any saved stashes yet."
			action={onStash ? { label: 'Stash Changes', onClick: onStash } : undefined}
		/>
	);
}

export function NoTags({ onCreateTag }: { onCreateTag?: () => void }) {
	return (
		<EmptyState
			icon={<Tag className="h-12 w-12" />}
			title="No Tags"
			description="Tags mark important points in history like releases. Create one to mark a version."
			action={onCreateTag ? { label: 'Create Tag', onClick: onCreateTag } : undefined}
		/>
	);
}

export function NoRemotes({ onAddRemote }: { onAddRemote?: () => void }) {
	return (
		<EmptyState
			icon={<GitPullRequest className="h-12 w-12" />}
			title="No Remotes"
			description="Add a remote repository to push and pull changes with others."
			action={onAddRemote ? { label: 'Add Remote', onClick: onAddRemote } : undefined}
		/>
	);
}

export function NoMergeConflicts() {
	return (
		<EmptyState
			icon={<GitMerge className="h-12 w-12" />}
			title="No Conflicts"
			description="Great! There are no merge conflicts to resolve. Your code merged cleanly."
		/>
	);
}

export function NoSearchResults({ query }: { query: string }) {
	return (
		<EmptyState
			title="No Results"
			description={`No commits found matching "${query}". Try a different search term.`}
		/>
	);
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
				<p className="text-sm text-muted-foreground">{message}</p>
			</CardContent>
		</Card>
	);
}

export function ErrorState({ 
	title = 'Something went wrong',
	error,
	onRetry 
}: { 
	title?: string; 
	error?: string; 
	onRetry?: () => void;
}) {
	return (
		<Card className="border-dashed border-destructive">
			<CardContent className="flex flex-col items-center justify-center py-12 text-center">
				<div className="mb-4 text-destructive">
					<svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
						/>
					</svg>
				</div>
				<h3 className="font-medium text-lg mb-1">{title}</h3>
				{error && <p className="text-sm text-muted-foreground mb-4">{error}</p>}
				{onRetry && <Button variant="outline" onClick={onRetry}>Try Again</Button>}
			</CardContent>
		</Card>
	);
}

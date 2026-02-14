/**
 * Empty States & Loading
 * Helpful guidance when nothing to show + skeleton screens
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	FolderGit2,
	GitBranch,
	GitMerge,
	GitPullRequest,
	History,
	Archive,
	Tag,
	Search,
	GitCommit,
	AlertCircle,
	RefreshCw,
} from 'lucide-react';
import React from 'react';

// Skeleton components for loading states

export function CommitListSkeleton({ count = 10 }: { count?: number }) {
	return (
		<div className="space-y-0">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-transparent animate-pulse">
					<div className="h-8 w-8 rounded-full bg-muted" />
					<div className="flex-1 space-y-1">
						<div className="h-4 w-3/4 bg-muted rounded" />
						<div className="h-3 w-1/2 bg-muted rounded" />
					</div>
					<div className="h-4 w-20 bg-muted rounded" />
				</div>
			))}
		</div>
	);
}

export function BranchListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div className="space-y-1 p-2">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-center gap-2 px-2 py-1 animate-pulse">
					<div className="h-3.5 w-3.5 rounded-full bg-muted" />
					<div className="h-4 flex-1 bg-muted rounded" />
				</div>
			))}
		</div>
	);
}

export function GraphSkeleton() {
	return (
		<div className="flex flex-col items-center justify-center h-full py-20">
			<div className="relative w-20 h-20">
				<div className="absolute inset-0 border-4 border-muted rounded-full animate-ping opacity-25" />
				<div className="absolute inset-2 border-4 border-primary/30 rounded-full animate-pulse" />
				<GitCommit className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
			</div>
			<p className="mt-4 text-sm text-muted-foreground animate-pulse">Loading commits...</p>
		</div>
	);
}

export function DetailsSkeleton() {
	return (
		<div className="p-4 space-y-4 animate-pulse">
			<div className="flex items-center gap-3">
				<div className="h-10 w-10 rounded-full bg-muted" />
				<div className="space-y-2 flex-1">
					<div className="h-4 w-32 bg-muted rounded" />
					<div className="h-3 w-48 bg-muted rounded" />
				</div>
			</div>
			<div className="h-20 w-full bg-muted rounded" />
			<div className="space-y-2">
				<div className="h-4 w-full bg-muted rounded" />
				<div className="h-4 w-3/4 bg-muted rounded" />
			</div>
		</div>
	);
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
	return (
		<div className="p-4 space-y-3 animate-pulse">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex gap-4">
					{Array.from({ length: cols }).map((_, j) => (
						<div key={j} className="h-4 flex-1 bg-muted rounded" />
					))}
				</div>
			))}
		</div>
	);
}

// Empty state component

interface EmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	description: string;
	action?: {
		label: string;
		onClick: () => void;
	} | undefined;
	variant?: 'card' | 'inline';
}

export function EmptyState({ icon, title, description, action, variant = 'card' }: EmptyStateProps) {
	if (variant === 'inline') {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center">
				{icon && <div className="mb-2 text-muted-foreground opacity-40">{icon}</div>}
				<p className="text-sm font-medium mb-1">{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
				{action && (
					<Button variant="link" size="sm" onClick={action.onClick} className="mt-2">
						{action.label}
					</Button>
				)}
			</div>
		);
	}

	return (
		<Card className="ui-surface border-dashed border-border/70">
			<CardContent className="flex flex-col items-center justify-center py-12 text-center">
				{icon && (
					<div className="mb-4 text-muted-foreground opacity-50">{icon}</div>
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

// Inline empty state (less prominent)

export function InlineEmptyState({
	icon,
	message,
	action,
}: {
	icon?: React.ReactNode;
	message: string;
	action?: {
		label: string;
		onClick: () => void;
	};
}) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			{icon && <div className="mb-2 text-muted-foreground opacity-40">{icon}</div>}
			<p className="text-sm text-muted-foreground">{message}</p>
			{action && (
				<Button variant="link" size="sm" onClick={action.onClick} className="mt-1">
					{action.label}
				</Button>
			)}
		</div>
	);
}

// Error state with retry

export function ErrorState({
	title = 'Something went wrong',
	message,
	onRetry,
	variant = 'card',
}: {
	title?: string;
	message?: string;
	onRetry?: () => void;
	variant?: 'card' | 'inline';
}) {
	if (variant === 'inline') {
		return (
			<div className="flex flex-col items-center justify-center py-6 text-center px-4">
				<AlertCircle className="h-6 w-6 text-red-500 mb-2" />
				<p className="text-sm font-medium">{title}</p>
				{message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
				{onRetry && (
					<Button variant="ghost" size="sm" onClick={onRetry} className="mt-2">
						<RefreshCw className="h-3 w-3 mr-1" />
						Retry
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center py-12 text-center px-4">
			<div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
				<AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
			</div>
			<h3 className="font-medium text-lg mb-1">{title}</h3>
			{message && (
				<p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
			)}
			{onRetry && (
				<Button variant="outline" onClick={onRetry}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Try Again
				</Button>
			)}
		</div>
	);
}

// Specific empty states

export function NoRepoSelected({ onSelectRepo }: { onSelectRepo: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center p-8 ui-surface">
			<div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
				<FolderGit2 className="h-10 w-10 text-primary" />
			</div>
			<h2 className="text-2xl font-semibold mb-2">Welcome to Git Graph</h2>
			<p className="text-muted-foreground mb-6 max-w-md">
				Open a Git repository to visualize your commit history, manage branches, and collaborate.
			</p>
			<Button onClick={onSelectRepo} size="lg">
				<FolderGit2 className="h-5 w-5 mr-2" />
				Open Repository
			</Button>
		</div>
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
			description="Stashes let you save your work temporarily."
			action={onStash ? { label: 'Stash Changes', onClick: onStash } : undefined}
			variant="inline"
		/>
	);
}

export function NoTags({ onCreateTag }: { onCreateTag?: () => void }) {
	return (
		<EmptyState
			icon={<Tag className="h-12 w-12" />}
			title="No Tags"
			description="Tags mark important points like releases."
			action={onCreateTag ? { label: 'Create Tag', onClick: onCreateTag } : undefined}
			variant="inline"
		/>
	);
}

export function NoRemotes({ onAddRemote }: { onAddRemote?: () => void }) {
	return (
		<EmptyState
			icon={<GitPullRequest className="h-12 w-12" />}
			title="No Remotes"
			description="Add a remote to push and pull changes."
			action={onAddRemote ? { label: 'Add Remote', onClick: onAddRemote } : undefined}
			variant="inline"
		/>
	);
}

export function NoMergeConflicts() {
	return (
		<EmptyState
			icon={<GitMerge className="h-12 w-12" />}
			title="No Conflicts"
			description="Great! There are no merge conflicts to resolve."
		/>
	);
}

export function NoSearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<Search className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
			<h3 className="font-medium mb-1">No results for "{query}"</h3>
			<p className="text-sm text-muted-foreground mb-4">
				Try a different search term
			</p>
			{onClear && (
				<Button variant="outline" size="sm" onClick={onClear}>
					Clear Search
				</Button>
			)}
		</div>
	);
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
			<p className="text-sm text-muted-foreground">{message}</p>
		</div>
	);
}

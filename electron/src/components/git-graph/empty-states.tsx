/**
 * Empty States & Loading
 * Helpful guidance when nothing to show + skeleton screens
 */

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

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
		<div className='flex h-full flex-col items-center justify-center py-20'>
			<div className='relative h-14 w-14'>
				<span aria-hidden className='absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:1800ms]' />
				<div className='relative grid h-full w-full place-items-center rounded-full bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] ring-1 ring-primary/25'>
					<GitCommit className='h-5 w-5 text-primary/85' />
				</div>
			</div>
			<p className='mt-4 text-[0.8125rem] text-muted-foreground'>Reading commits…</p>
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
			<div className='flex flex-col items-center justify-center px-4 py-8 text-center'>
				{icon && (
					<div className='mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50 [&>*]:!h-4 [&>*]:!w-4'>
						{icon}
					</div>
				)}
				<p className='mb-0.5 text-[0.8125rem] font-semibold tracking-[-0.005em]'>{title}</p>
				<p className='max-w-xs text-xs leading-relaxed text-muted-foreground/85'>{description}</p>
				{action && (
					<Button variant='outline' size='xs' onClick={action.onClick} className='mt-3'>
						{action.label}
					</Button>
				)}
			</div>
		);
	}

	return (
		<Card className='border-dashed border-border/60 bg-card/40 shadow-none'>
			<CardContent className='flex flex-col items-center justify-center px-6 py-12 text-center'>
				{icon && (
					<div className='relative mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--primary)_8%,var(--muted))] text-primary/85 ring-1 ring-primary/15 [&>*]:!h-5 [&>*]:!w-5'>
						<span
							aria-hidden
							className='pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-card/50'
						/>
						{icon}
					</div>
				)}
				<h3 className='mb-1 text-[0.9375rem] font-semibold tracking-[-0.012em]'>{title}</h3>
				<p className='mb-4 max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground'>{description}</p>
				{action && <Button onClick={action.onClick} size='sm'>{action.label}</Button>}
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
		<div className='flex flex-col items-center justify-center px-4 py-8 text-center'>
			{icon && (
				<div className='mb-2 grid h-9 w-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50 [&>*]:!h-4 [&>*]:!w-4'>
					{icon}
				</div>
			)}
			<p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>{message}</p>
			{action && (
				<Button variant='outline' size='xs' onClick={action.onClick} className='mt-2.5'>
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
			<div className='flex flex-col items-center justify-center px-4 py-6 text-center'>
				<div className='mb-2 grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-destructive/20'>
					<AlertCircle className='h-4 w-4' />
				</div>
				<p className='text-[0.8125rem] font-semibold tracking-[-0.005em]'>{title}</p>
				{message && <p className='mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground/85'>{message}</p>}
				{onRetry && (
					<Button variant='outline' size='xs' onClick={onRetry} className='mt-2.5'>
						<RefreshCw className='h-3 w-3' />
						Retry
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className='flex flex-col items-center justify-center px-4 py-12 text-center'>
			<div className='relative mb-3.5 grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20'>
				<span aria-hidden className='pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-card/50' />
				<AlertCircle className='h-5 w-5' />
			</div>
			<h3 className='mb-1 text-[0.9375rem] font-semibold tracking-[-0.012em]'>{title}</h3>
			{message && (
				<p className='mb-4 max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground'>{message}</p>
			)}
			{onRetry && (
				<Button variant='outline' onClick={onRetry} size='sm'>
					<RefreshCw className='h-3.5 w-3.5' />
					Try again
				</Button>
			)}
		</div>
	);
}

// Specific empty states

export function NoRepoSelected({ onSelectRepo }: { onSelectRepo: () => void }) {
	return (
		<div className='relative flex h-full flex-col items-center justify-center overflow-hidden p-8 text-center'>
			<div
				aria-hidden
				className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_60%)]'
			/>
			<div className='mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-[var(--shadow-md)] ring-1 ring-primary/25'>
				<FolderGit2 className='h-7 w-7 text-primary' />
			</div>
			<h2 className='mb-1.5 text-[1.5rem] font-semibold tracking-[-0.022em]'>Welcome to GitLizard</h2>
			<p className='mb-6 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground'>
				Open a Git repository to see history at a glance, branch with confidence, and undo anything.
			</p>
			<Button onClick={onSelectRepo} size='lg'>
				<FolderGit2 className='h-4 w-4' />
				Open repository
			</Button>
		</div>
	);
}

export function NoCommits({ onCommit }: { onCommit?: () => void }) {
	return (
		<EmptyState
			icon={<History />}
			title='No commits yet'
			description='Make your first commit and the history will start showing up here.'
			action={onCommit ? { label: 'Create initial commit', onClick: onCommit } : undefined}
		/>
	);
}

export function NoBranches({ onCreateBranch }: { onCreateBranch: () => void }) {
	return (
		<EmptyState
			icon={<GitBranch />}
			title='No branches'
			description='Create a branch to start working on a new feature or fix.'
			action={{ label: 'Create branch', onClick: onCreateBranch }}
		/>
	);
}

export function NoStashes({ onStash }: { onStash?: () => void }) {
	return (
		<EmptyState
			icon={<Archive />}
			title='No stashes'
			description='Stashes let you set work aside without committing it.'
			action={onStash ? { label: 'Stash changes', onClick: onStash } : undefined}
			variant='inline'
		/>
	);
}

export function NoTags({ onCreateTag }: { onCreateTag?: () => void }) {
	return (
		<EmptyState
			icon={<Tag />}
			title='No tags'
			description='Tags mark important points in history — releases, milestones.'
			action={onCreateTag ? { label: 'Create tag', onClick: onCreateTag } : undefined}
			variant='inline'
		/>
	);
}

export function NoRemotes({ onAddRemote }: { onAddRemote?: () => void }) {
	return (
		<EmptyState
			icon={<GitPullRequest />}
			title='No remotes'
			description='Add a remote to push and pull changes.'
			action={onAddRemote ? { label: 'Add remote', onClick: onAddRemote } : undefined}
			variant='inline'
		/>
	);
}

export function NoMergeConflicts() {
	return (
		<EmptyState
			icon={<GitMerge />}
			title='No conflicts'
			description='Nothing to resolve — the working tree is clean.'
		/>
	);
}

export function NoSearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
	return (
		<div className='flex flex-col items-center justify-center px-4 py-12 text-center'>
			<div className='mb-3.5 grid h-12 w-12 place-items-center rounded-xl bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50'>
				<Search className='h-5 w-5' />
			</div>
			<h3 className='mb-0.5 max-w-[18rem] truncate text-[0.9375rem] font-semibold tracking-[-0.012em]'>
				No results for <span className='font-mono text-foreground/90'>&ldquo;{query}&rdquo;</span>
			</h3>
			<p className='mb-3 text-[0.8125rem] leading-relaxed text-muted-foreground'>
				Try a different search term.
			</p>
			{onClear && (
				<Button variant='outline' size='sm' onClick={onClear}>
					Clear search
				</Button>
			)}
		</div>
	);
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
	return (
		<div className='flex flex-col items-center justify-center py-12'>
			<div className='relative mb-3 h-7 w-7'>
				<div className='absolute inset-0 rounded-full border-2 border-muted' />
				<div className='absolute inset-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
			</div>
			<p className='text-[0.8125rem] text-muted-foreground'>{message}</p>
		</div>
	);
}

/**
 * Git Graph Side Panel
 * Shows branches, tags, stashes, and remotes
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
	ChevronRight,
	ChevronDown,
	GitBranch,
	Tag,
	Archive,
	Globe,
	Plus,
	RefreshCw,
	Trash2,
	Check,
	ArrowUp,
	ArrowDown,
	Search,
	MoreHorizontal,
	GitCommit,
	FolderTree,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGitOperations } from '@/hooks/useGitOperations';
import { CommitPanel } from './commit-panel';

interface SidePanelProps {
	onBranchSelect?: (branch: string) => void;
}

export function SidePanel({ onBranchSelect }: SidePanelProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		branches: true,
		remotes: true,
		tags: false,
		stashes: false,
		worktrees: false,
	});
	const [searchQuery, setSearchQuery] = useState('');

	const { data: repoInfo, refetch: refetchRepoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: true,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo }
	);

	const { data: worktreesData } = trpc.git.worktree.list.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo }
	);

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
	};

	if (!activeRepo) return null;

	const localBranches = repoInfo?.branches?.filter((b) => !b.startsWith('remotes/')) ?? [];
	const remoteBranches = repoInfo?.branches?.filter((b) => b.startsWith('remotes/')) ?? [];
	const tags = repoInfo?.tags ?? [];
	const stashes = repoInfo?.stashes ?? [];
	const worktrees = worktreesData?.worktrees ?? [];
	const currentHead = repoInfo?.head;

	// Filter by search
	const filterBySearch = <T extends string>(items: T[]): T[] =>
		searchQuery ? items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())) : items;

	const filteredLocalBranches = filterBySearch(localBranches);
	const filteredTags = filterBySearch(tags);

	return (
		<div className="flex flex-col h-full border-r bg-muted/30 w-56 shrink-0">
			{/* Header with search */}
			<div className="p-2 border-b">
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
					<Input
						placeholder="Filter..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-7 pl-7 text-xs"
					/>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-1">
					{/* Local Branches */}
					<Section
						title="Local"
						icon={GitBranch}
						count={localBranches.length}
						expanded={expandedSections.branches}
						onToggle={() => toggleSection('branches')}
						actions={
							<Button
								variant="ghost"
								size="sm"
								className="h-5 w-5 p-0"
								onClick={() => {
									// TODO: Open create branch dialog
								}}
							>
								<Plus className="h-3 w-3" />
							</Button>
						}
					>
						{filteredLocalBranches.map((branch) => (
							<BranchItem
								key={branch}
								branch={branch}
								isCurrent={branch === currentHead}
								onCheckout={() => gitOps.checkout(branch)}
								onDelete={() => gitOps.deleteBranch(branch, false)}
							/>
						))}
					</Section>

					{/* Remote Branches */}
					{remoteBranches.length > 0 && (
						<Section
							title="Remote"
							icon={Globe}
							count={remoteBranches.length}
							expanded={expandedSections.remotes}
							onToggle={() => toggleSection('remotes')}
						>
							{remoteBranches.slice(0, 20).map((branch) => (
								<RemoteBranchItem
									key={branch}
									branch={branch}
									onCheckout={() => gitOps.checkout(branch)}
								/>
							))}
							{remoteBranches.length > 20 && (
								<div className="px-4 py-1 text-xs text-muted-foreground">
									+{remoteBranches.length - 20} more
								</div>
							)}
						</Section>
					)}

					{/* Tags */}
					{tags.length > 0 && (
						<Section
							title="Tags"
							icon={Tag}
							count={tags.length}
							expanded={expandedSections.tags}
							onToggle={() => toggleSection('tags')}
							actions={
								<Button
									variant="ghost"
									size="sm"
									className="h-5 w-5 p-0"
									onClick={() => {
										// TODO: Open create tag dialog
									}}
								>
									<Plus className="h-3 w-3" />
								</Button>
							}
						>
							{filteredTags.slice(0, 30).map((tag) => (
								<TagItem
									key={tag}
									tag={tag}
									onDelete={() => gitOps.deleteTag(tag)}
								/>
							))}
							{tags.length > 30 && (
								<div className="px-4 py-1 text-xs text-muted-foreground">
									+{tags.length - 30} more
								</div>
							)}
						</Section>
					)}

					{/* Worktrees */}
					{worktrees.length > 0 && (
						<Section
							title="Worktrees"
							icon={FolderTree}
							count={worktrees.length}
							expanded={expandedSections.worktrees}
							onToggle={() => toggleSection('worktrees')}
						>
							{worktrees.map((wt: { path: string; branch?: string; isMain?: boolean }) => (
								<WorktreeItem
									key={wt.path}
									worktree={wt}
								/>
							))}
						</Section>
					)}

					{/* Stashes */}
					{stashes.length > 0 && (
						<Section
							title="Stashes"
							icon={Archive}
							count={stashes.length}
							expanded={expandedSections.stashes}
							onToggle={() => toggleSection('stashes')}
						>
							{stashes.map((stash: { selector: string; message: string }, index: number) => (
								<StashItem
									key={stash.selector}
									stash={stash}
									index={index}
									onApply={() => gitOps.stashApply(stash.selector)}
									onPop={() => gitOps.stashPop(stash.selector)}
									onDrop={() => gitOps.stashDrop(stash.selector)}
								/>
							))}
						</Section>
					)}
				</div>
			</ScrollArea>

			{/* Commit Panel */}
			<div className="shrink-0 max-h-[300px] overflow-hidden">
				<CommitPanel />
			</div>
		</div>
	);
}

// Section component
function Section({
	title,
	icon: Icon,
	count,
	expanded,
	onToggle,
	actions,
	children,
}: {
	title: string;
	icon: React.ElementType;
	count: number;
	expanded: boolean;
	onToggle: () => void;
	actions?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-1">
			<button
				onClick={onToggle}
				className="flex items-center gap-1 w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded"
			>
				{expanded ? (
					<ChevronDown className="h-3 w-3 shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0" />
				)}
				<Icon className="h-3 w-3 shrink-0" />
				<span className="flex-1 text-left">{title}</span>
				<span className="text-muted-foreground/60">{count}</span>
				{actions}
			</button>
			{expanded && <div className="mt-0.5">{children}</div>}
		</div>
	);
}

// Branch item
function BranchItem({
	branch,
	isCurrent,
	onCheckout,
	onDelete,
}: {
	branch: string;
	isCurrent: boolean;
	onCheckout: () => void;
	onDelete: () => void;
}) {
	return (
		<div
			className={`group flex items-center gap-2 px-3 py-0.5 text-xs cursor-pointer rounded hover:bg-accent/50 ${
				isCurrent ? 'bg-accent/30' : ''
			}`}
			onClick={onCheckout}
		>
			<GitBranch className={`h-3 w-3 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
			<span className={`flex-1 truncate ${isCurrent ? 'font-medium text-primary' : ''}`}>
				{branch}
			</span>
			{isCurrent && <Check className="h-3 w-3 text-primary shrink-0" />}
			{!isCurrent && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreHorizontal className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<DropdownMenuItem onClick={onCheckout}>
							<Check className="h-4 w-4 mr-2" />
							Checkout
						</DropdownMenuItem>
						<DropdownMenuItem>
							<Merge className="h-4 w-4 mr-2" />
							Merge into current
						</DropdownMenuItem>
						<DropdownMenuItem>
							<RefreshCw className="h-4 w-4 mr-2" />
							Rebase current onto...
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onDelete} className="text-destructive">
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

// Remote branch item
function RemoteBranchItem({
	branch,
	onCheckout,
}: {
	branch: string;
	onCheckout: () => void;
}) {
	const displayBranch = branch.replace('remotes/', '');
	const [remote, ...rest] = displayBranch.split('/');
	const branchName = rest.join('/');

	return (
		<div
			className="group flex items-center gap-2 px-3 py-0.5 text-xs cursor-pointer rounded hover:bg-accent/50"
			onClick={onCheckout}
		>
			<Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
			<span className="text-muted-foreground">{remote}/</span>
			<span className="flex-1 truncate">{branchName}</span>
		</div>
	);
}

// Tag item
function TagItem({
	tag,
	onDelete,
}: {
	tag: string;
	onDelete: () => void;
}) {
	return (
		<div className="group flex items-center gap-2 px-3 py-0.5 text-xs rounded hover:bg-accent/50">
			<Tag className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
			<span className="flex-1 truncate">{tag}</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
					>
						<MoreHorizontal className="h-3 w-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem onClick={onDelete} className="text-destructive">
						<Trash2 className="h-4 w-4 mr-2" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// Stash item
function StashItem({
	stash,
	index,
	onApply,
	onPop,
	onDrop,
}: {
	stash: { selector: string; message: string };
	index: number;
	onApply: () => void;
	onPop: () => void;
	onDrop: () => void;
}) {
	return (
		<div className="group flex items-center gap-2 px-3 py-0.5 text-xs rounded hover:bg-accent/50">
			<Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate">{stash.message || `stash@{${index}}`}</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
					>
						<MoreHorizontal className="h-3 w-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuItem onClick={onApply}>
						<ArrowDown className="h-4 w-4 mr-2" />
						Apply
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onPop}>
						<ArrowUp className="h-4 w-4 mr-2" />
						Pop
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={onDrop} className="text-destructive">
						<Trash2 className="h-4 w-4 mr-2" />
						Drop
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// Worktree item
function WorktreeItem({
	worktree,
}: {
	worktree: { path: string; branch?: string; isMain?: boolean };
}) {
	const pathParts = worktree.path.split('/');
	const folderName = pathParts[pathParts.length - 1];
	
	return (
		<div className="group flex items-center gap-2 px-3 py-0.5 text-xs rounded hover:bg-accent/50">
			<FolderTree className={`h-3 w-3 shrink-0 ${worktree.isMain ? 'text-primary' : 'text-muted-foreground'}`} />
			<span className="flex-1 truncate" title={worktree.path}>
				{folderName}
			</span>
			{worktree.isMain && (
				<span className="text-[10px] text-primary font-medium">main</span>
			)}
			{worktree.branch && !worktree.isMain && (
				<span className="text-[10px] text-muted-foreground">{worktree.branch}</span>
			)}
		</div>
	);
}

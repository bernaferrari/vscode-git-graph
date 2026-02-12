/**
 * Git Graph Side Panel
 * Beautiful, clean sidebar for branches, tags, remotes, stashes
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
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
	GitMerge,
	Play,
	Box,
	Settings,
	Ellipsis,
} from 'lucide-react';
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
		submodules: false,
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

	const { data: aheadBehindData } = trpc.git.aheadBehindAll.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo, refetchInterval: 10000 }
	);

	const { data: submodulesData } = trpc.git.submodule.list.useQuery(
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

	const filterBySearch = <T extends string>(items: T[]): T[] =>
		searchQuery ? items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())) : items;

	const filteredLocalBranches = filterBySearch(localBranches);
	const filteredTags = filterBySearch(tags);

	return (
		<div className="flex flex-col h-full border-r bg-muted/20 w-60 shrink-0">
			{/* Header */}
			<div className="p-2 border-b bg-background/50">
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						placeholder="Filter..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-8 pl-8 text-sm bg-background"
					/>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-2 space-y-1">
					{/* Local Branches */}
					<Section
						title="Branches"
						icon={GitBranch}
						count={filteredLocalBranches.length}
						expanded={expandedSections.branches}
						onToggle={() => toggleSection('branches')}
						action={
							<Button
								variant="ghost"
								size="sm"
								className="h-5 w-5 p-0 hover:bg-accent"
								onClick={() => {/* TODO: create branch */}}
							>
								<Plus className="h-3 w-3" />
							</Button>
						}
					>
						{filteredLocalBranches.map((branch) => {
							const aheadBehind = aheadBehindData?.[branch];
							return (
								<BranchItem
									key={branch}
									branch={branch}
									isCurrent={branch === currentHead}
									ahead={aheadBehind?.ahead}
									behind={aheadBehind?.behind}
									onCheckout={() => gitOps.checkout(branch)}
									onDelete={() => gitOps.deleteBranch(branch, false)}
								/>
							);
						})}
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
								<MoreItems
									label={`+${remoteBranches.length - 20} more`}
									count={remoteBranches.length - 20}
								>
									{remoteBranches.slice(20).map((branch) => (
										<RemoteBranchItem
											key={branch}
											branch={branch}
											onCheckout={() => gitOps.checkout(branch)}
										/>
									))}
								</MoreItems>
							)}
						</Section>
					)}

					{/* Tags */}
					{tags.length > 0 && (
						<Section
							title="Tags"
							icon={Tag}
							count={filteredTags.length}
							expanded={expandedSections.tags}
							onToggle={() => toggleSection('tags')}
							action={
								<Button
									variant="ghost"
									size="sm"
									className="h-5 w-5 p-0 hover:bg-accent"
									onClick={() => {/* TODO: create tag */}}
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
							{filteredTags.length > 30 && (
								<MoreItems
									label={`+${filteredTags.length - 30} more`}
									count={filteredTags.length - 30}
								>
									{filteredTags.slice(30).map((tag) => (
										<TagItem
											key={tag}
											tag={tag}
											onDelete={() => gitOps.deleteTag(tag)}
										/>
									))}
								</MoreItems>
							)}
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
							{stashes.map((stash, index) => (
								<StashItem
									key={index}
									stash={stash}
									index={index}
									onApply={() => gitOps.stashApply(index, false)}
									onPop={() => gitOps.stashPop(index)}
									onDrop={() => gitOps.stashDrop(index)}
								/>
							))}
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
								<WorktreeItem key={wt.path} worktree={wt} />
							))}
						</Section>
					)}

					{/* Submodules */}
					{submodulesData?.submodules && submodulesData.submodules.length > 0 && (
						<Section
							title="Submodules"
							icon={Box}
							count={submodulesData.submodules.length}
							expanded={expandedSections.submodules}
							onToggle={() => toggleSection('submodules')}
						>
							{submodulesData.submodules.map((sm: { path: string; status: string }) => (
								<SubmoduleItem key={sm.path} submodule={sm} />
							))}
						</Section>
					)}
				</div>
			</ScrollArea>
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
	action,
	children,
}: {
	title: string;
	icon: React.ElementType;
	count: number;
	expanded: boolean;
	onToggle: () => void;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-0.5">
			<button
				onClick={onToggle}
				className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40 rounded-md transition-colors"
			>
				{expanded ? (
					<ChevronDown className="h-3.5 w-3.5 shrink-0" />
				) : (
					<ChevronRight className="h-3.5 w-3.5 shrink-0" />
				)}
				<Icon className="h-3.5 w-3.5 shrink-0" />
				<span className="flex-1 text-left">{title}</span>
				<span className="text-[10px] tabular-nums bg-muted px-1.5 py-0.5 rounded">
					{count}
				</span>
				{action}
			</button>
			{expanded && <div className="mt-0.5 ml-1">{children}</div>}
		</div>
	);
}

// Branch item
function BranchItem({
	branch,
	isCurrent,
	ahead,
	behind,
	onCheckout,
	onDelete,
}: {
	branch: string;
	isCurrent: boolean;
	ahead?: number;
	behind?: number;
	onCheckout: () => void;
	onDelete: () => void;
}) {
	const hasAheadBehind = (ahead ?? 0) > 0 || (behind ?? 0) > 0;

	return (
		<div
			className="group flex items-center gap-2 px-2 py-1 text-xs cursor-pointer rounded hover:bg-accent/40 transition-colors"
			onClick={onCheckout}
		>
			<GitBranch className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
			<span className={`flex-1 truncate ${isCurrent ? 'font-medium text-primary' : ''}`}>
				{branch}
			</span>
			{hasAheadBehind && (
				<span className="flex items-center gap-0.5 shrink-0 text-[10px]">
					{(ahead ?? 0) > 0 && (
						<span className="flex items-center text-emerald-600 dark:text-emerald-400">
							<ArrowUp className="h-2.5 w-2.5" />
							{ahead}
						</span>
					)}
					{(behind ?? 0) > 0 && (
						<span className="flex items-center text-amber-600 dark:text-amber-400">
							<ArrowDown className="h-2.5 w-2.5" />
							{behind}
						</span>
					)}
				</span>
			)}
			{isCurrent && <Check className="h-3 w-3 text-primary shrink-0" />}
			{!isCurrent && (
				<ActionMenu>
					<button
						className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent"
						onClick={(e) => { e.stopPropagation(); onCheckout(); }}
					>
						<Check className="h-3.5 w-3.5" /> Checkout
					</button>
					<button
						className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent"
						onClick={(e) => e.stopPropagation()}
					>
						<GitMerge className="h-3.5 w-3.5" /> Merge
					</button>
					<div className="h-px bg-border mx-2 my-1" />
					<button
						className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
						onClick={(e) => { e.stopPropagation(); onDelete(); }}
					>
						<Trash2 className="h-3.5 w-3.5" /> Delete
					</button>
				</ActionMenu>
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
			className="group flex items-center gap-2 px-2 py-1 text-xs cursor-pointer rounded hover:bg-accent/40 transition-colors"
			onClick={onCheckout}
		>
			<Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<span className="text-muted-foreground shrink-0">{remote}/</span>
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
		<div className="group flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-accent/40 transition-colors">
			<Tag className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
			<span className="flex-1 truncate">{tag}</span>
			<ActionMenu>
				<button
					className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
					onClick={() => onDelete()}
				>
					<Trash2 className="h-3.5 w-3.5" /> Delete
				</button>
			</ActionMenu>
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
	stash: { message?: string };
	index: number;
	onApply: () => void;
	onPop: () => void;
	onDrop: () => void;
}) {
	return (
		<div className="group flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-accent/40 transition-colors">
			<Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate">{stash.message || `Stash ${index}`}</span>
			<ActionMenu>
				<button
					className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent"
					onClick={onApply}
				>
					<ArrowDown className="h-3.5 w-3.5" /> Apply
				</button>
				<button
					className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent"
					onClick={onPop}
				>
					<ArrowUp className="h-3.5 w-3.5" /> Pop
				</button>
				<div className="h-px bg-border mx-2 my-1" />
				<button
					className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
					onClick={onDrop}
				>
					<Trash2 className="h-3.5 w-3.5" /> Drop
				</button>
			</ActionMenu>
		</div>
	);
}

// Worktree item
function WorktreeItem({
	worktree,
}: {
	worktree: { path: string; branch?: string; isMain?: boolean };
}) {
	const folderName = worktree.path.split('/').pop();
	
	return (
		<div className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-accent/40 transition-colors">
			<FolderTree className={`h-3.5 w-3.5 shrink-0 ${worktree.isMain ? 'text-primary' : 'text-muted-foreground'}`} />
			<span className="flex-1 truncate" title={worktree.path}>
				{folderName}
			</span>
			{worktree.isMain && (
				<span className="text-[10px] text-primary font-medium">main</span>
			)}
			{worktree.branch && !worktree.isMain && (
				<span className="text-[10px] text-muted-foreground truncate">{worktree.branch}</span>
			)}
		</div>
	);
}

// Submodule item
function SubmoduleItem({
	submodule,
}: {
	submodule: { path: string; status: string };
}) {
	const getStatusIcon = () => {
		if (submodule.status === '+') return <span className="text-emerald-500 text-[10px]">●</span>;
		if (submodule.status === '-') return <span className="text-red-500 text-[10px]">●</span>;
		if (submodule.status === 'U') return <span className="text-amber-500 text-[10px]">●</span>;
		return null;
	};

	return (
		<div className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-accent/40 transition-colors">
			<Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate" title={submodule.path}>
				{submodule.path}
			</span>
			{getStatusIcon()}
		</div>
	);
}

// Action menu popover
function ActionMenu({ children }: { children: React.ReactNode }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
					onClick={(e) => e.stopPropagation()}
				>
					<Ellipsis className="h-3.5 w-3.5" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-40 p-1"
				align="end"
				side="right"
				sideOffset={5}
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}

// More items popover
function MoreItems({
	label,
	count,
	children,
}: {
	label: string;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button className="w-full px-2 py-1 text-xs text-primary hover:underline text-left">
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-80 p-0"
				align="start"
				side="right"
				sideOffset={5}
			>
				<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
					<span className="text-sm font-medium">{count} items</span>
				</div>
				<ScrollArea className="h-[500px] max-h-[60vh]">
					<div className="py-1">
						{children}
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}

export default SidePanel;

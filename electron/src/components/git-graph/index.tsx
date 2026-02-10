/**
 * Git Graph Main Component
 * GitKraken-style Git visualization
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
	Loader2,
	GitBranch,
	Upload,
	Download,
	Terminal,
	Search,
	Plus,
	RefreshCw,
	ChevronDown,
	Tag,
	Merge,
	GitCommit,
	Archive,
	MoreHorizontal,
	X,
	FileCode,
	User,
	Calendar,
	Hash,
} from 'lucide-react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { CommitGraph } from './commit-graph';
import { CommitList } from './commit-list';
import { FindWidget, type FindOptions } from './find-widget';
import { BranchDropdown } from './branch-dropdown';
import {
	CreateBranchDialog,
	AddTagDialog,
	ResetDialog,
	DeleteBranchDialog,
	MergeDialog,
	RebaseDialog,
	CherryPickDialog,
	RevertDialog,
} from './dialogs';
import { CommitDetailsPanel } from './commit-details';
import { useGitOperations } from '@/hooks/useGitOperations';
import {
	GraphLayoutCalculator,
	DEFAULT_GRAPH_CONFIG,
} from '@/lib/graph/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

// Type for commits returned by tRPC
interface ClientCommit {
	hash: string;
	parents: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	heads: string[];
	tags: string[];
	remotes: string[];
}

// Graph configuration
const GRAPH_CONFIG = DEFAULT_GRAPH_CONFIG;
const graphCalculator = new GraphLayoutCalculator(GRAPH_CONFIG, {
	mergeCommits: true,
	commitsNotAncestorsOfHead: false,
});

// Toolbar button component
function ToolbarButton({
	icon: Icon,
	label,
	shortcut,
	onClick,
	variant = 'ghost',
	disabled,
}: {
	icon: React.ElementType;
	label: string;
	shortcut?: string;
	onClick: () => void;
	variant?: 'ghost' | 'default' | 'outline';
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant={variant}
					size="sm"
					className="h-8 px-2 gap-1.5"
					onClick={onClick}
					disabled={disabled}
				>
					<Icon className="h-4 w-4" />
					<span className="hidden sm:inline">{label}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<p>{label}{shortcut && ` (${shortcut})`}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function GitGraph() {
	// App store
	const {
		activeRepo,
		selectedCommit,
		commitDetailsOpen,
		setSelectedCommit,
		setCommitDetailsOpen,
	} = useAppStore();

	// Local state
	const [expandedCommit, setExpandedCommit] = useState<number | null>(null);
	const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);
	const [findWidgetOpen, setFindWidgetOpen] = useState(false);
	const [findMatches, setFindMatches] = useState<number[]>([]);
	const [findCurrentIndex, setFindCurrentIndex] = useState(0);
	const [selectedBranches, setSelectedBranches] = useState<string[]>(['__all__']);

	// Refs
	// Note: ScrollArea handles scrolling internally

	// Dialog state
	const [createBranchOpen, setCreateBranchOpen] = useState(false);
	const [addTagOpen, setAddTagOpen] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);
	const [mergeOpen, setMergeOpen] = useState(false);
	const [rebaseOpen, setRebaseOpen] = useState(false);
	const [cherryPickOpen, setCherryPickOpen] = useState(false);
	const [revertOpen, setRevertOpen] = useState(false);
	const [targetCommit, setTargetCommit] = useState<string>('');
	const [targetBranch, _setTargetBranch] = useState<string>('');

	// Git operations hook
	const gitOps = useGitOperations();

	// tRPC queries
	const { data: repoInfo, isLoading: repoLoading } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: true,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo }
	);

	const {
		data: commitsData,
		isLoading: commitsLoading,
		refetch: refetchCommits,
	} = trpc.git.commits.useQuery(
		{
			repo: activeRepo ?? '',
			branches: selectedBranches.includes('__all__') ? null : selectedBranches,
			maxCommits: 500,
			order: 'date',
			onlyFollowFirstParent: false,
			showTags: true,
			showRemoteBranches: true,
			hideRemotes: [],
		},
		{
			enabled: !!activeRepo,
			refetchInterval: 30000,
			staleTime: 10000,
		}
	);

	// Git status check
	const { data: gitStatus } = trpc.git.status.useQuery();

	// Derive commit lookup
	const commitLookup = useMemo(() => {
		if (!commitsData?.commits) return {};
		const lookup: Record<string, number> = {};
		commitsData.commits.forEach((commit: ClientCommit, index: number) => {
			lookup[commit.hash] = index;
		});
		return lookup;
	}, [commitsData?.commits]);

	// Calculate graph layout
	const graphLayout = useMemo(() => {
		if (!commitsData?.commits) return null;
		return graphCalculator.calculate(
			commitsData.commits,
			commitsData.head,
			commitLookup,
			false
		);
	}, [commitsData, commitLookup]);

	// Branch options for dropdown
	const branchOptions = useMemo(() => {
		if (!repoInfo?.branches) return [];
		return repoInfo.branches.map((b: string) => ({
			name: b,
			value: b,
			isRemote: b.startsWith('remotes/'),
			isCurrent: b === repoInfo.head,
		}));
	}, [repoInfo]);

	// Handlers
	const handleSelectCommit = useCallback((index: number) => {
		setSelectedCommitIndex(index);
		const commit = commitsData?.commits[index];
		if (commit) {
			setSelectedCommit(commit.hash);
			// Auto-open details panel on click
			if (!commitDetailsOpen) {
				setCommitDetailsOpen(true);
			}
		}
	}, [commitsData, setSelectedCommit, commitDetailsOpen, setCommitDetailsOpen]);

	const handleExpandCommit = useCallback((index: number | null) => {
		setExpandedCommit(index);
		setCommitDetailsOpen(index !== null);
	}, [setCommitDetailsOpen]);

	const handleFind = useCallback((query: string, options: FindOptions) => {
		if (!commitsData?.commits || !query) {
			setFindMatches([]);
			setFindCurrentIndex(0);
			return;
		}

		const matches: number[] = [];
		commitsData.commits.forEach((commit: ClientCommit, index: number) => {
			const searchStr = options.caseSensitive
				? commit.message
				: commit.message.toLowerCase();
			const searchQuery = options.caseSensitive ? query : query.toLowerCase();

			if (options.regex) {
				try {
					const regex = new RegExp(searchQuery);
					if (regex.test(searchStr)) {
						matches.push(index);
					}
				} catch {
					// Invalid regex
				}
			} else if (searchStr.includes(searchQuery)) {
				matches.push(index);
			}
		});

		setFindMatches(matches);
		setFindCurrentIndex(0);

		const firstMatch = matches[0];
		if (firstMatch !== undefined) {
			handleSelectCommit(firstMatch);
		}
	}, [commitsData, handleSelectCommit]);

	const handleFindNext = useCallback(() => {
		if (findMatches.length === 0) return;
		const nextIndex = (findCurrentIndex + 1) % findMatches.length;
		setFindCurrentIndex(nextIndex);
		const match = findMatches[nextIndex];
		if (match !== undefined) handleSelectCommit(match);
	}, [findMatches, findCurrentIndex, handleSelectCommit]);

	const handleFindPrevious = useCallback(() => {
		if (findMatches.length === 0) return;
		const prevIndex = (findCurrentIndex - 1 + findMatches.length) % findMatches.length;
		setFindCurrentIndex(prevIndex);
		const match = findMatches[prevIndex];
		if (match !== undefined) handleSelectCommit(match);
	}, [findMatches, findCurrentIndex, handleSelectCommit]);

	// Context menu handler
	const handleContextMenu = useCallback((index: number, event: React.MouseEvent) => {
		event.preventDefault();
		const commit = commitsData?.commits[index];
		if (commit) {
			setTargetCommit(commit.hash);
			setSelectedCommitIndex(index);
			setSelectedCommit(commit.hash);
		}
	}, [commitsData, setSelectedCommit]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const totalCommits = commitsData?.commits?.length ?? 0;

			if (e.key === 'j' || e.key === 'ArrowDown') {
				e.preventDefault();
				if (totalCommits > 0) {
					const nextIndex = selectedCommitIndex === null ? 0 : Math.min(selectedCommitIndex + 1, totalCommits - 1);
					handleSelectCommit(nextIndex);
				}
			} else if (e.key === 'k' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (totalCommits > 0) {
					const prevIndex = selectedCommitIndex === null ? totalCommits - 1 : Math.max(selectedCommitIndex - 1, 0);
					handleSelectCommit(prevIndex);
				}
			} else if (e.key === 'g') {
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(0);
			} else if (e.key === 'G') {
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(totalCommits - 1);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (selectedCommitIndex !== null) {
					handleExpandCommit(expandedCommit === selectedCommitIndex ? null : selectedCommitIndex);
				}
			} else if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setFindWidgetOpen(true);
			} else if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				refetchCommits();
			} else if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setCreateBranchOpen(true);
				}
			} else if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setAddTagOpen(true);
				}
			} else if (e.key === 'Escape') {
				setCommitDetailsOpen(false);
				setFindWidgetOpen(false);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [refetchCommits, commitsData?.commits?.length, selectedCommitIndex, selectedCommit, expandedCommit, handleSelectCommit, handleExpandCommit, setCommitDetailsOpen]);

	// tRPC mutations
	const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();
	const { mutate: registerRepo } = trpc.repo.register.useMutation();
	const { setActiveRepo, addRecentRepo } = useAppStore();

	const handleOpenRepo = async () => {
		try {
			const result = await showOpenDialog({
				title: 'Open Repository',
				properties: ['openDirectory'],
			});
			if (!result.canceled && result.filePaths[0]) {
				const path = result.filePaths[0];
				registerRepo({ path });
				setActiveRepo(path);
				addRecentRepo(path);
			}
		} catch (error) {
			console.error('Failed to open folder:', error);
		}
	};

	// No repo selected
	if (!activeRepo) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
						<GitCommit className="h-10 w-10 text-primary" />
					</div>
					<h1 className="text-2xl font-semibold mb-2">Welcome to Git Graph</h1>
					<p className="text-muted-foreground mb-6">
						Open a Git repository to visualize your commit history.
					</p>
					<Button size="lg" onClick={handleOpenRepo} className="gap-2">
						<Plus className="h-5 w-5" />
						Open Repository
					</Button>
					<p className="text-xs text-muted-foreground mt-4">
						or use the sidebar to browse recent repositories
					</p>
				</div>
			</div>
		);
	}

	// Git not available
	if (gitStatus && !gitStatus.available) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center">
						<X className="h-10 w-10 text-destructive" />
					</div>
					<h1 className="text-2xl font-semibold mb-2">Git Not Available</h1>
					<p className="text-muted-foreground mb-2">
						Git Graph requires Git to be installed.
					</p>
					<p className="text-sm text-muted-foreground/70 mb-4">{gitStatus.error}</p>
					<Button variant="outline" onClick={() => window.open('https://git-scm.com/downloads', '_blank')}>
						Download Git
					</Button>
				</div>
			</div>
		);
	}

	// Loading
	if (repoLoading || commitsLoading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
					<p className="text-sm text-muted-foreground">Loading commits...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (commitsData?.error) {
		return (
			<div className="flex-1 flex items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-lg mb-2 text-destructive">Error Loading Commits</p>
					<p className="text-sm text-muted-foreground mb-4">{commitsData.error}</p>
					<Button variant="outline" onClick={() => refetchCommits()}>
						Retry
					</Button>
				</div>
			</div>
		);
	}

	const currentHead = repoInfo?.head ?? 'main';

	return (
		<TooltipProvider>
			<div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
				{/* Top Toolbar */}
				<div className="flex items-center gap-1 px-3 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{/* Repo info */}
					<div className="flex items-center gap-2 mr-2">
						<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
							<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm font-medium">{activeRepo.split('/').pop()}</span>
						</div>
						{/* Current branch - clickable to show branches */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="secondary" size="sm" className="h-6 px-2 text-xs font-mono gap-1">
									{currentHead}
									<ChevronDown className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-56">
								<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
									Switch to branch
								</div>
								{repoInfo?.branches?.filter(b => !b.startsWith('remotes/')).slice(0, 10).map((branch) => (
									<DropdownMenuItem
										key={branch}
										className={branch === currentHead ? 'bg-accent' : ''}
										onClick={() => {
											// TODO: Checkout branch
											console.log('Checkout:', branch);
										}}
									>
										<GitBranch className="h-4 w-4 mr-2" />
										{branch}
										{branch === currentHead && (
											<span className="ml-auto text-xs text-muted-foreground">current</span>
										)}
									</DropdownMenuItem>
								))}
								{(repoInfo?.branches?.length ?? 0) > 10 && (
									<div className="px-2 py-1 text-xs text-muted-foreground">
										+{(repoInfo?.branches?.length ?? 0) - 10} more...
									</div>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div className="h-5 w-px bg-border mx-1" />

					{/* Main actions */}
					<ToolbarButton
						icon={Download}
						label="Fetch"
						shortcut="F"
						onClick={() => {
							// TODO: Implement fetch
						}}
					/>
					<ToolbarButton
						icon={Upload}
						label="Push"
						shortcut="P"
						onClick={() => {
							// TODO: Implement push
						}}
					/>
					<ToolbarButton
						icon={GitBranch}
						label="Pull"
						shortcut="L"
						onClick={() => {
							// TODO: Implement pull
						}}
					/>

					<div className="h-5 w-px bg-border mx-1" />

					{/* Branch/Tag creation */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
								<Plus className="h-4 w-4" />
								<span className="hidden sm:inline">New</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => {
								setTargetCommit(selectedCommit ?? 'HEAD');
								setCreateBranchOpen(true);
							}}>
								<GitBranch className="h-4 w-4 mr-2" />
								Branch...
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => {
								setTargetCommit(selectedCommit ?? 'HEAD');
								setAddTagOpen(true);
							}}>
								<Tag className="h-4 w-4 mr-2" />
								Tag...
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => {
								// TODO: Stash
							}}>
								<Archive className="h-4 w-4 mr-2" />
								Stash
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Branch filter */}
					<div className="ml-2 w-44">
						<BranchDropdown
							branches={branchOptions}
							selectedBranches={selectedBranches}
							multiple
							onChange={setSelectedBranches}
						/>
					</div>

					{/* Right side */}
					<div className="flex-1" />

					{/* Search */}
					<ToolbarButton
						icon={Search}
						label="Find"
						shortcut="⌘F"
						onClick={() => setFindWidgetOpen(true)}
					/>

					{/* Refresh */}
					<ToolbarButton
						icon={RefreshCw}
						label="Refresh"
						shortcut="⌘R"
						onClick={() => refetchCommits()}
					/>

					{/* More options */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => {
								// TODO: Open in terminal
							}}>
								<Terminal className="h-4 w-4 mr-2" />
								Open in Terminal
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => {
								// TODO: Open in Finder
							}}>
								<FileCode className="h-4 w-4 mr-2" />
								Open in Finder
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Find Widget */}
				<FindWidget
					open={findWidgetOpen}
					onClose={() => setFindWidgetOpen(false)}
					onFind={handleFind}
					onFindNext={handleFindNext}
					onFindPrevious={handleFindPrevious}
					currentIndex={findCurrentIndex}
					totalMatches={findMatches.length}
				/>

				{/* Main Content */}
				<div className="flex-1 flex overflow-hidden min-w-0">
					{/* Graph and Commit List */}
					<ScrollArea className="flex-1 w-full h-full">
						<div className="flex min-w-max">
							{/* Graph */}
							<div className="shrink-0 bg-background" style={{ width: graphLayout?.width ?? 200 }}>
								{graphLayout && (
									<CommitGraph
										layout={graphLayout}
										config={GRAPH_CONFIG}
										expandedIndex={expandedCommit ?? -1}
										onVertexClick={handleSelectCommit}
										onVertexHover={() => {}}
									/>
								)}
							</div>

							{/* Commit list */}
							<div className="shrink-0" style={{ width: 'max-content' }}>
								{commitsData?.commits && commitsData.commits.length > 0 && (
									<CommitList
										commits={commitsData.commits}
										layout={graphLayout}
										selectedIndex={selectedCommitIndex}
										expandedIndex={expandedCommit}
										onSelect={handleSelectCommit}
										onExpand={handleExpandCommit}
										onContextMenu={handleContextMenu}
									/>
								)}
								{commitsData?.commits && commitsData.commits.length === 0 && (
									<div className="flex items-center justify-center h-32 text-muted-foreground">
										<p>No commits found</p>
									</div>
								)}
							</div>
						</div>
					</ScrollArea>

					{/* Commit Details Panel */}
					{commitDetailsOpen && selectedCommit && (
						<div className="w-80 shrink-0 border-l">
							<CommitDetailsPanel
								commitHash={selectedCommit}
								onClose={() => setCommitDetailsOpen(false)}
							/>
						</div>
					)}
				</div>

				{/* Status bar */}
				<div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-t bg-background/95">
					<span>{commitsData?.commits?.length ?? 0} commits</span>
					{commitsData?.moreCommitsAvailable && (
						<>
							<span>•</span>
							<span className="text-primary cursor-pointer hover:underline">
								Load more
							</span>
						</>
					)}
					<div className="flex-1" />
					<span>{repoInfo?.branches?.length ?? 0} branches</span>
					<span>•</span>
					<span>{repoInfo?.tags?.length ?? 0} tags</span>
				</div>

				{/* Dialogs */}
				<CreateBranchDialog
					open={createBranchOpen}
					onOpenChange={setCreateBranchOpen}
					onCreate={(name, checkout) => {
						gitOps.createBranch(targetCommit, name, checkout);
						setCreateBranchOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<AddTagDialog
					open={addTagOpen}
					onOpenChange={setAddTagOpen}
					onAdd={(name, type, _push) => {
						gitOps.createTag(targetCommit, name, type === 'annotated' ? name : undefined);
						setAddTagOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<ResetDialog
					open={resetOpen}
					onOpenChange={setResetOpen}
					onReset={(mode) => {
						gitOps.reset(targetCommit, mode);
						setResetOpen(false);
					}}
					targetCommit={targetCommit}
				/>

				<DeleteBranchDialog
					open={deleteBranchOpen}
					onOpenChange={setDeleteBranchOpen}
					onDelete={(force) => {
						gitOps.deleteBranch(targetBranch, force);
						setDeleteBranchOpen(false);
					}}
					branchName={targetBranch}
				/>

				<MergeDialog
					open={mergeOpen}
					onOpenChange={setMergeOpen}
					onMerge={(options) => {
						gitOps.merge(targetBranch, options);
						setMergeOpen(false);
					}}
					branchName={targetBranch}
				/>

				<RebaseDialog
					open={rebaseOpen}
					onOpenChange={setRebaseOpen}
					onRebase={(interactive) => {
						gitOps.rebase(targetCommit, interactive);
						setRebaseOpen(false);
					}}
					onto={targetCommit}
				/>

				<CherryPickDialog
					open={cherryPickOpen}
					onOpenChange={setCherryPickOpen}
					onCherryPick={(noCommit) => {
						gitOps.cherryPick(targetCommit, noCommit);
						setCherryPickOpen(false);
					}}
					commitHash={targetCommit}
				/>

				<RevertDialog
					open={revertOpen}
					onOpenChange={setRevertOpen}
					onRevert={(noCommit) => {
						gitOps.revert(targetCommit, noCommit);
						setRevertOpen(false);
					}}
					commitHash={targetCommit}
				/>
			</div>
		</TooltipProvider>
	);
}

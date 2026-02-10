/**
 * Git Graph Main Component
 * Combines all sub-components into a cohesive Git Graph view
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

// Type for commits returned by tRPC (simpler than full GitCommit)
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
	const commitListRef = useRef<HTMLDivElement>(null);

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
			// Auto-refresh commits every 30 seconds
			refetchInterval: 30000,
			staleTime: 10000,
		}
	);

	// Git status check
	const { data: gitStatus } = trpc.git.status.useQuery();

	// File watcher subscription for real-time updates - DISABLED for debugging
	// const utils = trpc.useUtils();
	// trpc.watcher.onChange.useSubscription({ repo: activeRepo ?? '' }, {
	// 	enabled: !!activeRepo,
	// 	onData: () => {
	// 		// Invalidate and refetch when repo changes
	// 		utils.git.commits.invalidate();
	// 		utils.git.repoInfo.invalidate();
	// 	},
	// });

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
		setSelectedCommit(commit?.hash ?? null);
	}, [commitsData, setSelectedCommit]);

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
			// Ignore if typing in an input
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			const totalCommits = commitsData?.commits?.length ?? 0;

			// Navigation
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
				// Go to first commit
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(0);
			} else if (e.key === 'G') {
				// Go to last commit
				e.preventDefault();
				if (totalCommits > 0) handleSelectCommit(totalCommits - 1);
			} else if (e.key === 'Enter') {
				// Toggle commit details
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
				// Create branch on selected commit
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setCreateBranchOpen(true);
				}
			} else if (e.key === 't' && (e.metaKey || e.ctrlKey)) {
				// Add tag on selected commit
				e.preventDefault();
				if (selectedCommit) {
					setTargetCommit(selectedCommit);
					setAddTagOpen(true);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [refetchCommits, commitsData?.commits?.length, selectedCommitIndex, selectedCommit, expandedCommit, handleSelectCommit, handleExpandCommit]);

	// tRPC mutations for opening repo
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
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-primary"
						>
							<circle cx="12" cy="12" r="4" />
							<line x1="1.05" y1="12" x2="7" y2="12" />
							<line x1="17.01" y1="12" x2="22.96" y2="12" />
						</svg>
					</div>
					<h1 className="text-2xl font-semibold mb-2">Welcome to Git Graph</h1>
					<p className="text-muted-foreground mb-6">
						Open a Git repository to visualize your commit history and manage your code.
					</p>
					<Button size="lg" onClick={handleOpenRepo} className="gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
							<line x1="12" y1="11" x2="12" y2="17" />
							<line x1="9" y1="14" x2="15" y2="14" />
						</svg>
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
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-destructive"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
					<h1 className="text-2xl font-semibold mb-2">Git Not Available</h1>
					<p className="text-muted-foreground mb-2">
						Git Graph requires Git to be installed on your system.
					</p>
					<p className="text-sm text-muted-foreground/70">{gitStatus.error}</p>
					<Button variant="outline" className="mt-6" onClick={() => window.open('https://git-scm.com/downloads', '_blank')}>
						Download Git
					</Button>
				</div>
			</div>
		);
	}

	// Loading
	if (repoLoading || commitsLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
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
			<div className="flex-1 flex items-center justify-center text-destructive">
				<div className="text-center">
					<p className="text-lg mb-2">Error Loading Commits</p>
					<p className="text-sm opacity-70">{commitsData.error}</p>
					<Button variant="outline" className="mt-4" onClick={() => refetchCommits()}>
						Retry
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			{/* Top Control Bar */}
			<div className="flex items-center gap-2 p-2 border-b bg-background">
				<Badge variant="outline" className="text-sm font-mono">
					{activeRepo.split('/').pop()}
				</Badge>

				{repoInfo?.head && (
					<Badge variant="secondary" className="text-xs">
						{(repoInfo.head)}
					</Badge>
				)}

				<Separator orientation="vertical" className="h-6" />

				<div className="w-48">
					<BranchDropdown
						branches={branchOptions}
						selectedBranches={selectedBranches}
						multiple
						onChange={setSelectedBranches}
					/>
				</div>

				<Separator orientation="vertical" className="h-6" />

				<Button variant="ghost" size="sm" onClick={() => setFindWidgetOpen(true)}>
					Find (⌘F)
				</Button>
				<Button variant="ghost" size="sm" onClick={() => refetchCommits()}>
					Refresh (⌘R)
				</Button>

				{commitsData?.moreCommitsAvailable && (
					<Badge variant="outline" className="text-xs">
						More available
					</Badge>
				)}
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
			<div className="flex-1 flex overflow-hidden">
				{/* Shared scroll container for graph and list */}
				<div className="flex-1 overflow-auto" ref={commitListRef}>
					<div className="flex min-h-full">
						{/* Graph - positioned absolutely to scroll with list */}
						<div className="shrink-0" style={{ width: graphLayout?.width ?? 200 }}>
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

						{/* Commit list - no internal scrolling */}
						<div className="flex-1">
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
				</div>

				{/* Commit Details Panel */}
				{commitDetailsOpen && selectedCommit && (
					<div className="w-80 shrink-0">
						<CommitDetailsPanel
							commitHash={selectedCommit}
							onClose={() => setCommitDetailsOpen(false)}
						/>
					</div>
				)}
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
	);
}

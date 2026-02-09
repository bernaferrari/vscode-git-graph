/**
 * Git Graph Main Component
 * Combines all sub-components into a cohesive Git Graph view
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
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
} from './dialogs';
import {
	GraphLayoutCalculator,
	DEFAULT_GRAPH_CONFIG,
} from '@/lib/graph/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GitCommit } from '@/lib/types/git';

// Local types
interface BranchInfo {
	name: string;
	current: boolean;
}

// Graph configuration
const GRAPH_CONFIG = DEFAULT_GRAPH_CONFIG;
const graphCalculator = new GraphLayoutCalculator(GRAPH_CONFIG, {
	mergeCommits: true,
	commitsNotAncestorsOfHead: false,
});

// Mock data for development (replace with tRPC when ready)
const mockBranches: BranchInfo[] = [];
const mockCommits: GitCommit[] = [];
const mockHead: string | null = null;

export function GitGraph() {
	// App store
	const { activeRepo, setSelectedCommit, setCommitDetailsOpen } = useAppStore();

	// Local state
	const [expandedCommit, setExpandedCommit] = useState<number | null>(null);
	const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);
	const [findWidgetOpen, setFindWidgetOpen] = useState(false);
	const [findMatches, setFindMatches] = useState<number[]>([]);
	const [findCurrentIndex, setFindCurrentIndex] = useState(0);
	const [selectedBranches, setSelectedBranches] = useState<string[]>(['__all__']);

	// Dialog state
	const [createBranchOpen, setCreateBranchOpen] = useState(false);
	const [addTagOpen, setAddTagOpen] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [deleteBranchOpen, setDeleteBranchOpen] = useState(false);
	const [mergeOpen, setMergeOpen] = useState(false);
	const [targetCommit] = useState<string>('');
	const [targetBranch] = useState<string>('');

	// TODO: Replace with tRPC queries when available
	const repoInfo = { branches: mockBranches, head: mockHead, remotes: [], stashes: [] };
	const commitsData = { commits: mockCommits, head: mockHead, tags: [], moreCommitsAvailable: false };
	const repoLoading = false;
	const commitsLoading = false;
	const refetchCommits = () => console.log('Refetch');

	// Derive commit lookup
	const commitLookup = useMemo(() => {
		if (!commitsData?.commits) return {};
		const lookup: Record<string, number> = {};
		commitsData.commits.forEach((commit: GitCommit, index: number) => {
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
		if (!repoInfo) return [];
		return repoInfo.branches.map((b: BranchInfo) => ({
			name: b.name,
			value: b.name,
			isRemote: false,
			isCurrent: b.name === repoInfo.head,
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
		commitsData.commits.forEach((commit: GitCommit, index: number) => {
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

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setFindWidgetOpen(true);
			} else if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				refetchCommits();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	// No repo selected
	if (!activeRepo) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<div className="text-center">
					<p className="text-lg mb-2">No Repository Selected</p>
					<p className="text-sm">Open a Git repository to view the commit graph</p>
				</div>
			</div>
		);
	}

	// Loading
	if (repoLoading || commitsLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			{/* Top Control Bar */}
			<div className="flex items-center gap-2 p-2 border-b bg-background">
				<Badge variant="outline" className="text-sm">
					{activeRepo.split('/').pop()}
				</Badge>

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
			<ScrollArea className="flex-1">
				<div className="flex">
					<div className="shrink-0 sticky top-0">
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

					<div className="flex-1">
						{commitsData?.commits && (
							<CommitList
								commits={commitsData.commits}
								layout={graphLayout}
								selectedIndex={selectedCommitIndex}
								expandedIndex={expandedCommit}
								onSelect={handleSelectCommit}
								onExpand={handleExpandCommit}
							/>
						)}
					</div>
				</div>
			</ScrollArea>

			{/* Dialogs */}
			<CreateBranchDialog
				open={createBranchOpen}
				onOpenChange={setCreateBranchOpen}
				onCreate={(name, checkout) => {
					console.log('Create branch:', name, checkout);
					setCreateBranchOpen(false);
				}}
			/>

			<AddTagDialog
				open={addTagOpen}
				onOpenChange={setAddTagOpen}
				onAdd={(name, type, push) => {
					console.log('Add tag:', name, type, push);
					setAddTagOpen(false);
				}}
			/>

			<ResetDialog
				open={resetOpen}
				onOpenChange={setResetOpen}
				onReset={(mode) => {
					console.log('Reset:', targetCommit, mode);
					setResetOpen(false);
				}}
				targetCommit={targetCommit}
			/>

			<DeleteBranchDialog
				open={deleteBranchOpen}
				onOpenChange={setDeleteBranchOpen}
				onDelete={(force) => {
					console.log('Delete branch:', targetBranch, force);
					setDeleteBranchOpen(false);
				}}
				branchName={targetBranch}
			/>

			<MergeDialog
				open={mergeOpen}
				onOpenChange={setMergeOpen}
				onMerge={(options) => {
					console.log('Merge:', targetBranch, options);
					setMergeOpen(false);
				}}
				branchName={targetBranch}
			/>
		</div>
	);
}

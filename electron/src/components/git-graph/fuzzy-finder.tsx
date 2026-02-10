/**
 * Fuzzy Finder Modal
 * Quick switch branches, tags, commits, files
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	GitBranch,
	Tag,
	GitCommit,
	FileText,
	Search,
	Globe,
	Clock,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';

interface FuzzyFinderProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface SearchResult {
	type: 'branch' | 'tag' | 'commit' | 'file' | 'recent';
	name: string;
	subtitle?: string;
	icon: React.ElementType;
	action: () => void;
}

export function FuzzyFinder({ open, onOpenChange }: FuzzyFinderProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);

	const { data: repoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: true,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo && open }
	);

	const { data: recentCommits } = trpc.git.commits.useQuery(
		{
			repo: activeRepo ?? '',
			branch: '',
			maxCommits: 20,
		},
		{ enabled: !!activeRepo && open }
	);

	const { data: searchResults } = trpc.git.searchRefs.useQuery(
		{
			repo: activeRepo ?? '',
			query,
			includeCommits: true,
		},
		{ enabled: !!activeRepo && open && query.length > 0 }
	);

	// Build search results
	const results = useMemo<SearchResult[]>(() => {
		if (!activeRepo) return [];

		const items: SearchResult[] = [];
		const q = query.toLowerCase();

		// Branches
		const branches = repoInfo?.branches ?? [];
		branches.forEach((branch) => {
			const name = branch.replace('remotes/', '');
			if (name.toLowerCase().includes(q)) {
				items.push({
					type: branch.startsWith('remotes/') ? 'branch' : 'branch',
					name: branch.startsWith('remotes/') ? name : branch,
					subtitle: branch.startsWith('remotes/') ? 'remote' : 'local',
					icon: branch.startsWith('remotes/') ? Globe : GitBranch,
					action: () => {
						gitOps.checkout(branch);
						onOpenChange(false);
					},
				});
			}
		});

		// Tags
		const tags = repoInfo?.tags ?? [];
		tags.forEach((tag) => {
			if (tag.toLowerCase().includes(q)) {
				items.push({
					type: 'tag',
					name: tag,
					icon: Tag,
					action: () => {
						gitOps.checkout(tag);
						onOpenChange(false);
					},
				});
			}
		});

		// Recent commits
		const commits = recentCommits?.commits ?? [];
		commits.forEach((commit) => {
			if (
				commit.hash.toLowerCase().includes(q) ||
				commit.message.toLowerCase().includes(q)
			) {
				items.push({
					type: 'commit',
					name: commit.message.split('\n')[0] ?? '',
					subtitle: commit.hash.slice(0, 7),
					icon: GitCommit,
					action: () => {
						gitOps.checkout(commit.hash);
						onOpenChange(false);
					},
				});
			}
		});

		// Search results from backend
		if (searchResults) {
			searchResults.commits?.forEach((c) => {
				if (!items.some((i) => i.subtitle === c.hash.slice(0, 7))) {
					items.push({
						type: 'commit',
						name: c.message,
						subtitle: c.hash.slice(0, 7),
						icon: GitCommit,
						action: () => {
							gitOps.checkout(c.hash);
							onOpenChange(false);
						},
					});
				}
			});
		}

		// Sort: exact matches first, then by type
		items.sort((a, b) => {
			const aExact = a.name.toLowerCase() === q;
			const bExact = b.name.toLowerCase() === q;
			if (aExact && !bExact) return -1;
			if (!aExact && bExact) return 1;

			const typeOrder = { branch: 0, tag: 1, commit: 2, file: 3 };
			return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
		});

		return items.slice(0, 50);
	}, [activeRepo, query, repoInfo, recentCommits, searchResults, gitOps, onOpenChange]);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === 'Enter' && results[selectedIndex]) {
				e.preventDefault();
				results[selectedIndex].action();
			} else if (e.key === 'Escape') {
				onOpenChange(false);
			}
		},
		[results, selectedIndex, onOpenChange]
	);

	// Reset on open
	useEffect(() => {
		if (open) {
			setQuery('');
			setSelectedIndex(0);
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-0 gap-0 max-w-xl">
				<DialogHeader className="sr-only">
					<DialogTitle>Quick Switch</DialogTitle>
				</DialogHeader>
				<div className="flex items-center gap-2 px-3 py-2 border-b">
					<Search className="h-4 w-4 text-muted-foreground shrink-0" />
					<Input
						placeholder="Search branches, tags, commits..."
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						className="border-0 shadow-none focus-visible:ring-0 px-0"
						autoFocus
					/>
					<kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded">esc</kbd>
				</div>
				<ScrollArea className="max-h-80">
					{results.length === 0 ? (
						<div className="px-3 py-8 text-center text-muted-foreground text-sm">
							{query ? 'No results found' : 'Start typing to search...'}
						</div>
					) : (
						<div className="py-1">
							{results.map((result, index) => {
								const Icon = result.icon;
								return (
									<div
										key={`${result.type}-${result.name}-${result.subtitle}`}
										className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
											index === selectedIndex
												? 'bg-accent text-accent-foreground'
												: 'hover:bg-accent/50'
										}`}
										onClick={result.action}
										onMouseEnter={() => setSelectedIndex(index)}
									>
										<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="flex-1 truncate text-sm">{result.name}</span>
										{result.subtitle && (
											<span className="text-xs text-muted-foreground font-mono">
												{result.subtitle}
											</span>
										)}
										{index === selectedIndex && (
											<kbd className="px-1 py-0.5 text-[10px] bg-muted/50 rounded">↵</kbd>
										)}
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
				<div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center gap-4">
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 bg-muted rounded">↑↓</kbd> navigate
					</span>
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd> select
					</span>
					<span className="flex items-center gap-1">
						<kbd className="px-1 py-0.5 bg-muted rounded">esc</kbd> close
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

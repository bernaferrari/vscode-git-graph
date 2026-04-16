/**
 * Search All Commits
 * Full-text search across commit messages, authors, files
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Search,
	GitCommit,
	User,
	Loader2,
	X,
} from 'lucide-react';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}

interface SearchAllCommitsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectCommit?: (hash: string) => void;
}

interface SearchCommit {
	hash: string;
	date: number;
	message: string;
	author: string;
}

export function SearchAllCommits({ open, onOpenChange, onSelectCommit }: SearchAllCommitsProps) {
	const { activeRepo } = useAppStore();
	const [query, setQuery] = useState('');
	const [searchType, setSearchType] = useState<'message' | 'author' | 'file' | 'hash'>('message');
	
	// Use debounce hook
	const debouncedQuery = useDebounce(query, 300);

	// Search commits
	const { data: searchResults, isLoading } = trpc.git.searchCommits.useQuery(
		{
			repo: activeRepo ?? '',
			query: debouncedQuery,
			type: searchType,
		},
		{
			enabled: !!activeRepo && debouncedQuery.length >= 2,
		}
	);

	const results: SearchCommit[] = searchResults?.commits ?? [];

	const formatDate = (timestamp: number) => {
		return new Date(timestamp * 1000).toLocaleDateString();
	};

	const handleSelect = (hash: string) => {
		onSelectCommit?.(hash);
		onOpenChange(false);
		setQuery('');
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Search All Commits
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-3">
					{/* Search input */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search commits..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="pl-10 pr-10"
							autoFocus
						/>
						{query && (
							<Button
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
								onClick={() => {
									setQuery('');
								}}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>

					{/* Search type tabs */}
					<div className="flex gap-1 p-1 bg-muted rounded-lg">
						{(['message', 'author', 'file', 'hash'] as const).map((type) => (
							<button
								key={type}
								className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
									searchType === type
										? 'bg-background shadow-sm'
										: 'hover:bg-background/50'
								}`}
								onClick={() => setSearchType(type)}
							>
								{type.charAt(0).toUpperCase() + type.slice(1)}
							</button>
						))}
					</div>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : debouncedQuery.length < 2 ? (
						<div className="text-center py-8 text-muted-foreground">
							<Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>Type at least 2 characters to search</p>
						</div>
					) : results.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<GitCommit className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No commits found for "{debouncedQuery}"</p>
						</div>
					) : (
						<div className="space-y-2">
							<p className="text-xs text-muted-foreground px-1">
								{results.length} result{results.length !== 1 ? 's' : ''}
							</p>
							{results.map((commit: SearchCommit) => (
								<button
									key={commit.hash}
									className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors"
									onClick={() => handleSelect(commit.hash)}
								>
									<div className="flex items-start gap-3">
										<div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
											<GitCommit className="h-4 w-4" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
													{commit.hash.slice(0, 7)}
												</code>
												<span className="text-xs text-muted-foreground">
													{formatDate(commit.date)}
												</span>
											</div>
											<p className="text-sm font-medium truncate mb-1">
												{commit.message.split('\n')[0]}
											</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<User className="h-3 w-3" />
												<span>{commit.author}</span>
											</div>
										</div>
									</div>
								</button>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Tip: Use Ctrl+Shift+F to quickly open search from anywhere
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default SearchAllCommits;

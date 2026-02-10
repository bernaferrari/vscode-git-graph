/**
 * Recent Repositories
 * Quick access to recently opened repositories
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	FolderGit2,
	Clock,
	Star,
	X,
	Pin,
	GitBranch,
	Plus,
	Loader2,
} from 'lucide-react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

interface RecentRepo {
	path: string;
	name: string;
	lastOpened: number;
	openCount: number;
	pinned: boolean;
	currentBranch?: string;
}

interface RecentRepositoriesProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = 'git-graph-recent-repos';

export function useRecentRepos() {
	const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setRecentRepos(JSON.parse(stored));
			} catch {
				setRecentRepos([]);
			}
		}
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(recentRepos));
	}, [recentRepos]);

	const addRecentRepo = (path: string, branch?: string) => {
		setRecentRepos(prev => {
			const existing = prev.find(r => r.path === path);
			const name = path.split('/').pop() || path;
			
			if (existing) {
				return [
					{ ...existing, lastOpened: Date.now(), openCount: existing.openCount + 1, currentBranch: branch },
					...prev.filter(r => r.path !== path),
				];
			}
			
			return [
				{ path, name, lastOpened: Date.now(), openCount: 1, pinned: false, currentBranch: branch },
				...prev,
			].slice(0, 20); // Keep max 20
		});
	};

	const removeRecentRepo = (path: string) => {
		setRecentRepos(prev => prev.filter(r => r.path !== path));
	};

	const togglePin = (path: string) => {
		setRecentRepos(prev => prev.map(r => 
			r.path === path ? { ...r, pinned: !r.pinned } : r
		));
	};

	const clearRecentRepos = () => {
		setRecentRepos([]);
	};

	return {
		recentRepos,
		addRecentRepo,
		removeRecentRepo,
		togglePin,
		clearRecentRepos,
	};
}

export function RecentRepositories({ open, onOpenChange }: RecentRepositoriesProps) {
	const { activeRepo, setActiveRepo } = useAppStore();
	const { recentRepos, addRecentRepo, removeRecentRepo, togglePin, clearRecentRepos } = useRecentRepos();
	
	// Open folder dialog
	const { mutateAsync: showOpenDialog, isLoading: isOpening } = trpc.system.showOpenDialog.useMutation();

	const handleOpenRepo = async () => {
		try {
			const result = await showOpenDialog({
				title: 'Open Repository',
				properties: ['openDirectory'],
			});
			
			if (result.filePaths && result.filePaths.length > 0) {
				const path = result.filePaths[0];
				setActiveRepo(path);
				addRecentRepo(path);
				onOpenChange(false);
			}
		} catch (error) {
			toast.error('Failed to open repository');
		}
	};

	const handleSelectRepo = (path: string) => {
		setActiveRepo(path);
		addRecentRepo(path);
		onOpenChange(false);
	};

	const formatLastOpened = (timestamp: number) => {
		const diffMs = Date.now() - timestamp;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return new Date(timestamp).toLocaleDateString();
	};

	// Sort: pinned first, then by last opened
	const sortedRepos = [...recentRepos].sort((a, b) => {
		if (a.pinned && !b.pinned) return -1;
		if (!a.pinned && b.pinned) return 1;
		return b.lastOpened - a.lastOpened;
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderGit2 className="h-5 w-5" />
						Recent Repositories
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<span className="text-sm text-muted-foreground">
						{recentRepos.length} repositor{recentRepos.length !== 1 ? 'ies' : 'y'}
					</span>
					<div className="flex items-center gap-2">
						{recentRepos.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={clearRecentRepos}
								className="text-red-600"
							>
								<X className="h-4 w-4 mr-1" />
								Clear
							</Button>
						)}
						<Button size="sm" onClick={handleOpenRepo} disabled={isOpening}>
							{isOpening ? (
								<Loader2 className="h-4 w-4 mr-1 animate-spin" />
							) : (
								<Plus className="h-4 w-4 mr-1" />
							)}
							Open Repository
						</Button>
					</div>
				</div>

				<ScrollArea className="flex-1">
					{sortedRepos.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No recent repositories</p>
							<p className="text-xs mt-1">Open a repository to get started</p>
						</div>
					) : (
						<div className="space-y-1">
							{sortedRepos.map((repo) => (
								<div
									key={repo.path}
									className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer group ${
										repo.path === activeRepo
											? 'bg-primary/10 border border-primary/20'
											: 'hover:bg-accent/50'
									}`}
									onClick={() => handleSelectRepo(repo.path)}
								>
									<div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
										<FolderGit2 className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-0.5">
											<span className="font-medium truncate">{repo.name}</span>
											{repo.pinned && (
												<Pin className="h-3 w-3 text-primary" />
											)}
											{repo.path === activeRepo && (
												<span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
													Active
												</span>
											)}
										</div>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											{repo.currentBranch && (
												<>
													<GitBranch className="h-3 w-3" />
													<span>{repo.currentBranch}</span>
													<span>•</span>
												</>
											)}
											<Clock className="h-3 w-3" />
											<span>{formatLastOpened(repo.lastOpened)}</span>
										</div>
										<div className="text-xs text-muted-foreground truncate mt-0.5">
											{repo.path}
										</div>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={(e) => {
												e.stopPropagation();
												togglePin(repo.path);
											}}
										>
											<Pin className={`h-4 w-4 ${repo.pinned ? 'text-primary' : ''}`} />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-red-600"
											onClick={(e) => {
												e.stopPropagation();
												removeRecentRepo(repo.path);
											}}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Tip: Pin frequently used repositories for quick access
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default RecentRepositories;

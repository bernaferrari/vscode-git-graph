/**
 * Main App Layout with Sidebar
 * Provides repo selection sidebar and main content area
 */

import { Outlet } from '@tanstack/react-router';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect } from 'react';
import {
	FolderOpen,
	FolderGit2,
	ChevronLeft,
	ChevronRight,
	Clock,
	Plus,
} from 'lucide-react';

// Extend CSSProperties to include webkit drag properties
declare module 'react' {
	interface CSSProperties {
		WebkitAppRegion?: 'drag' | 'no-drag';
	}
}

// Detect platform from user agent
const getPlatform = () => {
	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes('mac')) return 'darwin';
	if (ua.includes('win')) return 'win32';
	return 'linux';
};

export default function AppLayout() {
	const { activeRepo, setActiveRepo, sidebarOpen, setSidebarOpen, addRecentRepo } = useAppStore();

	// Add platform class to document for platform-specific styles
	useEffect(() => {
		const platform = getPlatform();
		document.documentElement.classList.add(`platform-${platform}`);
		return () => {
			document.documentElement.classList.remove(`platform-${platform}`);
		};
	}, []);

	// Detect and apply system theme
	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

		const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
			document.documentElement.classList.toggle('dark', e.matches);
		};

		// Set initial theme
		updateTheme(mediaQuery);

		const handler = (e: MediaQueryListEvent) => updateTheme(e);
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	}, []);

	// Get repositories from backend
	const { data: repoList } = trpc.repo.list.useQuery();
	const { data: recentRepos } = trpc.repo.recent.useQuery();
	const { mutate: registerRepo } = trpc.repo.register.useMutation();
	const { mutate: setLastActive } = trpc.repo.setLastActive.useMutation();
	const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();

	// Track active repo changes
	useEffect(() => {
		if (activeRepo) {
			setLastActive({ repo: activeRepo });
			addRecentRepo(activeRepo);
		}
	}, [activeRepo, setLastActive, addRecentRepo]);

	// Group repos by folder
	const groupedRepos = repoList?.repos?.reduce(
		(acc, repo) => {
			const parentFolder = repo.path.split('/').slice(-2, -1)[0] ?? 'Other';
			if (!acc[parentFolder]) acc[parentFolder] = [];
			acc[parentFolder].push(repo);
			return acc;
		},
		{} as Record<string, typeof repoList.repos>
	);

	const handleOpenFolder = async () => {
		try {
			const result = await showOpenDialog({
				title: 'Open Repository',
				properties: ['openDirectory'],
			});
			if (!result.canceled && result.filePaths[0]) {
				const path = result.filePaths[0];
				registerRepo({ path });
				setActiveRepo(path);
			}
		} catch (error) {
			console.error('Failed to open folder:', error);
		}
	};

	return (
		<div className="flex h-screen">
			{/* Sidebar */}
			<aside
				className={`flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
					sidebarOpen ? 'w-60' : 'w-12'
				}`}
			>
				{/* Draggable titlebar with macOS traffic light padding */}
				<div
					className="sidebar-header flex items-center justify-between px-3 border-b border-sidebar-border"
					style={{ WebkitAppRegion: 'drag' }}
				>
					{sidebarOpen && (
						<div className="flex items-center gap-2">
							<FolderGit2 className="h-4 w-4 text-primary" />
							<span className="font-semibold text-sm select-none">Git Graph</span>
						</div>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSidebarOpen(!sidebarOpen)}
						className="h-7 w-7 p-0 ml-auto"
						style={{ WebkitAppRegion: 'no-drag' }}
					>
						{sidebarOpen ? (
							<ChevronLeft className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</Button>
				</div>

				{sidebarOpen && (
					<>
						{/* Open Repository Button */}
						<div className="p-2">
							<Button
								variant="outline"
								className="w-full justify-start gap-2 h-9"
								onClick={handleOpenFolder}
							>
								<Plus className="h-4 w-4" />
								<span>Open Repository</span>
							</Button>
						</div>

						{/* Recent Repositories */}
						{recentRepos && recentRepos.length > 0 && (
							<div className="px-2 pb-2">
								<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5 px-2 pt-1">
									<Clock className="h-3 w-3" />
									<span>Recent</span>
								</div>
								<div className="space-y-0.5">
									{recentRepos.slice(0, 5).map((repo) => (
										<button
											key={repo}
											className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
												activeRepo === repo
													? 'bg-accent text-accent-foreground'
													: 'hover:bg-accent/50 text-foreground'
											}`}
											onClick={() => setActiveRepo(repo)}
										>
											<div className="flex items-center gap-2">
												<FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
												<span className="truncate">{repo.split('/').pop()}</span>
											</div>
										</button>
									))}
								</div>
							</div>
						)}

						{/* Repository List */}
						<ScrollArea className="flex-1 px-2">
							{groupedRepos && Object.keys(groupedRepos).length > 0 && (
								<div className="pb-2">
									<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5 px-2 pt-1">
										<FolderOpen className="h-3 w-3" />
										<span>Repositories</span>
									</div>
									{Object.entries(groupedRepos).map(([folder, repos]) => (
										<div key={folder} className="mb-2">
											<div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 py-1 font-medium">
												{folder}
											</div>
											<div className="space-y-0.5">
												{repos.map((repo) => (
													<button
														key={repo.path}
														className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
															activeRepo === repo.path
																? 'bg-accent text-accent-foreground'
																: 'hover:bg-accent/50 text-foreground'
														}`}
														onClick={() => setActiveRepo(repo.path)}
													>
														<div className="flex items-center gap-2">
															<FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
															<span className="truncate">{repo.name}</span>
														</div>
													</button>
												))}
											</div>
										</div>
									))}
								</div>
							)}
						</ScrollArea>
					</>
				)}

				{/* Collapsed sidebar */}
				{!sidebarOpen && (
					<div className="flex flex-col items-center p-2 gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={handleOpenFolder}
							title="Open Repository"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				)}
			</aside>

			{/* Main Content */}
			<div className="flex-1 flex flex-col overflow-hidden bg-background">
				<Outlet />
			</div>
		</div>
	);
}

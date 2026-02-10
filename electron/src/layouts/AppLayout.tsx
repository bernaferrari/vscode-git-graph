/**
 * Main App Layout with Sidebar
 * Provides repo selection sidebar and main content area
 */

import { Outlet } from '@tanstack/react-router';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useEffect } from 'react';

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
				// Register the repo
				registerRepo({ path });
				setActiveRepo(path);
			}
		} catch (error) {
			console.error('Failed to open folder:', error);
		}
	};

	return (
		<div className="flex h-screen">
			{/* Sidebar - very translucent with macOS vibrancy */}
			<div
				className={`flex flex-col border-r bg-sidebar backdrop-blur-xl transition-all duration-300 ${
					sidebarOpen ? 'w-64' : 'w-12'
				}`}
			>
				{/* Draggable titlebar area with macOS traffic light padding */}
				<div className="flex items-center justify-between p-3 border-b border-sidebar-border sidebar-title" style={{ WebkitAppRegion: 'drag' }}>
					{sidebarOpen && (
						<span className="font-semibold text-sm select-none">Git Graph</span>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSidebarOpen(!sidebarOpen)}
						className="h-7 w-7 p-0"
						style={{ WebkitAppRegion: 'no-drag' }}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							{sidebarOpen ? (
								<polyline points="15 18 9 12 15 6" />
							) : (
								<polyline points="9 18 15 12 9 6" />
							)}
						</svg>
					</Button>
				</div>

				{sidebarOpen && (
					<>
						{/* Open Repository Button */}
						<div className="p-2">
							<Button
								variant="outline"
								className="w-full justify-start gap-2"
								onClick={handleOpenFolder}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
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
						</div>

						<Separator />

						{/* Recent Repositories */}
						{recentRepos && recentRepos.length > 0 && (
							<div className="p-2">
								<div className="text-xs font-medium text-muted-foreground mb-2 px-2">
									Recent
								</div>
								<ScrollArea className="h-auto max-h-40">
									{recentRepos.slice(0, 5).map((repo) => (
										<Button
											key={repo}
											variant={activeRepo === repo ? 'secondary' : 'ghost'}
											className="w-full justify-start text-left truncate text-xs"
											onClick={() => setActiveRepo(repo)}
										>
											{repo.split('/').pop()}
										</Button>
									))}
								</ScrollArea>
							</div>
						)}

						<Separator />

						{/* Repository List */}
						<ScrollArea className="flex-1">
							<div className="p-2">
								<div className="text-xs font-medium text-muted-foreground mb-2 px-2">
									Repositories
								</div>
								{groupedRepos &&
									Object.entries(groupedRepos).map(([folder, repos]) => (
										<div key={folder} className="mb-2">
											<div className="text-xs text-muted-foreground/70 px-2 py-1">
												{folder}
											</div>
											{repos.map((repo) => (
												<Button
													key={repo.path}
													variant={activeRepo === repo.path ? 'secondary' : 'ghost'}
													className="w-full justify-start text-left"
													onClick={() => setActiveRepo(repo.path)}
												>
													<div className="flex items-center gap-2 w-full">
														<span className="truncate flex-1">
															{repo.name}
														</span>
													</div>
												</Button>
											))}
										</div>
									))}
							</div>
						</ScrollArea>
					</>
				)}

				{/* Collapsed sidebar icons */}
				{!sidebarOpen && (
					<div className="flex flex-col items-center p-2 gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={handleOpenFolder}
							title="Open Repository"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
								<line x1="12" y1="11" x2="12" y2="17" />
								<line x1="9" y1="14" x2="15" y2="14" />
							</svg>
						</Button>
					</div>
				)}
			</div>

			{/* Main Content - solid background */}
			<div className="flex-1 flex flex-col overflow-hidden bg-background">
				<Outlet />
			</div>
		</div>
	);
}

import { Outlet } from '@tanstack/react-router';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useMemo } from 'react';
import {
	Clock,
	ChevronLeft,
	ChevronRight,
	FolderGit2,
	FolderOpen,
	Plus,
} from 'lucide-react';

// Extend CSSProperties to include webkit drag properties.
declare module 'react' {
	interface CSSProperties {
		WebkitAppRegion?: 'drag' | 'no-drag';
	}
}

const getPlatform = () => {
	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes('mac')) return 'darwin';
	if (ua.includes('win')) return 'win32';
	return 'linux';
};

export default function AppLayout() {
	const {
		activeRepo,
		addRecentRepo,
		setActiveRepo,
		setSidebarOpen,
		sidebarOpen,
	} = useAppStore();

	useEffect(() => {
		const platform = getPlatform();
		document.documentElement.classList.add(`platform-${platform}`);
		return () => {
			document.documentElement.classList.remove(`platform-${platform}`);
		};
	}, []);

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const updateTheme = (e: MediaQueryList | MediaQueryListEvent) => {
			document.documentElement.classList.toggle('dark', e.matches);
		};

		updateTheme(mediaQuery);
		const handler = (e: MediaQueryListEvent) => updateTheme(e);
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	}, []);

	const { data: repoList } = trpc.repo.list.useQuery();
	const { data: recentRepos } = trpc.repo.recent.useQuery();
	const { mutate: registerRepo } = trpc.repo.register.useMutation();
	const { mutate: setLastActive } = trpc.repo.setLastActive.useMutation();
	const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();

	useEffect(() => {
		if (activeRepo) {
			setLastActive({ repo: activeRepo });
			addRecentRepo(activeRepo);
		}
	}, [activeRepo, setLastActive, addRecentRepo]);

	const groupedRepos = useMemo(() => {
		if (!repoList?.repos?.length) {
			return {};
		}

		return repoList.repos.reduce<Record<string, typeof repoList.repos>>((acc, repo) => {
			const normalizedPath = repo.path.replace(/\\/g, '/');
			const parentFolder = normalizedPath.split('/').slice(-2, -1)[0] ?? 'Other';
			if (!acc[parentFolder]) {
				acc[parentFolder] = [];
			}
			acc[parentFolder].push(repo);
			return acc;
		}, {});
	}, [repoList?.repos]);

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
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				Skip to main content
			</a>
			<aside
				className={`app-shell-sidebar ui-reveal flex flex-col ${
					sidebarOpen ? 'w-60' : 'w-12'
				}`}
				role="navigation"
				aria-label="Repository navigation"
			>
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
						aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
					>
						{sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
					</Button>
				</div>

				{sidebarOpen && (
					<>
						<div className="p-2">
							<Button
								variant="outline"
								className="w-full justify-start gap-2 h-9"
								onClick={handleOpenFolder}
								aria-label="Open repository"
							>
								<Plus className="h-4 w-4" />
								<span>Open Repository</span>
							</Button>
						</div>

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
											type="button"
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

						<ScrollArea className="flex-1 px-2">
							{Object.keys(groupedRepos).length > 0 && (
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
														type="button"
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

							{!repoList || repoList.repos.length === 0 ? (
								<div className="empty-state ui-reveal">
									<FolderOpen className="h-6 w-6 text-muted-foreground" />
									<div className="font-medium text-foreground">No repositories yet</div>
									<div className="text-xs">
										Open a folder to start using Git Graph.
									</div>
								</div>
							) : null}
						</ScrollArea>
					</>
				)}

				{!sidebarOpen && (
					<div className="flex flex-col items-center p-2 gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={handleOpenFolder}
							title="Open Repository"
							aria-label="Open Repository"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				)}
			</aside>

			<div
				id="main-content"
				className="app-shell-main flex-1 flex flex-col overflow-hidden ui-reveal"
			>
				<Outlet />
			</div>
		</div>
	);
}

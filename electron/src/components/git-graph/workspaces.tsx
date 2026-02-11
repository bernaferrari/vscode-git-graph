/**
 * Workspaces Management
 * Group related repositories for quick access
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	FolderGit2,
	Plus,
	Trash2,
	Edit,
	Star,
	StarOff,
	FolderOpen,
	MoreHorizontal,
	Check,
	X,
	GripVertical,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export interface Workspace {
	id: string;
	name: string;
	color: string;
	repos: WorkspaceRepo[];
	createdAt: number;
	updatedAt: number;
}

export interface WorkspaceRepo {
	path: string;
	name: string;
	lastOpened?: number;
	isFavorite?: boolean;
}

const STORAGE_KEY = 'git-graph-workspaces';

const COLORS = [
	'bg-blue-500',
	'bg-green-500',
	'bg-amber-500',
	'bg-purple-500',
	'bg-pink-500',
	'bg-cyan-500',
	'bg-orange-500',
	'bg-indigo-500',
];

export function WorkspacesManager({
	open,
	onOpenChange,
	onSelectRepo,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectRepo?: (path: string) => void;
}) {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [newWorkspaceName, setNewWorkspaceName] = useState('');
	const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
	const [editName, setEditName] = useState('');

	// Load workspaces
	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setWorkspaces(JSON.parse(stored));
			} catch {
				setWorkspaces([]);
			}
		}
	}, [open]);

	// Save workspaces
	const saveWorkspaces = useCallback((ws: Workspace[]) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
		setWorkspaces(ws);
	}, []);

	// Create workspace
	const handleCreateWorkspace = () => {
		if (!newWorkspaceName.trim()) return;

		const workspace: Workspace = {
			id: `ws-${Date.now()}`,
			name: newWorkspaceName.trim(),
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			repos: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		saveWorkspaces([...workspaces, workspace]);
		setNewWorkspaceName('');
		setIsCreating(false);
		toast.success(`Created workspace "${workspace.name}"`);
	};

	// Delete workspace
	const handleDeleteWorkspace = (id: string) => {
		const ws = workspaces.find(w => w.id === id);
		if (!confirm(`Delete workspace "${ws?.name}"?`)) return;

		saveWorkspaces(workspaces.filter(w => w.id !== id));
		if (selectedWorkspace?.id === id) {
			setSelectedWorkspace(null);
		}
		toast.success('Workspace deleted');
	};

	// Rename workspace
	const handleRenameWorkspace = (id: string) => {
		if (!editName.trim()) return;

		saveWorkspaces(workspaces.map(w =>
			w.id === id
				? { ...w, name: editName.trim(), updatedAt: Date.now() }
				: w
		));
		setEditingWorkspace(null);
		toast.success('Workspace renamed');
	};

	// Add repo to workspace
	const handleAddRepo = async (workspaceId: string) => {
		// This would use Electron's dialog API
		const result = await window.electron?.ipcRenderer.invoke('open-directory-dialog');
		if (!result || result.canceled) return;

		const path = result.filePaths[0];
		const name = path.split('/').pop() || path;

		saveWorkspaces(workspaces.map(w =>
			w.id === workspaceId
				? {
						...w,
						repos: [...w.repos, { path, name, lastOpened: Date.now() }],
						updatedAt: Date.now(),
					}
				: w
		));

		toast.success(`Added "${name}" to workspace`);
	};

	// Remove repo from workspace
	const handleRemoveRepo = (workspaceId: string, repoPath: string) => {
		saveWorkspaces(workspaces.map(w =>
			w.id === workspaceId
				? {
						...w,
						repos: w.repos.filter(r => r.path !== repoPath),
						updatedAt: Date.now(),
					}
				: w
		));
	};

	// Toggle favorite
	const handleToggleFavorite = (workspaceId: string, repoPath: string) => {
		saveWorkspaces(workspaces.map(w =>
			w.id === workspaceId
				? {
						...w,
						repos: w.repos.map(r =>
							r.path === repoPath ? { ...r, isFavorite: !r.isFavorite } : r
						),
						updatedAt: Date.now(),
					}
				: w
		));
	};

	// Open repo
	const handleOpenRepo = (path: string) => {
		onSelectRepo?.(path);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderGit2 className="h-5 w-5" />
						Workspaces
					</DialogTitle>
				</DialogHeader>

				<div className="flex gap-4 flex-1 overflow-hidden">
					{/* Workspace list */}
					<div className="w-64 border rounded-lg overflow-hidden flex flex-col">
						<div className="p-2 border-b bg-muted/30 flex items-center justify-between">
							<span className="text-sm font-medium">Workspaces</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0"
								onClick={() => setIsCreating(true)}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>

						<ScrollArea className="flex-1">
							{isCreating && (
								<div className="p-2 border-b">
									<Input
										placeholder="Workspace name..."
										value={newWorkspaceName}
										onChange={(e) => setNewWorkspaceName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') handleCreateWorkspace();
											if (e.key === 'Escape') setIsCreating(false);
										}}
										autoFocus
									/>
									<div className="flex gap-1 mt-2">
										<Button size="sm" onClick={handleCreateWorkspace}>
											<Check className="h-3 w-3" />
										</Button>
										<Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
											<X className="h-3 w-3" />
										</Button>
									</div>
								</div>
							)}

							{workspaces.map(workspace => (
								<div
									key={workspace.id}
									className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 ${
										selectedWorkspace?.id === workspace.id ? 'bg-accent' : ''
									}`}
									onClick={() => setSelectedWorkspace(workspace)}
								>
									<div className={`w-3 h-3 rounded ${workspace.color}`} />
									<span className="flex-1 truncate text-sm">
										{editingWorkspace === workspace.id ? (
											<Input
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') handleRenameWorkspace(workspace.id);
													if (e.key === 'Escape') setEditingWorkspace(null);
												}}
												onClick={(e) => e.stopPropagation()}
												className="h-6"
											/>
										) : (
											workspace.name
										)}
									</span>
									<Badge variant="outline" className="text-xs">
										{workspace.repos.length}
									</Badge>
								</div>
							))}

							{workspaces.length === 0 && !isCreating && (
								<div className="p-4 text-center text-sm text-muted-foreground">
									<p>No workspaces yet</p>
									<p className="text-xs mt-1">Create one to organize your repos</p>
								</div>
							)}
						</ScrollArea>
					</div>

					{/* Repos in workspace */}
					<div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
						{selectedWorkspace ? (
							<>
								<div className="p-2 border-b bg-muted/30 flex items-center justify-between">
									<span className="text-sm font-medium">
										{selectedWorkspace.name}
									</span>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => handleAddRepo(selectedWorkspace.id)}>
												<Plus className="h-4 w-4 mr-2" />
												Add Repository
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => {
												setEditingWorkspace(selectedWorkspace.id);
												setEditName(selectedWorkspace.name);
											}}>
												<Edit className="h-4 w-4 mr-2" />
												Rename
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => handleDeleteWorkspace(selectedWorkspace.id)}
												className="text-red-600"
											>
												<Trash2 className="h-4 w-4 mr-2" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>

								<ScrollArea className="flex-1">
									{selectedWorkspace.repos.length > 0 ? (
										<div className="divide-y">
											{selectedWorkspace.repos.map(repo => (
												<div
													key={repo.path}
													className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer group"
													onClick={() => handleOpenRepo(repo.path)}
												>
													<FolderGit2 className="h-4 w-4 text-muted-foreground" />
													<div className="flex-1 min-w-0">
														<p className="font-medium text-sm truncate">{repo.name}</p>
														<p className="text-xs text-muted-foreground truncate">{repo.path}</p>
													</div>
													{repo.isFavorite && (
														<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
													)}
													<div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
														<Button
															variant="ghost"
															size="sm"
															className="h-6 w-6 p-0"
															onClick={(e) => {
																e.stopPropagation();
																handleToggleFavorite(selectedWorkspace.id, repo.path);
															}}
														>
															{repo.isFavorite ? (
																<StarOff className="h-3 w-3" />
															) : (
																<Star className="h-3 w-3" />
															)}
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="h-6 w-6 p-0 text-red-600"
															onClick={(e) => {
																e.stopPropagation();
																handleRemoveRepo(selectedWorkspace.id, repo.path);
															}}
														>
															<X className="h-3 w-3" />
														</Button>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="p-8 text-center">
											<FolderOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
											<p className="mt-4 text-muted-foreground">No repositories yet</p>
											<Button
												variant="outline"
												size="sm"
												className="mt-2"
												onClick={() => handleAddRepo(selectedWorkspace.id)}
											>
												<Plus className="h-4 w-4 mr-2" />
												Add Repository
											</Button>
										</div>
									)}
								</ScrollArea>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center text-muted-foreground">
									<FolderGit2 className="h-12 w-12 mx-auto opacity-30" />
									<p className="mt-4">Select a workspace to view repositories</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default WorkspacesManager;

/**
 * Command Palette
 * Quick access to all commands and actions (Cmd+Shift+P)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
} from '@/components/ui/dialog';
import {
	GitBranch,
	Upload,
	Download,
	Plus,
	RefreshCw,
	Settings,
	Search,
	Terminal,
	Archive,
	Key,
	History,
	FileText,
	Package,
	GitPullRequest,
	FolderGit2,
	Keyboard,
	BarChart3,
	Globe,
	Filter,
	Pin,
	Activity,
	FolderOpen,
	Command,
	FileCode,
	GitCommit,
} from 'lucide-react';

interface Command {
	id: string;
	label: string;
	description?: string;
	icon: React.ReactNode;
	category: string;
	shortcut?: string;
	action: () => void;
	keywords?: string[];
}

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actions: {
		onCreateBranch: () => void;
	onCreateTag: () => void;
	onFetch: () => void;
	onPull: () => void;
	onPush: () => void;
	onRefresh: () => void;
	onSettings: () => void;
	onSearch: () => void;
	onTerminal: () => void;
	onClone?: () => void;
	onOpenInFinder?: () => void;
	onStash: () => void;
	onCommitSigning: () => void;
	onReflog: () => void;
		onTemplates: () => void;
		onGitignore: () => void;
		onCustomCommands: () => void;
		onLFS: () => void;
		onPRIntegration: () => void;
		onWorktrees: () => void;
		onSubmodules: () => void;
		onStatistics: () => void;
		onRemotes: () => void;
		onFilters: () => void;
		onPinned: () => void;
		onLineStaging?: () => void;
		onWorkspaces?: () => void;
		onKeyboardHelp: () => void;
		onHealthCheck: () => void;
		onFuzzyFinder: () => void;
		onUndoStack?: () => void;
		onConfigEditor?: () => void;
		onExternalDiff?: () => void;
		onIssueTracker?: () => void;
		onBulkOps?: () => void;
		onFileAnnotations?: () => void;
		onActivityHeatmap?: () => void;
	};
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);

	const commands: Command[] = useMemo(() => [
		// Git Operations
		{
			id: 'pull',
			label: 'Pull from Remote',
			icon: <Download className="h-4 w-4" />,
			category: 'Git',
			shortcut: '',
			action: actions.onPull,
		},
		{
			id: 'push',
			label: 'Push to Remote',
			icon: <Upload className="h-4 w-4" />,
			category: 'Git',
			action: actions.onPush,
		},
		{
			id: 'fetch',
			label: 'Fetch from All Remotes',
			icon: <RefreshCw className="h-4 w-4" />,
			category: 'Git',
			action: actions.onFetch,
		},
		{
			id: 'create-branch',
			label: 'Create Branch',
			icon: <GitBranch className="h-4 w-4" />,
			category: 'Git',
			shortcut: '⌘B',
			action: actions.onCreateBranch,
		},
		{
			id: 'create-tag',
			label: 'Create Tag',
			icon: <Plus className="h-4 w-4" />,
			category: 'Git',
			shortcut: '⌘T',
			action: actions.onCreateTag,
		},
		{
			id: 'stash',
			label: 'Manage Stashes',
			icon: <Archive className="h-4 w-4" />,
			category: 'Git',
			action: actions.onStash,
		},
		{
			id: 'reflog',
			label: 'View Reflog',
			icon: <History className="h-4 w-4" />,
			category: 'Git',
			action: actions.onReflog,
		},
		// Tools
		{
			id: 'search',
			label: 'Search All Commits',
			icon: <Search className="h-4 w-4" />,
			category: 'Tools',
			shortcut: '⌘⇧F',
			action: actions.onSearch,
		},
		{
			id: 'fuzzy-finder',
			label: 'Fuzzy Finder',
			icon: <Command className="h-4 w-4" />,
			category: 'Tools',
			shortcut: '⌘K',
			action: actions.onFuzzyFinder,
		},
		{
			id: 'terminal',
			label: 'Toggle Terminal',
			icon: <Terminal className="h-4 w-4" />,
			category: 'Tools',
			shortcut: '⌘P',
			action: actions.onTerminal,
		},
		{
			id: 'finder',
			label: 'Reveal in Finder',
			icon: <FolderOpen className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onOpenInFinder ?? (() => {}),
		},
		...(actions.onClone ? [{
			id: 'clone',
			label: 'Clone Repository',
			icon: <Download className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onClone,
		}] : []),
		{
			id: 'statistics',
			label: 'Repository Statistics',
			icon: <BarChart3 className="h-4 w-4" />,
			category: 'Tools',
			shortcut: '⌘⇧S',
			action: actions.onStatistics,
		},
		{
			id: 'filters',
			label: 'Commit Filters',
			icon: <Filter className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onFilters,
		},
		...(actions.onLineStaging ? [{
			id: 'line-staging',
			label: 'Line Staging',
			icon: <Plus className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onLineStaging,
		}] : []),
		{
			id: 'pinned',
			label: 'Pinned Commits',
			icon: <Pin className="h-4 w-4" />,
			category: 'Tools',
			shortcut: '⌘⇧P',
			action: actions.onPinned,
		},
		// Settings
		{
			id: 'commit-signing',
			label: 'Commit Signing',
			icon: <Key className="h-4 w-4" />,
			category: 'Settings',
			action: actions.onCommitSigning,
		},
		{
			id: 'templates',
			label: 'Commit Templates',
			icon: <FileText className="h-4 w-4" />,
			category: 'Settings',
			action: actions.onTemplates,
		},
		{
			id: 'gitignore',
			label: 'Edit .gitignore',
			icon: <FileText className="h-4 w-4" />,
			category: 'Settings',
			action: actions.onGitignore,
		},
		{
			id: 'custom-commands',
			label: 'Custom Commands',
			icon: <Terminal className="h-4 w-4" />,
			category: 'Settings',
			action: actions.onCustomCommands,
		},
		{
			id: 'remotes',
			label: 'Manage Remotes',
			icon: <Globe className="h-4 w-4" />,
			category: 'Settings',
			shortcut: '⌘⇧R',
			action: actions.onRemotes,
		},
		{
			id: 'settings',
			label: 'Open Settings',
			icon: <Settings className="h-4 w-4" />,
			category: 'Settings',
			shortcut: '⌘,',
			action: actions.onSettings,
		},
		// Integrations
		{
			id: 'pr-integration',
			label: 'Pull Requests',
			icon: <GitPullRequest className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onPRIntegration,
		},
		{
			id: 'lfs',
			label: 'LFS Management',
			icon: <Package className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onLFS,
		},
		{
			id: 'worktrees',
			label: 'Worktrees',
			icon: <FolderGit2 className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onWorktrees,
		},
		{
			id: 'submodules',
			label: 'Submodules',
			icon: <Package className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onSubmodules,
		},
		...(actions.onWorkspaces ? [{
			id: 'workspaces',
			label: 'Workspaces Launchpad',
			icon: <FolderGit2 className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onWorkspaces,
		}] : []),
		// Advanced
		...(actions.onUndoStack ? [{
			id: 'undo-stack',
			label: 'Undo History',
			icon: <History className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onUndoStack,
		}] : []),
		...(actions.onConfigEditor ? [{
			id: 'config-editor',
			label: 'Git Configuration',
			icon: <Settings className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onConfigEditor,
		}] : []),
		...(actions.onExternalDiff ? [{
			id: 'external-diff',
			label: 'External Diff Settings',
			icon: <FileCode className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onExternalDiff,
		}] : []),
		...(actions.onIssueTracker ? [{
			id: 'issue-tracker',
			label: 'Issue Tracker Settings',
			icon: <GitPullRequest className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onIssueTracker,
		}] : []),
		...(actions.onBulkOps ? [{
			id: 'bulk-ops',
			label: 'Bulk Commit Operations',
			icon: <GitCommit className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onBulkOps,
		}] : []),
		...(actions.onFileAnnotations ? [{
			id: 'file-annotations',
			label: 'File Annotations',
			icon: <FileCode className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onFileAnnotations,
		}] : []),
		...(actions.onActivityHeatmap ? [{
			id: 'activity-heatmap',
			label: 'Activity Heatmap',
			icon: <BarChart3 className="h-4 w-4" />,
			category: 'Advanced',
			action: actions.onActivityHeatmap,
		}] : []),
		// Help
		{
			id: 'keyboard-shortcuts',
			label: 'Keyboard Shortcuts',
			icon: <Keyboard className="h-4 w-4" />,
			category: 'Help',
			shortcut: '?',
			action: actions.onKeyboardHelp,
		},
		{
			id: 'health-check',
			label: 'Repository Health Check',
			icon: <Activity className="h-4 w-4" />,
			category: 'Help',
			action: actions.onHealthCheck,
		},
		{
			id: 'refresh',
			label: 'Refresh Repository',
			icon: <RefreshCw className="h-4 w-4" />,
			category: 'Help',
			shortcut: '⌘R',
			action: actions.onRefresh,
		},
	], [actions]);

	const filteredCommands = useMemo(() => {
		if (!query) return commands;
		
		const lowerQuery = query.toLowerCase();
		return commands.filter(cmd => 
			cmd.label.toLowerCase().includes(lowerQuery) ||
			cmd.category.toLowerCase().includes(lowerQuery) ||
			cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
		);
	}, [commands, query]);

	// Reset selection when query changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	// Handle keyboard navigation
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
				break;
			case 'ArrowUp':
				e.preventDefault();
				setSelectedIndex(prev => Math.max(prev - 1, 0));
				break;
			case 'Enter':
				e.preventDefault();
				const selectedCommand = filteredCommands[selectedIndex];
				if (selectedCommand) {
					selectedCommand.action();
					onOpenChange(false);
					setQuery('');
				}
				break;
			case 'Escape':
				onOpenChange(false);
				setQuery('');
				break;
		}
	}, [filteredCommands, selectedIndex, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(''); }}>
			<DialogContent className="p-0 max-w-xl gap-0 ui-surface">
				<div className="ui-toolbar flex items-center px-3 py-2">
					<Search className="h-4 w-4 text-muted-foreground mr-2" />
					<Input
						placeholder="Type a command or search..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						className="border-0 focus-visible:ring-0 px-0"
						autoFocus
					/>
				</div>

				<ScrollArea className="max-h-80">
					{filteredCommands.length === 0 ? (
						<div className="py-6 text-center text-muted-foreground text-sm">
							No commands found
						</div>
					) : (
						<div className="py-2">
								{Object.entries(
									filteredCommands.reduce((acc, cmd) => {
										const bucket = acc[cmd.category] ?? [];
										bucket.push(cmd);
										acc[cmd.category] = bucket;
										return acc;
									}, {} as Record<string, Command[]>)
								).map(([category, cmds]) => (
								<div key={category}>
									<div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
										{category}
									</div>
									{cmds.map((cmd) => {
										const globalIndex = filteredCommands.indexOf(cmd);
										return (
											<div
												key={cmd.id}
												className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
													globalIndex === selectedIndex 
														? 'bg-accent' 
														: 'hover:bg-accent/50'
												}`}
												onClick={() => {
													cmd.action();
													onOpenChange(false);
													setQuery('');
												}}
												onMouseEnter={() => setSelectedIndex(globalIndex)}
											>
												<div className="text-muted-foreground">
													{cmd.icon}
												</div>
												<span className="flex-1 text-sm">{cmd.label}</span>
												{cmd.shortcut && (
													<kbd className="ui-kbd">
														{cmd.shortcut}
													</kbd>
												)}
											</div>
										);
									})}
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="ui-toolbar px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
					<span>↑↓ to navigate</span>
					<span>↵ to select</span>
					<span>esc to close</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default CommandPalette;

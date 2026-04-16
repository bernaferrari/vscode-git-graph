/**
 * Command Palette
 * Quick access to all commands and actions (Ctrl/Cmd+Shift+P)
 */

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
	Link,
	Shield,
	Bell,
	Siren,
	Users,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';

import {
	Dialog,
	DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const isMacPlatform = () => {
	if (typeof navigator === 'undefined') {
		return false;
	}
	return /mac/i.test(navigator.userAgent) || /mac/i.test(navigator.platform ?? '');
};

const shortcutLabels = {
	createBranch: isMacPlatform() ? '⌘B' : 'Ctrl+B',
	createTag: isMacPlatform() ? '⌘T' : 'Ctrl+T',
	searchCommits: isMacPlatform() ? '⌘⇧F' : 'Ctrl+Shift+F',
	fuzzyFinder: isMacPlatform() ? '⌘K' : 'Ctrl+K',
	terminal: isMacPlatform() ? '⌘P' : 'Ctrl+P',
	statistics: isMacPlatform() ? '⌘⇧S' : 'Ctrl+Shift+S',
	pinned: isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P',
	remotes: isMacPlatform() ? '⌘⇧R' : 'Ctrl+Shift+R',
	settings: isMacPlatform() ? '⌘,' : 'Ctrl+,',
	refresh: isMacPlatform() ? '⌘R' : 'Ctrl+R',
};

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

export interface CommandPaletteActions {
		onCreateBranch: () => void;
	onCreateTag: () => void;
	onFetch: () => void;
	onPull: () => void;
	onPullFfOnly?: () => void;
	onPush: () => void;
	onRefresh: () => void;
	onSettings: () => void;
	onSearch: () => void;
	onTerminal: () => void;
	onClone?: () => void;
		onOpenInFinder?: () => void;
		onCopyDeepLink?: () => void;
		onStash: () => void;
	onCommitSigning: () => void;
	onReflog: () => void;
		onTemplates: () => void;
		onGitignore: () => void;
		onCustomCommands: () => void;
		onLFS: () => void;
		onPRIntegration: () => void;
		onWorktrees?: () => void;
		onWorkflows?: () => void;
		onSubmodules: () => void;
		onStatistics: () => void;
		onRemotes: () => void;
		onFilters: () => void;
		onPinned: () => void;
		onLineStaging?: () => void;
	onWorkspaces?: () => void;
	onCollaboration?: () => void;
	onKeyboardHelp: () => void;
		onKeyboardCustomize?: () => void;
		onHealthCheck: () => void;
		onFuzzyFinder: () => void;
		onUndoStack?: () => void;
		onConfigEditor?: () => void;
		onExternalDiff?: () => void;
		onIssueTracker?: () => void;
		onBulkOps?: () => void;
		onFileAnnotations?: () => void;
		onActivityHeatmap?: () => void;
		onRepoPolicy?: () => void;
		onAuditLog?: () => void;
		onDiagnostics?: () => void;
}

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actions: CommandPaletteActions;
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
		...(actions.onPullFfOnly
			? [
					{
						id: 'pull-ff-only',
						label: 'Pull (Fast-forward only)',
						description: 'Run git pull --ff-only',
						icon: <Download className="h-4 w-4" />,
						category: 'Git',
						action: actions.onPullFfOnly,
						keywords: ['ff-only', 'fast-forward', 'pull'],
					},
				]
			: []),
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
			shortcut: shortcutLabels.createBranch,
			action: actions.onCreateBranch,
		},
		{
			id: 'create-tag',
			label: 'Create Tag',
			icon: <Plus className="h-4 w-4" />,
			category: 'Git',
			shortcut: shortcutLabels.createTag,
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
			shortcut: shortcutLabels.searchCommits,
			action: actions.onSearch,
		},
		{
			id: 'fuzzy-finder',
			label: 'Fuzzy Finder',
			icon: <Command className="h-4 w-4" />,
			category: 'Tools',
			shortcut: shortcutLabels.fuzzyFinder,
			action: actions.onFuzzyFinder,
		},
		{
			id: 'terminal',
			label: 'Toggle Terminal',
			icon: <Terminal className="h-4 w-4" />,
			category: 'Tools',
			shortcut: shortcutLabels.terminal,
			action: actions.onTerminal,
		},
		{
			id: 'finder',
			label: 'Reveal in File Manager',
			icon: <FolderOpen className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onOpenInFinder ?? (() => {}),
		},
		...(actions.onCopyDeepLink ? [{
			id: 'copy-deeplink',
			label: 'Copy Deep Link',
			icon: <Link className="h-4 w-4" />,
			category: 'Tools',
			action: actions.onCopyDeepLink,
		}] : []),
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
			shortcut: shortcutLabels.statistics,
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
			shortcut: shortcutLabels.pinned,
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
			shortcut: shortcutLabels.remotes,
			action: actions.onRemotes,
		},
		{
			id: 'settings',
			label: 'Open Settings',
			icon: <Settings className="h-4 w-4" />,
			category: 'Settings',
			shortcut: shortcutLabels.settings,
			action: actions.onSettings,
		},
		// Integrations
		{
			id: 'pr-integration',
			label: 'Pull Requests',
			description: 'Open the PR list, review workspace, comments, and merge actions',
			icon: <GitPullRequest className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['pull requests', 'review', 'merge', 'comments'],
			action: actions.onPRIntegration,
		},
		{
			id: 'lfs',
			label: 'LFS Management',
			icon: <Package className="h-4 w-4" />,
			category: 'Integrations',
			action: actions.onLFS,
		},
		...(actions.onWorktrees ? [{
			id: 'worktrees',
			label: 'Worktrees',
			description: 'Create, prune, repair, and inspect linked working trees',
			icon: <FolderGit2 className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['worktree', 'cleanup', 'review checkout'],
			action: actions.onWorktrees,
		}] : []),
		...(actions.onWorkflows ? [{
			id: 'workflows',
			label: 'Workflow Engine',
			description: 'Run and edit reusable Git workflow automations',
			icon: <Activity className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['workflow', 'automation', 'templates', 'dry run'],
			action: actions.onWorkflows,
		}] : []),
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
			description: 'Open saved workspace collections and launchpad context',
			icon: <FolderGit2 className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['workspace', 'launchpad', 'repos'],
			action: actions.onWorkspaces,
		}] : []),
		...(actions.onCollaboration ? [{
			id: 'collaboration-center',
			label: 'Collaboration Center',
			description: 'Create workspace handoffs, deep links, and reusable patch shelf items',
			icon: <Users className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['handoff', 'patch', 'share', 'workspace', 'collaboration'],
			action: actions.onCollaboration,
		}] : []),
		...(actions.onRepoPolicy ? [{
			id: 'repo-policy',
			label: 'Repo Policy',
			description: 'Open repository rules for signing, merge strategy, and stacking',
			icon: <Shield className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['policy', 'guardrails', 'signed commits', 'merge rules'],
			action: actions.onRepoPolicy,
		}] : []),
		...(actions.onAuditLog ? [{
			id: 'audit-log',
			label: 'Audit Log',
			description: 'Inspect recent Git, review, and policy events for this repository',
			icon: <Bell className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['audit', 'history', 'events', 'activity'],
			action: actions.onAuditLog,
		}] : []),
		...(actions.onDiagnostics ? [{
			id: 'diagnostics',
			label: 'Diagnostics',
			description: 'Check app protocol, packaging, and CLI helper health',
			icon: <Siren className="h-4 w-4" />,
			category: 'Integrations',
			keywords: ['diagnostics', 'protocol', 'deep link', 'gg cli'],
			action: actions.onDiagnostics,
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
		...(actions.onKeyboardCustomize ? [{
			id: 'keyboard-customize',
			label: 'Customize Keybindings',
			icon: <Keyboard className="h-4 w-4" />,
			category: 'Help',
			action: actions.onKeyboardCustomize,
		}] : []),
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
			shortcut: shortcutLabels.refresh,
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
						onChange={(e) => { setQuery(e.target.value); }}
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
									filteredCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
										const bucket = acc[cmd.category] ?? [];
										bucket.push(cmd);
										acc[cmd.category] = bucket;
										return acc;
									}, {})
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
												onMouseEnter={() => { setSelectedIndex(globalIndex); }}
											>
												<div className="text-muted-foreground">
													{cmd.icon}
												</div>
												<div className="flex-1 min-w-0">
													<div className="text-sm">{cmd.label}</div>
													{cmd.description && (
														<div className="text-muted-foreground truncate text-xs">{cmd.description}</div>
													)}
												</div>
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

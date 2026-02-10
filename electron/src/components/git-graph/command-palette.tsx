/**
 * Command Palette (Cmd+K)
 * Quick access to all actions, like VSCode
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import {
	Dialog,
	DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Command {
	id: string;
	label: string;
	category: string;
	shortcut?: string;
	icon?: string;
	action: () => void;
	keywords?: string[];
}

interface CommandPaletteProps {
	repo: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateBranch: () => void;
	onFetch: () => void;
	onPush: () => void;
	onPull: () => void;
	onStash: () => void;
	onCommit: () => void;
	onRebase: () => void;
	onMerge: () => void;
	onSettings: () => void;
}

export function CommandPalette({
	repo,
	open,
	onOpenChange,
	onCreateBranch,
	onFetch,
	onPush,
	onPull,
	onStash,
	onCommit,
	onRebase,
	onMerge,
	onSettings,
}: CommandPaletteProps) {
	const [search, setSearch] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);

	const utils = trpc.useUtils();
	const { data: branches } = trpc.git.repoInfo.useQuery(
		{ repo, showRemoteBranches: true, showStashes: false, hideRemotes: [] },
		{ enabled: open && !!repo }
	);

	const checkoutMutation = trpc.git.checkout.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
			onOpenChange(false);
		},
	});

	// Build commands list
	const commands = useMemo<Command[]>(() => {
		const cmds: Command[] = [
			// Branch commands
			{
				id: 'branch.create',
				label: 'Create Branch',
				category: 'Branch',
				shortcut: 'B',
				action: () => { onOpenChange(false); onCreateBranch(); },
				keywords: ['new', 'branch'],
			},
			{
				id: 'branch.checkout',
				label: 'Checkout Branch...',
				category: 'Branch',
				shortcut: '⇧B',
				action: () => {},
				keywords: ['switch', 'branch'],
			},

			// Remote commands
			{
				id: 'remote.fetch',
				label: 'Fetch All',
				category: 'Remote',
				shortcut: 'F',
				action: () => { onOpenChange(false); onFetch(); },
				keywords: ['download', 'remote'],
			},
			{
				id: 'remote.push',
				label: 'Push',
				category: 'Remote',
				shortcut: 'P',
				action: () => { onOpenChange(false); onPush(); },
				keywords: ['upload', 'push'],
			},
			{
				id: 'remote.pull',
				label: 'Pull',
				category: 'Remote',
				shortcut: '⇧P',
				action: () => { onOpenChange(false); onPull(); },
				keywords: ['download', 'merge'],
			},

			// Commit commands
			{
				id: 'commit.create',
				label: 'Commit',
				category: 'Commit',
				shortcut: 'C',
				action: () => { onOpenChange(false); onCommit(); },
				keywords: ['save', 'commit'],
			},
			{
				id: 'commit.amend',
				label: 'Amend Commit',
				category: 'Commit',
				action: () => { onOpenChange(false); },
				keywords: ['edit', 'fix'],
			},

			// Stash commands
			{
				id: 'stash.push',
				label: 'Stash Changes',
				category: 'Stash',
				shortcut: 'S',
				action: () => { onOpenChange(false); onStash(); },
				keywords: ['save', 'temporary'],
			},
			{
				id: 'stash.pop',
				label: 'Pop Stash',
				category: 'Stash',
				action: () => { onOpenChange(false); },
				keywords: ['apply', 'restore'],
			},

			// Merge/Rebase
			{
				id: 'merge.start',
				label: 'Merge Branch...',
				category: 'Merge',
				shortcut: 'M',
				action: () => { onOpenChange(false); onMerge(); },
				keywords: ['combine', 'branch'],
			},
			{
				id: 'rebase.start',
				label: 'Rebase...',
				category: 'Rebase',
				shortcut: 'R',
				action: () => { onOpenChange(false); onRebase(); },
				keywords: ['replay', 'commits'],
			},
			{
				id: 'rebase.interactive',
				label: 'Interactive Rebase',
				category: 'Rebase',
				action: () => { onOpenChange(false); onRebase(); },
				keywords: ['edit', 'squash', 'reorder'],
			},

			// Tag commands
			{
				id: 'tag.create',
				label: 'Create Tag',
				category: 'Tag',
				action: () => { onOpenChange(false); },
				keywords: ['version', 'release'],
			},

			// View commands
			{
				id: 'view.blame',
				label: 'Show Blame',
				category: 'View',
				action: () => { onOpenChange(false); },
				keywords: ['annotate', 'author'],
			},
			{
				id: 'view.history',
				label: 'File History',
				category: 'View',
				action: () => { onOpenChange(false); },
				keywords: ['log', 'changes'],
			},
			{
				id: 'view.reflog',
				label: 'Show Reflog',
				category: 'View',
				action: () => { onOpenChange(false); },
				keywords: ['undo', 'history'],
			},

			// Git Flow
			{
				id: 'gitflow.feature',
				label: 'Start Feature',
				category: 'Git Flow',
				action: () => { onOpenChange(false); },
			},
			{
				id: 'gitflow.release',
				label: 'Start Release',
				category: 'Git Flow',
				action: () => { onOpenChange(false); },
			},

			// Settings
			{
				id: 'settings.open',
				label: 'Open Settings',
				category: 'Settings',
				shortcut: ',',
				action: () => { onOpenChange(false); onSettings(); },
				keywords: ['preferences', 'config'],
			},

			// Help
			{
				id: 'help.shortcuts',
				label: 'Keyboard Shortcuts',
				category: 'Help',
				shortcut: '?',
				action: () => { onOpenChange(false); },
			},
		];

		// Add branch checkout commands
		if (branches?.branches) {
			for (const branch of branches.branches.slice(0, 10)) {
				const branchName = branch.toString();
				const isCurrent = branchName === branches.head;
				if (!isCurrent) {
					cmds.push({
						id: `checkout.${branchName}`,
						label: `Checkout ${branchName}`,
						category: 'Branches',
						action: () => {
							checkoutMutation.mutate({ repo, ref: branchName });
						},
					});
				}
			}
		}

		return cmds;
	}, [branches, checkoutMutation, onCreateBranch, onFetch, onMerge, onOpenChange, onPull, onPush, onRebase, onSettings, onStash, onCommit, repo]);

	// Filter commands by search
	const filteredCommands = useMemo(() => {
		if (!search.trim()) return commands;

		const searchLower = search.toLowerCase();
		return commands.filter((cmd) => {
			const matchLabel = cmd.label.toLowerCase().includes(searchLower);
			const matchCategory = cmd.category.toLowerCase().includes(searchLower);
			const matchKeywords = cmd.keywords?.some(k => k.includes(searchLower));
			return matchLabel || matchCategory || matchKeywords;
		});
	}, [commands, search]);

	// Keyboard navigation
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
				break;
			case 'ArrowUp':
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					filteredCommands[selectedIndex].action();
				}
				break;
			case 'Escape':
				onOpenChange(false);
				break;
		}
	}, [filteredCommands, selectedIndex, onOpenChange]);

	// Reset on open
	useEffect(() => {
		if (open) {
			setSearch('');
			setSelectedIndex(0);
		}
	}, [open]);

	// Reset selection when filter changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [filteredCommands.length]);

	// Group by category
	const groupedCommands = useMemo(() => {
		const groups: Record<string, Command[]> = {};
		for (const cmd of filteredCommands) {
			if (!groups[cmd.category]) {
				groups[cmd.category] = [];
			}
			groups[cmd.category]!.push(cmd);
		}
		return groups;
	}, [filteredCommands]);

	let flatIndex = -1;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-0 gap-0 max-w-lg">
				{/* Search input */}
				<div className="border-b p-3">
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a command or search..."
						className="border-0 shadow-none focus-visible:ring-0 text-sm"
						autoFocus
					/>
				</div>

				{/* Commands list */}
				<ScrollArea className="max-h-80">
					{filteredCommands.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground text-sm">
							No commands found
						</div>
					) : (
						<div className="py-2">
							{Object.entries(groupedCommands).map(([category, cmds]) => (
								<div key={category}>
									<div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
										{category}
									</div>
									{cmds.map((cmd) => {
										flatIndex++;
										const idx = flatIndex;
										return (
											<button
												key={cmd.id}
												onClick={() => cmd.action()}
												onMouseEnter={() => setSelectedIndex(idx)}
												className={cn(
													'w-full flex items-center justify-between px-3 py-2 text-sm',
													selectedIndex === idx && 'bg-accent'
												)}
											>
												<span>{cmd.label}</span>
												{cmd.shortcut && (
													<kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">
														{cmd.shortcut}
													</kbd>
												)}
											</button>
										);
									})}
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				{/* Footer hints */}
				<div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
					<span>
						<kbd className="px-1 bg-muted rounded mx-0.5">↑↓</kbd> navigate
						<kbd className="px-1 bg-muted rounded mx-0.5 ml-2">↵</kbd> select
						<kbd className="px-1 bg-muted rounded mx-0.5 ml-2">esc</kbd> close
					</span>
					<span className="flex items-center gap-1">
						<Badge variant="outline" className="text-xs">⌘K</Badge>
						to open
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Hook to manage command palette keyboard shortcut
 */
export function useCommandPalette() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				setOpen(true);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	return { open, setOpen };
}

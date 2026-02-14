/**
 * Lens-Aware Command Palette
 * Commands filtered/adjusted based on current lens mode
 */

import { useMemo, useState, useEffect } from 'react';
import { Command } from '@/components/ui/command';
import { useLensMode, type LensMode } from '@/components/lens';
import { GitBranch, GitCommit, GitPullRequest, Settings, Keyboard, Terminal, Compass, Wand2, Eye, Zap, Shield, Info } from 'lucide-react';

export interface CommandItem {
	id: string;
	label: string;
	shortcut?: string;
	icon?: React.ElementType;
	action: () => void;
	lensModes: LensMode[];
	category: 'navigation' | 'git' | 'view' | 'settings' | 'ai';
}

interface LensCommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commands: CommandItem[];
	onExecute: (commandId: string) => void;
}

export function LensCommandPalette({
	open,
	onOpenChange,
	commands,
	onExecute,
}: LensCommandPaletteProps) {
	const { mode, setLensMode, config } = useLensMode();
	const [search, setSearch] = useState('');

	// Filter commands based on lens mode
	const filteredCommands = useMemo(() => {
		let filtered = commands.filter((cmd) => cmd.lensModes.includes(mode));

		if (search) {
			const searchLower = search.toLowerCase();
			filtered = filtered.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(searchLower) ||
					cmd.category.toLowerCase().includes(searchLower)
			);
		}

		// Group by category
		const grouped: Record<string, CommandItem[]> = {};
		filtered.forEach((cmd) => {
			if (!grouped[cmd.category]) {
				grouped[cmd.category] = [];
			}
			grouped[cmd.category].push(cmd);
		});

		return grouped;
	}, [commands, mode, search]);

	// Add lens-switching commands
	const lensCommands = useMemo(() => [
		{
			id: 'lens-guided',
			label: 'Switch to Guided Mode',
			shortcut: '⌘1',
			icon: Compass,
			action: () => setLensMode('guided'),
			lensModes: ['craft', 'control'] as LensMode[],
			category: 'settings' as const,
		},
		{
			id: 'lens-craft',
			label: 'Switch to Craft Mode',
			shortcut: '⌘2',
			icon: Wand2,
			action: () => setLensMode('craft'),
			lensModes: ['guided', 'control'] as LensMode[],
			category: 'settings' as const,
		},
		{
			id: 'lens-control',
			label: 'Switch to Control Mode',
			shortcut: '⌘3',
			icon: Terminal,
			action: () => setLensMode('control'),
			lensModes: ['guided', 'craft'] as LensMode[],
			category: 'settings' as const,
		},
	], [setLensMode]);

	// Combine regular commands with lens commands
	const allCommands = useMemo(() => {
		const combined = [...commands, ...lensCommands];
		let filtered = combined.filter((cmd) => cmd.lensModes.includes(mode));

		if (search) {
			const searchLower = search.toLowerCase();
			filtered = filtered.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(searchLower) ||
					cmd.category.toLowerCase().includes(searchLower)
			);
		}

		// Group by category
		const grouped: Record<string, CommandItem[]> = {};
		filtered.forEach((cmd) => {
			if (!grouped[cmd.category]) {
				grouped[cmd.category] = [];
			}
			grouped[cmd.category].push(cmd);
		});

		return grouped;
	}, [commands, lensCommands, mode, search]);

	const categoryLabels: Record<string, string> = {
		navigation: 'Navigation',
		git: 'Git Actions',
		view: 'View',
		settings: 'Settings & Modes',
		ai: 'AI Features',
	};

	const categoryIcons: Record<string, React.ElementType> = {
		navigation: GitBranch,
		git: GitCommit,
		view: Eye,
		settings: Settings,
		ai: Zap,
	};

	return (
		<Command
			open={open}
			onOpenChange={onOpenChange}
			className="max-w-lg"
		>
			<div className="border-b px-3 py-2">
				<input
					type="text"
					placeholder="Type a command or search..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground"
					autoFocus
				/>
			</div>
			<div className="max-h-[400px] overflow-y-auto p-2">
				{Object.entries(allCommands).map(([category, items]) => {
					if (items.length === 0) return null;
					const CategoryIcon = categoryIcons[category] || Info;
					return (
						<div key={category} className="mb-3">
							<div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
								<CategoryIcon className="h-3 w-3" />
								{categoryLabels[category] || category}
							</div>
							{items.map((cmd) => {
								const CmdIcon = cmd.icon || Info;
								return (
									<button
										key={cmd.id}
										onClick={() => {
											cmd.action();
											onOpenChange(false);
										}}
										className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
									>
										<div className="flex items-center gap-2">
											<CmdIcon className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm">{cmd.label}</span>
										</div>
										{cmd.shortcut && (
											<kbd className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
												{cmd.shortcut}
											</kbd>
										)}
									</button>
								);
							})}
						</div>
					);
				})}
				{Object.keys(allCommands).length === 0 && (
					<div className="py-8 text-center text-muted-foreground">
						<p className="text-sm">No commands found</p>
					</div>
				)}
			</div>
			<div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
				<span>Current: {config.label} Mode</span>
				<div className="flex gap-2">
					<span>↑↓ Navigate</span>
					<span>↵ Select</span>
					<span>Esc Close</span>
				</div>
			</div>
		</Command>
	);
}

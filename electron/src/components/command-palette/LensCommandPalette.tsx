/**
 * Lens-Aware Command Palette
 * Commands filtered/adjusted based on current lens mode
 */

import { GitBranch, GitCommit, Settings, Terminal, Compass, Wand2, Eye, Zap, Info } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useLensMode, type LensMode } from '@/components/lens';
import { CommandDialog } from '@/components/ui/command';

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
}

export function LensCommandPalette({
	open,
	onOpenChange,
	commands,
}: LensCommandPaletteProps) {
	const { mode, setLensMode, config } = useLensMode();
	const [search, setSearch] = useState('');

	// Add lens-switching commands
	const lensCommands = useMemo(() => [
		{
			id: 'lens-guided',
			label: 'Switch to Guided Mode',
			shortcut: '⌘1',
			icon: Compass,
			action: () => { setLensMode('guided'); },
			lensModes: ['craft', 'control'] as LensMode[],
			category: 'settings' as const,
		},
		{
			id: 'lens-craft',
			label: 'Switch to Craft Mode',
			shortcut: '⌘2',
			icon: Wand2,
			action: () => { setLensMode('craft'); },
			lensModes: ['guided', 'control'] as LensMode[],
			category: 'settings' as const,
		},
		{
			id: 'lens-control',
			label: 'Switch to Control Mode',
			shortcut: '⌘3',
			icon: Terminal,
			action: () => { setLensMode('control'); },
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
			(grouped[cmd.category] ??= []).push(cmd);
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
	<CommandDialog open={open} onOpenChange={onOpenChange} className='max-w-lg'>
		<div className='border-b px-3 py-2'>
			<input
				type='text'
				placeholder='Type a command or search...'
				value={search}
				onChange={(e) => { setSearch(e.target.value); }}
				className='text-muted-foreground w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground'
				autoFocus
			/>
		</div>
		<div className='max-h-[400px] overflow-y-auto p-2'>
			{Object.entries(allCommands).map(([category, items]) => {
				if (items.length === 0) return null;
				const CategoryIcon = categoryIcons[category] || Info;
				return (
					<div key={category} className='mb-3'>
						<div className='text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs font-medium uppercase'>
							<CategoryIcon className='h-3 w-3' />
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
									className='hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors'
								>
									<div className='flex items-center gap-2'>
										<CmdIcon className='text-muted-foreground h-4 w-4' />
										<span className='text-sm'>{cmd.label}</span>
									</div>
									{cmd.shortcut && (
										<kbd className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs'>
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
				<div className='text-muted-foreground py-8 text-center'>
					<p className='text-sm'>No commands found</p>
				</div>
			)}
		</div>
		<div className='text-muted-foreground border-t px-3 py-2 text-xs flex items-center justify-between'>
			<span>Current: {config.label} Mode</span>
			<div className='flex gap-2'>
				<span>↑↓ Navigate</span>
				<span>↵ Select</span>
				<span>Esc Close</span>
			</div>
		</div>
	</CommandDialog>
	);
}

/**
 * Custom Git Commands
 * Define and run custom git commands with aliases
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Terminal,
	Plus,
	Trash2,
	Play,
	Edit,
	Save,
	Search,
	Copy,
	Check,
	Clock,
	AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface CustomCommand {
	id: string;
	name: string;
	command: string;
	description?: string;
	alias?: string;
	lastUsed?: number;
	useCount: number;
}

interface CustomCommandsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = 'git-graph-custom-commands';

const DEFAULT_COMMANDS: CustomCommand[] = [
	{
		id: '1',
		name: 'List Untracked Files',
		command: 'ls-files --others --exclude-standard',
		description: 'Show all untracked files',
		useCount: 0,
	},
	{
		id: '2',
		name: 'Clean Untracked',
		command: 'clean -n',
		description: 'Preview what would be removed (dry run)',
		useCount: 0,
	},
	{
		id: '3',
		name: 'Prune Remote',
		command: 'remote prune origin',
		description: 'Remove stale remote-tracking branches',
		useCount: 0,
	},
	{
		id: '4',
		name: 'Show Remotes',
		command: 'remote -v',
		description: 'List all remotes with URLs',
		useCount: 0,
	},
	{
		id: '5',
		name: 'Compact GC',
		command: 'gc --aggressive --prune=now',
		description: 'Aggressively optimize repository',
		useCount: 0,
	},
	{
		id: '6',
		name: 'Show Config',
		command: 'config --list --local',
		description: 'Show local repository configuration',
		useCount: 0,
	},
];

export function useCustomCommands() {
	const [commands, setCommands] = useState<CustomCommand[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setCommands(JSON.parse(stored));
			} catch {
				setCommands(DEFAULT_COMMANDS);
			}
		} else {
			setCommands(DEFAULT_COMMANDS);
		}
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
	}, [commands]);

	const addCommand = (command: Omit<CustomCommand, 'id' | 'useCount'>) => {
		const newCommand: CustomCommand = {
			...command,
			id: Date.now().toString(),
			useCount: 0,
		};
		setCommands(prev => [...prev, newCommand]);
	};

	const updateCommand = (id: string, updates: Partial<CustomCommand>) => {
		setCommands(prev => prev.map(c => 
			c.id === id ? { ...c, ...updates } : c
		));
	};

	const deleteCommand = (id: string) => {
		setCommands(prev => prev.filter(c => c.id !== id));
	};

	const incrementUseCount = (id: string) => {
		setCommands(prev => prev.map(c =>
			c.id === id ? { ...c, useCount: c.useCount + 1, lastUsed: Date.now() } : c
		));
	};

	return {
		commands,
		addCommand,
		updateCommand,
		deleteCommand,
		incrementUseCount,
	};
}

export function CustomCommands({ open, onOpenChange }: CustomCommandsProps) {
	const { activeRepo } = useAppStore();
	const { commands, addCommand, updateCommand, deleteCommand, incrementUseCount } = useCustomCommands();
	const [searchQuery, setSearchQuery] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
	const [output, setOutput] = useState<string | null>(null);
	const [runningCommand, setRunningCommand] = useState<string | null>(null);

	const [newCommand, setNewCommand] = useState({
		name: '',
		command: '',
		description: '',
		alias: '',
	});

	// Run custom command mutation
	const runCommand = async (cmd: CustomCommand) => {
		if (!activeRepo) return;
		
		setRunningCommand(cmd.id);
		setOutput(null);
		
		try {
			const result = await trpc.git.runCustomCommand.mutate({
				repo: activeRepo,
				command: cmd.command,
			});
			
			setOutput(result.output ?? result.error ?? 'No output');
			incrementUseCount(cmd.id);
			
			if (!result.error) {
				toast.success(`Command "${cmd.name}" completed`);
			}
		} catch (error) {
			setOutput(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			setRunningCommand(null);
		}
	};

	const filteredCommands = commands.filter(c =>
		c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		c.command.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const handleSaveNew = () => {
		if (!newCommand.name || !newCommand.command) return;
		addCommand(newCommand);
		setNewCommand({ name: '', command: '', description: '', alias: '' });
		setIsCreating(false);
	};

	const handleUpdate = () => {
		if (!editingCommand) return;
		updateCommand(editingCommand.id, editingCommand);
		setEditingCommand(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Terminal className="h-5 w-5" />
						Custom Commands
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center gap-2 py-2">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search commands..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsCreating(true)}
					>
						<Plus className="h-4 w-4 mr-1" />
						New
					</Button>
				</div>

				<ScrollArea className="flex-1">
					{isCreating && (
						<div className="p-4 border rounded-lg mb-4 bg-muted/30">
							<h4 className="font-medium mb-3">New Command</h4>
							<div className="space-y-3">
								<Input
									placeholder="Command name"
									value={newCommand.name}
									onChange={(e) => setNewCommand(prev => ({ ...prev, name: e.target.value }))}
								/>
								<Input
									placeholder="git <command>"
									value={newCommand.command}
									onChange={(e) => setNewCommand(prev => ({ ...prev, command: e.target.value }))}
									className="font-mono"
								/>
								<Input
									placeholder="Description (optional)"
									value={newCommand.description}
									onChange={(e) => setNewCommand(prev => ({ ...prev, description: e.target.value }))}
								/>
								<Input
									placeholder="Short alias (optional)"
									value={newCommand.alias}
									onChange={(e) => setNewCommand(prev => ({ ...prev, alias: e.target.value }))}
								/>
								<div className="flex justify-end gap-2">
									<Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
										Cancel
									</Button>
									<Button size="sm" onClick={handleSaveNew}>
										Save
									</Button>
								</div>
							</div>
						</div>
					)}

					<div className="space-y-2">
						{filteredCommands.map((cmd) => (
							<div
								key={cmd.id}
								className="border rounded-lg p-3 hover:bg-accent/50"
							>
								{editingCommand?.id === cmd.id ? (
									<div className="space-y-3">
										<Input
											placeholder="Command name"
											value={editingCommand.name}
											onChange={(e) => setEditingCommand(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
										/>
										<Input
											placeholder="git <command>"
											value={editingCommand.command}
											onChange={(e) => setEditingCommand(prev => prev ? ({ ...prev, command: e.target.value }) : null)}
											className="font-mono"
										/>
										<div className="flex justify-end gap-2">
											<Button variant="outline" size="sm" onClick={() => setEditingCommand(null)}>
												Cancel
											</Button>
											<Button size="sm" onClick={handleUpdate}>
												Save
											</Button>
										</div>
									</div>
								) : (
									<>
										<div className="flex items-start gap-3">
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<span className="font-medium">{cmd.name}</span>
													{cmd.alias && (
														<code className="text-xs px-1.5 py-0.5 rounded bg-muted">
															:{cmd.alias}
														</code>
													)}
													<span className="text-xs text-muted-foreground">
														({cmd.useCount} uses)
													</span>
												</div>
												<code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded block">
													git {cmd.command}
												</code>
												{cmd.description && (
													<p className="text-xs text-muted-foreground mt-1">
														{cmd.description}
													</p>
												)}
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="outline"
													size="sm"
													onClick={() => runCommand(cmd)}
													disabled={runningCommand === cmd.id}
												>
													{runningCommand === cmd.id ? (
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
													) : (
														<Play className="h-4 w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditingCommand(cmd)}
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-red-600"
													onClick={() => deleteCommand(cmd.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</>
								)}
							</div>
						))}

						{filteredCommands.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								<Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p>No commands found</p>
							</div>
						)}
					</div>
				</ScrollArea>

				{output && (
					<div className="border rounded-lg p-3 bg-muted/30">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium">Output</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									navigator.clipboard.writeText(output);
									toast.success('Copied to clipboard');
								}}
							>
								<Copy className="h-3 w-3" />
							</Button>
						</div>
						<pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
							{output}
						</pre>
					</div>
				)}

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Tip: Commands run in the context of the current repository
				</div>
			</DialogContent>
		</Dialog>
	);
}

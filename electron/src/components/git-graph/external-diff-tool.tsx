/**
 * External Diff Tool
 * Support for opening diffs in external tools like VSCode, Beyond Compare, etc.
 */

import {
	ExternalLink,
	Plus,
	Trash2,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Switch,
} from '@/components/ui/switch';
import { trpcClient } from '@/lib/trpcClient';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


// Predefined diff tools
interface DiffTool {
	id: string;
	name: string;
	command: string;
	args: string;
	supports3Way: boolean;
	supportsDirDiff: boolean;
	icon?: string;
}

const PREDEFINED_TOOLS: DiffTool[] = [
	{
		id: 'vscode',
		name: 'VS Code',
		command: 'code',
		args: '--diff "$LOCAL" "$REMOTE"',
		supports3Way: false,
		supportsDirDiff: false,
	},
	{
		id: 'vscode-insiders',
		name: 'VS Code Insiders',
		command: 'code-insiders',
		args: '--diff "$LOCAL" "$REMOTE"',
		supports3Way: false,
		supportsDirDiff: false,
	},
	{
		id: 'bcompare',
		name: 'Beyond Compare',
		command: 'bcompare',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: true,
	},
	{
		id: 'meld',
		name: 'Meld',
		command: 'meld',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: true,
	},
	{
		id: 'kdiff3',
		name: 'KDiff3',
		command: 'kdiff3',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: true,
	},
	{
		id: 'p4merge',
		name: 'P4Merge',
		command: 'p4merge',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: false,
	},
	{
		id: 'diffmerge',
		name: 'DiffMerge',
		command: 'diffmerge',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: false,
	},
	{
		id: 'tkdiff',
		name: 'TkDiff',
		command: 'tkdiff',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: false,
		supportsDirDiff: false,
	},
	{
		id: 'araxis',
		name: 'Araxis Merge',
		command: 'compare',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: true,
	},
	{
		id: ' Kaleidoscope',
		name: 'Kaleidoscope',
		command: 'ksdiff',
		args: '"$LOCAL" "$REMOTE"',
		supports3Way: false,
		supportsDirDiff: false,
	},
	{
		id: 'intellij',
		name: 'IntelliJ IDEA',
		command: 'idea',
		args: 'diff "$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: false,
	},
	{
		id: 'sublime',
		name: 'Sublime Merge',
		command: 'smerge',
		args: 'mergetool "$LOCAL" "$REMOTE"',
		supports3Way: true,
		supportsDirDiff: false,
	},
];

interface DiffToolConfig {
	tools: DiffTool[];
	selectedTool: string;
	useForMergeConflicts: boolean;
}

const DEFAULT_DIFF_TOOL_CONFIG: DiffToolConfig = {
    tools: PREDEFINED_TOOLS,
    selectedTool: 'vscode',
    useForMergeConflicts: false,
};

function useExternalDiffConfigState() {
    const [config, setConfig] = useState<DiffToolConfig>(DEFAULT_DIFF_TOOL_CONFIG);
    const utils = trpc.useUtils();
    const configQuery = trpc.config.externalDiffConfig.useQuery(undefined, { staleTime: 10_000 });
    const setConfigMutation = trpc.config.setExternalDiffConfig.useMutation({
        onSuccess: async () => {
            await utils.config.externalDiffConfig.invalidate();
        },
    });

    useEffect(() => {
        const stored = configQuery.data?.config;
        if (!stored) {
            return;
        }

        setConfig({
            tools: stored.tools.length > 0 ? stored.tools : PREDEFINED_TOOLS,
            selectedTool: stored.selectedTool || 'vscode',
            useForMergeConflicts: stored.useForMergeConflicts,
        });
    }, [configQuery.data?.config]);

    const persistConfig = (nextConfig: DiffToolConfig) => {
        setConfig(nextConfig);
        setConfigMutation.mutate(nextConfig);
    };

    return { config, persistConfig };
}

export function ExternalDiffConfig({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { config, persistConfig } = useExternalDiffConfigState();

	const [isAddingCustom, setIsAddingCustom] = useState(false);
	const [customTool, setCustomTool] = useState<Partial<DiffTool>>({
		name: '',
		command: '',
		args: '$LOCAL $REMOTE',
	});

	const selectedToolInfo = useMemo(() => {
		return config.tools.find(t => t.id === config.selectedTool);
	}, [config.tools, config.selectedTool]);

	const handleSelectTool = (toolId: string | null) => {
		if (!toolId) {
			return;
		}
		persistConfig({ ...config, selectedTool: toolId });
	};

	const handleToggleMergeConflicts = (enabled: boolean) => {
		persistConfig({ ...config, useForMergeConflicts: enabled });
	};

	const handleAddCustomTool = () => {
		if (!customTool.name || !customTool.command) {
			toast.error('Name and command are required');
			return;
		}

		const newTool: DiffTool = {
			id: `custom-${Date.now()}`,
			name: customTool.name,
			command: customTool.command,
			args: customTool.args || '$LOCAL $REMOTE',
			supports3Way: false,
			supportsDirDiff: false,
		};

		persistConfig({
            ...config,
            tools: [...config.tools, newTool],
        });

		setCustomTool({ name: '', command: '', args: '$LOCAL $REMOTE' });
		setIsAddingCustom(false);
		toast.success('Custom tool added');
	};

	const handleDeleteTool = (toolId: string) => {
		if (toolId.startsWith('custom-')) {
			persistConfig({
                ...config,
                tools: config.tools.filter(t => t.id !== toolId),
                selectedTool: config.selectedTool === toolId ? 'vscode' : config.selectedTool,
            });
		} else {
			toast.error('Cannot delete predefined tools');
		}
	};

	const handleTestTool = async () => {
		if (!selectedToolInfo) return;

		try {
			await trpcClient.git.testDiffTool.mutate({
				command: selectedToolInfo.command,
			});
			toast.success(`${selectedToolInfo.name} is available`);
		} catch {
			toast.error(`${selectedToolInfo.name} not found in PATH`);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ExternalLink className="h-5 w-5" />
						External Diff Tool
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-hidden space-y-6">
					{/* Tool Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium">Diff Tool</label>
						<Select value={config.selectedTool} onValueChange={handleSelectTool}>
							<SelectTrigger>
								<SelectValue placeholder="Select a diff tool" />
							</SelectTrigger>
							<SelectContent>
								{config.tools.map(tool => (
									<SelectItem key={tool.id} value={tool.id}>
										{tool.name}
										{tool.id.startsWith('custom-') && ' (Custom)'}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Selected Tool Info */}
					{selectedToolInfo && (
						<div className="bg-muted/50 rounded-lg p-4 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-medium">{selectedToolInfo.name}</span>
								<Button variant="outline" size="sm" onClick={handleTestTool}>
									Test
								</Button>
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-muted-foreground">Command:</span>
									<code className="ml-2 bg-muted px-1 rounded text-xs">
										{selectedToolInfo.command}
									</code>
								</div>
								<div>
									<span className="text-muted-foreground">3-Way Merge:</span>
									<span className="ml-2">
										{selectedToolInfo.supports3Way ? '✓' : '✗'}
									</span>
								</div>
							</div>
							<div className="text-sm">
								<span className="text-muted-foreground">Arguments:</span>
								<code className="ml-2 bg-muted px-1 rounded text-xs block mt-1">
									{selectedToolInfo.args}
								</code>
							</div>
						</div>
					)}

					{/* Options */}
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">Use for merge conflicts</p>
							<p className="text-sm text-muted-foreground">
								Open merge conflicts in external tool
							</p>
						</div>
						<Switch
							checked={config.useForMergeConflicts}
							onCheckedChange={handleToggleMergeConflicts}
						/>
					</div>

					{/* Custom Tools */}
					<div className="border-t pt-4">
						<div className="flex items-center justify-between mb-3">
							<span className="font-medium">Custom Tools</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => { setIsAddingCustom(!isAddingCustom); }}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add Custom
							</Button>
						</div>

						{isAddingCustom && (
							<div className="bg-muted/30 rounded-lg p-4 space-y-3 mb-3">
								<Input
									placeholder="Tool name"
									value={customTool.name || ''}
									onChange={e => { setCustomTool(prev => ({ ...prev, name: e.target.value })); }}
								/>
								<Input
									placeholder="Command (e.g., code, bcompare)"
									value={customTool.command || ''}
									onChange={e => { setCustomTool(prev => ({ ...prev, command: e.target.value })); }}
								/>
								<Input
									placeholder="Arguments (use $LOCAL, $REMOTE, $BASE, $MERGED)"
									value={customTool.args || ''}
									onChange={e => { setCustomTool(prev => ({ ...prev, args: e.target.value })); }}
								/>
								<div className="flex justify-end gap-2">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => { setIsAddingCustom(false); }}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={handleAddCustomTool}>
										Add Tool
									</Button>
								</div>
							</div>
						)}

						<ScrollArea className="h-40">
							<div className="space-y-1">
								{config.tools.filter(t => t.id.startsWith('custom-')).map(tool => (
									<div
										key={tool.id}
										className="flex items-center justify-between p-2 rounded hover:bg-accent/50"
									>
										<div>
											<span className="font-medium">{tool.name}</span>
											<code className="ml-2 text-xs text-muted-foreground">
												{tool.command}
											</code>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-red-600"
											onClick={() => { handleDeleteTool(tool.id); }}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
								{config.tools.filter(t => t.id.startsWith('custom-')).length === 0 && (
									<p className="text-sm text-muted-foreground text-center py-4">
										No custom tools added
									</p>
								)}
							</div>
						</ScrollArea>
					</div>

					{/* Variable Reference */}
					<div className="bg-muted/30 rounded-lg p-3 text-xs">
						<p className="font-medium mb-2">Available Variables:</p>
						<div className="grid grid-cols-2 gap-2 text-muted-foreground">
							<code>$LOCAL</code><span>- Local version (yours)</span>
							<code>$REMOTE</code><span>- Remote version (theirs)</span>
							<code>$BASE</code><span>- Common ancestor</span>
							<code>$MERGED</code><span>- Merged output file</span>
						</div>
					</div>
				</div>

				<DialogFooter className="ui-toolbar">
					<Button variant="ghost" onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Quick action button to open external diff
export function OpenInExternalDiffButton({
	filePath,
	commitHash,
	onCommit,
	variant = 'ghost',
}: {
	filePath: string;
	commitHash?: string;
	onCommit?: string;
	variant?: 'ghost' | 'outline' | 'default';
}) {
	const { activeRepo } = useAppStore();
    const configQuery = trpc.config.externalDiffConfig.useQuery(undefined, { staleTime: 10_000 });

	const handleOpen = async () => {
		const config = configQuery.data?.config;
        const resolvedConfig: DiffToolConfig = config
            ? {
                  tools: config.tools.length > 0 ? config.tools : PREDEFINED_TOOLS,
                  selectedTool: config.selectedTool || 'vscode',
                  useForMergeConflicts: config.useForMergeConflicts,
              }
            : DEFAULT_DIFF_TOOL_CONFIG;

		const tool = PREDEFINED_TOOLS.find(t => t.id === resolvedConfig.selectedTool) ||
			resolvedConfig.tools.find(t => t.id === resolvedConfig.selectedTool);

		if (!tool) {
			toast.error('No diff tool configured');
			return;
		}

		try {
			await trpcClient.git.openExternalDiff.mutate({
				repo: activeRepo ?? '',
				filePath,
				commitHash,
				onCommit,
				command: tool.command,
				args: tool.args,
			});
		} catch (error) {
			toast.error('Failed to open external diff', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	};

	return (
		<Button variant={variant} size="sm" onClick={handleOpen}>
			<ExternalLink className="h-4 w-4 mr-1" />
			Open Externally
		</Button>
	);
}

// Hook to get current diff tool
export function useDiffTool() {
    const configQuery = trpc.config.externalDiffConfig.useQuery(undefined, { staleTime: 10_000 });
	return useMemo(() => {
        const config = configQuery.data?.config;
        const resolvedConfig: DiffToolConfig = config
            ? {
                  tools: config.tools.length > 0 ? config.tools : PREDEFINED_TOOLS,
                  selectedTool: config.selectedTool || 'vscode',
                  useForMergeConflicts: config.useForMergeConflicts,
              }
            : DEFAULT_DIFF_TOOL_CONFIG;
		return PREDEFINED_TOOLS.find(t => t.id === resolvedConfig.selectedTool) ||
			resolvedConfig.tools.find(t => t.id === resolvedConfig.selectedTool) ||
			PREDEFINED_TOOLS[0];
	}, [configQuery.data?.config]);
}

export default ExternalDiffConfig;

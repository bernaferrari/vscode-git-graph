/**
 * Git Config Editor
 * Visual editor for .gitconfig with sections and key-value pairs
 */

import {
	Settings,
	Plus,
	Trash2,
	Edit,
	Save,
	RotateCcw,
	Search,
	Check,
	X,
	AlertTriangle,
	Loader2,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { trpcClient } from '@/lib/trpcClient';


interface ConfigSection {
	name: string;
	keys: ConfigKey[];
}

interface ConfigKey {
	key: string;
	value: string;
	source: 'system' | 'global' | 'local';
	modified?: boolean;
}

function buildConfigSections(result: Record<string, unknown>): ConfigSection[] {
	const sectionMap = new Map<string, ConfigKey[]>();

	Object.entries(result).forEach(([key, value]) => {
		const [section, ...rest] = key.split('.');
		if (!section) {
			return;
		}

		const subKey = rest.join('.');
		const keys = sectionMap.get(section) ?? [];
		keys.push({
			key: subKey,
			value: String(value),
			source: 'global',
		});
		sectionMap.set(section, keys);
	});

	const sections: ConfigSection[] = [];
	sectionMap.forEach((keys, name) => {
		sections.push({ name, keys });
	});

	sections.sort((a, b) => a.name.localeCompare(b.name));
	return sections;
}

// Common config keys with descriptions
const CONFIG_INFO: Record<string, { description: string; type: 'string' | 'boolean' | 'number' | 'path' }> = {
	'user.name': { description: 'Your name for commits', type: 'string' },
	'user.email': { description: 'Your email for commits', type: 'string' },
	'user.signingkey': { description: 'GPG key for signing commits', type: 'string' },
	'core.editor': { description: 'Default text editor', type: 'string' },
	'core.autocrlf': { description: 'Line ending conversion', type: 'string' },
	'core.safecrlf': { description: 'Warn about CRLF issues', type: 'boolean' },
	'core.ignorecase': { description: 'Ignore case in file names', type: 'boolean' },
	'core.filemode': { description: 'Track file permissions', type: 'boolean' },
	'core.pager': { description: 'Pager program', type: 'string' },
	'core.whitespace': { description: 'Whitespace error detection', type: 'string' },
	'init.defaultBranch': { description: 'Default branch name', type: 'string' },
	'pull.rebase': { description: 'Rebase on pull', type: 'boolean' },
	'pull.ff': { description: 'Fast-forward behavior', type: 'string' },
	'push.default': { description: 'Push behavior', type: 'string' },
	'fetch.prune': { description: 'Prune on fetch', type: 'boolean' },
	'rebase.autoStash': { description: 'Auto stash before rebase', type: 'boolean' },
	'merge.conflictstyle': { description: 'Conflict marker style', type: 'string' },
	'merge.tool': { description: 'Default merge tool', type: 'string' },
	'diff.tool': { description: 'Default diff tool', type: 'string' },
	'diff.algorithm': { description: 'Diff algorithm', type: 'string' },
	'diff.colorMoved': { description: 'Color moved lines', type: 'boolean' },
	'commit.gpgsign': { description: 'Sign commits by default', type: 'boolean' },
	'commit.verbose': { description: 'Verbose commit messages', type: 'boolean' },
	'color.ui': { description: 'Color output', type: 'boolean' },
	'color.diff': { description: 'Color diff output', type: 'boolean' },
	'color.status': { description: 'Color status output', type: 'boolean' },
	'color.branch': { description: 'Color branch output', type: 'boolean' },
	'alias.*': { description: 'Git alias', type: 'string' },
	'credential.helper': { description: 'Credential storage', type: 'string' },
};

export function GitConfigEditor({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { activeRepo } = useAppStore();
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [configSections, setConfigSections] = useState<ConfigSection[]>([]);
	const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [editValue, setEditValue] = useState('');
	const [newSection, setNewSection] = useState('');
	const [newKey, setNewKey] = useState('');
	const [newValue, setNewValue] = useState('');
	const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
	const [rawConfig, setRawConfig] = useState('');

	// Load config
	useEffect(() => {
		if (!open || !activeRepo) return;

		const loadConfig = async () => {
			setIsLoading(true);
			try {
				const result = (await trpcClient.git.configList.query({ repo: activeRepo })) as Record<string, unknown>;
				setConfigSections(buildConfigSections(result));

				// Also get raw config
				const rawResult = await trpcClient.git.configRaw.query({ repo: activeRepo });
				setRawConfig(rawResult || '');
			} catch {
				toast.error('Failed to load git config');
			} finally {
				setIsLoading(false);
			}
		};

		void loadConfig();
	}, [open, activeRepo]);

	// Filter sections by search
	const filteredSections = useMemo(() => {
		if (!searchQuery) return configSections;

		const query = searchQuery.toLowerCase();
		return configSections
			.map(section => ({
				...section,
				keys: section.keys.filter(k =>
					`${section.name}.${k.key}`.toLowerCase().includes(query) ||
					k.value.toLowerCase().includes(query)
				),
			}))
			.filter(section => section.keys.length > 0);
	}, [configSections, searchQuery]);

	// Save modified config
	const handleSave = async () => {
		if (!activeRepo) return;

		setIsSaving(true);
		try {
			// Save each modified key
			for (const fullKey of modifiedKeys) {
				const section = configSections.find(s => 
					s.keys.some(k => `${s.name}.${k.key}` === fullKey)
				);
				const key = section?.keys.find(k => `${section.name}.${k.key}` === fullKey);

				if (key) {
					await trpcClient.git.configSet.mutate({
						repo: activeRepo,
						key: fullKey,
						value: key.value,
					});
				}
			}

			setModifiedKeys(new Set());
			toast.success('Configuration saved');
		} catch {
			toast.error('Failed to save configuration');
		} finally {
			setIsSaving(false);
		}
	};

	// Save raw config
	const handleSaveRaw = async () => {
		if (!activeRepo) return;

		setIsSaving(true);
		try {
			const result = await trpcClient.git.configSetRaw.mutate({
				repo: activeRepo,
				content: rawConfig,
			});
			if (result.error) {
				toast.error('Failed to save configuration', { description: result.error });
				return;
			}
			toast.success('Configuration saved');
		} catch {
			toast.error('Failed to save configuration');
		} finally {
			setIsSaving(false);
		}
	};

	// Update key value
	const handleUpdateKey = (sectionName: string, keyName: string, value: string) => {
		setConfigSections(prev => prev.map(section => {
			if (section.name === sectionName) {
				return {
					...section,
					keys: section.keys.map(k =>
						k.key === keyName ? { ...k, value, modified: true } : k
					),
				};
			}
			return section;
		}));

		setModifiedKeys(prev => new Set(prev).add(`${sectionName}.${keyName}`));
		setEditingKey(null);
	};

	// Delete key
	const handleDeleteKey = async (sectionName: string, keyName: string) => {
		if (!activeRepo) return;
		// eslint-disable-next-line no-alert
		if (!confirm(`Delete ${sectionName}.${keyName}?`)) return;

		try {
			await trpcClient.git.configUnset.mutate({
				repo: activeRepo,
				key: `${sectionName}.${keyName}`,
			});

			setConfigSections(prev => prev.map(section => {
				if (section.name === sectionName) {
					return {
						...section,
						keys: section.keys.filter(k => k.key !== keyName),
					};
				}
				return section;
			}).filter(s => s.keys.length > 0));

			toast.success('Key deleted');
		} catch {
			toast.error('Failed to delete key');
		}
	};

	// Add new key
	const handleAddKey = () => {
		if (!newSection || !newKey) {
			toast.error('Section and key are required');
			return;
		}

		setConfigSections(prev => {
			const existing = prev.find(s => s.name === newSection);
			if (existing) {
				return prev.map(s =>
					s.name === newSection
						? { ...s, keys: [...s.keys, { key: newKey, value: newValue, source: 'global' as const, modified: true }] }
						: s
				);
			} else {
				return [...prev, {
					name: newSection,
					keys: [{ key: newKey, value: newValue, source: 'global' as const, modified: true }],
				}];
			}
		});

		setModifiedKeys(prev => new Set(prev).add(`${newSection}.${newKey}`));
		setNewSection('');
		setNewKey('');
		setNewValue('');
		toast.success('Key added (save to apply)');
	};

	// Reset to original
	const handleReset = () => {
		setModifiedKeys(new Set());
		// Reload config
		if (activeRepo) {
			void trpcClient.git.configList.query({ repo: activeRepo }).then((result: unknown) => {
				setConfigSections(buildConfigSections((result ?? {}) as Record<string, unknown>));
			});
		}
	};

	// Get config info
	const getConfigInfo = (section: string, key: string): { description: string } | undefined => {
		const fullKey = `${section}.${key}`;
		return CONFIG_INFO[fullKey] || (key === '*' ? CONFIG_INFO[`${section}.*`] : undefined);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Git Configuration
					</DialogTitle>
				</DialogHeader>

				<Tabs value={viewMode} onValueChange={(v) => { setViewMode(v as 'visual' | 'raw'); }} className="flex-1 flex flex-col">
					<div className="flex items-center justify-between mb-4">
						<TabsList>
							<TabsTrigger value="visual">Visual Editor</TabsTrigger>
							<TabsTrigger value="raw">Raw Config</TabsTrigger>
						</TabsList>

						<div className="flex items-center gap-2">
							{modifiedKeys.size > 0 && (
								<Badge variant="secondary">
									{modifiedKeys.size} unsaved
								</Badge>
							)}
							<Button variant="outline" size="sm" onClick={handleReset}>
								<RotateCcw className="h-4 w-4" />
							</Button>
							<Button size="sm" onClick={() => { void (viewMode === 'raw' ? handleSaveRaw() : handleSave()); }} disabled={isSaving}>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>

					<TabsContent value="visual" className="flex-1 overflow-hidden m-0">
						{/* Search */}
						<div className="relative mb-4">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search configuration..."
								value={searchQuery}
								onChange={(e) => { setSearchQuery(e.target.value); }}
								className="pl-9"
							/>
						</div>

						{/* Add new key */}
						<div className="bg-muted/50 rounded-lg p-3 mb-4">
							<p className="text-sm font-medium mb-2">Add New Key</p>
							<div className="flex items-center gap-2">
								<Input
									placeholder="Section (e.g., user)"
									value={newSection}
									onChange={(e) => { setNewSection(e.target.value); }}
									className="w-32"
								/>
								<span className="text-muted-foreground">.</span>
								<Input
									placeholder="Key"
									value={newKey}
									onChange={(e) => { setNewKey(e.target.value); }}
									className="w-32"
								/>
								<Input
									placeholder="Value"
									value={newValue}
									onChange={(e) => { setNewValue(e.target.value); }}
									className="flex-1"
								/>
								<Button size="sm" onClick={handleAddKey}>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<ScrollArea className="flex-1">
							{isLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : (
								<div className="space-y-4">
									{filteredSections.map(section => (
										<div key={section.name} className="border rounded-lg overflow-hidden">
											<div className="px-4 py-2 bg-muted/50 border-b font-medium flex items-center gap-2">
												<span className="text-muted-foreground">[</span>
												{section.name}
												<span className="text-muted-foreground">]</span>
												<Badge variant="outline" className="ml-auto">
													{section.keys.length}
												</Badge>
											</div>
											<div className="divide-y">
												{section.keys.map(configKey => {
													const fullKey = `${section.name}.${configKey.key}`;
													const info = getConfigInfo(section.name, configKey.key);
													const isEditing = editingKey === fullKey;
													const isModified = modifiedKeys.has(fullKey);

													return (
														<div
															key={configKey.key}
															className={`flex items-center gap-4 px-4 py-2 ${
																isModified ? 'bg-amber-50 dark:bg-amber-900/10' : ''
															}`}
														>
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2">
																	<span className="font-mono text-sm">{configKey.key}</span>
																	{isModified && (
																		<Badge variant="outline" className="text-xs">
																			Modified
																		</Badge>
																	)}
																</div>
																{info && (
																	<p className="text-xs text-muted-foreground">
																		{info.description}
																	</p>
																)}
															</div>

															{isEditing ? (
																<div className="flex items-center gap-2 flex-1">
																	<Input
																		value={editValue}
																		onChange={(e) => { setEditValue(e.target.value); }}
																		className="flex-1"
																		autoFocus
																	/>
																	<Button
																		size="sm"
																		onClick={() => { handleUpdateKey(section.name, configKey.key, editValue); }}
																	>
																		<Check className="h-4 w-4" />
																	</Button>
																	<Button
																		size="sm"
																		variant="ghost"
																		onClick={() => { setEditingKey(null); }}
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</div>
															) : (
																<>
																	<span className="font-mono text-sm text-muted-foreground truncate max-w-xs">
																		{configKey.value || '(empty)'}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0"
																		onClick={() => {
																			setEditingKey(fullKey);
																			setEditValue(configKey.value);
																		}}
																	>
																		<Edit className="h-4 w-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0 text-red-600"
																		onClick={() => { void handleDeleteKey(section.name, configKey.key); }}
																	>
																		<Trash2 className="h-4 w-4" />
																	</Button>
																</>
															)}
														</div>
													);
												})}
											</div>
										</div>
									))}

									{filteredSections.length === 0 && (
										<div className="text-center py-8 text-muted-foreground">
											<Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
											<p>No configuration found</p>
										</div>
									)}
								</div>
							)}
						</ScrollArea>
					</TabsContent>

					<TabsContent value="raw" className="flex-1 overflow-hidden m-0">
						<div className="h-full">
							<Textarea
								value={rawConfig}
								onChange={(e) => { setRawConfig(e.target.value); }}
								className="h-full font-mono text-sm resize-none"
								placeholder="# Git config file content"
							/>
						</div>
					</TabsContent>
				</Tabs>

				<div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
					<div className="flex items-center gap-2">
						<AlertTriangle className="h-4 w-4" />
						<span>Changes affect global git configuration</span>
					</div>
					<Button variant="ghost" onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default GitConfigEditor;

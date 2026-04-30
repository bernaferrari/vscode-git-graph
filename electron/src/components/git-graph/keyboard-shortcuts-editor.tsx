/**
 * Keyboard Shortcuts Customization
 * Customize keyboard shortcuts
 */

import {
	Keyboard,
	RotateCcw,
	Search,
	AlertTriangle,
	Check,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface ShortcutAction {
	id: string;
	name: string;
	category: string;
	description?: string;
	defaultKey: string;
	customKey?: string;
}

const DEFAULT_SHORTCUTS: ShortcutAction[] = [
	// Git Operations
	{ id: 'git.fetch', name: 'Fetch', category: 'Git', defaultKey: 'F5' },
	{ id: 'git.pull', name: 'Pull', category: 'Git', defaultKey: 'CmdOrCtrl+Shift+P' },
	{ id: 'git.push', name: 'Push', category: 'Git', defaultKey: 'CmdOrCtrl+P' },
	{ id: 'git.commit', name: 'Commit', category: 'Git', defaultKey: 'CmdOrCtrl+Enter' },
	{ id: 'git.stage-all', name: 'Stage All', category: 'Git', defaultKey: 'CmdOrCtrl+Shift+A' },
	{ id: 'git.stash', name: 'Stash', category: 'Git', defaultKey: '' },
	
	// Branch Operations
	{ id: 'branch.create', name: 'Create Branch', category: 'Branch', defaultKey: 'CmdOrCtrl+B' },
	{ id: 'branch.checkout', name: 'Checkout Branch', category: 'Branch', defaultKey: 'CmdOrCtrl+Shift+B' },
	{ id: 'branch.merge', name: 'Merge Branch', category: 'Branch', defaultKey: 'CmdOrCtrl+M' },
	{ id: 'branch.rebase', name: 'Rebase', category: 'Branch', defaultKey: '' },
	
	// Navigation
	{ id: 'nav.up', name: 'Navigate Up', category: 'Navigation', defaultKey: 'Up' },
	{ id: 'nav.down', name: 'Navigate Down', category: 'Navigation', defaultKey: 'Down' },
	{ id: 'nav.left', name: 'Navigate Left', category: 'Navigation', defaultKey: 'Left' },
	{ id: 'nav.right', name: 'Navigate Right', category: 'Navigation', defaultKey: 'Right' },
	{ id: 'nav.select', name: 'Select', category: 'Navigation', defaultKey: 'Enter' },
	
	// View
	{ id: 'view.find', name: 'Find', category: 'View', defaultKey: 'CmdOrCtrl+F' },
	{ id: 'view.search', name: 'Search Commits', category: 'View', defaultKey: 'CmdOrCtrl+Shift+F' },
	{ id: 'view.sidebar', name: 'Toggle Sidebar', category: 'View', defaultKey: 'CmdOrCtrl+Shift+B' },
	{ id: 'view.details', name: 'Toggle Commit Details', category: 'View', defaultKey: 'CmdOrCtrl+D' },
	{ id: 'view.refresh', name: 'Refresh', category: 'View', defaultKey: 'CmdOrCtrl+R' },
	
	// Tools
	{ id: 'tools.command-palette', name: 'Command Palette', category: 'Tools', defaultKey: 'CmdOrCtrl+Shift+P' },
	{ id: 'tools.settings', name: 'Settings', category: 'Tools', defaultKey: 'CmdOrCtrl+,' },
	{ id: 'tools.terminal', name: 'Terminal', category: 'Tools', defaultKey: 'CmdOrCtrl+`' },
	{ id: 'tools.help', name: 'Keyboard Shortcuts', category: 'Tools', defaultKey: '?' },
	
	// Edit
	{ id: 'edit.undo', name: 'Undo', category: 'Edit', defaultKey: 'CmdOrCtrl+Z' },
	{ id: 'edit.redo', name: 'Redo', category: 'Edit', defaultKey: 'CmdOrCtrl+Shift+Z' },
	{ id: 'edit.copy', name: 'Copy', category: 'Edit', defaultKey: 'CmdOrCtrl+C' },
	{ id: 'edit.paste', name: 'Paste', category: 'Edit', defaultKey: 'CmdOrCtrl+V' },
];

export function KeyboardShortcutsEditor({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [shortcuts, setShortcuts] = useState<ShortcutAction[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [conflicts, setConflicts] = useState<Set<string>>(new Set());
	const keybindingQuery = trpc.config.keybindings.useQuery(undefined, { enabled: open });
	const setKeybindings = trpc.config.setKeybindings.useMutation({
		onError: (error: { message: string }) => {
			toast.error('Failed to save shortcuts', { description: error.message });
		},
	});

	// Load shortcuts
	useEffect(() => {
		const overrides = keybindingQuery.data?.overrides ?? {};
		setShortcuts(DEFAULT_SHORTCUTS.map((s) => ({
			...s,
			...(overrides[s.id] ? { customKey: overrides[s.id] } : {}),
		})));
	}, [keybindingQuery.data?.overrides]);

	// Check for conflicts
	useEffect(() => {
		const keyMap = new Map<string, string[]>();
		const conflictSet = new Set<string>();

		shortcuts.forEach((s) => {
			const key = s.customKey || s.defaultKey;
			if (!key) return;

			const existing = keyMap.get(key) || [];
			existing.push(s.id);
			keyMap.set(key, existing);

			if (existing.length > 1) {
				existing.forEach(id => conflictSet.add(id));
			}
		});

		setConflicts(conflictSet);
	}, [shortcuts]);

	// Filter shortcuts
	const filteredShortcuts = searchQuery
		? shortcuts.filter((s) =>
				s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				s.category.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: shortcuts;

	// Group by category
	const grouped = filteredShortcuts.reduce<Record<string, ShortcutAction[]>>((acc, s) => {
		const bucket = acc[s.category] ?? (acc[s.category] = []);
		bucket.push(s);
		return acc;
	}, {});

	// Update shortcut
	const handleUpdate = (id: string, key: string) => {
		setShortcuts(prev => prev.map(s =>
			s.id === id ? { ...s, customKey: key } : s
		));
	};

	// Reset shortcut
	const handleReset = (id: string) => {
		setShortcuts((prev) =>
			prev.map((s) =>
				s.id === id
					? // eslint-disable-next-line @typescript-eslint/no-unused-vars
					  (({ customKey: _, ...rest }) => rest)(s)
					: s
			)
		);
	};

	// Reset all
	const handleResetAll = () => {
		setShortcuts(DEFAULT_SHORTCUTS);
		toast.success('All shortcuts reset to defaults');
	};

	// Save
	const handleSave = () => {
		const custom: Record<string, string> = {};
		shortcuts.forEach((s) => {
			if (s.customKey) {
				custom[s.id] = s.customKey;
			}
		});
		setKeybindings.mutate({ overrides: custom });
		toast.success('Shortcuts saved');
		onOpenChange(false);
	};

	// Key capture
	const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
		e.preventDefault();
		e.stopPropagation();

		if (e.key === 'Escape') {
			setEditingId(null);
			return;
		}

		if (e.key === 'Delete' || e.key === 'Backspace') {
			handleUpdate(id, '');
			setEditingId(null);
			return;
		}

		const parts: string[] = [];
		if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl');
		if (e.altKey) parts.push('Alt');
		if (e.shiftKey) parts.push('Shift');

		// Add the main key
		const key = e.key.toUpperCase();
		if (!['META', 'CONTROL', 'ALT', 'SHIFT'].includes(key)) {
			parts.push(key === ' ' ? 'Space' : key);
		}

		if (parts.length > 1 || key.length === 1) {
			const combo = parts.join('+');
			handleUpdate(id, combo);
			setEditingId(null);
		}
	}, [handleUpdate]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Keyboard className="h-5 w-5" />
						Keyboard Shortcuts
					</DialogTitle>
				</DialogHeader>

				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search shortcuts..."
						value={searchQuery}
						onChange={(e) => { setSearchQuery(e.target.value); }}
						className="pl-9"
					/>
				</div>

				{/* Conflicts warning */}
				{conflicts.size > 0 && (
					<div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-600 dark:text-amber-400">
						<AlertTriangle className="h-4 w-4" />
						<span>{conflicts.size} shortcut(s) have conflicting key bindings</span>
					</div>
				)}

				{/* Shortcuts list */}
				<ScrollArea className="flex-1">
					<div className="space-y-6">
						{Object.entries(grouped).map(([category, items]) => (
							<div key={category}>
								<h3 className="text-sm font-medium text-muted-foreground mb-2">
									{category}
								</h3>
								<div className="space-y-1">
									{items.map(shortcut => {
										const isEditing = editingId === shortcut.id;
										const hasConflict = conflicts.has(shortcut.id);
										const key = shortcut.customKey || shortcut.defaultKey;
										const isCustom = !!shortcut.customKey;

										return (
											<div
												key={shortcut.id}
												className={`flex items-center justify-between p-2 rounded-lg ${
													hasConflict ? 'bg-amber-50 dark:bg-amber-900/20' : ''
												}`}
											>
												<div className="flex-1">
													<p className="font-medium text-sm">{shortcut.name}</p>
													{shortcut.description && (
														<p className="text-xs text-muted-foreground">
															{shortcut.description}
														</p>
													)}
												</div>

												<div className="flex items-center gap-2">
													{isEditing ? (
														<Input
															autoFocus
															className="w-48 h-8"
															placeholder="Press key..."
															onKeyDown={(e) => { handleKeyDown(e, shortcut.id); }}
															onBlur={() => { setEditingId(null); }}
														/>
													) : (
														<>
															<kbd
																className={`px-2 py-1 rounded text-xs font-mono cursor-pointer ${
																	isCustom
																		? 'bg-primary/10 text-primary'
																		: 'bg-muted'
																}`}
																onClick={() => { setEditingId(shortcut.id); }}
															>
																{key || 'Not set'}
															</kbd>
															{isCustom && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 w-6 p-0"
																	onClick={() => { handleReset(shortcut.id); }}
																>
																	<RotateCcw className="h-3 w-3" />
																</Button>
															)}
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>

				{/* Actions */}
				<div className="flex items-center justify-between pt-4 border-t">
					<Button variant="outline" onClick={handleResetAll}>
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset All
					</Button>
					<div className="flex items-center gap-2">
						<Button variant="ghost" onClick={() => { onOpenChange(false); }}>
							Cancel
						</Button>
						<Button onClick={handleSave}>
							<Check className="h-4 w-4 mr-2" />
							Save
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default KeyboardShortcutsEditor;

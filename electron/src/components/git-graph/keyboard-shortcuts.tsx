/**
 * Keyboard Shortcuts Dialog
 * Show all available shortcuts
 */

import { useState, useEffect } from 'react';

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Shortcut {
	keys: string[];
	description: string;
}

interface ShortcutGroup {
	category: string;
	shortcuts: Shortcut[];
}

const SHORTCUTS: ShortcutGroup[] = [
	{
		category: 'General',
		shortcuts: [
			{ keys: ['⌘', 'K'], description: 'Open command palette' },
			{ keys: ['?'], description: 'Show keyboard shortcuts' },
			{ keys: ['Esc'], description: 'Close dialog / cancel' },
		],
	},
	{
		category: 'Navigation',
		shortcuts: [
			{ keys: ['↑', '↓'], description: 'Navigate commits' },
			{ keys: ['Enter'], description: 'Select commit / confirm' },
			{ keys: ['Home'], description: 'Go to first commit' },
			{ keys: ['End'], description: 'Go to last commit' },
		],
	},
	{
		category: 'Branch',
		shortcuts: [
			{ keys: ['B'], description: 'Create branch' },
			{ keys: ['⇧', 'B'], description: 'Checkout branch' },
			{ keys: ['⌘', 'D'], description: 'Delete branch' },
		],
	},
	{
		category: 'Commit',
		shortcuts: [
			{ keys: ['C'], description: 'Commit' },
			{ keys: ['⇧', 'C'], description: 'Amend commit' },
			{ keys: ['Space'], description: 'Toggle commit selection' },
		],
	},
	{
		category: 'Remote',
		shortcuts: [
			{ keys: ['P'], description: 'Push' },
			{ keys: ['⇧', 'P'], description: 'Pull' },
			{ keys: ['F'], description: 'Fetch all' },
		],
	},
	{
		category: 'Git Operations',
		shortcuts: [
			{ keys: ['M'], description: 'Merge' },
			{ keys: ['R'], description: 'Rebase' },
			{ keys: ['S'], description: 'Stash' },
			{ keys: ['⇧', 'S'], description: 'Pop stash' },
			{ keys: ['T'], description: 'Create tag' },
		],
	},
	{
		category: 'View',
		shortcuts: [
			{ keys: ['⌘', 'F'], description: 'Search commits' },
			{ keys: ['⌘', '='], description: 'Zoom in' },
			{ keys: ['⌘', '-'], description: 'Zoom out' },
			{ keys: ['⌘', '0'], description: 'Reset zoom' },
		],
	},
	{
		category: 'Interactive Rebase',
		shortcuts: [
			{ keys: ['P'], description: 'Pick commit' },
			{ keys: ['R'], description: 'Reword commit' },
			{ keys: ['E'], description: 'Edit commit' },
			{ keys: ['S'], description: 'Squash commit' },
			{ keys: ['F'], description: 'Fixup commit' },
			{ keys: ['D'], description: 'Drop commit' },
		],
	},
	{
		category: 'Graph',
		shortcuts: [
			{ keys: ['Scroll'], description: 'Scroll vertically' },
			{ keys: ['⇧', 'Scroll'], description: 'Scroll horizontally' },
			{ keys: ['⌘', 'Scroll'], description: 'Zoom' },
		],
	},
];

interface KeyboardShortcutsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg ui-surface">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[60vh]">
					<div className="space-y-4">
						{SHORTCUTS.map((group, idx) => (
							<div key={group.category}>
								{idx > 0 && <Separator className="mb-4" />}
								<h3 className="font-medium text-sm mb-2">{group.category}</h3>
								<div className="space-y-1">
									{group.shortcuts.map((shortcut, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between text-sm"
										>
											<span className="text-muted-foreground">{shortcut.description}</span>
											<div className="flex items-center gap-0.5">
												{shortcut.keys.map((key, keyIdx) => (
													<span key={keyIdx}>
														<kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">
															{key}
														</kbd>
														{keyIdx < shortcut.keys.length - 1 && (
															<span className="mx-0.5 text-muted-foreground">+</span>
														)}
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Hook to manage keyboard shortcuts dialog
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useKeyboardShortcuts() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Show shortcuts on ?
			if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
				// Only if not in an input
				if (document.activeElement?.tagName !== 'INPUT' && 
					document.activeElement?.tagName !== 'TEXTAREA') {
					e.preventDefault();
					setOpen(true);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => { window.removeEventListener('keydown', handleKeyDown); };
	}, []);

	return { open, setOpen };
}

/**
 * Keyboard Shortcuts Help
 * Display all available keyboard shortcuts
 */

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard, Command, ArrowUp, ArrowDown } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface ShortcutGroup {
	title: string;
	shortcuts: {
		keys: string[];
		description: string;
	}[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
	{
		title: 'Navigation',
		shortcuts: [
			{ keys: ['j', '↓'], description: 'Move to next commit' },
			{ keys: ['k', '↑'], description: 'Move to previous commit' },
			{ keys: ['g'], description: 'Go to first commit' },
			{ keys: ['G'], description: 'Go to last commit' },
			{ keys: ['Enter'], description: 'Expand/collapse commit details' },
		],
	},
	{
		title: 'Actions',
		shortcuts: [
			{ keys: ['⌘', 'B'], description: 'Create branch at selected commit' },
			{ keys: ['⌘', 'T'], description: 'Create tag at selected commit' },
			{ keys: ['s'], description: 'Star/pin selected commit' },
			{ keys: ['?'], description: 'Show keyboard shortcuts' },
		],
	},
	{
		title: 'Search & Find',
		shortcuts: [
			{ keys: ['⌘', 'F'], description: 'Find in commit list' },
			{ keys: ['⌘', '⇧', 'F'], description: 'Search all commits' },
		],
	},
	{
		title: 'Tools',
		shortcuts: [
			{ keys: ['⌘', 'K'], description: 'Open Fuzzy Finder' },
			{ keys: ['⌘', 'P'], description: 'Toggle Terminal' },
			{ keys: ['⌘', '⇧', 'S'], description: 'Open Statistics' },
			{ keys: ['⌘', '⇧', 'P'], description: 'Open Pinned Commits' },
			{ keys: ['⌘', '⇧', 'R'], description: 'Manage Remotes' },
		],
	},
	{
		title: 'Merge Conflict Editor',
		shortcuts: [
			{ keys: ['⌘', '↑'], description: 'Go to previous unresolved conflict' },
			{ keys: ['⌘', '↓'], description: 'Go to next unresolved conflict' },
			{ keys: ['⌘', 'O'], description: 'Use Ours for active conflict, advance to next' },
			{ keys: ['⌘', 'T'], description: 'Use Theirs for active conflict, advance to next' },
			{ keys: ['⌘', 'B'], description: 'Keep both for active conflict, advance to next' },
			{ keys: ['Alt', 'N'], description: 'Use Base for active conflict, advance to next' },
			{ keys: ['⌘', 'R'], description: 'Close conflict editor' },
		],
	},
	{
		title: 'Refresh',
		shortcuts: [
			{ keys: ['⌘', 'R'], description: 'Refresh commit list' },
			{ keys: ['Esc'], description: 'Close dialogs/panels' },
		],
	},
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Keyboard className="h-5 w-5" />
						Keyboard Shortcuts
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex-1">
					<div className="space-y-6">
						{SHORTCUT_GROUPS.map((group) => (
							<div key={group.title}>
								<h3 className="text-sm font-medium mb-3 text-muted-foreground">
									{group.title}
								</h3>
								<div className="space-y-2">
									{group.shortcuts.map((shortcut, index) => (
										<div
											key={index}
											className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50"
										>
											<span className="text-sm">{shortcut.description}</span>
											<div className="flex items-center gap-1">
												{shortcut.keys.map((key, keyIndex) => (
													<span key={keyIndex} className="flex items-center">
														{keyIndex > 0 && (
															<span className="text-muted-foreground mx-0.5">+</span>
														)}
														<kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-mono bg-muted rounded border">
															{key === '⌘' && <Command className="h-3 w-3" />}
															{key === '↑' && <ArrowUp className="h-3 w-3" />}
															{key === '↓' && <ArrowDown className="h-3 w-3" />}
															{key !== '⌘' && key !== '↑' && key !== '↓' && key}
														</kbd>
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

				<div className="flex justify-end pt-4 border-t">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default KeyboardShortcutsHelp;

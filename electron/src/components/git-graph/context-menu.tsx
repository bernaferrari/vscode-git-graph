/**
 * Git Graph Context Menu
 * Uses Shadcn dropdown-menu for right-click context menus
 */

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useState, type ReactNode } from 'react';

export interface ContextMenuAction {
	title: ReactNode;
	visible: boolean;
	onClick: () => void;
	checked?: boolean;
	disabled?: boolean;
}

export interface ContextMenuActionGroup {
	actions: ContextMenuAction[];
}

interface GitGraphContextMenuProps {
	groups: ContextMenuActionGroup[];
	children: ReactNode;
	checked?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function GitGraphContextMenu({
	groups,
	children,
	checked = false,
	onOpenChange,
}: GitGraphContextMenuProps) {
	const [open, setOpen] = useState(false);

	const visibleGroups = groups.filter((g) =>
		g.actions.some((a) => a.visible)
	);

	if (visibleGroups.length === 0) {
		return <>{children}</>;
	}

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		onOpenChange?.(newOpen);
	};

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild onContextMenu={(e) => {
				e.preventDefault();
				setOpen(true);
			}}>
				{children}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-48">
				{visibleGroups.map((group, groupIndex) => (
					<div key={groupIndex}>
						{groupIndex > 0 && <DropdownMenuSeparator />}
						{group.actions
							.filter((a) => a.visible)
							.map((action, actionIndex) =>
								checked ? (
									<DropdownMenuCheckboxItem
										key={actionIndex}
										checked={action.checked ?? false}
										onSelect={(e) => {
											e.preventDefault();
											action.onClick();
										}}
										{...(action.disabled ? { disabled: action.disabled } : {})}
									>
										{action.title}
									</DropdownMenuCheckboxItem>
								) : (
									<DropdownMenuItem
										key={actionIndex}
										onSelect={(e) => {
											e.preventDefault();
											action.onClick();
										}}
										{...(action.disabled ? { disabled: action.disabled } : {})}
									>
										{action.title}
									</DropdownMenuItem>
								)
							)}
					</div>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Commit context menu
interface CommitContextMenuProps {
	commitHash: string;
	commitIndex: number;
	isHead: boolean;
	children: ReactNode;
	onAddTag: () => void;
	onCreateBranch: () => void;
	onCheckout: () => void;
	onCherryPick: () => void;
	onRevert: () => void;
	onMerge: () => void;
	onRebase: () => void;
	onReset: () => void;
	onDrop: () => void;
	onCopyHash: () => void;
	onCopySubject: () => void;
	visibility: {
		addTag: boolean;
		createBranch: boolean;
		checkout: boolean;
		cherryPick: boolean;
		revert: boolean;
		merge: boolean;
		rebase: boolean;
		reset: boolean;
		drop: boolean;
		copyHash: boolean;
		copySubject: boolean;
	};
}

export function CommitContextMenu({
	children,
	onAddTag,
	onCreateBranch,
	onCheckout,
	onCherryPick,
	onRevert,
	onMerge,
	onRebase,
	onReset,
	onDrop,
	onCopyHash,
	onCopySubject,
	visibility,
}: CommitContextMenuProps) {
	const groups: ContextMenuActionGroup[] = [
		{
			actions: [
				{ title: 'Add Tag...', visible: visibility.addTag, onClick: onAddTag },
				{ title: 'Create Branch...', visible: visibility.createBranch, onClick: onCreateBranch },
				{ title: 'Checkout', visible: visibility.checkout, onClick: onCheckout },
			],
		},
		{
			actions: [
				{ title: 'Cherry Pick...', visible: visibility.cherryPick, onClick: onCherryPick },
				{ title: 'Revert...', visible: visibility.revert, onClick: onRevert },
			],
		},
		{
			actions: [
				{ title: 'Merge...', visible: visibility.merge, onClick: onMerge },
				{ title: 'Rebase...', visible: visibility.rebase, onClick: onRebase },
				{ title: 'Reset...', visible: visibility.reset, onClick: onReset },
				{ title: 'Drop', visible: visibility.drop, onClick: onDrop },
			],
		},
		{
			actions: [
				{ title: 'Copy Hash', visible: visibility.copyHash, onClick: onCopyHash },
				{ title: 'Copy Subject', visible: visibility.copySubject, onClick: onCopySubject },
			],
		},
	];

	return (
		<GitGraphContextMenu groups={groups}>
			{children}
		</GitGraphContextMenu>
	);
}

// Branch context menu
interface BranchContextMenuProps {
	branchName: string;
	isRemote: boolean;
	isCurrent: boolean;
	children: ReactNode;
	onCheckout: () => void;
	onRename: () => void;
	onDelete: () => void;
	onMerge: () => void;
	onRebase: () => void;
	onPush: () => void;
	onFetch: () => void;
	onPull: () => void;
	visibility: {
		checkout: boolean;
		rename: boolean;
		delete: boolean;
		merge: boolean;
		rebase: boolean;
		push: boolean;
		fetch: boolean;
		pull: boolean;
	};
}

export function BranchContextMenu({
	children,
	isRemote,
	onCheckout,
	onRename,
	onDelete,
	onMerge,
	onRebase,
	onPush,
	onFetch,
	onPull,
	visibility,
}: BranchContextMenuProps) {
	const groups: ContextMenuActionGroup[] = isRemote
		? [
				{
					actions: [
						{ title: 'Checkout', visible: visibility.checkout, onClick: onCheckout },
						{ title: 'Fetch', visible: visibility.fetch, onClick: onFetch },
						{ title: 'Pull', visible: visibility.pull, onClick: onPull },
					],
				},
				{
					actions: [
						{ title: 'Merge...', visible: visibility.merge, onClick: onMerge },
						{ title: 'Delete', visible: visibility.delete, onClick: onDelete },
					],
				},
			]
		: [
				{
					actions: [
						{ title: 'Checkout', visible: visibility.checkout, onClick: onCheckout },
						{ title: 'Rename...', visible: visibility.rename, onClick: onRename },
						{ title: 'Delete', visible: visibility.delete, onClick: onDelete },
					],
				},
				{
					actions: [
						{ title: 'Merge...', visible: visibility.merge, onClick: onMerge },
						{ title: 'Rebase...', visible: visibility.rebase, onClick: onRebase },
						{ title: 'Push', visible: visibility.push, onClick: onPush },
					],
				},
			];

	return (
		<GitGraphContextMenu groups={groups}>
			{children}
		</GitGraphContextMenu>
	);
}

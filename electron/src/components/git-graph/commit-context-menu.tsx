/**
 * Commit Context Menu
 * Right-click menu for commit actions
 */

import {
	GitBranch,
	Tag,
	Copy,
	RotateCcw,
	GitMerge,
	ArrowRightLeft,
	ArrowLeft,
	Scissors,
	History,
} from 'lucide-react';

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useGitOperations } from '@/hooks/useGitOperations';

interface CommitContextMenuProps {
	children: React.ReactNode;
	commit: {
		hash: string;
		message: string;
		author: string;
	};
	onCreateBranch: () => void;
	onCreateTag: () => void;
	onMerge: () => void;
	onRebase: () => void;
	onCherryPick: () => void;
	onRevert: () => void;
}

export function CommitContextMenu({
	children,
	commit,
	onCreateBranch,
	onCreateTag,
	onMerge,
	onRebase,
	onCherryPick,
	onRevert,
}: CommitContextMenuProps) {
	const gitOps = useGitOperations();

	const handleCopyHash = () => {
		void gitOps.copyToClipboard(commit.hash);
	};

	const handleCopyMessage = () => {
		void gitOps.copyToClipboard(commit.message);
	};

	const handleResetHere = (mode: 'soft' | 'mixed' | 'hard') => {
		void gitOps.reset(commit.hash, mode);
	};

	const handleCheckout = () => {
		void gitOps.checkout(commit.hash);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className="w-56">
				{/* Navigation */}
				<ContextMenuItem onClick={handleCheckout}>
					<ArrowLeft className="h-4 w-4 mr-2 text-muted-foreground" />
					Checkout Commit
				</ContextMenuItem>
				
				<ContextMenuSeparator />

				{/* Create */}
				<ContextMenuItem onClick={onCreateBranch}>
					<GitBranch className="h-4 w-4 mr-2 text-muted-foreground" />
					Create Branch...
				</ContextMenuItem>
				<ContextMenuItem onClick={onCreateTag}>
					<Tag className="h-4 w-4 mr-2 text-muted-foreground" />
					Create Tag...
				</ContextMenuItem>
				
				<ContextMenuSeparator />

				{/* Integrate */}
				<ContextMenuItem onClick={onMerge}>
					<GitMerge className="h-4 w-4 mr-2 text-muted-foreground" />
					Merge into Current
				</ContextMenuItem>
				<ContextMenuItem onClick={onRebase}>
					<History className="h-4 w-4 mr-2 text-muted-foreground" />
					Rebase Onto Here
				</ContextMenuItem>
				<ContextMenuItem onClick={onCherryPick}>
					<Scissors className="h-4 w-4 mr-2 text-muted-foreground" />
					Cherry Pick
				</ContextMenuItem>
				<ContextMenuItem onClick={onRevert}>
					<ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground" />
					Revert Commit
				</ContextMenuItem>
				
				<ContextMenuSeparator />

				{/* Reset submenu */}
				<ContextMenuSub>
					<ContextMenuSubTrigger>
						<RotateCcw className="h-4 w-4 mr-2 text-muted-foreground" />
						Reset to Here
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem onClick={() => { handleResetHere('soft'); }}>
							<span className="text-amber-600">Soft</span>
							<span className="ml-2 text-xs text-muted-foreground">Keep changes staged</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={() => { handleResetHere('mixed'); }}>
							<span className="text-blue-600">Mixed</span>
							<span className="ml-2 text-xs text-muted-foreground">Keep changes unstaged</span>
						</ContextMenuItem>
						<ContextMenuItem onClick={() => { handleResetHere('hard'); }} className="text-red-600">
							Hard
							<span className="ml-2 text-xs opacity-70">Discard all changes</span>
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				
				<ContextMenuSeparator />

				{/* Copy */}
				<ContextMenuItem onClick={handleCopyHash}>
					<Copy className="h-4 w-4 mr-2 text-muted-foreground" />
					Copy SHA
				</ContextMenuItem>
				<ContextMenuItem onClick={handleCopyMessage}>
					<Copy className="h-4 w-4 mr-2 text-muted-foreground" />
					Copy Message
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

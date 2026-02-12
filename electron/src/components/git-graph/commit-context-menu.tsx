/**
 * Commit Context Menu
 * Right-click menu for commit actions
 */

import { useAppStore } from '@/lib/store';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
	GitBranch,
	Tag,
	Copy,
	RotateCcw,
	GitMerge,
	GitCommit,
	ArrowRightLeft,
	ArrowLeft,
	Trash2,
} from 'lucide-react';
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
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();

	const handleCopyHash = () => {
		gitOps.copyToClipboard(commit.hash);
	};

	const handleCopyMessage = () => {
		gitOps.copyToClipboard(commit.message);
	};

	const handleResetHere = (mode: 'soft' | 'mixed' | 'hard') => {
		gitOps.reset(commit.hash, mode);
	};

	const handleCheckout = () => {
		gitOps.checkout(commit.hash);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className="w-56">
				<ContextMenuItem onClick={handleCopyHash}>
					<Copy className="h-4 w-4 mr-2" />
					Copy SHA
				</ContextMenuItem>
				<ContextMenuItem onClick={handleCopyMessage}>
					<Copy className="h-4 w-4 mr-2" />
					Copy Message
				</ContextMenuItem>
				<ContextMenuSeparator />
				
				<ContextMenuItem onClick={onCreateBranch}>
					<GitBranch className="h-4 w-4 mr-2" />
					Create Branch Here
				</ContextMenuItem>
				<ContextMenuItem onClick={onCreateTag}>
					<Tag className="h-4 w-4 mr-2" />
					Create Tag Here
				</ContextMenuItem>
				<ContextMenuItem onClick={handleCheckout}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Checkout Commit
				</ContextMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuItem onClick={onMerge}>
					<GitMerge className="h-4 w-4 mr-2" />
					Merge into Current
				</ContextMenuItem>
				<ContextMenuItem onClick={onRebase}>
					<RotateCcw className="h-4 w-4 mr-2" />
					Rebase Current onto Here
				</ContextMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuItem onClick={onCherryPick}>
					<GitCommit className="h-4 w-4 mr-2" />
					Cherry Pick
				</ContextMenuItem>
				<ContextMenuItem onClick={onRevert}>
					<ArrowRightLeft className="h-4 w-4 mr-2" />
					Revert Commit
				</ContextMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuItem onClick={() => handleResetHere('soft')}>
					<RotateCcw className="h-4 w-4 mr-2 text-amber-600" />
					Reset Here (Soft)
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleResetHere('mixed')}>
					<RotateCcw className="h-4 w-4 mr-2 text-blue-600" />
					Reset Here (Mixed)
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleResetHere('hard')}>
					<Trash2 className="h-4 w-4 mr-2 text-red-600" />
					Reset Here (Hard)
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

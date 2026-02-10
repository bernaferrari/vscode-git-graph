/**
 * Commit Context Menu
 * Right-click menu for commit actions
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
	GitBranch,
	Tag,
	Copy,
	RotateCcw,
	Merge,
	GitCommit,
	ArrowRightLeft,
	ArrowLeft,
	Trash2,
	ExternalLink,
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
				<ContextMenuMenuItem onClick={handleCopyHash}>
					<Copy className="h-4 w-4 mr-2" />
					Copy SHA
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={handleCopyMessage}>
					<Copy className="h-4 w-4 mr-2" />
					Copy Message
				</ContextMenuMenuItem>
				<ContextMenuSeparator />
				
				<ContextMenuMenuItem onClick={onCreateBranch}>
					<GitBranch className="h-4 w-4 mr-2" />
					Create Branch Here
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={onCreateTag}>
					<Tag className="h-4 w-4 mr-2" />
					Create Tag Here
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={handleCheckout}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Checkout Commit
				</ContextMenuMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuMenuItem onClick={onMerge}>
					<Merge className="h-4 w-4 mr-2" />
					Merge into Current
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={onRebase}>
					<RotateCcw className="h-4 w-4 mr-2" />
					Rebase Current onto Here
				</ContextMenuMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuMenuItem onClick={onCherryPick}>
					<GitCommit className="h-4 w-4 mr-2" />
					Cherry Pick
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={onRevert}>
					<ArrowRightLeft className="h-4 w-4 mr-2" />
					Revert Commit
				</ContextMenuMenuItem>
				
				<ContextMenuSeparator />
				
				<ContextMenuMenuItem onClick={() => handleResetHere('soft')}>
					<RotateCcw className="h-4 w-4 mr-2 text-amber-600" />
					Reset Here (Soft)
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={() => handleResetHere('mixed')}>
					<RotateCcw className="h-4 w-4 mr-2 text-blue-600" />
					Reset Here (Mixed)
				</ContextMenuMenuItem>
				<ContextMenuMenuItem onClick={() => handleResetHere('hard')}>
					<Trash2 className="h-4 w-4 mr-2 text-red-600" />
					Reset Here (Hard)
				</ContextMenuMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

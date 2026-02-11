/**
 * Quick Actions Toolbar
 * Common git actions in a compact toolbar
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	Upload,
	Download,
	RefreshCw,
	Plus,
	GitBranch,
	Tag,
	Archive,
	MoreHorizontal,
	Loader2,
	Check,
	RotateCcw,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';
import { toast } from 'sonner';

interface QuickActionsToolbarProps {
	className?: string;
	onCreateBranch?: () => void;
	onCreateTag?: () => void;
	onStash?: () => void;
}

export function QuickActionsToolbar({ 
	className,
	onCreateBranch,
	onCreateTag,
	onStash,
}: QuickActionsToolbarProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [commitMessage, setCommitMessage] = useState('');
	const [isCommitting, setIsCommitting] = useState(false);

	// Get status
	const { data: statusData, refetch: refetchStatus } = trpc.git.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo }
	);

	// Get ahead/behind
	const { data: aheadBehindData, refetch: refetchAheadBehind } = trpc.git.aheadBehind.useQuery(
		{ repo: activeRepo ?? '', upstream: `origin/${statusData?.branch ?? 'main'}` },
		{ enabled: !!activeRepo && !!statusData?.branch }
	);

	const stagedCount = statusData?.staged?.length ?? 0;
	const ahead = aheadBehindData?.ahead ?? 0;
	const behind = aheadBehindData?.behind ?? 0;

	const handleQuickCommit = async () => {
		if (!commitMessage.trim()) {
			toast.error('Please enter a commit message');
			return;
		}

		setIsCommitting(true);
		try {
			await gitOps.commit(commitMessage);
			setCommitMessage('');
			refetchStatus();
		} finally {
			setIsCommitting(false);
		}
	};

	const handleQuickPush = () => {
		gitOps.push();
		setTimeout(() => refetchAheadBehind(), 2000);
	};

	const handleQuickPull = () => {
		gitOps.pull();
		setTimeout(() => refetchAheadBehind(), 2000);
	};

	const handleQuickFetch = () => {
		gitOps.fetch();
		setTimeout(() => refetchAheadBehind(), 1000);
	};

	return (
		<div className={`flex items-center gap-2 p-2 border-b bg-background ${className || ''}`}>
			{/* Quick commit */}
			<div className="flex items-center gap-2 flex-1 max-w-md">
				<Input
					placeholder="Commit message..."
					value={commitMessage}
					onChange={(e) => setCommitMessage(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && handleQuickCommit()}
					className="h-8 text-sm"
					disabled={!activeRepo || stagedCount === 0}
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="sm"
							className="h-8"
							onClick={handleQuickCommit}
							disabled={!activeRepo || stagedCount === 0 || isCommitting}
						>
							{isCommitting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Check className="h-4 w-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						Commit ({stagedCount} staged)
					</TooltipContent>
				</Tooltip>
			</div>

			{/* Divider */}
			<div className="w-px h-6 bg-border mx-2" />

			{/* Sync actions */}
			<div className="flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={handleQuickFetch}
							disabled={!activeRepo}
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Fetch</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2"
							onClick={handleQuickPull}
							disabled={!activeRepo || behind === 0}
						>
							<Download className="h-4 w-4" />
							{behind > 0 && <span className="ml-1 text-xs">{behind}</span>}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Pull ({behind} behind)</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2"
							onClick={handleQuickPush}
							disabled={!activeRepo || ahead === 0}
						>
							<Upload className="h-4 w-4" />
							{ahead > 0 && <span className="ml-1 text-xs">{ahead}</span>}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Push ({ahead} ahead)</TooltipContent>
				</Tooltip>
			</div>

			{/* Divider */}
			<div className="w-px h-6 bg-border mx-2" />

			{/* Create actions */}
			<div className="flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={onCreateBranch}
							disabled={!activeRepo}
						>
							<GitBranch className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Create Branch</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={onCreateTag}
							disabled={!activeRepo}
						>
							<Tag className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Create Tag</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={onStash}
							disabled={!activeRepo}
						>
							<Archive className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Stash Changes</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

export default QuickActionsToolbar;

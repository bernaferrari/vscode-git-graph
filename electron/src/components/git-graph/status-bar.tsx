/**
 * Status Bar
 * Show repository status, branch info, and quick actions at bottom
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	GitBranch,
	RefreshCw,
	AlertCircle,
	Check,
	Clock,
	Upload,
	Download,
	Loader2,
	Octagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBarProps {
	className?: string;
	onFetch?: () => void;
	onPush?: () => void;
	onPull?: () => void;
}

export function StatusBar({ className, onFetch, onPush, onPull }: StatusBarProps) {
	const { activeRepo } = useAppStore();

	// Get repo status
	const { data: statusData, isLoading: statusLoading } = trpc.git.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ 
			enabled: !!activeRepo,
			refetchInterval: 30000, // Refresh every 30s
		}
	);

	// Get ahead/behind info
	const { data: aheadBehindData } = trpc.git.aheadBehind.useQuery(
		{ repo: activeRepo ?? '', upstream: `origin/${statusData?.branch ?? 'main'}` },
		{ enabled: !!activeRepo && !!statusData?.branch }
	);

	// Get file counts
	const stagedCount = statusData?.staged?.length ?? 0;
	const unstagedCount = statusData?.changes?.length ?? 0;
	const untrackedCount = statusData?.untracked?.length ?? 0;
	const conflictedCount = statusData?.conflicted?.length ?? 0;

	const ahead = aheadBehindData?.ahead ?? 0;
	const behind = aheadBehindData?.behind ?? 0;

	if (!activeRepo) {
		return (
			<div className={cn("h-6 bg-muted border-t flex items-center px-3 text-xs text-muted-foreground", className)}>
				<span>No repository open</span>
			</div>
		);
	}

	return (
		<div className={cn("h-6 bg-muted border-t flex items-center justify-between px-3 text-xs", className)}>
			{/* Left side - Branch and status */}
			<div className="flex items-center gap-3">
				{/* Branch */}
				<div className="flex items-center gap-1.5">
					<GitBranch className="h-3 w-3 text-muted-foreground" />
					<span className="font-medium">{statusData?.branch || 'detached'}</span>
				</div>

				{/* Sync status */}
				{statusLoading ? (
					<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
				) : (
					<div className="flex items-center gap-2">
						{ahead > 0 && (
							<span className="flex items-center gap-1 text-green-600">
								<Upload className="h-3 w-3" />
								{ahead}
							</span>
						)}
						{behind > 0 && (
							<span className="flex items-center gap-1 text-blue-600">
								<Download className="h-3 w-3" />
								{behind}
							</span>
						)}
						{ahead === 0 && behind === 0 && (
							<span className="flex items-center gap-1 text-muted-foreground">
								<Check className="h-3 w-3" />
								Synced
							</span>
						)}
					</div>
				)}

				{/* File status */}
				{(stagedCount > 0 || unstagedCount > 0 || untrackedCount > 0 || conflictedCount > 0) && (
					<div className="flex items-center gap-2">
						{conflictedCount > 0 && (
							<span className="flex items-center gap-1 text-red-600">
								<AlertCircle className="h-3 w-3" />
								{conflictedCount} conflict{conflictedCount !== 1 ? 's' : ''}
							</span>
						)}
						{stagedCount > 0 && (
							<span className="text-green-600">
								+{stagedCount} staged
							</span>
						)}
						{unstagedCount > 0 && (
							<span className="text-amber-600">
								~{unstagedCount} modified
							</span>
						)}
						{untrackedCount > 0 && (
							<span className="text-muted-foreground">
								?{untrackedCount} untracked
							</span>
						)}
					</div>
				)}
			</div>

			{/* Right side - Quick actions and info */}
			<div className="flex items-center gap-3">
				{/* Quick sync buttons */}
				<div className="flex items-center gap-1">
					{behind > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-5 px-1.5 text-xs"
							onClick={onPull}
						>
							<Download className="h-3 w-3 mr-1" />
							Pull
						</Button>
					)}
					{ahead > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-5 px-1.5 text-xs"
							onClick={onPush}
						>
							<Upload className="h-3 w-3 mr-1" />
							Push
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						className="h-5 px-1.5 text-xs"
						onClick={onFetch}
					>
						<RefreshCw className="h-3 w-3" />
					</Button>
				</div>

				{/* Repository name */}
				<span className="text-muted-foreground truncate max-w-[200px]">
					{activeRepo.split('/').pop()}
				</span>
			</div>
		</div>
	);
}

export default StatusBar;

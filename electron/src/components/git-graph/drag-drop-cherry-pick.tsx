/**
 * Drag and Drop Cherry-Pick
 * Drag commits to cherry-pick them onto branches
 */

import {
	GitCommit,
	AlertCircle,
	Check,
	Loader2,
	Copy,
	ArrowRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface DragDropCherryPickProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceCommit: {
		hash: string;
		message: string;
		author: string;
	} | null;
}

export function DragDropCherryPick({ open, onOpenChange, sourceCommit }: DragDropCherryPickProps) {
	const { activeRepo } = useAppStore();
	const [targetBranch, setTargetBranch] = useState<string>('');
	const [isCherryPicking, setIsCherryPicking] = useState(false);

	// Fetch branches
	const { data: repoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: false,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo && open }
	);

	const branches = repoInfo?.branches ?? [];
	const currentBranch = repoInfo?.head ?? '';

	// Cherry-pick mutation
	const cherryPickMutation = trpc.git.cherryPick.useMutation({
		onSuccess: () => {
			toast.success(`Cherry-picked ${sourceCommit?.hash.slice(0, 7)} onto ${targetBranch}`);
			onOpenChange(false);
			setTargetBranch('');
		},
		onError: (error) => {
			toast.error('Cherry-pick failed', { description: error.message });
		},
		onSettled: () => {
			setIsCherryPicking(false);
		},
	});

	const handleCherryPick = useCallback(() => {
		if (!sourceCommit || !targetBranch) return;

		setIsCherryPicking(true);
		cherryPickMutation.mutate({
			repo: activeRepo ?? '',
			commitHash: sourceCommit.hash,
		});
	}, [sourceCommit, targetBranch, activeRepo, cherryPickMutation]);

	if (!sourceCommit) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Copy className="h-5 w-5" />
						Cherry-Pick Commit
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Source commit */}
					<div className="p-3 rounded-lg border bg-muted/30">
						<div className="flex items-center gap-2 mb-2">
							<GitCommit className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium">Source Commit</span>
						</div>
						<div className="flex items-center gap-2 mb-1">
							<code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
								{sourceCommit.hash.slice(0, 7)}
							</code>
							<span className="text-xs text-muted-foreground">
								by {sourceCommit.author}
							</span>
						</div>
						<p className="text-sm truncate">{sourceCommit.message}</p>
					</div>

					{/* Arrow */}
					<div className="flex justify-center">
						<ArrowRight className="h-5 w-5 text-muted-foreground" />
					</div>

					{/* Target branch selection */}
					<div>
						<label className="text-sm font-medium mb-2 block">Target Branch</label>
						<select
							className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
							value={targetBranch}
							onChange={(e) => { setTargetBranch(e.target.value); }}
						>
							<option value="">Select branch...</option>
							{branches.map((branch) => (
								<option key={branch} value={branch}>
									{branch} {branch === currentBranch ? '(current)' : ''}
								</option>
							))}
						</select>
					</div>

					{targetBranch && targetBranch !== currentBranch && (
						<div className="flex items-center gap-2 p-2 rounded bg-amber-50 text-amber-700 text-xs">
							<AlertCircle className="h-4 w-4" />
							<span>
								You'll need to checkout {targetBranch} first, or the commit will be cherry-picked onto {currentBranch}.
							</span>
						</div>
					)}

					{targetBranch === currentBranch && (
						<div className="flex items-center gap-2 p-2 rounded bg-green-50 text-green-700 text-xs">
							<Check className="h-4 w-4" />
							<span>
								Commit will be cherry-picked onto the current branch ({currentBranch}).
							</span>
						</div>
					)}
				</div>

				<DialogFooter className="ui-toolbar">
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button
						onClick={handleCherryPick}
						disabled={!targetBranch || isCherryPicking}
					>
						{isCherryPicking ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Copy className="h-4 w-4 mr-2" />
						)}
						Cherry-Pick
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default DragDropCherryPick;

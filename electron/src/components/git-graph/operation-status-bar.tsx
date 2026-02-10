/**
 * Operation Status Bar
 * Shows current git operation state (merge/rebase/cherry-pick/revert)
 * with abort/continue/skip buttons
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface OperationStatusBarProps {
	repo: string;
}

export function OperationStatusBar({ repo }: OperationStatusBarProps) {
	const utils = trpc.useUtils();
	const { data: opState } = trpc.git.operationState.useQuery(
		{ repo },
		{ enabled: !!repo, refetchInterval: 2000 }
	);

	// Mutations
	const mergeAbort = trpc.git.mergeAbort.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const mergeContinue = trpc.git.mergeContinue.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const rebaseAbort = trpc.git.rebaseAbort.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const rebaseContinue = trpc.git.rebaseContinue.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const rebaseSkip = trpc.git.rebaseSkip.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const cherryPickAbort = trpc.git.cherryPickAbort.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const cherryPickContinue = trpc.git.cherryPickContinue.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const cherryPickSkip = trpc.git.cherryPickSkip.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const revertAbort = trpc.git.revertAbort.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const revertContinue = trpc.git.revertContinue.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const revertSkip = trpc.git.revertSkip.useMutation({
		onSuccess: () => {
			utils.git.operationState.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const [showAbortConfirm, setShowAbortConfirm] = useState(false);
	const [abortAction, setAbortAction] = useState<(() => void) | null>(null);

	const state = opState?.state;
	if (!state) return null;

	const hasActiveOperation = state.merging || state.rebasing || state.cherryPicking || state.reverting || state.bisecting;
	if (!hasActiveOperation) return null;

	const hasConflicts = state.conflicts.length > 0;

	// Determine current operation type
	const operationType = state.merging ? 'merge' :
		state.rebasing ? 'rebase' :
		state.cherryPicking ? 'cherry-pick' :
		state.reverting ? 'revert' :
		state.bisecting ? 'bisect' : null;

	if (!operationType) return null;

	// Get appropriate handlers
	const handleAbort = () => {
		switch (operationType) {
			case 'merge':
				setAbortAction(() => () => mergeAbort.mutate({ repo }));
				break;
			case 'rebase':
				setAbortAction(() => () => rebaseAbort.mutate({ repo }));
				break;
			case 'cherry-pick':
				setAbortAction(() => () => cherryPickAbort.mutate({ repo }));
				break;
			case 'revert':
				setAbortAction(() => () => revertAbort.mutate({ repo }));
				break;
		}
		setShowAbortConfirm(true);
	};

	const handleContinue = () => {
		switch (operationType) {
			case 'merge':
				mergeContinue.mutate({ repo });
				break;
			case 'rebase':
				rebaseContinue.mutate({ repo });
				break;
			case 'cherry-pick':
				cherryPickContinue.mutate({ repo });
				break;
			case 'revert':
				revertContinue.mutate({ repo });
				break;
		}
	};

	const handleSkip = () => {
		switch (operationType) {
			case 'rebase':
				rebaseSkip.mutate({ repo });
				break;
			case 'cherry-pick':
				cherryPickSkip.mutate({ repo });
				break;
			case 'revert':
				revertSkip.mutate({ repo });
				break;
		}
	};

	const canSkip = operationType !== 'merge' && operationType !== 'bisect';
	const isLoading = mergeAbort.isPending || mergeContinue.isPending ||
		rebaseAbort.isPending || rebaseContinue.isPending || rebaseSkip.isPending ||
		cherryPickAbort.isPending || cherryPickContinue.isPending || cherryPickSkip.isPending ||
		revertAbort.isPending || revertContinue.isPending || revertSkip.isPending;

	return (
		<>
			<Card className={cn(
				"border-2",
				hasConflicts ? "border-destructive bg-destructive/5" : "border-yellow-500 bg-yellow-500/5"
			)}>
				<CardContent className="p-3">
					<div className="flex items-center justify-between gap-4">
						{/* Operation info */}
						<div className="flex items-center gap-3">
							<Badge 
								variant={hasConflicts ? "destructive" : "outline"}
								className="capitalize"
							>
								{operationType} in progress
							</Badge>

							{hasConflicts && (
								<span className="text-sm text-destructive">
									{state.conflicts.length} conflict{state.conflicts.length !== 1 ? 's' : ''}
								</span>
							)}

							{/* Conflicts list */}
							{state.conflicts.length > 0 && (
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
												View files
											</Button>
										}
									/>
									<DropdownMenuContent align="start">
										<ScrollArea className="max-h-48">
											{state.conflicts.map((file) => (
												<DropdownMenuItem
													key={file}
													className="font-mono text-xs"
												>
													{file}
												</DropdownMenuItem>
											))}
										</ScrollArea>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>

						{/* Actions */}
						<div className="flex items-center gap-2">
							{hasConflicts && (
								<span className="text-xs text-muted-foreground">
									Resolve conflicts to continue
								</span>
							)}

							{canSkip && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleSkip}
									disabled={isLoading}
								>
									Skip
								</Button>
							)}

							<Button
								variant="default"
								size="sm"
								onClick={handleContinue}
								disabled={isLoading || hasConflicts}
							>
								Continue
							</Button>

							<Button
								variant="destructive"
								size="sm"
								onClick={handleAbort}
								disabled={isLoading}
							>
								Abort
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Abort confirmation dialog */}
			<AlertDialog open={showAbortConfirm} onOpenChange={setShowAbortConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Abort {operationType}?</AlertDialogTitle>
						<AlertDialogDescription>
							This will cancel the current {operationType} operation and reset the repository
							to its previous state. Any changes made during the {operationType} will be lost.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								abortAction?.();
								setShowAbortConfirm(false);
							}}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Abort {operationType}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

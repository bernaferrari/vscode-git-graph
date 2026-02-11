/**
 * Git Bisect UI
 * Visual workflow for finding bugs using binary search
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	CheckCircle,
	XCircle,
	Play,
	SkipForward,
	RotateCcw,
	Bug,
	GitBranch,
	Loader2,
	Check,
	X,
	Flag,
	AlertTriangle,
	Terminal,
} from 'lucide-react';
import { toast } from 'sonner';

interface BisectState {
	isActive: boolean;
	badCommit: string | null;
	goodCommits: string[];
	currentCommit: string | null;
	remainingCommits: number;
	estimatedSteps: number;
	culprit: string | null;
	log: BisectLogEntry[];
}

interface BisectLogEntry {
	type: 'good' | 'bad' | 'skip' | 'start' | 'reset' | 'found';
	commit: string;
	message: string;
	timestamp: number;
}

interface GitBisectUIProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentCommitHash?: string;
}

export function GitBisectUI({ open, onOpenChange, currentCommitHash }: GitBisectUIProps) {
	const { activeRepo } = useAppStore();
	const [isLoading, setIsLoading] = useState(false);
	const [bisectState, setBisectState] = useState<BisectState>({
		isActive: false,
		badCommit: null,
		goodCommits: [],
		currentCommit: null,
		remainingCommits: 0,
		estimatedSteps: 0,
		culprit: null,
		log: [],
	});

	// Get current branch info
	const { data: statusData } = trpc.git.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Get current commit info if bisecting
	const { data: currentCommitData, refetch: refetchCurrentCommit } = trpc.git.commitInfo.useQuery(
		{ repo: activeRepo ?? '', hash: bisectState.currentCommit ?? '' },
		{ enabled: !!activeRepo && !!bisectState.currentCommit }
	);

	// Start bisect
	const handleStartBisect = useCallback(async () => {
		if (!activeRepo || !currentCommitHash) return;

		setIsLoading(true);
		try {
			await trpc.git.bisectStart.mutate({ repo: activeRepo });
			
			// Mark current commit as bad (the one with the bug)
			await trpc.git.bisectBad.mutate({ repo: activeRepo, commit: currentCommitHash });
			
			setBisectState(prev => ({
				...prev,
				isActive: true,
				badCommit: currentCommitHash,
				currentCommit: currentCommitHash,
				log: [
					...prev.log,
					{
						type: 'start',
						commit: currentCommitHash,
						message: `Started bisect, marked ${currentCommitHash.slice(0, 7)} as bad`,
						timestamp: Date.now(),
					},
				],
			}));

			toast.success('Bisect started', { 
				description: 'Mark a known-good commit to begin the search' 
			});
		} catch (error) {
			toast.error('Failed to start bisect', { 
				description: error instanceof Error ? error.message : 'Unknown error' 
			});
		} finally {
			setIsLoading(false);
		}
	}, [activeRepo, currentCommitHash]);

	// Mark commit as good
	const handleMarkGood = useCallback(async (commit?: string) => {
		if (!activeRepo) return;

		const targetCommit = commit || bisectState.currentCommit;
		if (!targetCommit) return;

		setIsLoading(true);
		try {
			const result = await trpc.git.bisectGood.mutate({ 
				repo: activeRepo, 
				commit: targetCommit 
			});

			setBisectState(prev => ({
				...prev,
				goodCommits: [...prev.goodCommits, targetCommit],
				currentCommit: result.nextCommit,
				remainingCommits: result.remaining ?? 0,
				estimatedSteps: result.steps ?? 0,
				culprit: result.culprit,
				log: [
					...prev.log,
					{
						type: 'good',
						commit: targetCommit,
						message: `Marked ${targetCommit.slice(0, 7)} as good`,
						timestamp: Date.now(),
					},
					...(result.culprit ? [{
						type: 'found' as const,
						commit: result.culprit,
						message: `Found culprit: ${result.culprit.slice(0, 7)}`,
						timestamp: Date.now(),
					}] : []),
				],
			}));

			if (result.culprit) {
				toast.success('Culprit found!', { 
					description: `Commit ${result.culprit.slice(0, 7)} introduced the bug` 
				});
			} else {
				toast.success('Marked as good');
			}
		} catch (error) {
			toast.error('Failed to mark as good');
		} finally {
			setIsLoading(false);
		}
	}, [activeRepo, bisectState.currentCommit]);

	// Mark commit as bad
	const handleMarkBad = useCallback(async (commit?: string) => {
		if (!activeRepo) return;

		const targetCommit = commit || bisectState.currentCommit;
		if (!targetCommit) return;

		setIsLoading(true);
		try {
			const result = await trpc.git.bisectBad.mutate({ 
				repo: activeRepo, 
				commit: targetCommit 
			});

			setBisectState(prev => ({
				...prev,
				badCommit: targetCommit,
				currentCommit: result.nextCommit,
				remainingCommits: result.remaining ?? 0,
				estimatedSteps: result.steps ?? 0,
				culprit: result.culprit,
				log: [
					...prev.log,
					{
						type: 'bad',
						commit: targetCommit,
						message: `Marked ${targetCommit.slice(0, 7)} as bad`,
						timestamp: Date.now(),
					},
					...(result.culprit ? [{
						type: 'found' as const,
						commit: result.culprit,
						message: `Found culprit: ${result.culprit.slice(0, 7)}`,
						timestamp: Date.now(),
					}] : []),
				],
			}));

			if (result.culprit) {
				toast.success('Culprit found!', { 
					description: `Commit ${result.culprit.slice(0, 7)} introduced the bug` 
				});
			} else {
				toast.success('Marked as bad');
			}
		} catch (error) {
			toast.error('Failed to mark as bad');
		} finally {
			setIsLoading(false);
		}
	}, [activeRepo, bisectState.currentCommit]);

	// Skip current commit
	const handleSkip = useCallback(async () => {
		if (!activeRepo || !bisectState.currentCommit) return;

		setIsLoading(true);
		try {
			const result = await trpc.git.bisectSkip.mutate({ 
				repo: activeRepo 
			});

			setBisectState(prev => ({
				...prev,
				currentCommit: result.nextCommit,
				remainingCommits: result.remaining ?? 0,
				log: [
					...prev.log,
					{
						type: 'skip',
						commit: prev.currentCommit!,
						message: `Skipped ${prev.currentCommit!.slice(0, 7)}`,
						timestamp: Date.now(),
					},
				],
			}));

			toast.success('Skipped commit');
		} catch (error) {
			toast.error('Failed to skip');
		} finally {
			setIsLoading(false);
		}
	}, [activeRepo, bisectState.currentCommit]);

	// Reset bisect
	const handleReset = useCallback(async () => {
		if (!activeRepo) return;

		setIsLoading(true);
		try {
			await trpc.git.bisectReset.mutate({ repo: activeRepo });

			setBisectState({
				isActive: false,
				badCommit: null,
				goodCommits: [],
				currentCommit: null,
				remainingCommits: 0,
				estimatedSteps: 0,
				culprit: null,
				log: [],
			});

			toast.success('Bisect reset');
		} catch (error) {
			toast.error('Failed to reset bisect');
		} finally {
			setIsLoading(false);
		}
	}, [activeRepo]);

	// Check bisect status on open
	useEffect(() => {
		if (!open || !activeRepo) return;

		const checkStatus = async () => {
			try {
				const status = await trpc.git.bisectStatus.query({ repo: activeRepo });
				if (status.isActive) {
					setBisectState(prev => ({
						...prev,
						isActive: true,
						badCommit: status.badCommit,
						goodCommits: status.goodCommits || [],
						currentCommit: status.currentCommit,
						remainingCommits: status.remaining ?? 0,
						culprit: status.culprit,
					}));
				}
			} catch (error) {
				// No active bisect, that's fine
			}
		};

		checkStatus();
	}, [open, activeRepo]);

	// Progress calculation
	const progress = useMemo(() => {
		if (bisectState.culprit) return 100;
		if (bisectState.estimatedSteps === 0) return 0;
		const steps = bisectState.log.filter(l => l.type === 'good' || l.type === 'bad').length;
		return Math.min(99, Math.round((steps / (steps + bisectState.estimatedSteps)) * 100));
	}, [bisectState.log, bisectState.estimatedSteps, bisectState.culprit]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Bug className="h-5 w-5" />
						Git Bisect
						{bisectState.isActive && (
							<Badge variant="secondary" className="ml-2">
								Active
							</Badge>
						)}
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col gap-4">
					{/* Status Overview */}
					{bisectState.isActive && (
						<div className="bg-muted/50 rounded-lg p-4">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm font-medium">Progress</span>
								<span className="text-sm text-muted-foreground">
									~{bisectState.estimatedSteps} steps remaining
								</span>
							</div>
							<div className="h-2 bg-muted rounded-full overflow-hidden">
								<div 
									className="h-full bg-primary transition-all"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
					)}

					{/* Culprit Found */}
					{bisectState.culprit && (
						<div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
							<div className="flex items-center gap-3">
								<CheckCircle className="h-6 w-6 text-green-600" />
								<div>
									<p className="font-medium text-green-700 dark:text-green-400">
										Culprit Found!
									</p>
									<p className="text-sm text-green-600 dark:text-green-300">
										Commit <code className="bg-green-200 dark:bg-green-800 px-1 rounded">
											{bisectState.culprit.slice(0, 7)}
										</code> introduced the bug
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Current Commit */}
					{bisectState.isActive && bisectState.currentCommit && !bisectState.culprit && (
						<div className="border rounded-lg p-4">
							<div className="flex items-center gap-2 mb-3">
								<GitBranch className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">Current Commit to Test</span>
							</div>
							
							{currentCommitData && (
								<div className="bg-muted/50 rounded p-3 mb-4">
									<div className="flex items-center gap-2 mb-1">
										<code className="text-sm font-mono text-blue-600">
											{bisectState.currentCommit.slice(0, 7)}
										</code>
										<span className="text-xs text-muted-foreground">
											{currentCommitData.author}
										</span>
									</div>
									<p className="text-sm truncate">{currentCommitData.message}</p>
								</div>
							)}

							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => handleMarkGood()}
									disabled={isLoading}
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Check className="h-4 w-4 mr-2 text-green-600" />
									)}
									Good
								</Button>
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => handleMarkBad()}
									disabled={isLoading}
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<X className="h-4 w-4 mr-2 text-red-600" />
									)}
									Bad
								</Button>
								<Button
									variant="ghost"
									onClick={handleSkip}
									disabled={isLoading}
								>
									<SkipForward className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}

					{/* Start Bisect */}
					{!bisectState.isActive && (
						<div className="border rounded-lg p-6 text-center">
							<Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
							<p className="text-muted-foreground mb-4">
								Bisect uses binary search to find which commit introduced a bug.
							</p>
							<ol className="text-sm text-left text-muted-foreground mb-6 space-y-2">
								<li className="flex items-start gap-2">
									<span className="font-medium text-foreground">1.</span>
									Start bisect from a commit with the bug
								</li>
								<li className="flex items-start gap-2">
									<span className="font-medium text-foreground">2.</span>
									Mark commits as "good" or "bad" after testing
								</li>
								<li className="flex items-start gap-2">
									<span className="font-medium text-foreground">3.</span>
									Git narrows down to the culprit commit
								</li>
							</ol>
							<Button onClick={handleStartBisect} disabled={isLoading}>
								{isLoading ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Play className="h-4 w-4 mr-2" />
								)}
								Start Bisect from Current Commit
							</Button>
						</div>
					)}

					{/* Bisect Log */}
					{bisectState.log.length > 0 && (
						<div className="border rounded-lg overflow-hidden">
							<div className="px-3 py-2 bg-muted/50 border-b text-sm font-medium">
								Bisect Log
							</div>
							<ScrollArea className="h-40">
								<div className="divide-y">
									{bisectState.log.map((entry, index) => (
										<div 
											key={index}
											className={`flex items-center gap-3 px-3 py-2 ${
												entry.type === 'good' ? 'bg-green-50 dark:bg-green-900/20' :
												entry.type === 'bad' ? 'bg-red-50 dark:bg-red-900/20' :
												entry.type === 'found' ? 'bg-amber-50 dark:bg-amber-900/20' :
												''
											}`}
										>
											{entry.type === 'good' && <Check className="h-4 w-4 text-green-600" />}
											{entry.type === 'bad' && <X className="h-4 w-4 text-red-600" />}
											{entry.type === 'skip' && <SkipForward className="h-4 w-4 text-muted-foreground" />}
											{entry.type === 'start' && <Flag className="h-4 w-4 text-blue-600" />}
											{entry.type === 'found' && <CheckCircle className="h-4 w-4 text-amber-600" />}
											
											<code className="text-xs font-mono text-muted-foreground">
												{entry.commit.slice(0, 7)}
											</code>
											<span className="text-sm flex-1">{entry.message}</span>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between pt-4 border-t">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span>Make sure to test the current commit before marking</span>
					</div>
					<div className="flex items-center gap-2">
						{bisectState.isActive && (
							<Button variant="outline" onClick={handleReset} disabled={isLoading}>
								<RotateCcw className="h-4 w-4 mr-2" />
								Reset
							</Button>
						)}
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default GitBisectUI;

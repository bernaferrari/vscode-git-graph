/**
 * Inline Staging Diff Viewer
 * Click hunks/lines to stage/unstage directly in the diff
 * Similar to Sublime Merge's staging workflow
 */

import {
	Plus,
	Minus,
	PlusCircle,
	MinusCircle,
	Check,
	Loader2,
	FileDiff,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	type LineDiff,
} from '@/lib/diff-utils';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface HunkLine extends LineDiff {
	content: string;
}

interface Hunk {
	startLine: number;
	endLine: number;
	header: string;
	lines: HunkLine[];
	staged: boolean;
	partiallyStaged: boolean;
}

interface InlineStagingDiffProps {
	filePath: string;
	fileStatus: string;
	onStaged?: () => void;
}

export function InlineStagingDiff({
	filePath,
	fileStatus,
	onStaged,
}: InlineStagingDiffProps) {
	const { activeRepo } = useAppStore();
	const [stagingHunk, setStagingHunk] = useState<number | null>(null);

	// Get unstaged diff
	const { data: unstagedDiff, isLoading: loadingUnstaged, refetch: refetchUnstaged } = trpc.git.workingTreeFileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			filePath,
			staged: false,
		},
		{ enabled: !!activeRepo && !!filePath && fileStatus !== '?' }
	);

	// Get staged diff
	const { data: stagedDiff, isLoading: loadingStaged, refetch: refetchStaged } = trpc.git.workingTreeFileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			filePath,
			staged: true,
		},
		{ enabled: !!activeRepo && !!filePath }
	);

	// Parse diffs into hunks
	const unstagedHunks = useMemo(() => {
		if (!unstagedDiff?.diff) return [];
		return parseDiffIntoHunks(unstagedDiff.diff, false);
	}, [unstagedDiff?.diff]);

	const stagedHunks = useMemo(() => {
		if (!stagedDiff?.diff) return [];
		return parseDiffIntoHunks(stagedDiff.diff, true);
	}, [stagedDiff?.diff]);
	const diffStats = useMemo(() => {
		const allLines = [...stagedHunks, ...unstagedHunks].flatMap((hunk) => hunk.lines);
		return {
			hunks: stagedHunks.length + unstagedHunks.length,
			added: allLines.filter((line) => line.type === 'added').length,
			removed: allLines.filter((line) => line.type === 'removed').length,
		};
	}, [stagedHunks, unstagedHunks]);

	// Stage mutations
	const stageMutation = trpc.git.stage.useMutation({
		onSuccess: () => {
			toast.success('Staged');
			void refetchUnstaged();
			void refetchStaged();
			onStaged?.();
		},
		onError: (error) => {
			toast.error('Failed to stage', { description: error.message });
		},
	});

	const unstageMutation = trpc.git.unstage.useMutation({
		onSuccess: () => {
			toast.success('Unstaged');
			void refetchUnstaged();
			void refetchStaged();
		},
		onError: (error) => {
			toast.error('Failed to unstage', { description: error.message });
		},
	});

	// Stage a hunk
	const handleStageHunk = useCallback(async (hunkIndex: number, isUnstaged: boolean) => {
		if (!activeRepo || !filePath) return;

		setStagingHunk(hunkIndex);
		try {
			const hunks = isUnstaged ? unstagedHunks : stagedHunks;
			const hunk = hunks[hunkIndex];
			if (!hunk) {
				return;
			}

				if (isUnstaged) {
					await stageMutation.mutateAsync({
						repo: activeRepo,
						files: [filePath],
					});
				} else {
					await unstageMutation.mutateAsync({
						repo: activeRepo,
						files: [filePath],
					});
				}
		} finally {
			setStagingHunk(null);
		}
	}, [activeRepo, filePath, unstagedHunks, stagedHunks, stageMutation, unstageMutation]);

	// Stage/unstage all
	const handleStageAll = () => {
		if (!activeRepo || !filePath) return;
		stageMutation.mutate({ repo: activeRepo, files: [filePath] });
	};

	const handleUnstageAll = () => {
		if (!activeRepo || !filePath) return;
		unstageMutation.mutate({ repo: activeRepo, files: [filePath] });
	};

	const isLoading = loadingUnstaged || loadingStaged;
	const isMutating = stageMutation.isPending || unstageMutation.isPending;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
				<div className="flex items-center gap-2">
					<FileDiff className='h-3.5 w-3.5 text-muted-foreground' />
					<span className="text-sm font-medium truncate max-w-[200px]" title={filePath}>
						{filePath}
					</span>
					<Badge variant="outline" className="text-xs">
						{fileStatus === '?' ? 'Untracked' : fileStatus}
					</Badge>
					<Badge variant='outline' className='text-xs'>
						{diffStats.hunks} hunks
					</Badge>
					<Badge variant='outline' className='border-green-500/25 text-green-700 dark:text-green-300'>
						+{diffStats.added}
					</Badge>
					<Badge variant='outline' className='border-red-500/25 text-red-700 dark:text-red-300'>
						-{diffStats.removed}
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					{unstagedHunks.length > 0 && (
						<Button variant="outline" size="sm" onClick={handleStageAll} disabled={isMutating}>
							<PlusCircle className="h-3 w-3 mr-1" />
							Stage File
						</Button>
					)}
					{stagedHunks.length > 0 && (
						<Button variant="outline" size="sm" onClick={handleUnstageAll} disabled={isMutating}>
							<MinusCircle className="h-3 w-3 mr-1" />
							Unstage File
						</Button>
					)}
				</div>
			</div>

			<ScrollArea className="flex-1">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : (
					<div className="font-mono text-xs">
						{/* Staged changes section */}
						{stagedHunks.length > 0 && (
							<div className="border-b">
								<div className="px-4 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-sans text-xs font-medium flex items-center gap-2">
									<Check className="h-3 w-3" />
									Staged Changes
								</div>
									{stagedHunks.map((hunk, hunkIndex) => (
										<HunkDisplay
											key={`staged-${String(hunkIndex)}`}
											hunk={hunk}
											isStaged={true}
											onToggleHunk={() => { void handleStageHunk(hunkIndex, false); }}
											isStaging={stagingHunk === hunkIndex}
									/>
								))}
							</div>
						)}

						{/* Unstaged changes section */}
						{unstagedHunks.length > 0 && (
							<div>
								<div className="px-4 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-sans text-xs font-medium flex items-center gap-2">
									<Minus className="h-3 w-3" />
									Unstaged Changes
								</div>
									{unstagedHunks.map((hunk, hunkIndex) => (
										<HunkDisplay
											key={`unstaged-${String(hunkIndex)}`}
											hunk={hunk}
											isStaged={false}
											onToggleHunk={() => { void handleStageHunk(hunkIndex, true); }}
											isStaging={stagingHunk === hunkIndex}
									/>
								))}
							</div>
						)}

						{/* Empty state */}
						{stagedHunks.length === 0 && unstagedHunks.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								{fileStatus === '?' ? (
									<p>Untracked file - click Stage to add</p>
								) : (
									<p>No changes</p>
								)}
							</div>
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

// Parse diff into hunks
function parseDiffIntoHunks(diffText: string, isStaged: boolean): Hunk[] {
	const lines = diffText.split('\n');
	const hunks: Hunk[] = [];
	let currentHunk: Hunk | null = null;
	let lineNum = 0;

	for (const line of lines) {
		if (line.startsWith('@@')) {
			// Start new hunk
			if (currentHunk) {
				hunks.push(currentHunk);
			}
			currentHunk = {
				startLine: lineNum,
				endLine: lineNum,
				header: line,
				lines: [],
				staged: isStaged,
				partiallyStaged: false,
			};
		} else if (currentHunk) {
				const type: 'added' | 'removed' | 'context' = 
					line.startsWith('+') ? 'added' :
					line.startsWith('-') ? 'removed' : 'context';
				
				if (type !== 'context' || line.startsWith(' ')) {
					const content = line.slice(1);
					currentHunk.lines.push({
						type,
						content,
						left: type === 'removed' || type === 'context' ? {
							chars: content.split('').map(c => ({ char: c, type: 'unchanged' as const })),
							html: content,
						} : null,
						right: type === 'added' || type === 'context' ? {
							chars: content.split('').map(c => ({ char: c, type: 'unchanged' as const })),
							html: content,
						} : null,
						leftLineNum: 0,
						rightLineNum: 0,
				});
				currentHunk.endLine = lineNum;
			}
		}
		lineNum++;
	}

	if (currentHunk) {
		hunks.push(currentHunk);
	}

	return hunks;
}

// Hunk display component
function HunkDisplay({
	hunk,
	isStaged,
	onToggleHunk,
	isStaging,
}: {
	hunk: Hunk;
	isStaged: boolean;
	onToggleHunk: () => void;
	isStaging: boolean;
}) {
	return (
		<div className="border-b last:border-b-0">
			{/* Hunk header with stage button */}
			<div 
				className="flex items-center justify-between px-4 py-1 bg-muted/30 cursor-pointer hover:bg-muted/50"
				onClick={onToggleHunk}
			>
				<code className="text-xs text-muted-foreground">{hunk.header}</code>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 px-2 text-xs"
					disabled={isStaging}
				>
					{isStaging ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : isStaged ? (
						<>
							<MinusCircle className="h-3 w-3 mr-1" />
							Unstage File
						</>
					) : (
						<>
							<PlusCircle className="h-3 w-3 mr-1" />
							Stage File
						</>
					)}
				</Button>
			</div>

			{/* Lines */}
			{hunk.lines.map((line, lineIndex) => (
				<div
					key={lineIndex}
					className={`group flex items-center ${
						line.type === 'added' ? 'bg-green-50 dark:bg-green-900/20' :
						line.type === 'removed' ? 'bg-red-50 dark:bg-red-900/20' : ''
					} hover:bg-accent/30`}
				>
					{/* Line number */}
					<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/20">
						{line.leftLineNum || ''}
					</div>
					<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/20">
						{line.rightLineNum || ''}
					</div>

					{/* Diff indicator */}
					<div className="w-6 text-center select-none border-r bg-muted/20">
						{line.type === 'added' && <Plus className="h-3 w-3 mx-auto text-green-600" />}
						{line.type === 'removed' && <Minus className="h-3 w-3 mx-auto text-red-600" />}
					</div>

					{/* Content */}
					<pre className="px-2 py-0.5 whitespace-pre flex-1">
						{line.content}
					</pre>
				</div>
			))}
		</div>
	);
}

export default InlineStagingDiff;

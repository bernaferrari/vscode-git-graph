/**
 * Inline Staging Diff Viewer
 * Click hunks/lines to stage/unstage directly in the diff
 * Similar to Sublime Merge's staging workflow
 */

import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Plus,
	Minus,
	PlusCircle,
	MinusCircle,
	Check,
	Loader2,
	StageAll,
	UnstageAll,
} from 'lucide-react';
import { toast } from 'sonner';
import {
	parseDiffWithInlineDiffs,
	DiffCharRenderer,
	type LineDiff,
} from '@/lib/diff-utils';

interface Hunk {
	startLine: number;
	endLine: number;
	header: string;
	lines: LineDiff[];
	staged: boolean;
	partiallyStaged: boolean;
}

interface InlineStagingDiffProps {
	filePath: string;
	fileStatus: string;
	stagedContent?: string;
	workingContent?: string;
	onStaged?: () => void;
}

export function InlineStagingDiff({
	filePath,
	fileStatus,
	stagedContent,
	workingContent,
	onStaged,
}: InlineStagingDiffProps) {
	const { activeRepo } = useAppStore();
	const [stagingHunk, setStagingHunk] = useState<number | null>(null);
	const [stagingLines, setStagingLines] = useState<Set<number>>(new Set());

	// Get unstaged diff
	const { data: unstagedDiff, isLoading: loadingUnstaged, refetch: refetchUnstaged } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: 'HEAD',
			filePath,
			staged: false,
		},
		{ enabled: !!activeRepo && !!filePath && fileStatus !== '?' }
	);

	// Get staged diff
	const { data: stagedDiff, isLoading: loadingStaged, refetch: refetchStaged } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: 'HEAD',
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

	// Stage mutations
	const stageMutation = trpc.git.stage.useMutation({
		onSuccess: () => {
			toast.success('Staged');
			refetchUnstaged();
			refetchStaged();
			onStaged?.();
		},
		onError: (error) => {
			toast.error('Failed to stage', { description: error.message });
		},
	});

	const unstageMutation = trpc.git.unstage.useMutation({
		onSuccess: () => {
			toast.success('Unstaged');
			refetchUnstaged();
			refetchStaged();
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
			
			if (isUnstaged) {
				// Stage the hunk - use patch mode
				await stageMutation.mutateAsync({
					repo: activeRepo,
					paths: [filePath],
					patch: generateHunkPatch(hunk, filePath),
				});
			} else {
				// Unstage the hunk
				await unstageMutation.mutateAsync({
					repo: activeRepo,
					paths: [filePath],
					patch: generateHunkPatch(hunk, filePath, true),
				});
			}
		} finally {
			setStagingHunk(null);
		}
	}, [activeRepo, filePath, unstagedHunks, stagedHunks, stageMutation, unstageMutation]);

	// Stage/unstage all
	const handleStageAll = () => {
		if (!activeRepo || !filePath) return;
		stageMutation.mutate({ repo: activeRepo, paths: [filePath] });
	};

	const handleUnstageAll = () => {
		if (!activeRepo || !filePath) return;
		unstageMutation.mutate({ repo: activeRepo, paths: [filePath] });
	};

	// Toggle individual line
	const handleToggleLine = useCallback((lineIndex: number, isUnstaged: boolean) => {
		if (!activeRepo || !filePath) return;

		// For simplicity, stage/unstage the whole hunk containing this line
		const hunks = isUnstaged ? unstagedHunks : stagedHunks;
		const hunkIndex = hunks.findIndex(h => 
			lineIndex >= h.startLine && lineIndex <= h.endLine
		);
		
		if (hunkIndex >= 0) {
			handleStageHunk(hunkIndex, isUnstaged);
		}
	}, [activeRepo, filePath, unstagedHunks, stagedHunks, handleStageHunk]);

	const isLoading = loadingUnstaged || loadingStaged;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium truncate max-w-[200px]" title={filePath}>
						{filePath}
					</span>
					<Badge variant="outline" className="text-xs">
						{fileStatus === '?' ? 'Untracked' : fileStatus}
					</Badge>
				</div>
				<div className="flex items-center gap-2">
					{unstagedHunks.length > 0 && (
						<Button variant="outline" size="sm" onClick={handleStageAll}>
							<PlusCircle className="h-3 w-3 mr-1" />
							Stage All
						</Button>
					)}
					{stagedHunks.length > 0 && (
						<Button variant="outline" size="sm" onClick={handleUnstageAll}>
							<MinusCircle className="h-3 w-3 mr-1" />
							Unstage All
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
										key={`staged-${hunkIndex}`}
										hunk={hunk}
										hunkIndex={hunkIndex}
										isStaged={true}
										onToggleHunk={() => handleStageHunk(hunkIndex, false)}
										onToggleLine={(lineIdx) => handleToggleLine(lineIdx, false)}
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
										key={`unstaged-${hunkIndex}`}
										hunk={hunk}
										hunkIndex={hunkIndex}
										isStaged={false}
										onToggleHunk={() => handleStageHunk(hunkIndex, true)}
										onToggleLine={(lineIdx) => handleToggleLine(lineIdx, true)}
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
				currentHunk.lines.push({
					type,
					content: line.slice(1),
					left: type === 'removed' || type === 'context' ? {
						chars: line.slice(1).split('').map(c => ({ char: c, type: 'unchanged' as const })),
						html: line.slice(1),
					} : null,
					right: type === 'added' || type === 'context' ? {
						chars: line.slice(1).split('').map(c => ({ char: c, type: 'unchanged' as const })),
						html: line.slice(1),
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

// Generate patch for a hunk
function generateHunkPatch(hunk: Hunk, filePath: string, reverse: boolean = false): string {
	const lines: string[] = [];
	lines.push(`--- a/${filePath}`);
	lines.push(`+++ b/${filePath}`);
	lines.push(hunk.header);
	
	for (const line of hunk.lines) {
		if (line.type === 'added') {
			lines.push((reverse ? '-' : '+') + line.content);
		} else if (line.type === 'removed') {
			lines.push((reverse ? '+' : '-') + line.content);
		} else {
			lines.push(' ' + line.content);
		}
	}
	
	return lines.join('\n');
}

// Hunk display component
function HunkDisplay({
	hunk,
	hunkIndex,
	isStaged,
	onToggleHunk,
	onToggleLine,
	isStaging,
}: {
	hunk: Hunk;
	hunkIndex: number;
	isStaged: boolean;
	onToggleHunk: () => void;
	onToggleLine: (lineIndex: number) => void;
	isStaging: boolean;
}) {
	const [hoveredLine, setHoveredLine] = useState<number | null>(null);

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
							Unstage
						</>
					) : (
						<>
							<PlusCircle className="h-3 w-3 mr-1" />
							Stage
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
					onMouseEnter={() => setHoveredLine(lineIndex)}
					onMouseLeave={() => setHoveredLine(null)}
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

					{/* Stage line button */}
					<div className={`w-6 flex items-center justify-center border-r ${
						hoveredLine === lineIndex && line.type !== 'context' ? 'opacity-100' : 'opacity-0'
					}`}>
						<Button
							variant="ghost"
							size="sm"
							className="h-5 w-5 p-0"
							onClick={(e) => {
								e.stopPropagation();
								onToggleLine(lineIndex);
							}}
						>
							{isStaged ? (
								<MinusCircle className="h-3 w-3 text-red-500" />
							) : (
								<PlusCircle className="h-3 w-3 text-green-500" />
							)}
						</Button>
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

/**
 * Line-by-Line Staging
 * Stage specific hunks or individual lines from a file
 */

import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Plus,
	Minus,
	Check,
	X,
	ChevronDown,
	ChevronRight,
	StageAll,
} from 'lucide-react';

interface LineStagingProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filePath: string;
	onStaged: () => void;
}

interface DiffLine {
	lineNumber: number;
	content: string;
	type: 'context' | 'added' | 'removed' | 'header';
	oldLineNumber?: number;
	newLineNumber?: number;
	selected: boolean;
}

interface DiffHunk {
	header: string;
	startLine: number;
	lines: DiffLine[];
	selected: boolean;
}

export function LineStaging({ open, onOpenChange, filePath, onStaged }: LineStagingProps) {
	const { activeRepo } = useAppStore();
	const [hunks, setHunks] = useState<DiffHunk[]>([]);
	const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set());

	// Get unstaged diff for the file
	const { data: diffData, isLoading } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: 'HEAD',
			filePath: filePath,
		},
		{ enabled: !!activeRepo && !!filePath && open }
	);

	// Parse diff into hunks and lines
	useMemo(() => {
		if (!diffData?.diff) {
			setHunks([]);
			return;
		}

		const lines = diffData.diff.split('\n');
		const parsedHunks: DiffHunk[] = [];
		let currentHunk: DiffHunk | null = null;
		let oldLineNum = 0;
		let newLineNum = 0;

		lines.forEach((line, index) => {
			if (line.startsWith('@@')) {
				if (currentHunk) {
					parsedHunks.push(currentHunk);
				}
				const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
				if (match) {
					oldLineNum = parseInt(match[1], 10);
					newLineNum = parseInt(match[2], 10);
				}
				currentHunk = {
					header: line,
					startLine: index,
					lines: [],
					selected: false,
				};
			} else if (currentHunk) {
				let diffLine: DiffLine;
				if (line.startsWith('-') && !line.startsWith('---')) {
					diffLine = {
						lineNumber: index,
						content: line.slice(1),
						type: 'removed',
						oldLineNumber: oldLineNum++,
						selected: false,
					};
				} else if (line.startsWith('+') && !line.startsWith('+++')) {
					diffLine = {
						lineNumber: index,
						content: line.slice(1),
						type: 'added',
						newLineNumber: newLineNum++,
						selected: false,
					};
				} else if (line.startsWith(' ') || line === '') {
					diffLine = {
						lineNumber: index,
						content: line.startsWith(' ') ? line.slice(1) : line,
						type: 'context',
						oldLineNumber: oldLineNum++,
						newLineNumber: newLineNum++,
						selected: false,
					};
				} else {
					return; // Skip non-content lines
				}
				currentHunk.lines.push(diffLine);
			}
		});

		if (currentHunk) {
			parsedHunks.push(currentHunk);
		}

		setHunks(parsedHunks);
		setExpandedHunks(new Set(parsedHunks.map((_, i) => i)));
	}, [diffData?.diff]);

	const toggleHunk = useCallback((hunkIndex: number) => {
		setHunks(prev => prev.map((hunk, i) => 
			i === hunkIndex ? { ...hunk, selected: !hunk.selected, lines: hunk.lines.map(l => ({ ...l, selected: !hunk.selected })) } : hunk
		));
	}, []);

	const toggleLine = useCallback((hunkIndex: number, lineIndex: number) => {
		setHunks(prev => prev.map((hunk, hi) => {
			if (hi !== hunkIndex) return hunk;
			const newLines = hunk.lines.map((line, li) =>
				li === lineIndex ? { ...line, selected: !line.selected } : line
			);
			const allSelected = newLines.filter(l => l.type !== 'context').every(l => l.selected);
			return { ...hunk, lines: newLines, selected: allSelected };
		}));
	}, []);

	const toggleHunkExpanded = useCallback((hunkIndex: number) => {
		setExpandedHunks(prev => {
			const next = new Set(prev);
			if (next.has(hunkIndex)) {
				next.delete(hunkIndex);
			} else {
				next.add(hunkIndex);
			}
			return next;
		});
	}, []);

	const stageSelected = trpc.git.stageLines.useMutation({
		onSuccess: () => {
			onStaged();
			onOpenChange(false);
		},
	});

	const handleStageSelected = () => {
		// Build patch content from selected lines
		const selectedLines: string[] = [];
		hunks.forEach(hunk => {
			const hunkSelectedLines = hunk.lines.filter(l => l.selected && l.type !== 'context');
			if (hunkSelectedLines.length > 0) {
				selectedLines.push(hunk.header);
				hunk.lines.forEach(line => {
					if (line.selected || line.type === 'context') {
						if (line.type === 'added') selectedLines.push(`+${line.content}`);
						else if (line.type === 'removed') selectedLines.push(`-${line.content}`);
						else selectedLines.push(` ${line.content}`);
					} else if (line.type === 'removed') {
						// If we're not staging the removal, don't include it
					}
				});
			}
		});

		if (selectedLines.length > 0) {
			stageSelected.mutate({
				repo: activeRepo ?? '',
				filePath: filePath,
				patch: selectedLines.join('\n'),
			});
		}
	};

	const selectedCount = hunks.reduce((acc, hunk) => 
		acc + hunk.lines.filter(l => l.selected && l.type !== 'context').length, 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Stage Lines
						<span className="text-sm font-normal text-muted-foreground">
							{filePath}
						</span>
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<div className="text-sm text-muted-foreground">
						{selectedCount} line{selectedCount !== 1 ? 's' : ''} selected
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setHunks(prev => prev.map(hunk => ({
									...hunk,
									selected: true,
									lines: hunk.lines.map(l => ({ ...l, selected: l.type !== 'context' })),
								})));
							}}
						>
							Select All
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setHunks(prev => prev.map(hunk => ({
									...hunk,
									selected: false,
									lines: hunk.lines.map(l => ({ ...l, selected: false })),
								})));
							}}
						>
							Deselect All
						</Button>
					</div>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
						</div>
					) : hunks.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No unstaged changes in this file
						</div>
					) : (
						<div className="font-mono text-xs">
							{hunks.map((hunk, hunkIndex) => (
								<div key={hunkIndex} className="border-b last:border-b-0">
									{/* Hunk header */}
									<div
										className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 ${
											hunk.selected ? 'bg-green-500/10' : ''
										}`}
										onClick={() => toggleHunk(hunkIndex)}
									>
										<Button
											variant="ghost"
											size="sm"
											className="h-4 w-4 p-0"
											onClick={(e) => {
												e.stopPropagation();
												toggleHunkExpanded(hunkIndex);
											}}
										>
											{expandedHunks.has(hunkIndex) ? (
												<ChevronDown className="h-3 w-3" />
											) : (
												<ChevronRight className="h-3 w-3" />
											)}
										</Button>
										<Check className={`h-3 w-3 ${hunk.selected ? 'text-green-600' : 'text-muted-foreground'}`} />
										<span className="text-blue-600 dark:text-blue-400">{hunk.header}</span>
									</div>

									{/* Hunk lines */}
									{expandedHunks.has(hunkIndex) && hunk.lines.map((line, lineIndex) => (
										<div
											key={lineIndex}
											className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-accent/30 ${
												line.selected ? 'bg-green-500/10' : ''
											} ${
												line.type === 'added' ? 'bg-green-500/5' :
												line.type === 'removed' ? 'bg-red-500/5' : ''
											}`}
											onClick={() => line.type !== 'context' && toggleLine(hunkIndex, lineIndex)}
										>
											<div className="w-8 text-right text-muted-foreground select-none">
												{line.oldLineNumber ?? ''}
											</div>
											<div className="w-8 text-right text-muted-foreground select-none border-r">
												{line.newLineNumber ?? ''}
											</div>
											<div className="w-4 text-center select-none">
												{line.type === 'added' && <Plus className="h-3 w-3 text-green-600 inline" />}
												{line.type === 'removed' && <Minus className="h-3 w-3 text-red-600 inline" />}
											</div>
											{line.type !== 'context' && (
												<Check className={`h-3 w-3 ${line.selected ? 'text-green-600' : 'text-muted-foreground/30'}`} />
											)}
											<pre className="flex-1 whitespace-pre overflow-hidden">
												{line.content}
											</pre>
										</div>
									))}
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center justify-end gap-2 pt-4 border-t">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleStageSelected}
						disabled={selectedCount === 0 || stageSelected.isPending}
					>
						{stageSelected.isPending ? (
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
						) : (
							<Plus className="h-4 w-4 mr-2" />
						)}
						Stage {selectedCount} Line{selectedCount !== 1 ? 's' : ''}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

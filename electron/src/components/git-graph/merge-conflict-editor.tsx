/**
 * Merge Conflict Editor
 * Visual 3-way diff for resolving conflicts
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	ArrowRight,
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	Check,
	Copy,
	AlertTriangle,
	BookOpen,
} from 'lucide-react';

interface ConflictFile {
	path: string;
	ours: string;
	theirs: string;
	base?: string;
}

interface MergeConflictEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conflict: ConflictFile | null;
	onResolve: (path: string, content: string) => void;
}

interface ConflictChunk {
	ours: string;
	theirs: string;
	base?: string;
	startLine: number;
	endLine: number;
	rawStart: number;
	rawEnd: number;
	raw: string;
}

export function MergeConflictEditor({
	open,
	onOpenChange,
	conflict,
	onResolve,
}: MergeConflictEditorProps) {
	const [resolved, setResolved] = useState<string>('');
	const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
	const [activeConflictIndex, setActiveConflictIndex] = useState<number>(0);

	useEffect(() => {
		setResolved('');
		setActiveConflictIndex(0);
	}, [conflict?.path]);

	if (!conflict) return null;

	const parseConflictBlocks = (content: string): ConflictChunk[] => {
		const lines = content.split('\n');
		const conflicts: ConflictChunk[] = [];
		let current: Omit<ConflictChunk, 'raw'> | null = null;
		let state: 'ours' | 'base' | 'theirs' | null = null;

		let lineOffset = 0;

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index] ?? '';
			const lineStart = lineOffset;
			const lineLength = line.length + (index === lines.length - 1 ? 0 : 1);
			const lineEnd = lineStart + lineLength;

			if (line.startsWith('<<<<<<<')) {
				current = {
					ours: '',
					theirs: '',
					startLine: index,
					endLine: index,
					rawStart: lineStart,
					rawEnd: lineEnd,
				};
				state = 'ours';
				lineOffset = lineEnd;
				continue;
			}

			if (line.startsWith('|||||||')) {
				state = 'base';
				lineOffset = lineEnd;
				continue;
			}

			if (line.startsWith('=======')) {
				state = 'theirs';
				lineOffset = lineEnd;
				continue;
			}

			if (line.startsWith('>>>>>>>')) {
				if (current) {
					current.rawEnd = lineEnd;
					current.endLine = index;
					current.raw = content.slice(current.rawStart, current.rawEnd);
					conflicts.push(current as ConflictChunk);
				}
				current = null;
				state = null;
				lineOffset = lineEnd;
				continue;
			}

			if (current) {
				const chunkLine = line + (index === lines.length - 1 ? '' : '\n');
				if (state === 'ours') {
					current.ours += chunkLine;
				} else if (state === 'base') {
					current.base = (current.base ?? '') + chunkLine;
				} else if (state === 'theirs') {
					current.theirs += chunkLine;
				}
				current.rawEnd = lineEnd;
			}

			lineOffset = lineEnd;
		}

		if (current) {
			current.endLine = lines.length - 1;
			current.raw = content.slice(current.rawStart, current.rawEnd);
			conflicts.push(current as ConflictChunk);
		}

		return conflicts;
	};

	const editableContent = useMemo(() => resolved || conflict.ours, [resolved, conflict.ours]);
	const unresolvedConflicts = useMemo(() => parseConflictBlocks(editableContent), [editableContent]);
	const totalConflictCount = useMemo(() => parseConflictBlocks(conflict.ours).length, [conflict.ours]);
	const hasOriginalConflicts = totalConflictCount > 0;
	const resolvedConflictCount = useMemo(() => {
		if (!hasOriginalConflicts) return unresolvedConflicts.length === 0 ? 0 : 0;
		return Math.max(0, totalConflictCount - unresolvedConflicts.length);
	}, [hasOriginalConflicts, totalConflictCount, unresolvedConflicts.length]);
	const manualOverride = useMemo(() => {
		if (resolved === '') return false;
		return resolved !== conflict.ours;
	}, [resolved, conflict.ours]);
	const hasUnresolvedConflicts = unresolvedConflicts.length > 0;
	const hasBase = conflict.base !== undefined;
	const hasBaseInConflicts = unresolvedConflicts.some((chunk) => chunk.base !== undefined);
	const hasAnyBase = hasBase || hasBaseInConflicts;
	const hasBaseForAllConflicts =
		unresolvedConflicts.length > 0 && unresolvedConflicts.every((chunk) => chunk.base !== undefined);
	const activeConflict = unresolvedConflicts[activeConflictIndex];
	const canUseActiveBase = activeConflict?.base !== undefined;

	useEffect(() => {
		if (unresolvedConflicts.length === 0) {
			setActiveConflictIndex(0);
			return;
		}

		if (activeConflictIndex >= unresolvedConflicts.length) {
			setActiveConflictIndex(unresolvedConflicts.length - 1);
		}
	}, [activeConflictIndex, unresolvedConflicts.length]);

	const buildReplacement = (chunk: ConflictChunk, mode: 'ours' | 'theirs' | 'base' | 'both'): string => {
		if (mode === 'ours') return chunk.ours;
		if (mode === 'theirs') return chunk.theirs;
		if (mode === 'base') return chunk.base ?? '';

		const combined = chunk.ours + (chunk.ours && !chunk.ours.endsWith('\n') ? '\n' : '') + chunk.theirs;
		return combined;
	};

	const applyResolution = (
		mode: 'ours' | 'theirs' | 'both' | 'base',
		targetIndexes?: number[],
	): boolean => {
		const source = editableContent;
		if (!hasUnresolvedConflicts && !targetIndexes) return false;

		const chunks = parseConflictBlocks(source);
		if (chunks.length === 0) return false;

		const targetSet = targetIndexes
			? new Set(targetIndexes)
			: new Set(chunks.map((_, index) => index));
		const targets = chunks
			.map((chunk, index) => ({ chunk, index }))
			.filter((entry) => targetSet.has(entry.index))
			.sort((a, b) => a.chunk.rawStart - b.chunk.rawStart);
		if (targets.length === 0) return false;

		let cursor = 0;
		const outputParts: string[] = [];

		for (const { chunk } of targets) {
			outputParts.push(source.slice(cursor, chunk.rawStart));
			outputParts.push(buildReplacement(chunk, mode));
			cursor = chunk.rawEnd;
		}

		outputParts.push(source.slice(cursor));
		setResolved(outputParts.join(''));
		return true;
	};

	const applyActiveResolutionAndAdvance = (mode: 'ours' | 'theirs' | 'both' | 'base') => {
		const resolvedNow = applyResolution(mode, [activeConflictIndex]);
		if (!resolvedNow) return;
		if (unresolvedConflicts.length <= 1) {
			setActiveConflictIndex(0);
			return;
		}

		setActiveConflictIndex((current) => Math.min(current, unresolvedConflicts.length - 2));
	};

	const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const isActionModifier = event.metaKey || event.ctrlKey;
		const isAlt = event.altKey;
		if (!isActionModifier && !isAlt) return;

		if (event.key === 'ArrowUp') {
			if (isActionModifier) {
				event.preventDefault();
				goToPreviousConflict();
			}
			return;
		}

		if (event.key === 'ArrowDown') {
			if (isActionModifier) {
				event.preventDefault();
				goToNextConflict();
			}
			return;
		}

		switch (event.key.toLowerCase()) {
			case 'o':
				if (isActionModifier) {
					event.preventDefault();
					acceptActiveOursAndNext();
				}
				return;
			case 't':
				if (isActionModifier) {
					event.preventDefault();
					acceptActiveTheirsAndNext();
				}
				return;
			case 'b':
				if (isActionModifier) {
					event.preventDefault();
					acceptActiveBothAndNext();
				}
				return;
			case 'n':
				if (isAlt) {
					event.preventDefault();
					if (canUseActiveBase) {
						acceptActiveBaseAndNext();
					}
				}
				return;
			case 'r':
				if (isActionModifier) {
					event.preventDefault();
					handleClose(false);
				}
				return;
			default:
				return;
		}
	};

	const acceptOurs = () => applyResolution('ours');
	const acceptTheirs = () => applyResolution('theirs');
	const acceptBoth = () => applyResolution('both');
	const acceptBase = () => applyResolution('base');
	const acceptActiveOursAndNext = () => applyActiveResolutionAndAdvance('ours');
	const acceptActiveTheirsAndNext = () => applyActiveResolutionAndAdvance('theirs');
	const acceptActiveBothAndNext = () => applyActiveResolutionAndAdvance('both');
	const acceptActiveBaseAndNext = () => applyActiveResolutionAndAdvance('base');
	const resetResolution = () => setResolved('');
	const goToPreviousConflict = () => setActiveConflictIndex((current) => Math.max(0, current - 1));
	const goToNextConflict = () => setActiveConflictIndex((current) => Math.min(unresolvedConflicts.length - 1, current + 1));
	const goToFirstConflict = () => setActiveConflictIndex(0);
	const handleClose = (nextOpen: boolean) => {
		if (!nextOpen && manualOverride) {
			const canClose = window.confirm('You have unsaved conflict edits. Close anyway?');
			if (!canClose) return;
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				className="max-w-4xl max-h-[80vh] flex flex-col ui-surface"
				onKeyDown={handleEditorKeyDown}
				tabIndex={0}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="text-amber-500">⚠️</span>
						Resolve Conflicts: {conflict.path}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-wrap items-center gap-2 py-2 border-b">
					<span className="text-xs text-muted-foreground">Quick resolve:</span>
					<Button variant="outline" size="sm" onClick={acceptOurs} disabled={!hasUnresolvedConflicts}>
						<ArrowLeft className="h-3 w-3 mr-1" />
						Use Ours (all)
					</Button>
					{hasAnyBase && (
						<Button
							variant="outline"
							size="sm"
							onClick={acceptBase}
							disabled={!hasUnresolvedConflicts || !hasBaseForAllConflicts}
						>
							<BookOpen className="h-3 w-3 mr-1" />
							Use Base (all)
						</Button>
					)}
					<Button variant="outline" size="sm" onClick={acceptTheirs} disabled={!hasUnresolvedConflicts}>
						Use Theirs
						<ArrowRight className="h-3 w-3 ml-1" />
					</Button>
					<Button variant="outline" size="sm" onClick={acceptBoth} disabled={!hasUnresolvedConflicts}>
						<Copy className="h-3 w-3 mr-1" />
						Keep Both
					</Button>
					<Button variant="outline" size="sm" onClick={resetResolution} disabled={!manualOverride && !hasUnresolvedConflicts}>
						Reset
					</Button>
					<span className="h-4 w-px bg-border mx-1" />
					<span className="text-xs text-muted-foreground">Active conflict:</span>
					<Button variant="outline" size="sm" onClick={goToPreviousConflict} disabled={!hasUnresolvedConflicts || activeConflictIndex === 0}>
						<ChevronLeft className="h-3 w-3 mr-1" />
						Prev
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={goToNextConflict}
						disabled={!hasUnresolvedConflicts || activeConflictIndex >= unresolvedConflicts.length - 1}
					>
						Next
						<ChevronRight className="h-3 w-3 ml-1" />
					</Button>
					<Button variant="outline" size="sm" onClick={goToFirstConflict} disabled={!hasUnresolvedConflicts}>
						First
					</Button>
					<span className="text-xs text-muted-foreground">
						{hasUnresolvedConflicts
							? `${activeConflictIndex + 1} / ${unresolvedConflicts.length}`
							: '0 / 0'}
						{activeConflict?.startLine !== undefined ? ` (lines ${activeConflict.startLine + 1}-${activeConflict.endLine + 1})` : ''}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={acceptActiveOursAndNext}
						disabled={!hasUnresolvedConflicts}
					>
						<ArrowLeft className="h-3 w-3 mr-1" />
						Use Ours Here & Next
					</Button>
					{hasAnyBase && (
						<Button
							variant="outline"
							size="sm"
							onClick={acceptActiveBaseAndNext}
							disabled={!hasUnresolvedConflicts || !canUseActiveBase}
						>
							<BookOpen className="h-3 w-3 mr-1" />
							Use Base Here & Next
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={acceptActiveTheirsAndNext}
						disabled={!hasUnresolvedConflicts}
					>
						Use Theirs Here
						<ArrowRight className="h-3 w-3 ml-1" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={acceptActiveBothAndNext}
						disabled={!hasUnresolvedConflicts}
					>
						<Copy className="h-3 w-3 mr-1" />
						Keep Both Here & Next
					</Button>
					<Badge variant="secondary" className="h-7 px-2">
						{hasOriginalConflicts
							? `${resolvedConflictCount}/${totalConflictCount} resolved`
							: 'No conflict markers'}
					</Badge>
					<div className="flex-1" />
					<Button
						variant={viewMode === 'split' ? 'secondary' : 'ghost'}
						size="sm"
						onClick={() => setViewMode('split')}
					>
						Split
					</Button>
					<Button
						variant={viewMode === 'unified' ? 'secondary' : 'ghost'}
						size="sm"
						onClick={() => setViewMode('unified')}
					>
						Unified
					</Button>
				</div>

				{hasUnresolvedConflicts && (
					<div className="flex items-center gap-2 px-2 py-1.5 text-xs text-amber-600">
						<AlertTriangle className="h-3.5 w-3.5" />
						<span>
							{unresolvedConflicts.length} unresolved conflict marker block
							{unresolvedConflicts.length !== 1 ? 's' : ''} remain.
							Resolve them before marking this file as resolved.
						</span>
					</div>
				)}

				{activeConflict ? (
					<div className="border-b px-2 py-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>
								Active conflict marker block {activeConflictIndex + 1} / {unresolvedConflicts.length}
							</span>
							<span>
								Lines {activeConflict.startLine + 1}-{activeConflict.endLine + 1}
							</span>
						</div>
						<pre className="mt-1 max-h-28 overflow-auto p-2 text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded">
							{activeConflict.raw}
						</pre>
					</div>
				) : null}

				{hasUnresolvedConflicts ? (
					<div className="border-b px-2 py-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>Jump to conflict</span>
							<span>Shortcuts: Ctrl/⌘+↑/↓, Ctrl/⌘+O/T/B, Alt+N</span>
						</div>
						<div className="mt-1 flex flex-wrap gap-2">
							{unresolvedConflicts.map((chunk, index) => (
								<Button
									key={`${chunk.startLine}-${chunk.endLine}-${index}`}
									variant={index === activeConflictIndex ? 'secondary' : 'outline'}
									size="sm"
									onClick={() => setActiveConflictIndex(index)}
								>
									{index + 1}: {chunk.startLine + 1}-{chunk.endLine + 1}
								</Button>
							))}
						</div>
					</div>
				) : null}

				<ScrollArea className="flex-1">
					{viewMode === 'split' ? (
						<div className={`grid gap-2 p-2 ${hasBase ? 'grid-cols-3' : 'grid-cols-2'}`}>
							<div>
								<div className="flex items-center justify-between p-2 bg-green-500/10 rounded-t border-b border-green-500/20">
									<span className="text-xs font-medium text-green-600">Ours (Current)</span>
									<Button variant="ghost" size="sm" className="h-5 text-xs" onClick={acceptOurs}>
										Use This
									</Button>
								</div>
								<pre className="p-2 text-xs font-mono bg-muted/30 rounded-b min-h-[200px] overflow-auto">
									{conflict.ours}
								</pre>
							</div>
							{hasBase ? (
								<div>
									<div className="flex items-center justify-between p-2 bg-slate-500/10 rounded-t border-b border-slate-500/20">
										<span className="text-xs font-medium text-slate-600">Base</span>
										<Button variant="ghost" size="sm" className="h-5 text-xs" onClick={acceptBase}>
											Use This
										</Button>
									</div>
									<pre className="p-2 text-xs font-mono bg-muted/30 rounded-b min-h-[200px] overflow-auto">
										{conflict.base ?? 'No base content was available for this conflict.'}
									</pre>
								</div>
							) : null}
							<div>
								<div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-t border-b border-blue-500/20">
									<span className="text-xs font-medium text-blue-600">Theirs (Incoming)</span>
									<Button variant="ghost" size="sm" className="h-5 text-xs" onClick={acceptTheirs}>
										Use This
									</Button>
								</div>
								{conflict.theirs ? (
									<pre className="p-2 text-xs font-mono bg-muted/30 rounded-b min-h-[200px] overflow-auto">
										{conflict.theirs}
									</pre>
								) : (
									<div className="p-2 text-xs text-muted-foreground bg-muted/20 min-h-[200px] rounded-b">
										Theirs version is not available from index.
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="p-2">
							<textarea
								className="w-full h-64 p-2 text-xs font-mono bg-muted/30 rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary"
								value={resolved || conflict.ours}
								onChange={(e) => setResolved(e.target.value)}
								placeholder="Edit the merged content here..."
							/>
						</div>
					)}
				</ScrollArea>

				<DialogFooter className="ui-toolbar">
					<Button variant="outline" onClick={() => handleClose(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							onResolve(conflict.path, resolved || conflict.ours);
							onOpenChange(false);
						}}
						disabled={hasUnresolvedConflicts}
					>
						<Check className="h-4 w-4 mr-1" />
						Mark as Resolved
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Interactive Merge Editor
 * Allows selecting individual lines/hunks from ours vs theirs
 */

import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface DiffLine {
	oldLineNumber: number | null;
	newLineNumber: number | null;
	content: string;
	type: 'context' | 'add' | 'delete';
	selected: 'none' | 'ours' | 'theirs';
}

interface InteractiveMergeEditorProps {
	filePath: string;
	oursContent: string;
	theirsContent: string;
	baseContent: string;
	onResolve: (resolvedContent: string) => void;
	onCancel: () => void;
}

export function InteractiveMergeEditor({
	filePath,
	oursContent,
	theirsContent,
	baseContent,
	onResolve,
	onCancel,
}: InteractiveMergeEditorProps) {
	// Generate unified diff between ours and theirs
	const diffLines = useMemo(() => {
		const oursLines = oursContent.split('\n');
		const theirsLines = theirsContent.split('\n');

		// Simple LCS-based diff to find conflicting regions
		const lines: DiffLine[] = [];

		let oursIdx = 0;
		let theirsIdx = 0;

		// Compare line by line
		while (oursIdx < oursLines.length || theirsIdx < theirsLines.length) {
			const oursLine = oursLines[oursIdx] ?? '';
			const theirsLine = theirsLines[theirsIdx] ?? '';

			if (oursIdx >= oursLines.length) {
				// Only theirs has lines left - additions in theirs
				lines.push({
					oldLineNumber: null,
					newLineNumber: theirsIdx + 1,
					content: theirsLine,
					type: 'add',
					selected: 'theirs', // Default to accepting theirs
				});
				theirsIdx++;
			} else if (theirsIdx >= theirsLines.length) {
				// Only ours has lines left - deletions in ours
				lines.push({
					oldLineNumber: oursIdx + 1,
					newLineNumber: null,
					content: oursLine,
					type: 'delete',
					selected: 'ours', // Default to accepting ours
				});
				oursIdx++;
			} else if (oursLine === theirsLine) {
				// Context line - same in both
				lines.push({
					oldLineNumber: oursIdx + 1,
					newLineNumber: theirsIdx + 1,
					content: oursLine,
					type: 'context',
					selected: 'none',
				});
				oursIdx++;
				theirsIdx++;
			} else {
				// Conflict - lines differ
				// Show ours as deletion, theirs as addition
				lines.push({
					oldLineNumber: oursIdx + 1,
					newLineNumber: null,
					content: oursLine,
					type: 'delete',
					selected: 'none',
				});
				lines.push({
					oldLineNumber: null,
					newLineNumber: theirsIdx + 1,
					content: theirsLine,
					type: 'add',
					selected: 'none',
				});
				oursIdx++;
				theirsIdx++;
			}
		}

		return lines;
	}, [oursContent, theirsContent, baseContent]);

	// Track line selections
	const [selections, setSelections] = useState<Record<number, 'none' | 'ours' | 'theirs'>>(() => {
		const init: Record<number, 'none' | 'ours' | 'theirs'> = {};
		diffLines.forEach((line, idx) => {
			init[idx] = line.type === 'context' ? 'none' : line.type === 'delete' ? 'ours' : 'theirs';
		});
		return init;
	});

	// Group into hunks (conflict regions)
	const hunks = useMemo(() => {
		const groups: Array<{ start: number; lines: DiffLine[]; isConflict: boolean }> = [];
		let currentGroup: DiffLine[] = [];
		let currentStart = 0;
		let inConflict = false;

		diffLines.forEach((line, idx) => {
			const isConflictLine = line.type !== 'context';

			if (inConflict !== isConflictLine && currentGroup.length > 0) {
				groups.push({ start: currentStart, lines: currentGroup, isConflict: inConflict });
				currentGroup = [];
				currentStart = idx;
			}

			inConflict = isConflictLine;
			currentGroup.push(line);
		});

		if (currentGroup.length > 0) {
			groups.push({ start: currentStart, lines: currentGroup, isConflict: inConflict });
		}

		return groups;
	}, [diffLines]);

	// Toggle line selection
	const toggleLine = (idx: number, lineType: 'context' | 'add' | 'delete') => {
		if (lineType === 'context') return; // Can't toggle context

		setSelections((prev) => ({
			...prev,
			[idx]: prev[idx] === 'ours' ? 'theirs' : 'ours',
		}));
	};

	// Accept all from one side for a hunk
	const acceptHunk = (startIdx: number, lines: DiffLine[], side: 'ours' | 'theirs') => {
		setSelections((prev) => {
			const updated = { ...prev };
			lines.forEach((line, i) => {
				if (line.type !== 'context') {
					updated[startIdx + i] = side;
				}
			});
			return updated;
		});
	};

	// Generate resolved content
	const resolvedContent = useMemo(() => {
		const result: string[] = [];

		diffLines.forEach((line, idx) => {
			if (line.type === 'context') {
				// Always include context
				result.push(line.content);
			} else if (line.type === 'delete') {
				// Ours - include if selected
				if (selections[idx] === 'ours') {
					result.push(line.content);
				}
			} else if (line.type === 'add') { // eslint-disable-line @typescript-eslint/no-unnecessary-condition
				// Theirs - include if selected
				if (selections[idx] === 'theirs') {
					result.push(line.content);
				}
			}
		});

		return result.join('\n');
	}, [diffLines, selections]);

	// Stats
	const conflictCount = hunks.filter((h) => h.isConflict).length;
	const resolvedCount = hunks.filter((h) => {
		if (!h.isConflict) return true;
		return h.lines.every((line, i) => {
			const sel = selections[h.start + i];
			return line.type === 'context' || sel !== 'none';
		});
	}).length;

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-2 shrink-0">
				<CardTitle className="text-sm flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>Resolve Conflicts</span>
						<Badge variant="outline" className="font-mono text-xs">{filePath}</Badge>
						<Badge variant={conflictCount === resolvedCount ? 'default' : 'secondary'}>
							{resolvedCount}/{conflictCount} resolved
						</Badge>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={() => { onResolve(resolvedContent); }}
							disabled={resolvedCount < conflictCount}
						>
							Accept Resolution
						</Button>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden flex gap-4 p-4">
				{/* Left: Conflict view */}
				<div className="flex-1 flex flex-col min-w-0">
					<div className="text-xs font-medium mb-2 flex items-center justify-between">
						<span>Conflicts</span>
						<div className="flex gap-2 text-muted-foreground">
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 rounded bg-[color-mix(in_oklch,var(--info)_30%,transparent)] border border-[color-mix(in_oklch,var(--info)_35%,transparent)]" />
								Ours
							</span>
							<span className="flex items-center gap-1">
								<span className="w-3 h-3 rounded bg-[color-mix(in_oklch,var(--success)_30%,transparent)] border border-[color-mix(in_oklch,var(--success)_35%,transparent)]" />
								Theirs
							</span>
						</div>
					</div>
					<ScrollArea className="flex-1 border rounded">
						<div className="font-mono text-xs">
							{hunks.map((hunk, hunkIdx) => (
								<div key={hunkIdx} className="border-b last:border-b-0">
									{hunk.isConflict && (
										<div className="bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] px-2 py-1 flex items-center justify-between sticky top-0 z-10 border-b">
											<span className="text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] text-xs font-medium">
												Conflict #{hunkIdx + 1}
											</span>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													className="h-5 px-1.5 text-xs"
													onClick={() => { acceptHunk(hunk.start, hunk.lines, 'ours'); }}
												>
													Take Ours
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-5 px-1.5 text-xs"
													onClick={() => { acceptHunk(hunk.start, hunk.lines, 'theirs'); }}
												>
													Take Theirs
												</Button>
											</div>
										</div>
									)}
									{hunk.lines.map((line, lineIdx) => {
										const globalIdx = hunk.start + lineIdx;
										const selectedSide = selections[globalIdx];

										return (
											<button
												key={lineIdx}
												onClick={() => { if (line.type !== 'context') toggleLine(globalIdx, line.type); }}
												className={cn(
													'w-full flex text-left',
													line.type === 'context' && 'hover:bg-muted cursor-default',
													line.type === 'delete' && 'cursor-pointer',
													line.type === 'add' && 'cursor-pointer',
													line.type === 'delete' && selectedSide === 'ours' && 'bg-[color-mix(in_oklch,var(--info)_30%,transparent)]',
													line.type === 'delete' && selectedSide === 'theirs' && 'bg-[color-mix(in_oklch,var(--destructive)_20%,transparent)] line-through opacity-50',
													line.type === 'delete' && selectedSide === 'none' && 'bg-[color-mix(in_oklch,var(--warning)_20%,transparent)]',
													line.type === 'add' && selectedSide === 'theirs' && 'bg-[color-mix(in_oklch,var(--success)_30%,transparent)]',
													line.type === 'add' && selectedSide === 'ours' && 'bg-[color-mix(in_oklch,var(--destructive)_20%,transparent)] line-through opacity-50',
													line.type === 'add' && selectedSide === 'none' && 'bg-[color-mix(in_oklch,var(--warning)_20%,transparent)]',
												)}
												disabled={line.type === 'context'}
											>
												<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
													{line.oldLineNumber ?? ''}
												</span>
												<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
													{line.newLineNumber ?? ''}
												</span>
												<span
													className={cn(
														'w-6 shrink-0 text-center select-none',
														line.type === 'delete' && 'text-destructive',
														line.type === 'add' && 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
													)}
												>
													{line.type === 'delete' ? '-' : line.type === 'add' ? '+' : ' '}
												</span>
												<pre className="px-2 whitespace-pre overflow-x-auto flex-1">
													{line.content}
												</pre>
												{line.type !== 'context' && (
													<span className="pr-2 text-xs text-muted-foreground">
														{selectedSide === 'ours' ? '✓ Ours' : selectedSide === 'theirs' ? '✓ Theirs' : '✗'}
													</span>
												)}
											</button>
										);
									})}
								</div>
							))}
						</div>
					</ScrollArea>
				</div>

				<Separator orientation="vertical" />

				{/* Right: Preview */}
				<div className="w-96 flex flex-col shrink-0">
					<div className="text-xs font-medium mb-2">Resolved Preview</div>
					<ScrollArea className="flex-1 border rounded bg-muted/50">
						<pre className="p-2 text-xs font-mono whitespace-pre-wrap">
							{resolvedContent || <span className="text-muted-foreground italic">No content</span>}
						</pre>
					</ScrollArea>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Full interactive merge with file loading
 */
interface InteractiveMergeResolverProps {
	repo: string;
	filePath: string;
	onResolve: () => void;
	onCancel: () => void;
}

export function InteractiveMergeResolver({
	filePath,
	onResolve,
	onCancel,
}: InteractiveMergeResolverProps) {
	const [oursContent, setOursContent] = useState('');
	const [theirsContent, setTheirContent] = useState('');
	const [baseContent, setBaseContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Parse conflict markers from file
		function loadContent() {
			setLoading(true);
			try {
				// In a real app, we'd read the file and parse conflict markers
				// For now, simulate with example content
				setOursContent('function hello() {\n  console.log("ours");\n}');
				setTheirContent('function hello() {\n  console.log("theirs");\n}');
				setBaseContent('function hello() {\n  console.log("base");\n}');
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load');
			} finally {
				setLoading(false);
			}
		}

		loadContent();
	}, [filePath]);

	if (loading) {
		return (
			<Card className="h-full flex items-center justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</Card>
		);
	}

	if (error) {
		return (
			<Card className="h-full flex items-center justify-center text-destructive">
				<div className="text-center">
					<p className="mb-2">{error}</p>
					<Button variant="outline" onClick={onCancel}>
						Back
					</Button>
				</div>
			</Card>
		);
	}

	return (
		<InteractiveMergeEditor
			filePath={filePath}
			oursContent={oursContent}
			theirsContent={theirsContent}
			baseContent={baseContent}
			onResolve={(content) => {
				console.log('Resolved content:', content);
				onResolve();
			}}
			onCancel={onCancel}
		/>
	);
}

// eslint-disable-next-line import/order
import { useEffect } from 'react';

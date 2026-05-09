/**
 * Syntax Highlighting Diff Viewer
 * Display diffs with syntax highlighting and word-level diff
 */

import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Toggle } from '@/components/ui/toggle';
import {
	parseDiffWithInlineDiffs,
	DiffCharRenderer,
} from '@/lib/diff-utils';
import { cn } from '@/lib/utils';

interface SyntaxDiffViewerProps {
	diff: string;
	filename?: string;
	className?: string;
	showWordDiff?: boolean;
}

// Simple syntax highlighting for common languages
function highlightSyntax(content: string, filename?: string): string {
	const ext = filename?.split('.').pop()?.toLowerCase();
	
	// Keywords
	const keywords: Record<string, string[]> = {
		ts: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'extends', 'implements'],
		tsx: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'extends', 'implements'],
		js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'extends'],
		py: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'yield', 'lambda', 'pass', 'break', 'continue', 'True', 'False', 'None'],
		rs: ['fn', 'let', 'mut', 'const', 'if', 'else', 'for', 'while', 'loop', 'match', 'return', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'self', 'Self', 'true', 'false', 'async', 'await', 'move'],
		go: ['func', 'var', 'const', 'if', 'else', 'for', 'range', 'return', 'import', 'package', 'struct', 'interface', 'type', 'go', 'defer', 'chan', 'select', 'case', 'default', 'true', 'false', 'nil'],
	};

	const langKeywords = (keywords[ext ?? 'ts'] ?? keywords.ts) as string[];
	
	const result = content
		// Escape HTML
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		// Strings
		.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">$&</span>')
		// Numbers
		.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">$1</span>')
		// Comments
		.replace(/(\/\/.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
		.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
		// Keywords
		.replace(new RegExp(`\\b(${langKeywords.join('|')})\\b`, 'g'), '<span class="text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))] font-medium">$1</span>');

	return result;
}

export function SyntaxDiffViewer({ diff, filename, className, showWordDiff = true }: SyntaxDiffViewerProps) {
	const [wordDiff, setWordDiff] = useState(showWordDiff);
	const lines = useMemo(() => parseDiffWithInlineDiffs(diff), [diff]);

	// Stats
	const stats = useMemo(() => {
		const added = lines.filter(l => l.type === 'added').length;
		const removed = lines.filter(l => l.type === 'removed').length;
		const modified = lines.filter(l => l.type === 'modified').length;
		return { added, removed, modified };
	}, [lines]);

	return (
		<div className={cn("flex flex-col", className)}>
			{/* Toolbar */}
			<div className="flex items-center justify-end gap-2 px-2 py-1 border-b bg-muted/30">
				<Toggle
					pressed={wordDiff}
					onPressedChange={setWordDiff}
					size="sm"
					className="h-6 px-2 text-xs gap-1"
				>
					{wordDiff ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
					Word Diff
				</Toggle>
			</div>
			
			{/* Diff content */}
			<div className="flex-1 overflow-auto font-mono text-sm">
				<table className="w-full border-collapse">
					<colgroup>
						<col className="w-12" />
						<col className="w-12" />
						<col className="w-8" />
						<col />
					</colgroup>
					<tbody>
						{lines.map((line, index) => {
							return (
								<tr
									key={index}
									className={cn(
										line.type === 'added' && 'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_30%,transparent)]',
										line.type === 'removed' && 'bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--destructive)_30%,transparent)]',
										line.type === 'modified' && 'bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)]',
									)}
								>
									{/* Old line number */}
									<td className="px-2 py-0.5 text-right text-xs text-muted-foreground select-none border-r">
										{line.leftLineNum || ''}
									</td>
									{/* New line number */}
									<td className="px-2 py-0.5 text-right text-xs text-muted-foreground select-none border-r">
										{line.rightLineNum || ''}
									</td>
									{/* Diff indicator */}
									<td className="px-1 py-0.5 text-center text-xs select-none">
										{line.type === 'added' && <span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">+</span>}
										{line.type === 'removed' && <span className="text-destructive">-</span>}
										{line.type === 'modified' && <span className="text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]">~</span>}
									</td>
									{/* Content */}
									<td className="px-2 py-0.5 whitespace-pre">
										{line.type === 'context' ? (
											<span 
												dangerouslySetInnerHTML={{ 
													__html: highlightSyntax(
														line.left?.chars.map(c => c.char).join('') || '',
														filename
													) 
												}} 
											/>
										) : line.type === 'removed' ? (
											wordDiff && line.left?.chars ? (
												<span className="text-destructive dark:text-destructive">
													<DiffCharRenderer chars={line.left.chars} baseClass="removed" />
												</span>
											) : (
												<span 
													dangerouslySetInnerHTML={{ 
														__html: highlightSyntax(
															line.left?.chars.map(c => c.char).join('') || '',
															filename
														) 
													}} 
												/>
											)
										) : line.type === 'added' ? (
											wordDiff && line.right?.chars ? (
												<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">
													<DiffCharRenderer chars={line.right.chars} baseClass="added" />
												</span>
											) : (
												<span 
													dangerouslySetInnerHTML={{ 
														__html: highlightSyntax(
															line.right?.chars.map(c => c.char).join('') || '',
															filename
														) 
													}} 
												/>
											)
										) : (
											/* Modified line */
											<>
												{line.left && (
													<div className={wordDiff ? '' : 'hidden'}>
														<span className="text-destructive dark:text-destructive">
															{/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
															{wordDiff && line.left.chars ? (
																<DiffCharRenderer chars={line.left.chars} baseClass="removed" />
															) : (
																line.left.chars.map(c => c.char).join('')
															)}
														</span>
													</div>
												)}
												{line.right && (
													<div className={wordDiff ? '' : ''}>
														<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">
															{/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
															{wordDiff && line.right.chars ? (
																<DiffCharRenderer chars={line.right.chars} baseClass="added" />
															) : (
																line.right.chars.map(c => c.char).join('')
															)}
														</span>
													</div>
												)}
											</>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			
			{/* Status bar */}
			<div className="flex items-center justify-between px-2 py-1 border-t bg-muted/30 text-xs text-muted-foreground">
				<span>{lines.length} lines</span>
				<div className="flex items-center gap-3">
					<span className="text-destructive">-{stats.removed}</span>
					<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]">+{stats.added + stats.modified}</span>
				</div>
			</div>
		</div>
	);
}

export default SyntaxDiffViewer;

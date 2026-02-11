/**
 * Syntax Highlighting Diff Viewer
 * Display diffs with syntax highlighting
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DiffLine {
	type: 'add' | 'delete' | 'context' | 'header';
	content: string;
	oldLineNumber?: number;
	newLineNumber?: number;
}

interface SyntaxDiffViewerProps {
	diff: string;
	filename?: string;
	className?: string;
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

	const langKeywords = keywords[ext || ''] || keywords['ts'];
	
	let result = content
		// Escape HTML
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		// Strings
		.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="text-green-600">$&</span>')
		// Numbers
		.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-600">$1</span>')
		// Comments
		.replace(/(\/\/.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
		.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
		// Keywords
		.replace(new RegExp(`\\b(${langKeywords.join('|')})\\b`, 'g'), '<span class="text-purple-600 font-medium">$1</span>');

	return result;
}

function parseDiff(diff: string): DiffLine[] {
	const lines = diff.split('\n');
	const result: DiffLine[] = [];
	let oldLineNumber = 0;
	let newLineNumber = 0;

	for (const line of lines) {
		if (line.startsWith('@@')) {
			// Parse hunk header
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			if (match) {
				oldLineNumber = parseInt(match[1], 10);
				newLineNumber = parseInt(match[2], 10);
			}
			result.push({ type: 'header', content: line });
		} else if (line.startsWith('+++') || line.startsWith('---')) {
			result.push({ type: 'header', content: line });
		} else if (line.startsWith('+')) {
			result.push({
				type: 'add',
				content: line.slice(1),
				newLineNumber: newLineNumber++,
			});
		} else if (line.startsWith('-')) {
			result.push({
				type: 'delete',
				content: line.slice(1),
				oldLineNumber: oldLineNumber++,
			});
		} else if (line.startsWith(' ')) {
			result.push({
				type: 'context',
				content: line.slice(1),
				oldLineNumber: oldLineNumber++,
				newLineNumber: newLineNumber++,
			});
		} else if (line.trim()) {
			result.push({ type: 'context', content: line });
		}
	}

	return result;
}

export function SyntaxDiffViewer({ diff, filename, className }: SyntaxDiffViewerProps) {
	const lines = useMemo(() => parseDiff(diff), [diff]);

	return (
		<div className={cn("font-mono text-sm overflow-x-auto", className)}>
			<table className="w-full border-collapse">
				<colgroup>
					<col className="w-12" />
					<col className="w-12" />
					<col className="w-8" />
					<col />
				</colgroup>
				<tbody>
					{lines.map((line, index) => (
						<tr
							key={index}
							className={cn(
								line.type === 'add' && 'bg-green-50 dark:bg-green-950/30',
								line.type === 'delete' && 'bg-red-50 dark:bg-red-950/30',
								line.type === 'header' && 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
							)}
						>
							{/* Old line number */}
							<td className="px-2 py-0.5 text-right text-xs text-gray-400 select-none border-r border-gray-200 dark:border-gray-700">
								{line.oldLineNumber ?? ''}
							</td>
							{/* New line number */}
							<td className="px-2 py-0.5 text-right text-xs text-gray-400 select-none border-r border-gray-200 dark:border-gray-700">
								{line.newLineNumber ?? ''}
							</td>
							{/* Diff indicator */}
							<td className="px-1 py-0.5 text-center text-xs select-none">
								{line.type === 'add' && <span className="text-green-600">+</span>}
								{line.type === 'delete' && <span className="text-red-600">-</span>}
							</td>
							{/* Content */}
							<td className="px-2 py-0.5 whitespace-pre">
								{line.type === 'header' ? (
									<span>{line.content}</span>
								) : (
									<span 
										dangerouslySetInnerHTML={{ 
											__html: highlightSyntax(line.content, filename) 
										}} 
									/>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default SyntaxDiffViewer;

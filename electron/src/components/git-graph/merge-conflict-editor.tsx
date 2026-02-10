/**
 * Merge Conflict Editor
 * Visual 3-way diff for resolving conflicts
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
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
	ArrowDown,
	Check,
	X,
	Edit2,
	Copy,
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

export function MergeConflictEditor({
	open,
	onOpenChange,
	conflict,
	onResolve,
}: MergeConflictEditorProps) {
	const [resolved, setResolved] = useState<string>('');
	const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');

	if (!conflict) return null;

	// Parse conflict markers
	const parseConflicts = (content: string): Array<{
		ours: string;
		theirs: string;
		base?: string;
		startLine: number;
	}> => {
		const conflicts: Array<{ ours: string; theirs: string; base?: string; startLine: number }> = [];
		const lines = content.split('\n');
		let current: typeof conflicts[0] | null = null;
		let inOurs = false;
		let inTheirs = false;
		let inBase = false;

		lines.forEach((line, index) => {
			if (line.startsWith('<<<<<<<')) {
				current = { ours: '', theirs: '', startLine: index };
				inOurs = true;
			} else if (line.startsWith('|||||||')) {
				inOurs = false;
				inBase = true;
			} else if (line.startsWith('=======')) {
				inOurs = false;
				inBase = false;
				inTheirs = true;
			} else if (line.startsWith('>>>>>>>')) {
				inTheirs = false;
				if (current) conflicts.push(current);
				current = null;
			} else if (current) {
				if (inOurs) current.ours += line + '\n';
				else if (inBase) current.base = (current.base ?? '') + line + '\n';
				else if (inTheirs) current.theirs += line + '\n';
			}
		});

		return conflicts;
	};

	const conflicts = parseConflicts(conflict.ours);
	const hasConflicts = conflicts.length > 0;

	// Accept ours/theirs for all conflicts
	const acceptOurs = () => {
		setResolved(conflict.ours.replace(/<<<<<<<[\s\S]*?=======\n([\s\S]*?)>>>>>>> [^\n]+/g, ''));
	};

	const acceptTheirs = () => {
		setResolved(conflict.theirs);
	};

	// Accept both (concatenate)
	const acceptBoth = () => {
		let result = conflict.ours;
		conflicts.forEach((c) => {
			result = result.replace(
				`<<<<<<<\n${c.ours}=======\n${c.theirs}>>>>>>>`,
				c.ours + c.theirs
			);
		});
		setResolved(result);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="text-amber-500">⚠️</span>
						Resolve Conflicts: {conflict.path}
					</DialogTitle>
				</DialogHeader>

				{/* Quick actions */}
				<div className="flex items-center gap-2 py-2 border-b">
					<span className="text-xs text-muted-foreground">Quick resolve:</span>
					<Button variant="outline" size="sm" onClick={acceptOurs}>
						<ArrowLeft className="h-3 w-3 mr-1" />
						Use Ours
					</Button>
					<Button variant="outline" size="sm" onClick={acceptTheirs}>
						Use Theirs
						<ArrowRight className="h-3 w-3 ml-1" />
					</Button>
					<Button variant="outline" size="sm" onClick={acceptBoth}>
						<Copy className="h-3 w-3 mr-1" />
						Keep Both
					</Button>
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

				{/* Editor */}
				<ScrollArea className="flex-1">
					{viewMode === 'split' ? (
						<div className="grid grid-cols-2 gap-2 p-2">
							<div>
								<div className="flex items-center justify-between p-2 bg-green-500/10 rounded-t border-b border-green-500/20">
									<span className="text-xs font-medium text-green-600">Ours (Current)</span>
									<Button variant="ghost" size="sm" className="h-5 text-xs">
										Use This
									</Button>
								</div>
								<pre className="p-2 text-xs font-mono bg-muted/30 rounded-b min-h-[200px]">
									{conflict.ours}
								</pre>
							</div>
							<div>
								<div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-t border-b border-blue-500/20">
									<span className="text-xs font-medium text-blue-600">Theirs (Incoming)</span>
									<Button variant="ghost" size="sm" className="h-5 text-xs">
										Use This
									</Button>
								</div>
								<pre className="p-2 text-xs font-mono bg-muted/30 rounded-b min-h-[200px]">
									{conflict.theirs}
								</pre>
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

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							onResolve(conflict.path, resolved || conflict.ours);
							onOpenChange(false);
						}}
					>
						<Check className="h-4 w-4 mr-1" />
						Mark as Resolved
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

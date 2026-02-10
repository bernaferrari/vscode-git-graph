/**
 * Side-by-Side Diff Viewer
 * Syntax highlighted diff with line-by-line comparison
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	AlignLeft,
	Columns,
	Copy,
	Check,
	X,
	Plus,
	Minus,
	RotateCcw,
} from 'lucide-react';

interface SideBySideDiffProps {
	file: {
		path: string;
		from?: string;
		status: string;
	};
	commitHash?: string;
	onAcceptOurs?: () => void;
	onAcceptTheirs?: () => void;
}

export function SideBySideDiff({ file, commitHash, onAcceptOurs, onAcceptTheirs }: SideBySideDiffProps) {
	const { activeRepo } = useAppStore();
	const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
	const [copied, setCopied] = useState(false);

	const { data: diffData } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: commitHash ?? 'HEAD',
			filePath: file.path,
		},
		{ enabled: !!activeRepo && !!file.path }
	);

	const diffLines = useMemo(() => {
		if (!diffData?.diff) return [];
		return diffData.diff.split('\n');
	}, [diffData?.diff]);

	const parseDiff = (lines: string[]) => {
		const left: Array<{ line: string; type: 'context' | 'removed' | 'header' }> = [];
		const right: Array<{ line: string; type: 'context' | 'added' | 'header' }> = [];
		let leftNum = 0;
		let rightNum = 0;

		lines.forEach((line) => {
			if (line.startsWith('@@')) {
				// Hunk header
				const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
				if (match) {
					leftNum = parseInt(match[1], 10);
					rightNum = parseInt(match[2], 10);
				}
				left.push({ line, type: 'header' });
				right.push({ line, type: 'header' });
			} else if (line.startsWith('-') && !line.startsWith('---')) {
				left.push({ line: line.slice(1), type: 'removed' });
				leftNum++;
			} else if (line.startsWith('+') && !line.startsWith('+++')) {
				right.push({ line: line.slice(1), type: 'added' });
				rightNum++;
			} else if (line.startsWith(' ') || line === '') {
				const content = line.startsWith(' ') ? line.slice(1) : line;
				left.push({ line: content, type: 'context' });
				right.push({ line: content, type: 'context' });
				leftNum++;
				rightNum++;
			}
		});

		return { left, right };
	};

	const { left, right } = useMemo(() => parseDiff(diffLines), [diffLines]);

	const handleCopy = () => {
		navigator.clipboard.writeText(diffData?.diff ?? '');
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const getLineClass = (type: string) => {
		switch (type) {
			case 'removed':
				return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
			case 'added':
				return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
			case 'header':
				return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-mono';
			default:
				return '';
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium truncate max-w-[200px]">
						{file.path}
					</span>
					<span className="text-xs px-1.5 py-0.5 rounded bg-muted">
						{file.status}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
						<TabsList className="h-7">
							<TabsTrigger value="side-by-side" className="text-xs h-5 px-2">
								<Columns className="h-3 w-3 mr-1" />
								Split
							</TabsTrigger>
							<TabsTrigger value="unified" className="text-xs h-5 px-2">
								<AlignLeft className="h-3 w-3 mr-1" />
								Unified
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
						{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
					</Button>
					{file.status === 'U' && (
						<>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptOurs}>
								<Minus className="h-3 w-3 mr-1" />
								Ours
							</Button>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptTheirs}>
								<Plus className="h-3 w-3 mr-1" />
								Theirs
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-hidden">
				{viewMode === 'side-by-side' ? (
					<div className="flex h-full">
						<div className="flex-1 border-r overflow-auto">
							<div className="font-mono text-xs">
								{left.map((item, i) => (
									<div key={i} className={`flex ${getLineClass(item.type)}`}>
										<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30">
											{i + 1}
										</div>
										<pre className="px-2 py-0.5 whitespace-pre overflow-hidden flex-1">
											{item.line}
										</pre>
									</div>
								))}
							</div>
						</div>
						<div className="flex-1 overflow-auto">
							<div className="font-mono text-xs">
								{right.map((item, i) => (
									<div key={i} className={`flex ${getLineClass(item.type)}`}>
										<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30">
											{i + 1}
										</div>
										<pre className="px-2 py-0.5 whitespace-pre overflow-hidden flex-1">
											{item.line}
										</pre>
									</div>
								))}
							</div>
						</div>
					</div>
				) : (
					<ScrollArea className="h-full">
						<div className="font-mono text-xs">
							{diffLines.map((line, i) => {
								let type = 'context';
								if (line.startsWith('+')) type = 'added';
								else if (line.startsWith('-')) type = 'removed';
								else if (line.startsWith('@@')) type = 'header';
								return (
									<div key={i} className={`flex ${getLineClass(type)}`}>
										<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30">
											{i + 1}
										</div>
										<pre className="px-2 py-0.5 whitespace-pre overflow-hidden flex-1">
											{line}
										</pre>
									</div>
								);
							})}
						</div>
					</ScrollArea>
				)}
			</div>
		</div>
	);
}

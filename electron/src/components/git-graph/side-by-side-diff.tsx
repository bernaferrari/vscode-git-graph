/**
 * Side-by-Side Diff View
 */

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';

interface DiffLine {
	oldLineNumber: number | null;
	newLineNumber: number | null;
	content: string;
	type: 'context' | 'add' | 'delete' | 'header';
}

interface DiffHunk {
	header: string;
	lines: DiffLine[];
}

interface DiffViewProps {
	oldContent: string;
	newContent: string;
	oldPath?: string;
	newPath?: string;
	oldRevision?: string;
	newRevision?: string;
}

export function SideBySideDiff({
	oldContent,
	newContent,
	oldPath,
	newPath,
	oldRevision,
	newRevision,
}: DiffViewProps) {
	const [viewMode, setViewMode] = useState<'side' | 'unified'>('side');

	const diffResult = useMemo(() => {
		const oldLines = oldContent.split('\n');
		const newLines = newContent.split('\n');

		// Simple diff algorithm using LCS
		const hunks: DiffHunk[] = [];
		let currentHunk: DiffHunk = { header: '', lines: [] };

		// Simple line-by-line diff
		const maxLines = Math.max(oldLines.length, newLines.length);
		let oldLineNum = 1;
		let newLineNum = 1;

		for (let i = 0; i < maxLines; i++) {
			const oldLine = oldLines[i];
			const newLine = newLines[i];

			if (oldLine === newLine) {
				// Context line
				currentHunk.lines.push({
					oldLineNumber: oldLineNum++,
					newLineNumber: newLineNum++,
					content: oldLine ?? '',
					type: 'context',
				});
			} else if (oldLine !== undefined && newLine !== undefined) {
				// Modified line
				currentHunk.lines.push({
					oldLineNumber: oldLineNum++,
					newLineNumber: null,
					content: oldLine,
					type: 'delete',
				});
				currentHunk.lines.push({
					oldLineNumber: null,
					newLineNumber: newLineNum++,
					content: newLine,
					type: 'add',
				});
			} else if (oldLine !== undefined) {
				// Deleted line
				currentHunk.lines.push({
					oldLineNumber: oldLineNum++,
					newLineNumber: null,
					content: oldLine,
					type: 'delete',
				});
			} else if (newLine !== undefined) {
				// Added line
				currentHunk.lines.push({
					oldLineNumber: null,
					newLineNumber: newLineNum++,
					content: newLine,
					type: 'add',
				});
			}
		}

		hunks.push(currentHunk);
		return hunks;
	}, [oldContent, newContent]);

	const stats = useMemo(() => {
		let additions = 0;
		let deletions = 0;
		diffResult.forEach(hunk => {
			hunk.lines.forEach(line => {
				if (line.type === 'add') additions++;
				if (line.type === 'delete') deletions++;
			});
		});
		return { additions, deletions };
	}, [diffResult]);

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-2 shrink-0">
				<CardTitle className="text-sm flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>Diff</span>
						<Badge variant="outline" className="font-mono text-xs">
							{newPath || oldPath || 'file'}
						</Badge>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-green-600 text-xs">+{stats.additions}</span>
						<span className="text-red-600 text-xs">-{stats.deletions}</span>
						<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'side' | 'unified')}>
							<TabsList className="h-7">
								<TabsTrigger value="side" className="text-xs px-2">Side by Side</TabsTrigger>
								<TabsTrigger value="unified" className="text-xs px-2">Unified</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden p-0">
				{viewMode === 'side' ? (
					<div className="grid grid-cols-2 h-full">
						{/* Old content */}
						<div className="border-r flex flex-col">
							<div className="bg-muted px-2 py-1 text-xs font-mono border-b flex items-center gap-2">
								<span className="text-red-600">{oldRevision || 'OLD'}</span>
								<span className="text-muted-foreground truncate">{oldPath}</span>
							</div>
							<ScrollArea className="flex-1">
								<div className="font-mono text-xs">
									{diffResult.map((hunk, hunkIdx) => (
										<div key={hunkIdx}>
											{hunk.lines.map((line, lineIdx) => (
												<div
													key={lineIdx}
													className={`flex ${
														line.type === 'delete'
															? 'bg-red-500/20'
															: line.type === 'context'
															? 'hover:bg-muted'
															: ''
													}`}
												>
													<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
														{line.oldLineNumber ?? ''}
													</span>
													<span className="w-4 shrink-0 text-center select-none">
														{line.type === 'delete' ? '-' : ' '}
													</span>
													<pre className="px-2 whitespace-pre overflow-x-auto flex-1">
														{line.type === 'context' || line.type === 'delete' ? line.content : ''}
													</pre>
												</div>
											))}
										</div>
									))}
								</div>
							</ScrollArea>
						</div>

						{/* New content */}
						<div className="flex flex-col">
							<div className="bg-muted px-2 py-1 text-xs font-mono border-b flex items-center gap-2">
								<span className="text-green-600">{newRevision || 'NEW'}</span>
								<span className="text-muted-foreground truncate">{newPath}</span>
							</div>
							<ScrollArea className="flex-1">
								<div className="font-mono text-xs">
									{diffResult.map((hunk, hunkIdx) => (
										<div key={hunkIdx}>
											{hunk.lines.map((line, lineIdx) => (
												<div
													key={lineIdx}
													className={`flex ${
														line.type === 'add'
															? 'bg-green-500/20'
															: line.type === 'context'
															? 'hover:bg-muted'
															: ''
													}`}
												>
													<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
														{line.newLineNumber ?? ''}
													</span>
													<span className="w-4 shrink-0 text-center select-none">
														{line.type === 'add' ? '+' : ' '}
													</span>
													<pre className="px-2 whitespace-pre overflow-x-auto flex-1">
														{line.type === 'context' || line.type === 'add' ? line.content : ''}
													</pre>
												</div>
											))}
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					</div>
				) : (
					<ScrollArea className="h-full">
						<div className="font-mono text-xs">
							{diffResult.map((hunk, hunkIdx) => (
								<div key={hunkIdx}>
									{hunk.lines.map((line, lineIdx) => (
										<div
											key={lineIdx}
											className={`flex ${
												line.type === 'add'
													? 'bg-green-500/20'
													: line.type === 'delete'
													? 'bg-red-500/20'
													: 'hover:bg-muted'
											}`}
										>
											<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
												{line.oldLineNumber ?? ''}
											</span>
											<span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none border-r">
												{line.newLineNumber ?? ''}
											</span>
											<span className="w-4 shrink-0 text-center select-none">
												{line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
											</span>
											<pre className="px-2 whitespace-pre overflow-x-auto flex-1">
												{line.content}
											</pre>
										</div>
									))}
								</div>
							))}
						</div>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Full Diff View with file content loading
 */
interface FullDiffViewProps {
	repo: string;
	oldHash: string;
	newHash: string;
	filePath: string;
	oldPath?: string;
	status: string;
}

export function FullDiffView({
	repo,
	oldHash,
	newHash,
	filePath,
	oldPath,
	status,
}: FullDiffViewProps) {
	const [oldContent, setOldContent] = useState('');
	const [newContent, setNewContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load file contents via tRPC
	const utils = trpc.useUtils();

	useEffect(() => {
		async function loadContents() {
			setLoading(true);
			setError(null);

			try {
				if (status === 'A') {
					// New file - no old content
					setOldContent('');
					const newFile = await utils.client.git.fileAtRevision.query({
						repo,
						commitHash: newHash,
						filePath,
					});
					setNewContent(newFile.content ?? '');
				} else if (status === 'D') {
					// Deleted file - no new content
					const oldFile = await utils.client.git.fileAtRevision.query({
						repo,
						commitHash: oldHash,
						filePath: oldPath ?? filePath,
					});
					setOldContent(oldFile.content ?? '');
					setNewContent('');
				} else {
					// Modified or renamed
					const [oldFile, newFile] = await Promise.all([
						utils.client.git.fileAtRevision.query({
							repo,
							commitHash: oldHash,
							filePath: oldPath ?? filePath,
						}),
						utils.client.git.fileAtRevision.query({
							repo,
							commitHash: newHash,
							filePath,
						}),
					]);
					setOldContent(oldFile.content ?? '');
					setNewContent(newFile.content ?? '');
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load diff');
			} finally {
				setLoading(false);
			}
		}

		loadContents();
	}, [repo, oldHash, newHash, filePath, oldPath, status, utils.client.git]);

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
				{error}
			</Card>
		);
	}

	return (
		<SideBySideDiff
			oldContent={oldContent}
			newContent={newContent}
			newPath={filePath}
			oldRevision={oldHash.slice(0, 7)}
			newRevision={newHash.slice(0, 7)}
			{...(oldPath ? { oldPath } : {})}
		/>
	);
}

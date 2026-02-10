/**
 * 3-Way Merge Editor
 * Shows base (common ancestor), ours (current), and theirs (incoming)
 */

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface MergeEditorProps {
	repo: string;
	filePath: string;
	baseContent: string;
	oursContent: string;
	theirsContent: string;
	onResolve: (resolvedContent: string) => void;
	onCancel: () => void;
}

export function MergeEditor({
	filePath,
	baseContent,
	oursContent,
	theirsContent,
	onResolve,
	onCancel,
}: MergeEditorProps) {
	const [resolvedContent, setResolvedContent] = useState(baseContent);

	const baseLines = useMemo(() => baseContent.split('\n'), [baseContent]);
	const oursLines = useMemo(() => oursContent.split('\n'), [oursContent]);
	const theirsLines = useMemo(() => theirsContent.split('\n'), [theirsContent]);

	const handleAcceptOurs = () => {
		setResolvedContent(oursContent);
	};

	const handleAcceptTheirs = () => {
		setResolvedContent(theirsContent);
	};

	const handleAcceptBoth = (order: 'ours-first' | 'theirs-first') => {
		if (order === 'ours-first') {
			setResolvedContent(oursContent + '\n' + theirsContent);
		} else {
			setResolvedContent(theirsContent + '\n' + oursContent);
		}
	};

	const handleManualEdit = (content: string) => {
		setResolvedContent(content);
	};

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-2 shrink-0">
				<CardTitle className="text-sm flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span>Merge Conflict</span>
						<Badge variant="destructive">{filePath}</Badge>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={onCancel}>
							Cancel
						</Button>
						<Button size="sm" onClick={() => onResolve(resolvedContent)}>
							Accept Resolution
						</Button>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden flex flex-col gap-4 p-4">
				{/* Quick actions */}
				<div className="flex items-center gap-2 shrink-0">
					<span className="text-xs text-muted-foreground">Quick resolve:</span>
					<Button variant="outline" size="sm" onClick={handleAcceptOurs}>
						Take Ours
					</Button>
					<Button variant="outline" size="sm" onClick={handleAcceptTheirs}>
						Take Theirs
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleAcceptBoth('ours-first')}>
						Ours Then Theirs
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleAcceptBoth('theirs-first')}>
						Theirs Then Ours
					</Button>
				</div>

				<Separator />

				{/* 3-way view */}
				<div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
					{/* Ours panel */}
					<div className="flex flex-col border rounded overflow-hidden">
						<div className="bg-blue-500/20 px-2 py-1 text-xs font-medium border-b flex items-center justify-between">
							<span className="text-blue-700">OURS (Current Branch)</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-5 px-1 text-xs"
								onClick={handleAcceptOurs}
							>
								Use
							</Button>
						</div>
						<ScrollArea className="flex-1">
							<div className="font-mono text-xs p-2">
								{oursLines.map((line, i) => (
									<div key={i} className="flex hover:bg-blue-500/10">
										<span className="w-8 shrink-0 text-right pr-2 text-muted-foreground select-none">
											{i + 1}
										</span>
										<pre className="whitespace-pre">{line}</pre>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>

					{/* Base panel */}
					<div className="flex flex-col border rounded overflow-hidden">
						<div className="bg-gray-500/20 px-2 py-1 text-xs font-medium border-b">
							<span className="text-gray-700">BASE (Common Ancestor)</span>
						</div>
						<ScrollArea className="flex-1">
							<div className="font-mono text-xs p-2">
								{baseLines.map((line, i) => (
									<div key={i} className="flex hover:bg-gray-500/10">
										<span className="w-8 shrink-0 text-right pr-2 text-muted-foreground select-none">
											{i + 1}
										</span>
										<pre className="whitespace-pre">{line}</pre>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>

					{/* Theirs panel */}
					<div className="flex flex-col border rounded overflow-hidden">
						<div className="bg-green-500/20 px-2 py-1 text-xs font-medium border-b flex items-center justify-between">
							<span className="text-green-700">THEIRS (Incoming)</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-5 px-1 text-xs"
								onClick={handleAcceptTheirs}
							>
								Use
							</Button>
						</div>
						<ScrollArea className="flex-1">
							<div className="font-mono text-xs p-2">
								{theirsLines.map((line, i) => (
									<div key={i} className="flex hover:bg-green-500/10">
										<span className="w-8 shrink-0 text-right pr-2 text-muted-foreground select-none">
											{i + 1}
										</span>
										<pre className="whitespace-pre">{line}</pre>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
				</div>

				<Separator />

				{/* Result editor */}
				<div className="flex-1 flex flex-col min-h-[150px]">
					<div className="flex items-center justify-between mb-2">
						<Label className="text-xs font-medium">Resolved Content</Label>
						<span className="text-xs text-muted-foreground">
							Edit manually or use quick actions above
						</span>
					</div>
					<Textarea
						value={resolvedContent}
						onChange={(e) => handleManualEdit(e.target.value)}
						className="flex-1 font-mono text-xs min-h-[100px]"
						placeholder="Resolved content will appear here..."
					/>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Full merge conflict resolver with content loading
 */
interface MergeConflictResolverProps {
	repo: string;
	filePath: string;
	onResolve: () => void;
	onCancel: () => void;
}

export function MergeConflictResolver({
	repo,
	filePath,
	onResolve,
	onCancel,
}: MergeConflictResolverProps) {
	const [baseContent, setBaseContent] = useState('');
	const [oursContent, setOursContent] = useState('');
	const [theirsContent, setTheirsContent] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load the three versions
	useEffect(() => {
		async function loadContents() {
			setLoading(true);
			setError(null);

			try {
				// Read the file with conflict markers
				const response = await fetch(`file://${filePath}`);
				const content = await response.text();

				// Parse conflict markers
				const parts = parseConflictMarkers(content);
				setBaseContent(parts.base);
				setOursContent(parts.ours);
				setTheirsContent(parts.theirs);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load file');
			} finally {
				setLoading(false);
			}
		}

		loadContents();
	}, [filePath]);

	const handleResolve = () => {
		// This would call tRPC to write the resolved content
		// For now, just call onResolve
		onResolve();
	};

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
					<p className="mb-2">Error loading conflict</p>
					<Button variant="outline" onClick={onCancel}>
						Back
					</Button>
				</div>
			</Card>
		);
	}

	return (
		<MergeEditor
			repo={repo}
			filePath={filePath}
			baseContent={baseContent}
			oursContent={oursContent}
			theirsContent={theirsContent}
			onResolve={handleResolve}
			onCancel={onCancel}
		/>
	);
}

/**
 * Parse git conflict markers into sections
 */
function parseConflictMarkers(content: string): {
	base: string;
	ours: string;
	theirs: string;
} {
	const lines = content.split('\n');
	let ours: string[] = [];
	let theirs: string[] = [];
	let base: string[] = [];
	let current: 'ours' | 'theirs' | 'base' | null = null;
	let hasBase = false;

	for (const line of lines) {
		if (line.startsWith('<<<<<<<')) {
			current = 'ours';
		} else if (line.startsWith('|||||||')) {
			// Base version (with diff3 style)
			current = 'base';
			hasBase = true;
		} else if (line.startsWith('=======')) {
			current = 'theirs';
		} else if (line.startsWith('>>>>>>>')) {
			current = null;
		} else if (current === 'ours') {
			ours.push(line);
		} else if (current === 'theirs') {
			theirs.push(line);
		} else if (current === 'base') {
			base.push(line);
		}
	}

	// If no base was found, use empty string
	if (!hasBase) {
		base = [];
	}

	return {
		ours: ours.join('\n'),
		theirs: theirs.join('\n'),
		base: base.join('\n'),
	};
}

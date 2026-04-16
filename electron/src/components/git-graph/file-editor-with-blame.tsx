/**
 * File Editor with Blame
 * Edit files with inline git blame annotations
 */

import {
	Edit3,
	Save,
	Loader2,
	GitCommit,
	Calendar,
	Undo,
	History,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { Avatar } from './avatar';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface BlameLine {
	lineNumber: number;
	content: string;
	hash: string;
	author: string;
	authorEmail: string;
	date: string;
	summary: string;
}

interface FileEditorWithBlameProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filePath: string;
	commitHash?: string;
}

export function FileEditorWithBlame({
	open,
	onOpenChange,
	filePath,
	commitHash,
}: FileEditorWithBlameProps) {
	const { activeRepo } = useAppStore();
	const [content, setContent] = useState('');
	const [originalContent, setOriginalContent] = useState('');
	const [blameData, setBlameData] = useState<BlameLine[]>([]);
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [showBlame, setShowBlame] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const utils = trpc.useUtils();

	// Load file content and blame data
	useEffect(() => {
		if (!open || !filePath || !activeRepo) return;

		const loadData = async () => {
			setIsLoading(true);
			try {
				// Fetch file content
				const fileResult = await utils.client.git.readFile.query({
					repo: activeRepo,
					path: filePath,
				});
				setContent(fileResult.content || '');
				setOriginalContent(fileResult.content || '');

				// Fetch blame data
				const blameResult = await utils.client.git.blame.query({
					repo: activeRepo,
					path: filePath,
					commitHash: commitHash, // undefined is fine here if unexpected by trpc, but trpc usually handles it
				});

				// Parse blame data into line-by-line format
				const lines = (fileResult.content || '').split('\n');

				// Parse raw blame output if available
				const blameLines: Partial<BlameLine>[] = [];
				if (blameResult.blame) {
					const rawBlame = blameResult.blame;

					const rawLines = rawBlame.split('\n');
					let currentHash = '';
					let currentAuthor = '';
					let currentEmail = '';
					let currentDate = '';
					let currentSummary = '';

					for (const line of rawLines) {
						if (!line) continue;

						if (line.startsWith('\t')) {
							// Content line, ends the block for this line
							blameLines.push({
								hash: currentHash,
								author: currentAuthor,
								authorEmail: currentEmail,
								date: currentDate,
								summary: currentSummary,
							});
							currentHash = ''; // Reset
						} else if (/^[0-9a-f]{40}/.test(line)) {
							// New block start
							currentHash = line.split(' ')[0] ?? '';
						} else if (line.startsWith('author ')) {
							currentAuthor = line.substring(7);
						} else if (line.startsWith('author-mail ')) {
							currentEmail = line.substring(12).replace(/[<,>]/g, '');
						} else if (line.startsWith('author-time ')) {
							const ts = parseInt(line.substring(12), 10);
							if (!isNaN(ts)) {
								currentDate = new Date(ts * 1000).toISOString();
							}
						} else if (line.startsWith('summary ')) {
							currentSummary = line.substring(8);
						}
					}
				}

				const parsedBlame: BlameLine[] = lines.map((line: string, index: number) => {
					const blameInfo = blameLines[index] || {};
					return {
						lineNumber: index + 1,
						content: line,
						hash: blameInfo.hash || '',
						author: blameInfo.author || 'Unknown',
						authorEmail: blameInfo.authorEmail || '',
						date: blameInfo.date || '',
						summary: blameInfo.summary || '',
					};
				});
				setBlameData(parsedBlame);
			} catch (error) {
				console.error(error);
				toast.error('Failed to load file');
			} finally {
				setIsLoading(false);
			}
		};

		loadData();
	}, [open, filePath, activeRepo, commitHash, utils]);

	const hasChanges = content !== originalContent;

	const handleSave = async () => {
		if (!hasChanges) return;

		setIsSaving(true);
		try {
			await utils.client.git.writeFile.mutate({
				repo: activeRepo ?? '',
				path: filePath,
				content,
			});
			setOriginalContent(content);
			setIsEditing(false);
			toast.success('File saved');
		} catch (error) {
			toast.error('Failed to save file');
		} finally {
			setIsSaving(false);
		}
	};

	const handleUndo = () => {
		setContent(originalContent);
		setIsEditing(false);
	};

	const formatDate = (dateStr: string) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		return date.toLocaleDateString();
	};

	const getShortHash = (hash: string) => hash?.substring(0, 7) || '';

	const lineNumbers = useMemo(() => {
		return content.split('\n').map((_, i) => i + 1);
	}, [content]);

	// Group consecutive blame blocks
	const blameGroups = useMemo(() => {
		const groups: { hash: string; startLine: number; count: number; author: string; date: string; summary: string }[] = [];
		let currentGroup: typeof groups[0] | null = null;

		blameData.forEach((line, index) => {
			if (!currentGroup || currentGroup.hash !== line.hash) {
				if (currentGroup) groups.push(currentGroup);
				currentGroup = {
					hash: line.hash,
					startLine: index,
					count: 1,
					author: line.author,
					date: line.date,
					summary: line.summary,
				};
			} else {
				currentGroup.count++;
			}
		});
		if (currentGroup) groups.push(currentGroup);

		return groups;
	}, [blameData]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 ui-surface">
				<DialogHeader className="px-4 py-3 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2 text-base">
							<Edit3 className="h-4 w-4" />
							<span className="font-mono text-sm">{filePath}</span>
						</DialogTitle>
						<div className="flex items-center gap-2">
							<Button
								variant={showBlame ? 'default' : 'outline'}
								size="sm"
								onClick={() => { setShowBlame(!showBlame); }}
							>
								<GitCommit className="h-4 w-4 mr-1" />
								Blame
							</Button>
							{isEditing && (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={handleUndo}
										disabled={!hasChanges}
									>
										<Undo className="h-4 w-4" />
									</Button>
									<Button
										variant="default"
										size="sm"
										onClick={handleSave}
										disabled={!hasChanges || isSaving}
									>
										{isSaving ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Save className="h-4 w-4" />
										)}
									</Button>
								</>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="flex flex-1 overflow-hidden">
					{/* Blame Gutter */}
					{showBlame && (
						<div className="w-64 border-r bg-muted/30 overflow-y-auto text-xs">
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<Loader2 className="h-4 w-4 animate-spin" />
								</div>
							) : (
								<div className="divide-y divide-border/50">
									{blameGroups.map((group) => (
										<div
											key={`${group.hash}-${group.startLine}`}
											className="px-2 py-1 hover:bg-accent/50"
											style={{ minHeight: `${group.count * 20}px` }}
										>
											<div className="flex items-center gap-2 mb-1">
												<code className="text-blue-600 font-mono">
													{getShortHash(group.hash)}
												</code>
												<Avatar
													email={blameData[group.startLine]?.authorEmail || ''}
													name={group.author}
													size="sm"
													className="h-4 w-4"
												/>
											</div>
											<div className="text-muted-foreground truncate">
												{group.author}
											</div>
											<div className="flex items-center gap-1 text-muted-foreground">
												<Calendar className="h-3 w-3" />
												{formatDate(group.date)}
											</div>
											{group.summary && (
												<div className="text-muted-foreground truncate mt-1 italic">
													{group.summary}
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Editor Area */}
					<div className="flex-1 flex overflow-hidden">
						{/* Line Numbers */}
						<div className="w-12 bg-muted/30 text-right text-xs text-muted-foreground font-mono overflow-y-auto select-none border-r">
							<div className="py-1">
								{lineNumbers.map((num) => (
									<div key={num} className="px-2 h-5 leading-5">
										{num}
									</div>
								))}
							</div>
						</div>

						{/* Code Editor */}
						<div className="flex-1 overflow-auto">
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : isEditing ? (
								<textarea
									ref={editorRef}
									value={content}
									onChange={(e) => { setContent(e.target.value); }}
									className="w-full h-full p-1 font-mono text-sm bg-transparent resize-none focus:outline-none"
									spellCheck={false}
								/>
							) : (
								<div className="p-1">
									<pre className="font-mono text-sm">
										{content.split('\n').map((line, index) => {
											const blame = blameData[index];
											const isNewGroup = index === 0 || blameData[index - 1]?.hash !== blame?.hash;

											return (
												<div
													key={index}
													className={`group h-5 leading-5 hover:bg-accent/30 ${isNewGroup && showBlame ? 'border-t border-border/30' : ''
														}`}
												>
													{line || ' '}
												</div>
											);
										})}
									</pre>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
					<div className="flex items-center gap-4">
						<span>{lineNumbers.length} lines</span>
						{hasChanges && (
							<span className="text-amber-600">Modified</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{!isEditing ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => { setIsEditing(true); }}
							>
								<Edit3 className="h-4 w-4 mr-1" />
								Edit
							</Button>
						) : (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setContent(originalContent);
									setIsEditing(false);
								}}
							>
								Cancel
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								// Open file history
							}}
						>
							<History className="h-4 w-4 mr-1" />
							History
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default FileEditorWithBlame;

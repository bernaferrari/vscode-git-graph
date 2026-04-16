/**
 * File Annotations Panel
 * Detailed blame information alongside file content (like Tower/Sublime Merge)
 */

import { formatDistanceToNow } from 'date-fns';
import {
	User,
	Calendar,
	GitCommit,
	ChevronLeft,
	ChevronRight,
	Hash,
	Clock,
	Loader2,
	PanelRightClose,
	PanelRightOpen,
	Info,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

import { Avatar } from './avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface AnnotationLine {
	lineNumber: number;
	content: string;
	commitHash: string;
	author: string;
	email: string;
	date: number;
	message: string;
}

interface FileAnnotationsPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filePath: string;
	commitHash?: string;
}

export function FileAnnotationsPanel({
	open,
	onOpenChange,
	filePath,
	commitHash = 'HEAD',
}: FileAnnotationsPanelProps) {
	const { activeRepo } = useAppStore();
	const [isLoading, setIsLoading] = useState(false);
	const [annotations, setAnnotations] = useState<AnnotationLine[]>([]);
	const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
	const [showAuthorColumn, setShowAuthorColumn] = useState(true);
	const [showDateColumn, setShowDateColumn] = useState(true);
	const [showCommitColumn, setShowCommitColumn] = useState(true);
	const [compactMode, setCompactMode] = useState(false);

	// Load file with blame annotations
	useEffect(() => {
		if (!open || !activeRepo || !filePath) return;

		const loadAnnotations = async () => {
			setIsLoading(true);
			try {
				// Get file content
					const fileContent = await trpc.git.showFile.query({
						repo: activeRepo,
						commitHash,
						filePath,
					});

					// Get blame info
					const blameResult = await trpc.git.blameFile.query({
						repo: activeRepo,
						filePath,
						commitHash,
					});

					if (blameResult?.lines) {
						const lines = String(fileContent ?? '').split('\n');
						const blameLines = blameResult.lines as Array<
							Partial<{
								hash: string;
								author: string;
								email: string;
								timestamp: number;
								summary: string;
							}>
						>;
						const annotationLines: AnnotationLine[] = lines.map((line: string, index: number) => {
							const blame = blameLines[index];
							return {
								lineNumber: index + 1,
								content: line,
								commitHash: blame?.hash || '',
							author: blame?.author || 'Unknown',
							email: blame?.email || '',
							date: blame?.timestamp || 0,
							message: blame?.summary || '',
						};
					});
					setAnnotations(annotationLines);
				}
			} catch (error) {
				console.error('Failed to load annotations:', error);
			} finally {
				setIsLoading(false);
			}
		};

		loadAnnotations();
	}, [open, activeRepo, filePath, commitHash]);

	// Group lines by commit
	const commitGroups = useMemo(() => {
		const groups = new Map<string, AnnotationLine[]>();
		annotations.forEach((line) => {
			if (line.commitHash) {
				const existing = groups.get(line.commitHash) || [];
				existing.push(line);
				groups.set(line.commitHash, existing);
			}
		});
		return groups;
	}, [annotations]);

	// Color assignment for commits
	const commitColors = useMemo(() => {
		const colors = [
			'bg-blue-100 dark:bg-blue-900/30 border-l-blue-400',
			'bg-green-100 dark:bg-green-900/30 border-l-green-400',
			'bg-amber-100 dark:bg-amber-900/30 border-l-amber-400',
			'bg-purple-100 dark:bg-purple-900/30 border-l-purple-400',
			'bg-pink-100 dark:bg-pink-900/30 border-l-pink-400',
			'bg-cyan-100 dark:bg-cyan-900/30 border-l-cyan-400',
			'bg-orange-100 dark:bg-orange-900/30 border-l-orange-400',
			'bg-indigo-100 dark:bg-indigo-900/30 border-l-indigo-400',
		];
			const colorMap = new Map<string, string>();
			let colorIndex = 0;
			commitGroups.forEach((_, hash) => {
				const color = colors[colorIndex % colors.length]!;
				colorMap.set(hash, color);
				colorIndex++;
			});
		return colorMap;
	}, [commitGroups]);

	// Navigate to previous/next commit
	const navigateCommit = (direction: 'prev' | 'next') => {
		if (!selectedCommit) return;
			const commitHashes = Array.from(commitGroups.keys());
		const currentIndex = commitHashes.indexOf(selectedCommit);
		if (currentIndex === -1) return;

		const newIndex = direction === 'prev'
			? Math.max(0, currentIndex - 1)
			: Math.min(commitHashes.length - 1, currentIndex + 1);

			const nextCommit = commitHashes[newIndex];
			if (nextCommit) {
				setSelectedCommit(nextCommit);
			}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 ui-surface">
				<DialogHeader className="px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2">
							<Info className="h-5 w-5" />
							File Annotations
							<span className="text-muted-foreground font-normal">
								- {filePath}
							</span>
						</DialogTitle>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => { setCompactMode(!compactMode); }}
								title="Toggle compact mode"
							>
								{compactMode ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => { setShowAuthorColumn(!showAuthorColumn); }}
								className={showAuthorColumn ? 'text-primary' : 'text-muted-foreground'}
							>
								<User className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => { setShowDateColumn(!showDateColumn); }}
								className={showDateColumn ? 'text-primary' : 'text-muted-foreground'}
							>
								<Calendar className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => { setShowCommitColumn(!showCommitColumn); }}
								className={showCommitColumn ? 'text-primary' : 'text-muted-foreground'}
							>
								<GitCommit className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 flex overflow-hidden">
					{/* Commit sidebar */}
					{selectedCommit && (
						<div className="w-64 border-r bg-muted/30 flex flex-col">
							<div className="p-3 border-b flex items-center justify-between">
								<span className="text-sm font-medium">Commit Details</span>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() => { navigateCommit('prev'); }}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() => { navigateCommit('next'); }}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<ScrollArea className="flex-1">
								{(() => {
									const lines = commitGroups.get(selectedCommit);
									const firstLine = lines?.[0];
									if (!firstLine) return null;

									return (
										<div className="p-3 space-y-3">
											<div className="flex items-center gap-2">
												<Avatar
													name={firstLine.author}
													email={firstLine.email}
													size="md"
												/>
												<div>
													<p className="font-medium text-sm">{firstLine.author}</p>
													<p className="text-xs text-muted-foreground">{firstLine.email}</p>
												</div>
											</div>

											<div className="space-y-1 text-sm">
												<div className="flex items-center gap-2 text-muted-foreground">
													<Hash className="h-3 w-3" />
													<code className="font-mono">{selectedCommit.slice(0, 7)}</code>
												</div>
												<div className="flex items-center gap-2 text-muted-foreground">
													<Clock className="h-3 w-3" />
													<span>
														{formatDistanceToNow(new Date(firstLine.date * 1000), { addSuffix: true })}
													</span>
												</div>
											</div>

											<div className="p-2 bg-muted rounded text-sm">
												<p className="font-medium mb-1">Message</p>
												<p className="text-muted-foreground">{firstLine.message}</p>
											</div>

											<div>
												<p className="text-sm font-medium mb-1">
													{lines?.length || 0} lines in this commit
												</p>
												<Badge variant="outline">
													{((lines?.length || 0) / annotations.length * 100).toFixed(1)}% of file
												</Badge>
											</div>
										</div>
									);
								})()}
							</ScrollArea>
						</div>
					)}

					{/* Main content with annotations */}
					<ScrollArea className="flex-1">
						{isLoading ? (
							<div className="flex items-center justify-center h-64">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="font-mono text-sm">
								{annotations.map((line) => {
									const isSelected = selectedCommit === line.commitHash;
									const bgColor = commitColors.get(line.commitHash) || '';
									const showAnnotation = !compactMode || line.lineNumber === 1 || annotations[line.lineNumber - 2]?.commitHash !== line.commitHash;

									return (
										<div
											key={line.lineNumber}
											className={`flex border-l-2 cursor-pointer transition-colors ${
												isSelected ? 'bg-accent/50 border-l-primary' : bgColor
											} hover:bg-accent/30`}
											onClick={() => { setSelectedCommit(line.commitHash); }}
										>
											{/* Line number */}
											<div className="w-12 shrink-0 px-2 py-0.5 text-right text-muted-foreground bg-muted/20 select-none border-r">
												{line.lineNumber}
											</div>

											{/* Annotation info */}
											{showAnnotation && (
												<div className={`shrink-0 flex items-center gap-2 px-2 py-0.5 text-xs border-r bg-muted/10 ${compactMode ? 'w-48' : 'w-64'}`}>
													{showCommitColumn && (
														<code className="text-blue-600 dark:text-blue-400">
															{line.commitHash.slice(0, 7)}
														</code>
													)}
													{showAuthorColumn && (
														<span className="truncate text-muted-foreground flex-1">
															{line.author}
														</span>
													)}
													{showDateColumn && (
														<span className="text-muted-foreground shrink-0">
															{formatDistanceToNow(new Date(line.date * 1000), { addSuffix: false })}
														</span>
													)}
												</div>
											)}

											{/* Line content */}
											<div className="flex-1 px-3 py-0.5 whitespace-pre overflow-x-auto">
												{line.content || ' '}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</ScrollArea>
				</div>

				{/* Footer with stats */}
				<div className="px-6 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
					<div className="flex items-center gap-4">
						<span>{annotations.length} lines</span>
						<span>{commitGroups.size} unique commits</span>
					</div>
					<div className="flex items-center gap-2">
						<span>Click a line to see commit details</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default FileAnnotationsPanel;

/**
 * Commit Series Builder
 * Build a sequence of logical commits before pushing
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	GitCommit,
	Plus,
	Trash2,
	ArrowUp,
	ArrowDown,
	Edit,
	Copy,
	Split,
	Merge,
	Check,
	X,
	FileCode,
	FileText,
	Sparkles,
	Save,
	Play,
	Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIFeatures } from '@/components/ai';

interface FileChange {
	path: string;
	status: 'added' | 'modified' | 'deleted' | 'renamed';
	 additions: number;
	deletions: number;
	staged: boolean;
	hunks?: number;
}

interface CommitInSeries {
	id: string;
	message: string;
	files: FileChange[];
	isValid: boolean;
}

interface CommitSeriesBuilderProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stagedFiles: FileChange[];
	unstagedFiles: FileChange[];
	onCommitSeries: (commits: CommitInSeries[]) => void;
}

// Suggested commit types
const COMMIT_TYPES = [
	{ prefix: 'feat', label: 'Feature', color: 'text-green-500' },
	{ prefix: 'fix', label: 'Fix', color: 'text-red-500' },
	{ prefix: 'docs', label: 'Docs', color: 'text-blue-500' },
	{ prefix: 'style', label: 'Style', color: 'text-purple-500' },
	{ prefix: 'refactor', label: 'Refactor', color: 'text-amber-500' },
	{ prefix: 'test', label: 'Test', color: 'text-cyan-500' },
	{ prefix: 'chore', label: 'Chore', color: 'text-gray-500' },
];

export function CommitSeriesBuilder({
	open,
	onOpenChange,
	stagedFiles,
	unstagedFiles,
	onCommitSeries,
}: CommitSeriesBuilderProps) {
	const [commits, setCommits] = useState<CommitInSeries[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const { generateCommitMessage, isGeneratingMessage } = useAIFeatures();

	// All available files
	const allFiles = useMemo(() => [
		...stagedFiles.map(f => ({ ...f, staged: true })),
		...unstagedFiles.map(f => ({ ...f, staged: false })),
	], [stagedFiles, unstagedFiles]);

	// Add a new commit to the series
	const addCommit = useCallback(() => {
		const newCommit: CommitInSeries = {
			id: `commit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			message: '',
			files: [],
			isValid: false,
		};
		setCommits(prev => [...prev, newCommit]);
	}, []);

	// Remove a commit
	const removeCommit = useCallback((id: string) => {
		setCommits(prev => prev.filter(c => c.id !== id));
	}, []);

	// Update commit message
	const updateCommitMessage = useCallback((id: string, message: string) => {
		setCommits(prev =>
			prev.map(c =>
				c.id === id
					? { ...c, message, isValid: message.trim().length > 0 && c.files.length > 0 }
					: c
			)
		);
	}, []);

	// Assign files to a commit
	const assignFilesToCommit = useCallback((commitId: string, files: FileChange[]) => {
		setCommits(prev =>
			prev.map(c =>
				c.id === commitId
					? { ...c, files, isValid: c.message.trim().length > 0 && files.length > 0 }
					: c
			)
		);
	}, []);

	// Move commit up/down
	const moveCommit = useCallback((id: string, direction: 'up' | 'down') => {
		setCommits(prev => {
			const index = prev.findIndex(c => c.id === id);
			if (index === -1) return prev;
			
			const newIndex = direction === 'up' ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.length) return prev;
			
			const newCommits = [...prev];
			[newCommits[index], newCommits[newIndex]] = [newCommits[newIndex], newCommits[index]];
			return newCommits;
		});
	}, []);

	// Auto-assign files to commits using AI
	const autoAssignFiles = useCallback(async () => {
		if (allFiles.length === 0) return;
		
		setIsGenerating(true);
		
		// Simple heuristic-based grouping (in production, use AI)
		const grouped = new Map<string, FileChange[]>();
		
		allFiles.forEach(file => {
			// Group by directory
			const dir = file.path.split('/')[0] || 'root';
			if (!grouped.has(dir)) {
				grouped.set(dir, []);
			}
			grouped.get(dir)!.push(file);
		});
		
		// Create commits from groups
		const newCommits: CommitInSeries[] = [];
		let commitIndex = 0;
		
		grouped.forEach((files, dir) => {
			const type = COMMIT_TYPES[commitIndex % COMMIT_TYPES.length];
			newCommits.push({
				id: `commit-${Date.now()}-${commitIndex}`,
				message: `${type.prefix}: ${dir} changes`,
				files,
				isValid: true,
			});
			commitIndex++;
		});
		
		setCommits(newCommits);
		setIsGenerating(false);
	}, [allFiles]);

	// Generate commit messages using AI
	const generateMessages = useCallback(async () => {
		if (commits.length === 0) return;
		
		setIsGenerating(true);
		
		for (const commit of commits) {
			if (commit.files.length > 0) {
				const filePaths = commit.files.map(f => f.path);
				const diff = '...'; // Would get actual diff
				const suggestion = await generateCommitMessage(filePaths, diff);
				
				if (suggestion) {
					updateCommitMessage(commit.id, suggestion.message);
				}
			}
		}
		
		setIsGenerating(false);
	}, [commits, generateCommitMessage, updateCommitMessage]);

	// Apply commits
	const handleApply = useCallback(() => {
		const validCommits = commits.filter(c => c.isValid);
		if (validCommits.length > 0) {
			onCommitSeries(validCommits);
			onOpenChange(false);
			setCommits([]);
		}
	}, [commits, onCommitSeries, onOpenChange]);

	// Stats
	const totalFiles = commits.reduce((sum, c) => sum + c.files.length, 0);
	const validCommits = commits.filter(c => c.isValid).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitCommit className="h-5 w-5" />
						Commit Series Builder
					</DialogTitle>
					<DialogDescription>
						Build a sequence of logical commits before pushing. Perfect for PR reviews.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex gap-4">
					{/* Available Files */}
					<Card className="w-64 shrink-0">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">Available Files</CardTitle>
							<p className="text-xs text-muted-foreground">
								{allFiles.length} files changed
							</p>
						</CardHeader>
						<CardContent className="p-0">
							<ScrollArea className="h-[300px]">
								<div className="p-2 space-y-1">
									{allFiles.map((file, i) => (
										<div
											key={i}
											className={cn(
												'flex items-center gap-2 p-2 rounded text-sm cursor-pointer hover:bg-accent',
												file.staged ? 'bg-green-50 dark:bg-green-950/20' : 'bg-yellow-50 dark:bg-yellow-950/20'
											)}
											draggable
										>
											{file.status === 'added' && <Plus className="h-3 w-3 text-green-500" />}
											{file.status === 'modified' && <Edit className="h-3 w-3 text-blue-500" />}
											{file.status === 'deleted' && <Trash2 className="h-3 w-3 text-red-500" />}
											<span className="truncate flex-1">{file.path}</span>
											{file.staged && <Badge variant="outline" className="text-[10px]">staged</Badge>}
										</div>
									))}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>

					{/* Commit Series */}
					<div className="flex-1 flex flex-col min-w-0">
						{/* Actions */}
						<div className="flex items-center gap-2 mb-3">
							<Button variant="outline" size="sm" onClick={addCommit}>
								<Plus className="h-4 w-4 mr-1" />
								Add Commit
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={autoAssignFiles}
								disabled={isGenerating || allFiles.length === 0}
							>
								<Sparkles className="h-4 w-4 mr-1" />
								Auto Group
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={generateMessages}
								disabled={isGenerating || commits.length === 0}
							>
								{isGenerating ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Sparkles className="h-4 w-4 mr-1" />
								)}
								AI Messages
							</Button>
						</div>

						{/* Commit List */}
						<ScrollArea className="flex-1">
							<div className="space-y-2">
								{commits.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<GitCommit className="h-12 w-12 mx-auto mb-3 opacity-30" />
										<p>No commits yet</p>
										<p className="text-xs mt-1">
											Add commits or use "Auto Group" to organize your changes
										</p>
									</div>
								) : (
									commits.map((commit, index) => (
										<Card key={commit.id} className={cn(!commit.isValid && 'border-amber-300')}>
											<CardContent className="p-3">
												<div className="flex items-start gap-2">
													{/* Order controls */}
													<div className="flex flex-col gap-0.5">
														<Button
															variant="ghost"
															size="sm"
															className="h-5 w-5 p-0"
															onClick={() => moveCommit(commit.id, 'up')}
															disabled={index === 0}
														>
															<ArrowUp className="h-3 w-3" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="h-5 w-5 p-0"
															onClick={() => moveCommit(commit.id, 'down')}
															disabled={index === commits.length - 1}
														>
															<ArrowDown className="h-3 w-3" />
														</Button>
													</div>

													{/* Commit info */}
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-2">
															<Badge variant="outline" className="font-mono">
																#{index + 1}
															</Badge>
															{commit.files.length > 0 && (
																<Badge variant="secondary" className="text-xs">
																		 {commit.files.length} file{commit.files.length !== 1 ? 's' : ''}
																</Badge>
															)}
															{commit.isValid ? (
																<Check className="h-4 w-4 text-green-500" />
															) : (
																<X className="h-4 w-4 text-amber-500" />
															)}
														</div>
														
														<Textarea
															value={commit.message}
															onChange={(e) => updateCommitMessage(commit.id, e.target.value)}
															placeholder="Commit message..."
															className="h-16 text-sm"
														/>

														{commit.files.length > 0 && (
															<div className="flex flex-wrap gap-1 mt-2">
																{commit.files.slice(0, 3).map((f, i) => (
																	<Badge key={i} variant="outline" className="text-[10px]">
																		{f.path.split('/').pop()}
																	</Badge>
																))}
																{commit.files.length > 3 && (
																	<Badge variant="outline" className="text-[10px]">
																		+{commit.files.length - 3} more
																	</Badge>
																)}
															</div>
														)}
													</div>

													{/* Delete */}
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 text-red-500"
														onClick={() => removeCommit(commit.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</CardContent>
										</Card>
									))
								)}
							</div>
						</ScrollArea>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between pt-4 border-t">
					<div className="text-sm text-muted-foreground">
						{validCommits} of {commits.length} commits ready
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleApply} disabled={validCommits === 0}>
							<Play className="h-4 w-4 mr-2" />
							Commit Series ({validCommits})
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

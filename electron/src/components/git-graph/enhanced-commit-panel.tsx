/**
 * Enhanced Commit Panel
 * Better file preview, diff stats, and commit actions
 */

import { useState, useMemo } from 'react';
import { PatchDiff } from '@pierre/diffs/react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
	GitCommit,
	ChevronRight,
	ChevronDown,
	Plus,
	Minus,
	FileCode,
	FileText,
	Image,
	Binary,
	Folder,
	ExternalLink,
	Copy,
	Check,
	User,
	Calendar,
	Hash,
	Mail,
} from 'lucide-react';
import { InlineBlame } from './inline-blame';

interface FileChange {
	path: string;
	additions: number;
	deletions: number;
	status: 'added' | 'modified' | 'deleted' | 'renamed';
	oldPath?: string;
	binary?: boolean;
}

interface EnhancedCommitPanelProps {
	commit: {
		hash: string;
		message: string;
		author: string;
		email: string;
		date: number;
		parents: string[];
	};
	repo: string;
	onFileClick?: (path: string) => void;
}

export function EnhancedCommitPanel({ commit, repo, onFileClick }: EnhancedCommitPanelProps) {
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
	const [copiedHash, setCopiedHash] = useState<string | null>(null);

	// Fetch commit details
	const { data: commitDetails, isLoading } = trpc.git.commitDetails.useQuery(
		{ repo, hash: commit.hash },
		{ enabled: !!repo && !!commit.hash }
	);

	// Fetch diff for expanded files
	const expandedFilePath = expandedFiles.size > 0 ? Array.from(expandedFiles)[0] : null;
	const { data: fileDiff } = trpc.git.fileDiff.useQuery(
		{ repo, hash: commit.hash, path: expandedFilePath ?? '' },
		{ enabled: !!expandedFilePath && !!repo }
	);

	const fileChanges: FileChange[] = useMemo(() => {
		if (!commitDetails?.files) return [];
		return commitDetails.files.map((f: any) => ({
			path: f.path,
			additions: f.additions ?? 0,
			deletions: f.deletions ?? 0,
			status: f.status ?? 'modified',
			binary: f.binary,
		}));
	}, [commitDetails]);

	const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
	const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);
	const inlineDiffOptions = useMemo(
		() => ({
			diffStyle: 'unified' as const,
			lineDiffType: 'word' as const,
			overflow: 'scroll' as const,
			themeType: 'system' as const,
			disableFileHeader: true,
		}),
		[]
	);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		return date.toLocaleString();
	};

	const handleCopyHash = () => {
		navigator.clipboard.writeText(commit.hash);
		setCopiedHash(commit.hash);
		setTimeout(() => setCopiedHash(null), 2000);
	};

	const toggleFile = (path: string) => {
		setExpandedFiles(prev => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.clear(); // Only one file expanded at a time
				next.add(path);
			}
			return next;
		});
	};

	const getFileIcon = (path: string, binary?: boolean) => {
		if (binary) return <Binary className="h-4 w-4 text-muted-foreground" />;
		
		const ext = path.split('.').pop()?.toLowerCase();
		if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) {
			return <Image className="h-4 w-4 text-purple-500" />;
		}
		if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp'].includes(ext ?? '')) {
			return <FileCode className="h-4 w-4 text-blue-500" />;
		}
		if (['md', 'txt', 'json', 'yaml', 'yml', 'toml'].includes(ext ?? '')) {
			return <FileText className="h-4 w-4 text-amber-500" />;
		}
		return <FileCode className="h-4 w-4 text-muted-foreground" />;
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'added': return 'text-green-600';
			case 'deleted': return 'text-red-600';
			case 'renamed': return 'text-amber-600';
			default: return 'text-amber-500';
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case 'added': return 'A';
			case 'deleted': return 'D';
			case 'renamed': return 'R';
			default: return 'M';
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Commit Header */}
			<div className="p-4 border-b space-y-3">
				<div className="flex items-start gap-3">
					<div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
						<GitCommit className="h-5 w-5 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-medium text-sm leading-tight mb-1">
							{commit.message.split('\n')[0]}
						</h3>
						{commit.message.includes('\n') && (
							<p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
								{commit.message.split('\n').slice(1).join('\n').trim()}
							</p>
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2 text-xs">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Hash className="h-3 w-3" />
						<code className="font-mono">{commit.hash.slice(0, 7)}</code>
						<Button
							variant="ghost"
							size="sm"
							className="h-5 w-5 p-0"
							onClick={handleCopyHash}
						>
							{copiedHash === commit.hash ? (
								<Check className="h-3 w-3 text-green-600" />
							) : (
								<Copy className="h-3 w-3" />
							)}
						</Button>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Calendar className="h-3 w-3" />
						{formatDate(commit.date)}
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<User className="h-3 w-3" />
						{commit.author}
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Mail className="h-3 w-3" />
						{commit.email}
					</div>
				</div>

				{/* Diff Stats */}
				<div className="flex items-center gap-3 pt-2 border-t">
					<span className="text-xs text-muted-foreground">
						{fileChanges.length} file{fileChanges.length !== 1 ? 's' : ''} changed
					</span>
					{totalAdditions > 0 && (
						<span className="text-xs text-green-600 flex items-center gap-1">
							<Plus className="h-3 w-3" />
							{totalAdditions}
						</span>
					)}
					{totalDeletions > 0 && (
						<span className="text-xs text-red-600 flex items-center gap-1">
							<Minus className="h-3 w-3" />
							{totalDeletions}
						</span>
					)}
				</div>
			</div>

			{/* File List */}
			<ScrollArea className="flex-1">
				<div className="p-2">
					{fileChanges.length === 0 ? (
						<div className="text-center py-4 text-muted-foreground text-sm">
							No file changes found
						</div>
					) : (
						<div className="space-y-1">
							{fileChanges.map((file) => (
								<Collapsible
									key={file.path}
									open={expandedFiles.has(file.path)}
									onOpenChange={() => toggleFile(file.path)}
								>
									<CollapsibleTrigger className="w-full">
										<div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer group">
											{expandedFiles.has(file.path) ? (
												<ChevronDown className="h-4 w-4 text-muted-foreground" />
											) : (
												<ChevronRight className="h-4 w-4 text-muted-foreground" />
											)}
											{getFileIcon(file.path, file.binary)}
											<span className="flex-1 text-sm truncate text-left">
												{file.path}
											</span>
											<span className={`text-xs font-mono ${getStatusColor(file.status)}`}>
												{getStatusLabel(file.status)}
											</span>
											{(file.additions > 0 || file.deletions > 0) && !file.binary && (
												<div className="flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100">
													{file.additions > 0 && (
														<span className="text-green-600">+{file.additions}</span>
													)}
													{file.deletions > 0 && (
														<span className="text-red-600">-{file.deletions}</span>
													)}
												</div>
											)}
										</div>
									</CollapsibleTrigger>
									<CollapsibleContent>
										{file.binary ? (
											<div className="px-10 py-2 text-xs text-muted-foreground">
												Binary file - cannot display diff
											</div>
										) : fileDiff?.diff ? (
											<div className="px-4 py-2 bg-muted/30 rounded mx-2 mb-2 overflow-hidden">
												<PatchDiff
													patch={fileDiff.diff}
													options={inlineDiffOptions}
													className="w-full"
												/>
											</div>
										) : (
											<div className="px-10 py-2 text-xs text-muted-foreground">
												Loading diff...
											</div>
										)}
									</CollapsibleContent>
								</Collapsible>
							))}
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Quick Actions */}
			<div className="p-3 border-t flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={() => onFileClick?.(commit.hash)}>
					<ExternalLink className="h-3 w-3 mr-1" />
					View Full Diff
				</Button>
				<Button variant="outline" size="sm" onClick={handleCopyHash}>
					<Copy className="h-3 w-3 mr-1" />
					Copy SHA
				</Button>
			</div>
		</div>
	);
}

export default EnhancedCommitPanel;

/**
 * Commit Details Panel
 * Shows detailed information about a selected commit
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	X,
	GitBranch,
	Tag,
	Copy,
	ExternalLink,
	GitCommit,
	User,
	Calendar,
	MoreHorizontal,
	ArrowRight,
	FileText,
	Plus,
	Minus,
	RotateCcw,
	Columns,
	PanelTop,
} from 'lucide-react';
import { useState } from 'react';
import { SideBySideDiff } from './side-by-side-diff';

interface CommitDetailsPanelProps {
	commitHash: string | null;
	onClose?: () => void;
}

export function CommitDetailsPanel({ commitHash, onClose }: CommitDetailsPanelProps) {
	const { activeRepo } = useAppStore();
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [showDiff, setShowDiff] = useState(false);

	const { data: commitDetails, isLoading } = trpc.git.commitDetails.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: commitHash ?? '',
		},
		{ enabled: !!commitHash && !!activeRepo }
	);

	// Get selected file info
	const selectedFileInfo = commitDetails?.fileChanges?.find(
		(f) => f.newFilePath === selectedFile || f.oldFilePath === selectedFile
	);

	// Handle file click - show diff
	const handleFileClick = (filePath: string) => {
		setSelectedFile(filePath);
		setShowDiff(true);
	};

	if (!commitHash) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground p-4 bg-background">
				<div className="text-center">
					<GitCommit className="h-10 w-10 mx-auto mb-3 opacity-30" />
					<p className="text-sm">Select a commit to view details</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full bg-background">
				<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
			</div>
		);
	}

	if (!commitDetails?.details) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground p-4 bg-background">
				<p className="text-sm">Failed to load commit details</p>
			</div>
		);
	}

	const { details } = commitDetails;

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<div className="flex items-center gap-2">
					<GitCommit className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium text-sm">Commit</span>
					<code className="text-xs font-mono text-muted-foreground">
						{details.hash.slice(0, 7)}
					</code>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => copyToClipboard(details.hash)}
						title="Copy full SHA"
					>
						<Copy className="h-3 w-3" />
					</Button>
					{onClose && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={onClose}
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-4">
					{/* Author & Date */}
					<div className="space-y-2">
						<div className="flex items-start gap-2">
							<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
								<User className="h-3 w-3 text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium">{details.author}</p>
								<p className="text-xs text-muted-foreground truncate">{details.authorEmail}</p>
							</div>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
							<Calendar className="h-3 w-3" />
							<span>{formatDate(details.authorDate)}</span>
							<span className="text-muted-foreground/50">•</span>
							<span>{formatRelative(details.authorDate)}</span>
						</div>
					</div>

					{/* Message */}
					<div className="space-y-1">
						<p className="text-sm whitespace-pre-wrap leading-relaxed">
							{details.body || details.message}
						</p>
					</div>

					{/* Parents */}
					{details.parents && details.parents.length > 0 && (
						<div className="space-y-1">
							<span className="text-xs font-medium text-muted-foreground">Parents</span>
							<div className="flex flex-wrap gap-1">
								{details.parents.map((parent: string, i: number) => (
									<button
										key={parent}
										className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted rounded hover:bg-muted/80 transition-colors"
										onClick={() => {
											// TODO: Navigate to parent commit
										}}
									>
										{i === 0 ? <ArrowRight className="h-3 w-3" /> : <GitCommit className="h-3 w-3" />}
										{parent.slice(0, 7)}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Signature */}
					{details.signature && (
						<div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
							details.signature.status === 'Good'
								? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
								: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
						}`}>
							<span className="font-medium">{details.signature.status}</span>
							<span className="opacity-70">•</span>
							<span>{details.signature.signer}</span>
						</div>
					)}

					{/* File Changes */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Changed Files ({details.fileChanges.length})
							</span>
							<div className="flex items-center gap-2 text-xs">
								<span className="text-green-600 dark:text-green-400">
									+{details.fileChanges.reduce((acc: number, f: { additions: number | null }) => acc + (f.additions ?? 0), 0)}
								</span>
								<span className="text-red-600 dark:text-red-400">
									-{details.fileChanges.reduce((acc: number, f: { deletions: number | null }) => acc + (f.deletions ?? 0), 0)}
								</span>
							</div>
						</div>

						<div className="space-y-0.5">
							{details.fileChanges.map((file: FileChange, index: number) => (
								<div
									key={index}
									className={`group flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
										selectedFile === file.newFilePath
											? 'bg-accent'
											: 'hover:bg-accent/50'
									}`}
									onClick={() => handleFileClick(file.newFilePath)}
								>
									{/* Change type icon */}
									<FileChangeIcon type={file.type} />
									
									{/* File path with middle truncation */}
									<span className="truncate flex-1 min-w-0" title={file.newFilePath}>
										{middleTruncate(file.newFilePath)}
									</span>

									{/* Additions/deletions */}
									{(file.additions !== null || file.deletions !== null) && (
										<div className="flex items-center gap-1 text-[10px] font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
											{file.additions !== null && file.additions > 0 && (
												<span className="text-green-600 dark:text-green-400">+{file.additions}</span>
											)}
											{file.deletions !== null && file.deletions > 0 && (
												<span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
											)}
										</div>
									)}

									{/* More actions */}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
												onClick={(e) => e.stopPropagation()}
											>
												<MoreHorizontal className="h-3 w-3" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-48">
											<DropdownMenuItem onClick={() => copyToClipboard(file.newFilePath)}>
												<Copy className="h-4 w-4 mr-2" />
												Copy path
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem>
												<FileText className="h-4 w-4 mr-2" />
												View file at this commit
											</DropdownMenuItem>
											<DropdownMenuItem>
												<RotateCcw className="h-4 w-4 mr-2" />
												Reset file to this revision
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							))}
						</div>
					</div>
				</div>
			</ScrollArea>

			{/* Diff Viewer */}
			{showDiff && selectedFile && selectedFileInfo && (
				<div className="absolute inset-0 z-10 bg-background flex flex-col">
					<div className="flex items-center justify-between px-3 py-2 border-b">
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0"
								onClick={() => setShowDiff(false)}
							>
								<X className="h-4 w-4" />
							</Button>
							<span className="text-sm font-medium truncate max-w-[200px]">
								{selectedFile}
							</span>
						</div>
					</div>
					<div className="flex-1 overflow-hidden">
						<SideBySideDiff
							file={{
								path: selectedFile,
								oldPath: selectedFileInfo.oldFilePath ?? undefined,
								status: selectedFileInfo.type,
							}}
							commitHash={commitHash ?? ''}
						/>
					</div>
				</div>
			)}

			{/* Footer actions */}
			<div className="flex items-center gap-1 p-2 border-t">
				<Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
					<GitBranch className="h-3 w-3" />
					Branch
				</Button>
				<Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
					<Tag className="h-3 w-3" />
					Tag
				</Button>
				<Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
					<RotateCcw className="h-3 w-3" />
					Reset
				</Button>
			</div>
		</div>
	);
}

interface FileChange {
	type: string;
	newFilePath: string;
	oldFilePath: string | null;
	additions: number | null;
	deletions: number | null;
}

function FileChangeIcon({ type }: { type: string }) {
	switch (type) {
		case 'A':
			return <Plus className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
		case 'D':
			return <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />;
		case 'R':
			return <ArrowRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
		default:
			return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
	}
}

function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString('en-US', {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatRelative(timestamp: number): string {
	const now = Date.now();
	const date = timestamp * 1000;
	const diff = now - date;

	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} minutes ago`;
	if (hours < 24) return `${hours} hours ago`;
	if (days < 7) return `${days} days ago`;

	return formatDate(timestamp);
}

// Middle truncate long file paths: "src/components/very/long/path/to/file.ts" -> "src/.../to/file.ts"
function middleTruncate(path: string, maxLength: number = 40): string {
	if (path.length <= maxLength) return path;

	// Keep the filename intact
	const lastSlash = path.lastIndexOf('/');
	const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
	const dirPath = lastSlash >= 0 ? path.slice(0, lastSlash) : '';

	if (filename.length >= maxLength - 5) {
		// Filename is already long, just truncate end
		return filename.slice(0, maxLength - 3) + '...';
	}

	// Calculate how much of the directory path we can keep
	const availableForDir = maxLength - filename.length - 5; // -5 for ".../"

	if (availableForDir < 5) {
		return '.../' + filename;
	}

	// Keep start of directory path
	return dirPath.slice(0, availableForDir) + '.../' + filename;
}

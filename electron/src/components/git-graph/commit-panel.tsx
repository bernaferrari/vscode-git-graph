/**
 * Commit Panel
 * Shows staging area and allows creating commits
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	GitCommit,
	Plus,
	Minus,
	FileText,
	ChevronDown,
	ChevronRight,
	RotateCcw,
	Archive,
	RefreshCw,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';

interface CommitPanelProps {
	onCommit?: () => void;
}

interface FileStatus {
	file: string;
	status: string;
}

export function CommitPanel({ onCommit }: CommitPanelProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [message, setMessage] = useState('');
	const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
	const [expandedStaged, setExpandedStaged] = useState(true);
	const [expandedUnstaged, setExpandedUnstaged] = useState(true);

	// Get uncommitted changes from repoInfo
	const { data: repoInfo, refetch: refetchRepoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: true,
			hideRemotes: [],
		},
		{ enabled: !!activeRepo }
	);

	// For now, show a placeholder for uncommitted files
	// TODO: Add proper git status endpoint
	const hasUncommitted = repoInfo?.hasUncommittedChanges ?? false;
	const unstaged: FileStatus[] = hasUncommitted ? [{ file: 'Uncommitted changes', status: 'M' }] : [];
	const staged: FileStatus[] = [];

	const handleStageFile = (file: string) => {
		setStagedFiles((prev) => new Set([...prev, file]));
	};

	const handleUnstageFile = (file: string) => {
		setStagedFiles((prev) => {
			const next = new Set(prev);
			next.delete(file);
			return next;
		});
	};

	const handleStageAll = () => {
		const allFiles = [...staged, ...unstaged];
		setStagedFiles(new Set(allFiles.map((f) => f.file)));
	};

	const handleUnstageAll = () => {
		setStagedFiles(new Set());
	};

	const handleCommit = async () => {
		if (!message.trim()) return;
		// TODO: Implement commit with staged files
		setMessage('');
		setStagedFiles(new Set());
		refetchRepoInfo();
		onCommit?.();
	};

	const handleStash = async () => {
		await gitOps.stashPush(message || undefined);
		setMessage('');
		refetchRepoInfo();
	};

	if (!activeRepo) return null;

	const hasChanges = unstaged.length > 0 || staged.length > 0;
	const canCommit = stagedFiles.size > 0 && message.trim().length > 0;

	return (
		<div className="flex flex-col h-full border-t bg-muted/30">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<span className="text-sm font-medium">Commit</span>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => refetchRepoInfo()}
					>
						<RefreshCw className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* File changes */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2">
					{/* Staged files */}
					{staged.length > 0 && (
						<div className="mb-2">
							<button
								onClick={() => setExpandedStaged(!expandedStaged)}
								className="flex items-center gap-1 w-full text-xs font-medium text-muted-foreground hover:text-foreground"
							>
								{expandedStaged ? (
									<ChevronDown className="h-3 w-3" />
								) : (
									<ChevronRight className="h-3 w-3" />
								)}
								<Plus className="h-3 w-3 text-green-600" />
								<span>Staged ({staged.length})</span>
							</button>
							{expandedStaged && (
								<div className="mt-1 space-y-0.5">
									{staged.map((file) => (
										<FileItem
											key={file.file}
											file={file.file}
											status={file.status}
											staged={stagedFiles.has(file.file)}
											onToggle={() => handleUnstageFile(file.file)}
										/>
									))}
								</div>
							)}
						</div>
					)}

					{/* Unstaged files */}
					{unstaged.length > 0 && (
						<div className="mb-2">
							<button
								onClick={() => setExpandedUnstaged(!expandedUnstaged)}
								className="flex items-center gap-1 w-full text-xs font-medium text-muted-foreground hover:text-foreground"
							>
								{expandedUnstaged ? (
									<ChevronDown className="h-3 w-3" />
								) : (
									<ChevronRight className="h-3 w-3" />
								)}
								<Minus className="h-3 w-3 text-amber-600" />
								<span>Unstaged ({unstaged.length})</span>
								<Button
									variant="ghost"
									size="sm"
									className="h-4 px-1 ml-auto text-[10px]"
									onClick={(e) => {
										e.stopPropagation();
										handleStageAll();
									}}
								>
									Stage All
								</Button>
							</button>
							{expandedUnstaged && (
								<div className="mt-1 space-y-0.5">
									{unstaged.map((file) => (
										<FileItem
											key={file.file}
											file={file.file}
											status={file.status}
											staged={stagedFiles.has(file.file)}
											onToggle={() => handleStageFile(file.file)}
										/>
									))}
								</div>
							)}
						</div>
					)}

					{/* No changes */}
					{!hasChanges && (
						<div className="text-center py-8 text-muted-foreground text-xs">
							<FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
							<p>No changes to commit</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Commit message and actions */}
			<div className="border-t p-2 space-y-2">
				<Textarea
					placeholder="Commit message..."
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					className="min-h-[60px] text-sm resize-none"
					disabled={!hasChanges}
				/>

				<div className="flex items-center gap-2">
					<Button
						size="sm"
						className="flex-1"
						disabled={!canCommit}
						onClick={handleCommit}
					>
						<GitCommit className="h-4 w-4 mr-1" />
						Commit
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!hasChanges}
						onClick={handleStash}
						title="Stash changes"
					>
						<Archive className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// File item component
function FileItem({
	file,
	status,
	staged,
	onToggle,
}: {
	file: string;
	status: string;
	staged: boolean;
	onToggle: () => void;
}) {
	const getStatusIcon = () => {
		switch (status) {
			case 'A':
				return <Plus className="h-3 w-3 text-green-600" />;
			case 'D':
				return <Minus className="h-3 w-3 text-red-600" />;
			case 'R':
				return <RotateCcw className="h-3 w-3 text-amber-600" />;
			default:
				return <FileText className="h-3 w-3 text-muted-foreground" />;
		}
	};

	return (
		<div
			className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-accent/50 cursor-pointer"
			onClick={onToggle}
		>
			<Checkbox checked={staged} className="h-3 w-3" />
			{getStatusIcon()}
			<span className="text-xs truncate flex-1">{file}</span>
		</div>
	);
}

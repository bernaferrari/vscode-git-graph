/**
 * Commit Panel
 * Shows staging area and allows creating commits
 */

import { useState, useMemo, useCallback } from 'react';
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
	Edit,
	ChevronUp,
	FolderTree,
	List,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileTreeView } from './file-tree-view';

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
	const [expandedStaged, setExpandedStaged] = useState(true);
	const [expandedUnstaged, setExpandedUnstaged] = useState(true);
	const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
	const [selectedStagedFiles, setSelectedStagedFiles] = useState<Set<string>>(new Set());
	const [selectedUnstagedFiles, setSelectedUnstagedFiles] = useState<Set<string>>(new Set());

	// Get working tree status
	const { data: statusData, refetch: refetchStatus } = trpc.git.workingTreeStatus.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo, refetchInterval: 5000 }
	);

	const staged: FileStatus[] = statusData?.staged ?? [];
	const unstaged: FileStatus[] = statusData?.unstaged ?? [];

	// Auto-select all staged files
	const stagedFileSet = useMemo(() => new Set(staged.map(f => f.file)), [staged]);
	const unstagedFileSet = useMemo(() => new Set(unstaged.map(f => f.file)), [unstaged]);

	const handleStageFile = async (file: string) => {
		await gitOps.stage([file]);
		refetchStatus();
	};

	const handleUnstageFile = async (file: string) => {
		await gitOps.unstage([file]);
		refetchStatus();
	};

	const handleStageAll = async () => {
		await gitOps.stage(unstaged.map((f) => f.file));
		refetchStatus();
	};

	const handleUnstageAll = async () => {
		await gitOps.unstage(staged.map((f) => f.file));
		refetchStatus();
	};

	const handleCommit = async (amend: boolean = false) => {
		if (!message.trim() && !amend) return;
		await gitOps.commit(message, amend);
		setMessage('');
		refetchStatus();
		onCommit?.();
	};

	const handleStash = async () => {
		await gitOps.stashPush(message || undefined);
		setMessage('');
		refetchStatus();
	};

	if (!activeRepo) return null;

	const hasChanges = unstaged.length > 0 || staged.length > 0;
	const canCommit = staged.length > 0 && message.trim().length > 0;
	const canAmend = staged.length > 0;

	return (
		<div className="flex flex-col h-full border-t bg-muted/30">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<span className="text-sm font-medium">Commit</span>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
								size="sm"
								className="h-6 w-6 p-0"
								onClick={() => setViewMode(viewMode === 'tree' ? 'flat' : 'tree')}
							>
								{viewMode === 'tree' ? (
									<FolderTree className="h-3 w-3" />
								) : (
									<List className="h-3 w-3" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{viewMode === 'tree' ? 'Switch to list view' : 'Switch to tree view'}
						</TooltipContent>
					</Tooltip>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => refetchStatus()}
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
								<Button
									variant="ghost"
									size="sm"
									className="h-4 px-1 ml-auto text-[10px]"
									onClick={(e) => {
										e.stopPropagation();
										handleUnstageAll();
									}}
								>
									Unstage All
								</Button>
							</button>
							{expandedStaged && (
								<div className="mt-1 space-y-0.5">
									{staged.map((file) => (
										<FileItem
											key={file.file}
											file={file.file}
											status={file.status}
											staged={true}
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
											staged={false}
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
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="sm"
								className="flex-1"
								disabled={!canCommit}
							>
								<GitCommit className="h-4 w-4 mr-1" />
								Commit
								<ChevronUp className="h-3 w-3 ml-1" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-40">
							<DropdownMenuItem onClick={() => handleCommit(false)} disabled={!canCommit}>
								<GitCommit className="h-4 w-4 mr-2" />
								Commit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleCommit(true)} disabled={!canAmend}>
								<Edit className="h-4 w-4 mr-2" />
								Amend Commit
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
			<span className="text-xs truncate flex-1" title={file}>{file}</span>
		</div>
	);
}

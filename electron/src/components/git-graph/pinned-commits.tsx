/**
 * Pinned Commits
 * Save and manage favorite/important commits
 */

import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Star,
	Pin,
	PinOff,
	MessageSquare,
	User,
	Calendar,
	Hash,
	GitBranch,
	MoreHorizontal,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface PinnedCommit {
	hash: string;
	message: string;
	author: string;
	date: string;
	branch?: string;
	pinnedAt: number;
	note?: string;
}

interface PinnedCommitsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pinnedCommits: PinnedCommit[];
	onPin: (commit: PinnedCommit) => void;
	onUnpin: (hash: string) => void;
	onUpdateNote: (hash: string, note: string) => void;
	onJumpToCommit: (hash: string) => void;
}

export function PinnedCommitsDialog({
	open,
	onOpenChange,
	pinnedCommits,
	onUnpin,
	onUpdateNote,
	onJumpToCommit,
}: PinnedCommitsProps) {
	const [editingNote, setEditingNote] = useState<string | null>(null);
	const [noteText, setNoteText] = useState('');

	const sortedCommits = useMemo(() => {
		return [...pinnedCommits].sort((a, b) => b.pinnedAt - a.pinnedAt);
	}, [pinnedCommits]);

	const handleSaveNote = (hash: string) => {
		onUpdateNote(hash, noteText);
		setEditingNote(null);
		setNoteText('');
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Pin className="h-5 w-5" />
						Pinned Commits
						<span className="text-sm font-normal text-muted-foreground">
							({pinnedCommits.length})
						</span>
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex-1 -mx-6">
					<div className="px-6 py-2 space-y-2">
						{sortedCommits.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								<Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No pinned commits yet</p>
								<p className="text-xs mt-1">
									Right-click on a commit and select "Pin Commit"
								</p>
							</div>
						) : (
							sortedCommits.map((commit) => (
								<div
									key={commit.hash}
									className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
								>
									<div className="flex items-start gap-3">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<Hash className="h-3 w-3 text-muted-foreground" />
												<span className="font-mono text-xs">{commit.hash.slice(0, 8)}</span>
												{commit.branch && (
													<>
														<GitBranch className="h-3 w-3 text-muted-foreground" />
														<span className="text-xs text-muted-foreground truncate">
															{commit.branch}
														</span>
													</>
												)}
											</div>
											<p className="text-sm font-medium truncate mb-1">
												{commit.message}
											</p>
											<div className="flex items-center gap-3 text-xs text-muted-foreground">
												<span className="flex items-center gap-1">
													<User className="h-3 w-3" />
													{commit.author}
												</span>
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{new Date(commit.date).toLocaleDateString()}
												</span>
											</div>

											{commit.note && (
												<div className="mt-2 p-2 rounded bg-background text-xs">
													<span className="text-muted-foreground">Note: </span>
													{commit.note}
												</div>
											)}

											{editingNote === commit.hash && (
												<div className="mt-2 flex gap-2">
													<input
														type="text"
														value={noteText}
														onChange={(e) => setNoteText(e.target.value)}
														placeholder="Add a note..."
														className="flex-1 px-2 py-1 text-xs border rounded"
														autoFocus
														onKeyDown={(e) => {
															if (e.key === 'Enter') handleSaveNote(commit.hash);
															if (e.key === 'Escape') {
																setEditingNote(null);
																setNoteText('');
															}
														}}
													/>
													<Button
														size="sm"
														className="h-6 px-2 text-xs"
														onClick={() => handleSaveNote(commit.hash)}
													>
														Save
													</Button>
												</div>
											)}
										</div>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => onJumpToCommit(commit.hash)}>
													<GitBranch className="h-4 w-4 mr-2" />
													Jump to Commit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => {
														setEditingNote(commit.hash);
														setNoteText(commit.note ?? '');
													}}
												>
													<MessageSquare className="h-4 w-4 mr-2" />
													{commit.note ? 'Edit Note' : 'Add Note'}
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => onUnpin(commit.hash)}
													className="text-red-600"
												>
													<PinOff className="h-4 w-4 mr-2" />
													Unpin Commit
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							))
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

// Hook for managing pinned commits (persisted in backend store)
export function usePinnedCommits(repoId: string | null) {
	const [pinnedCommits, setPinnedCommits] = useState<PinnedCommit[]>([]);
    const utils = trpc.useUtils();
    const pinnedCommitsQuery = trpc.repo.pinnedCommits.useQuery(
        { repo: repoId ?? '' },
        { enabled: !!repoId, staleTime: 10_000 }
    );
    const setPinnedCommitsMutation = trpc.repo.setPinnedCommits.useMutation({
        onSuccess: async (
			_result: unknown,
			variables: { repo: string; commits: PinnedCommit[] }
		) => {
            await utils.repo.pinnedCommits.invalidate({ repo: variables.repo });
        },
    });

	useEffect(() => {
		if (!repoId) {
            setPinnedCommits([]);
            return;
        }
        setPinnedCommits(pinnedCommitsQuery.data?.commits ?? []);
	}, [pinnedCommitsQuery.data?.commits, repoId]);

    const persistCommits = (nextCommits: PinnedCommit[]) => {
        setPinnedCommits(nextCommits);
        if (repoId) {
            setPinnedCommitsMutation.mutate({ repo: repoId, commits: nextCommits });
        }
    };

	const pinCommit = (commit: Omit<PinnedCommit, 'pinnedAt'>) => {
        if (pinnedCommits.find((c) => c.hash === commit.hash)) {
            return;
        }
        persistCommits([{ ...commit, pinnedAt: Date.now() }, ...pinnedCommits]);
	};

	const unpinCommit = (hash: string) => {
		persistCommits(pinnedCommits.filter((c) => c.hash !== hash));
	};

	const updateNote = (hash: string, note: string) => {
		persistCommits(pinnedCommits.map((c) => (c.hash === hash ? { ...c, note } : c)));
	};

	const isPinned = (hash: string) => {
		return pinnedCommits.some((c) => c.hash === hash);
	};

	return {
		pinnedCommits,
		pinCommit,
		unpinCommit,
		updateNote,
		isPinned,
	};
}

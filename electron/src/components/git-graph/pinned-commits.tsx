/**
 * Pinned Commits
 * Save and manage favorite/important commits
 */

import {
	GitBranch,
	MessageSquare,
	MoreHorizontal,
	Pin,
	PinOff,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

export interface PinnedCommit {
	hash: string;
	message: string;
	author: string;
	date: string;
	branch?: string | undefined;
	pinnedAt: number;
	note?: string | undefined;
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
			<DialogContent className='flex max-h-[80vh] max-w-xl flex-col gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<Pin className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>Pinned commits</span>
						<span className='ml-1 rounded-full border border-border/70 bg-card/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/85'>
							{pinnedCommits.length}
						</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Bookmarks that survive across sessions. Pin a commit to keep it within reach.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className='flex-1'>
					{sortedCommits.length === 0 ? (
						<div className='flex flex-col items-center justify-center px-4 py-12 text-center'>
							<span className='mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50'>
								<Pin className='h-4 w-4' />
							</span>
							<p className='text-[0.8125rem] font-semibold tracking-[-0.005em]'>No pinned commits yet</p>
							<p className='mt-0.5 max-w-[20rem] text-xs text-muted-foreground/85'>
								Right-click any commit and choose <span className='font-mono'>Pin commit</span>. They&rsquo;ll show up here, sorted newest first.
							</p>
						</div>
					) : (
						<ul className='divide-y divide-border/40'>
							{sortedCommits.map((commit) => (
								<li
									key={commit.hash}
									className='group/pinned relative px-5 py-3 transition-colors hover:bg-muted/30'>
									<div className='flex items-start gap-3'>
										<button
											type='button'
											className='-mx-1 -my-1 flex min-w-0 flex-1 flex-col gap-1.5 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45'
											onClick={() => { onJumpToCommit(commit.hash); }}
											title='Jump to this commit'>
											<div className='flex flex-wrap items-center gap-1.5 leading-none'>
												<span className='inline-flex items-center rounded-md border border-border/70 bg-card/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground/85'>
													{commit.hash.slice(0, 8)}
												</span>
												{commit.branch && (
													<span className='inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground/85'>
														<GitBranch className='h-2.5 w-2.5' />
														{commit.branch}
													</span>
												)}
											</div>
											<p className='line-clamp-2 text-[12.5px] font-medium leading-snug tracking-[-0.005em]'>
												{commit.message}
											</p>
											<div className='flex items-center gap-2 text-[11px] text-muted-foreground/85'>
												<span className='truncate'>{commit.author}</span>
												<span aria-hidden className='inline-block h-0.5 w-0.5 rounded-full bg-muted-foreground/50' />
												<span className='tabular-nums'>{new Date(commit.date).toLocaleDateString()}</span>
											</div>
										</button>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant='ghost'
													size='sm'
													className='h-6 w-6 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/pinned:opacity-100'
													aria-label='More actions'>
													<MoreHorizontal className='h-4 w-4' />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align='end' className='min-w-[12rem]'>
												<DropdownMenuItem onClick={() => { onJumpToCommit(commit.hash); }} className='gap-2'>
													<GitBranch className='h-3.5 w-3.5' />
													Jump to commit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => {
														setEditingNote(commit.hash);
														setNoteText(commit.note ?? '');
													}}
													className='gap-2'>
													<MessageSquare className='h-3.5 w-3.5' />
													{commit.note ? 'Edit note' : 'Add note'}
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => { onUnpin(commit.hash); }}
													className='gap-2 text-destructive'>
													<PinOff className='h-3.5 w-3.5' />
													Unpin commit
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>

									{commit.note && editingNote !== commit.hash && (
										<p className='mt-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/85'>
											<span className='mr-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
												Note
											</span>
											{commit.note}
										</p>
									)}

									{editingNote === commit.hash && (
										<div className='mt-2 flex gap-1.5'>
											<Input
												type='text'
												value={noteText}
												onChange={(e) => { setNoteText(e.target.value); }}
												placeholder='Add a note…'
												className='h-7 flex-1 text-[11px]'
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
												size='sm'
												className='h-7 px-2 text-[11px]'
												onClick={() => { handleSaveNote(commit.hash); }}>
												Save
											</Button>
											<Button
												variant='outline'
												size='sm'
												className='h-7 px-2 text-[11px]'
												onClick={() => {
													setEditingNote(null);
													setNoteText('');
												}}>
												Cancel
											</Button>
										</div>
									)}
								</li>
							))}
						</ul>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

// Hook for managing pinned commits (persisted in backend store)
// eslint-disable-next-line react-refresh/only-export-components
export function usePinnedCommits(repoId: string | null) {
	const [pinnedCommits, setPinnedCommits] = useState<PinnedCommit[]>([]);
    const utils = trpc.useUtils();
    const pinnedCommitsQuery = trpc.repo.pinnedCommits.useQuery(
        { repo: repoId ?? '' },
        { enabled: !!repoId, staleTime: 10_000 }
    );
	    const setPinnedCommitsMutation = trpc.repo.setPinnedCommits.useMutation({
	        onSuccess: async (_result, variables) => {
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

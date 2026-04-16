import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import type { CollaborationComment } from '@/components/git-graph/collaboration-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CollaborationCommentThread({
	title = 'Discussion',
	comments,
	draft,
	submitPending,
	onDraftChange,
	onSubmit,
	onDelete,
	renderCommentBadges,
	renderCommentActions,
}: {
	title?: string;
	comments: CollaborationComment[];
	draft: string;
	submitPending: boolean | undefined;
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
	onDelete: (id: string) => void;
	renderCommentBadges?: (comment: CollaborationComment) => ReactNode;
	renderCommentActions?: (comment: CollaborationComment) => ReactNode;
}) {
	const orderedComments = useMemo(() => [...comments].sort((left, right) => left.createdAt - right.createdAt), [comments]);

	return (
		<div className='mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3'>
			<div className='mb-3 flex items-center justify-between gap-3'>
				<div className='flex items-center gap-2'>
					<MessageSquare className='h-4 w-4 text-muted-foreground' />
					<p className='text-sm font-medium'>{title}</p>
				</div>
				<Badge variant='outline' className='tabular-nums'>
					{orderedComments.length}
				</Badge>
			</div>
			<div className='space-y-3'>
				{orderedComments.length === 0 ? (
					<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs leading-5 text-muted-foreground'>
						No comments yet. Use this thread for review notes, takeover context, or follow-up tasks.
					</div>
				) : (
					orderedComments.map((comment) => (
						<div key={comment.id} className='rounded-xl border border-border/60 bg-background/85 p-3'>
							<div className='flex items-start justify-between gap-3'>
								<div className='min-w-0'>
									<div className='flex flex-wrap items-center gap-2'>
										<p className='text-sm font-medium'>{comment.author}</p>
										<Badge variant='outline' className='text-[10px]'>
											{formatDistanceToNow(comment.updatedAt, { addSuffix: true })}
										</Badge>
										{renderCommentBadges?.(comment)}
									</div>
									<p className='mt-2 text-sm leading-6 text-foreground/90'>{comment.body}</p>
								</div>
								<div className='flex shrink-0 items-center gap-1'>
									{renderCommentActions?.(comment)}
									<Button
										variant='ghost'
										size='sm'
										className='h-10 w-10 p-0'
										aria-label={`Delete comment by ${comment.author}`}
										onClick={() => onDelete(comment.id)}>
										<Trash2 className='h-4 w-4' />
									</Button>
								</div>
							</div>
						</div>
					))
				)}
				<div className='space-y-2'>
					<Textarea
						value={draft}
						onChange={(event) => onDraftChange(event.target.value)}
						placeholder='Leave context for teammates, reviewers, or your next session'
						className='min-h-24 resize-none text-sm'
					/>
					<div className='flex justify-end'>
						<Button className='h-10 min-w-28' disabled={submitPending || !draft.trim()} onClick={onSubmit}>
							<Send className='mr-1.5 h-4 w-4' />
							Add Comment
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default CollaborationCommentThread;

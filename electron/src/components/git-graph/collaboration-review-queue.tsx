import { ExternalLink, GitPullRequest } from 'lucide-react';

import { CollaborationAssignmentPanel } from '@/components/git-graph/collaboration-center-assignment';
import { CollaborationCommentThread } from '@/components/git-graph/collaboration-comment-thread';
import type {
	CollaborationAssignment,
	CollaborationComment,
	CollaborationMemberProfile,
} from '@/components/git-graph/collaboration-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function renderProviderAssignmentBadge(assignment: CollaborationAssignment) {
	if (!assignment.providerSync) {
		return null;
	}
	return (
		<Badge variant='outline' className='text-[10px] capitalize'>
			{assignment.providerSync.provider} · {assignment.providerSync.reviewerStatus.replace(/-/g, ' ')}
		</Badge>
	);
}

export interface CollaborationReviewQueueItem {
	id: string;
	targetId: string;
	provider: string;
	number: number;
	title: string;
	baseRef: string;
	headRef: string;
	webUrl: string;
	author: string;
	draft: boolean;
	assignments: CollaborationAssignment[];
	comments: CollaborationComment[];
}

export function CollaborationReviewQueueSection({
	items,
	members,
	assignmentDrafts,
	commentDrafts,
	pending,
	onOpen,
	onCommentDraftChange,
	onCommentSubmit,
	onCommentDelete,
	onAssignmentAssigneeChange,
	onAssignmentNoteChange,
	onAssignmentCreate,
	onAssignmentStatusChange,
	onAssignmentDelete,
}: {
	items: CollaborationReviewQueueItem[];
	members: CollaborationMemberProfile[];
	assignmentDrafts: Record<string, { assigneeId: string; note: string }>;
	commentDrafts: Record<string, string>;
	pending: boolean | undefined;
	onOpen: (url: string) => void;
	onCommentDraftChange: (targetKey: string, value: string) => void;
	onCommentSubmit: (targetId: string) => void;
	onCommentDelete: (id: string) => void;
	onAssignmentAssigneeChange: (targetKey: string, value: string) => void;
	onAssignmentNoteChange: (targetKey: string, value: string) => void;
	onAssignmentCreate: (targetId: string) => void;
	onAssignmentStatusChange: (assignmentId: string, status: CollaborationAssignment['status']) => void;
	onAssignmentDelete: (assignmentId: string) => void;
}) {
	return (
		<Card className='border-border/70'>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-sm'>
					<GitPullRequest className='h-4 w-4' />
					Review Queue
				</CardTitle>
				<CardDescription>
					Shared pull requests with explicit reviewer ownership and discussion.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4'>
				{items.length === 0 ? (
					<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
						No shared review requests yet. Create one from the Pull Requests review workspace.
					</div>
				) : (
					items.map((item) => {
						const targetKey = `pull-request:${item.targetId}`;
						return (
							<div key={item.id} className='rounded-2xl border border-border/60 bg-background/85 p-4'>
								<div className='flex flex-wrap items-start justify-between gap-3'>
									<div className='min-w-0'>
										<div className='flex flex-wrap items-center gap-2'>
											<p className='truncate text-sm font-medium'>
												#{item.number} {item.title}
											</p>
											<Badge variant='outline'>{item.provider}</Badge>
											{item.draft && <Badge variant='secondary'>Draft</Badge>}
										</div>
										<p className='mt-2 text-xs text-muted-foreground'>
											{item.headRef} → {item.baseRef} · author {item.author}
										</p>
									</div>
									<Button variant='outline' size='sm' className='h-10' onClick={() => onOpen(item.webUrl)}>
										<ExternalLink className='mr-1.5 h-4 w-4' />
										Open PR
									</Button>
								</div>

								<CollaborationAssignmentPanel
									title='Reviewers'
									assignments={item.assignments}
									members={members}
									selectedAssigneeId={assignmentDrafts[targetKey]?.assigneeId ?? ''}
									noteDraft={assignmentDrafts[targetKey]?.note ?? ''}
									pending={pending}
									onAssigneeChange={(value) => onAssignmentAssigneeChange(targetKey, value)}
									onNoteChange={(value) => onAssignmentNoteChange(targetKey, value)}
									onCreate={() => onAssignmentCreate(item.targetId)}
									onStatusChange={onAssignmentStatusChange}
									onDelete={onAssignmentDelete}
									renderAssignmentBadges={renderProviderAssignmentBadge}
								/>

								<CollaborationCommentThread
									title='Review Thread'
									comments={item.comments}
									draft={commentDrafts[targetKey] ?? ''}
									submitPending={pending}
									onDraftChange={(value) => onCommentDraftChange(targetKey, value)}
									onSubmit={() => onCommentSubmit(item.targetId)}
									onDelete={onCommentDelete}
								/>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}

export default CollaborationReviewQueueSection;

import { ClipboardCheck, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import type { CollaborationAssignment, CollaborationMemberProfile } from '@/components/git-graph/collaboration-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_LABELS: Record<CollaborationAssignment['status'], string> = {
	open: 'Open',
	'in-progress': 'In Progress',
	done: 'Done',
	blocked: 'Blocked',
};

export function CollaborationAssignmentPanel({
	title = 'Assignments',
	assignments,
	members,
	selectedAssigneeId,
	noteDraft,
	pending,
	onAssigneeChange,
	onNoteChange,
	onCreate,
	onStatusChange,
	onDelete,
	renderAssignmentBadges,
}: {
	title?: string;
	assignments: CollaborationAssignment[];
	members: CollaborationMemberProfile[];
	selectedAssigneeId: string;
	noteDraft: string;
	pending: boolean | undefined;
	onAssigneeChange: (value: string) => void;
	onNoteChange: (value: string) => void;
	onCreate: () => void;
	onStatusChange: (assignmentId: string, status: CollaborationAssignment['status']) => void;
	onDelete: (assignmentId: string) => void;
	renderAssignmentBadges?: (assignment: CollaborationAssignment) => ReactNode;
}) {
	return (
		<div className='mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3'>
			<div className='mb-3 flex items-center justify-between gap-3'>
				<div className='flex items-center gap-2'>
					<ClipboardCheck className='h-4 w-4 text-muted-foreground' />
					<p className='text-sm font-medium'>{title}</p>
				</div>
				<Badge variant='outline' className='tabular-nums'>
					{assignments.length}
				</Badge>
			</div>
			<div className='space-y-3'>
				{assignments.length === 0 ? (
					<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs leading-5 text-muted-foreground'>
						No assignments yet. Assign this handoff or patch to make ownership visible.
					</div>
				) : (
					assignments.map((assignment) => (
						<div key={assignment.id} className='rounded-xl border border-border/60 bg-background/85 p-3'>
							<div className='flex items-start justify-between gap-3'>
								<div className='min-w-0'>
									<div className='flex flex-wrap items-center gap-2'>
										<p className='text-sm font-medium'>{assignment.assigneeName}</p>
										<Badge variant='outline'>{STATUS_LABELS[assignment.status]}</Badge>
										{renderAssignmentBadges?.(assignment)}
									</div>
									<p className='mt-2 text-xs text-muted-foreground'>Created by {assignment.createdBy}</p>
									{assignment.note && <p className='mt-2 text-sm leading-6 text-foreground/90'>{assignment.note}</p>}
									<div className='mt-3'>
										<select
											className='border-border bg-background h-10 rounded-md border px-3 text-sm'
											value={assignment.status}
											onChange={(event) => onStatusChange(assignment.id, event.target.value as CollaborationAssignment['status'])}>
											{Object.entries(STATUS_LABELS).map(([value, label]) => (
												<option key={value} value={value}>
													{label}
												</option>
											))}
										</select>
									</div>
								</div>
								<Button
									variant='ghost'
									size='sm'
									className='h-10 w-10 shrink-0 p-0'
									aria-label={`Delete assignment for ${assignment.assigneeName}`}
									onClick={() => onDelete(assignment.id)}>
									<Trash2 className='h-4 w-4' />
								</Button>
							</div>
						</div>
					))
				)}
				<div className='grid gap-2 md:grid-cols-[0.9fr_1.1fr_auto]'>
					<select
						className='border-border bg-background h-10 rounded-md border px-3 text-sm'
						value={selectedAssigneeId}
						onChange={(event) => onAssigneeChange(event.target.value)}>
						<option value=''>Assign to…</option>
						{members.map((member) => (
							<option key={member.id} value={member.id}>
								{member.displayName} · {member.role}
							</option>
						))}
					</select>
					<Input
						value={noteDraft}
						onChange={(event) => onNoteChange(event.target.value)}
						placeholder='Optional handoff note or acceptance criteria'
					/>
					<Button className='h-10 min-w-28' disabled={pending || !selectedAssigneeId} onClick={onCreate}>
						Assign
					</Button>
				</div>
			</div>
		</div>
	);
}

export default CollaborationAssignmentPanel;

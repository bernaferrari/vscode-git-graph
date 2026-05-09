import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, Trash2, Users2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
	CollaborationReviewQueueSection,
	type CollaborationReviewQueueItem,
} from '@/components/git-graph/collaboration-review-queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type {
	CollaborationAssignment,
	CollaborationMemberProfile,
	CollaborationRemoteActivityEntry,
	CollaborationRemotePresence,
	CollaborationTeamProfile,
	CollaborationTeamInsights,
} from '@/components/git-graph/collaboration-types';

function PresenceCard({ entry }: { entry: CollaborationRemotePresence }) {
	return (
		<div className='rounded-2xl border border-border/60 bg-background/85 p-3'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='text-sm font-medium'>{entry.actor}</p>
						{entry.deviceLabel && <Badge variant='outline'>{entry.deviceLabel}</Badge>}
					</div>
					<p className='mt-2 text-xs text-muted-foreground'>
						{entry.branch ? `${entry.branch} · ` : ''}
						{entry.repo ?? 'No repo context'}
					</p>
					{entry.status && <p className='mt-2 text-sm leading-5 text-foreground/85'>{entry.status}</p>}
				</div>
				<Badge variant='outline' className='shrink-0'>
					{formatDistanceToNow(entry.lastSeenAt, { addSuffix: true })}
				</Badge>
			</div>
		</div>
	);
}

function TeamActivityItem({ entry }: { entry: CollaborationRemoteActivityEntry }) {
	return (
		<div className='rounded-2xl border border-border/60 bg-background/85 p-3'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='text-sm font-medium'>{entry.title}</p>
						{entry.actor && <Badge variant='outline'>{entry.actor}</Badge>}
					</div>
					{entry.description && <p className='mt-2 text-sm leading-6 text-muted-foreground'>{entry.description}</p>}
				</div>
				<Badge
					variant='outline'
					className={cn(
						'shrink-0',
						entry.status === 'success' && 'border-[color-mix(in_oklch,var(--success)_35%,transparent)] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
						entry.status === 'failed' && 'border-[color-mix(in_oklch,var(--warning)_35%,transparent)] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'
					)}>
					{formatDistanceToNow(entry.timestamp, { addSuffix: true })}
				</Badge>
			</div>
		</div>
	);
}

function InsightsCard({ label, value, hint }: { label: string; value: string; hint: string }) {
	return (
		<div className='rounded-2xl border border-border/60 bg-background/85 p-3'>
			<p className='text-[11px] uppercase tracking-[0.18em] text-muted-foreground'>{label}</p>
			<p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
			<p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p>
		</div>
	);
}

function TeamProfileCard({
	profile,
	disabled,
	onSave,
}: {
	profile: CollaborationTeamProfile | null;
	disabled: boolean | undefined;
	onSave: (profile: Omit<CollaborationTeamProfile, 'updatedAt'>) => void;
}) {
	const [draft, setDraft] = useState({
		organizationId: profile?.organizationId ?? '',
		organizationName: profile?.organizationName ?? '',
		teamId: profile?.teamId ?? '',
		teamName: profile?.teamName ?? '',
		defaultPermissionLevel: profile?.defaultPermissionLevel ?? 'member',
	});

	useEffect(() => {
		setDraft({
			organizationId: profile?.organizationId ?? '',
			organizationName: profile?.organizationName ?? '',
			teamId: profile?.teamId ?? '',
			teamName: profile?.teamName ?? '',
			defaultPermissionLevel: profile?.defaultPermissionLevel ?? 'member',
		});
	}, [profile]);

	return (
		<Card className='border-border/70'>
			<CardHeader>
				<CardTitle className='text-sm'>Team Structure</CardTitle>
				<CardDescription>Define the shared organization and team context used by the collaboration backend.</CardDescription>
			</CardHeader>
			<CardContent className='space-y-3'>
				<div className='grid gap-3 md:grid-cols-2'>
					<Input value={draft.organizationId} placeholder='Organization ID' onChange={(event) => { setDraft((current) => ({ ...current, organizationId: event.target.value })); }} />
					<Input value={draft.organizationName} placeholder='Organization name' onChange={(event) => { setDraft((current) => ({ ...current, organizationName: event.target.value })); }} />
				</div>
				<div className='grid gap-3 md:grid-cols-2'>
					<Input value={draft.teamId} placeholder='Team ID' onChange={(event) => { setDraft((current) => ({ ...current, teamId: event.target.value })); }} />
					<Input value={draft.teamName} placeholder='Team name' onChange={(event) => { setDraft((current) => ({ ...current, teamName: event.target.value })); }} />
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<select
						className='border-border bg-background h-10 rounded-md border px-3 text-sm'
						value={draft.defaultPermissionLevel}
						onChange={(event) => { setDraft((current) => ({ ...current, defaultPermissionLevel: event.target.value as typeof current.defaultPermissionLevel })); }}>
						<option value='owner'>Owner default</option>
						<option value='manager'>Manager default</option>
						<option value='member'>Member default</option>
						<option value='observer'>Observer default</option>
					</select>
					<Button
						className='h-10'
						disabled={
							disabled ||
							!draft.organizationId.trim() ||
							!draft.organizationName.trim() ||
							!draft.teamId.trim() ||
							!draft.teamName.trim()
						}
						onClick={() =>
							{ onSave({
								organizationId: draft.organizationId.trim(),
								organizationName: draft.organizationName.trim(),
								teamId: draft.teamId.trim(),
								teamName: draft.teamName.trim(),
								defaultPermissionLevel: draft.defaultPermissionLevel,
							}); }
						}>
						Save Team Profile
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function MemberCard({
	member,
	disabled,
	onRoleChange,
	onPermissionChange,
	onRemove,
}: {
	member: CollaborationMemberProfile;
	disabled: boolean | undefined;
	onRoleChange: (memberId: string, role: CollaborationMemberProfile['role']) => void;
	onPermissionChange: (memberId: string, permissionLevel: CollaborationMemberProfile['permissionLevel']) => void;
	onRemove: (memberId: string) => void;
}) {
	return (
		<div className='rounded-2xl border border-border/60 bg-background/85 p-3'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='text-sm font-medium'>{member.displayName}</p>
						<Badge variant='outline'>{member.role}</Badge>
					</div>
					{member.email && <p className='mt-2 text-xs text-muted-foreground'>{member.email}</p>}
					{member.deviceLabel && <p className='mt-1 text-xs text-muted-foreground'>{member.deviceLabel}</p>}
					{(member.organizationName || member.teamName) && (
						<p className='mt-1 text-xs text-muted-foreground'>
							{member.organizationName ?? 'Org'} · {member.teamName ?? 'Team'}
						</p>
					)}
					<div className='mt-3 flex items-center gap-2'>
						<select
							className='border-border bg-background h-9 rounded-md border px-2 text-xs'
							value={member.role}
							disabled={disabled}
							onChange={(event) => { onRoleChange(member.id, event.target.value as CollaborationMemberProfile['role']); }}>
							<option value='developer'>Developer</option>
							<option value='reviewer'>Reviewer</option>
							<option value='lead'>Lead</option>
							<option value='qa'>QA</option>
						</select>
						<select
							className='border-border bg-background h-9 rounded-md border px-2 text-xs'
							value={member.permissionLevel}
							disabled={disabled}
							onChange={(event) => { onPermissionChange(member.id, event.target.value as CollaborationMemberProfile['permissionLevel']); }}>
							<option value='owner'>Owner</option>
							<option value='manager'>Manager</option>
							<option value='member'>Member</option>
							<option value='observer'>Observer</option>
						</select>
						<Button
							variant='ghost'
							size='sm'
							className='h-9 px-2 text-xs'
							disabled={disabled}
							onClick={() => { onRemove(member.id); }}>
							<Trash2 className='mr-1 h-3.5 w-3.5' />
							Remove
						</Button>
					</div>
				</div>
				<Badge variant='outline' className='shrink-0'>
					{formatDistanceToNow(member.lastSeenAt, { addSuffix: true })}
				</Badge>
			</div>
		</div>
	);
}

export function CollaborationTeamTab({
	teamProfile,
	members,
	insights,
	presence,
	remoteActivity,
	reviewQueue,
	assignmentDrafts,
	commentDrafts,
	loadingMembers,
	loadingPresence,
	loadingRemoteActivity,
	memberError,
	presenceError,
	activityError,
	mutationPending,
	onRefresh,
	onMemberRoleChange,
	onMemberPermissionChange,
	onMemberRemove,
	onTeamProfileSave,
	onOpenReviewUrl,
	onCommentDraftChange,
	onCommentSubmit,
	onCommentDelete,
	onAssignmentAssigneeChange,
	onAssignmentNoteChange,
	onAssignmentCreate,
	onAssignmentStatusChange,
	onAssignmentDelete,
}: {
	teamProfile: CollaborationTeamProfile | null;
	members: CollaborationMemberProfile[];
	insights: CollaborationTeamInsights | null;
	presence: CollaborationRemotePresence[];
	remoteActivity: CollaborationRemoteActivityEntry[];
	reviewQueue: CollaborationReviewQueueItem[];
	assignmentDrafts: Record<string, { assigneeId: string; note: string }>;
	commentDrafts: Record<string, string>;
	loadingMembers: boolean;
	loadingPresence: boolean;
	loadingRemoteActivity: boolean;
	memberError: string | null;
	presenceError: string | null;
	activityError: string | null;
	mutationPending?: boolean;
	onRefresh: () => void;
	onMemberRoleChange: (memberId: string, role: CollaborationMemberProfile['role']) => void;
	onMemberPermissionChange: (memberId: string, permissionLevel: CollaborationMemberProfile['permissionLevel']) => void;
	onMemberRemove: (memberId: string) => void;
	onTeamProfileSave: (profile: Omit<CollaborationTeamProfile, 'updatedAt'>) => void;
	onOpenReviewUrl: (url: string) => void;
	onCommentDraftChange: (targetKey: string, value: string) => void;
	onCommentSubmit: (targetId: string) => void;
	onCommentDelete: (id: string) => void;
	onAssignmentAssigneeChange: (targetKey: string, value: string) => void;
	onAssignmentNoteChange: (targetKey: string, value: string) => void;
	onAssignmentCreate: (targetId: string) => void;
	onAssignmentStatusChange: (assignmentId: string, status: CollaborationAssignment['status']) => void;
	onAssignmentDelete: (assignmentId: string) => void;
}) {
	const reviewDashboard = useMemo(() => {
		const totalAssignments = reviewQueue.flatMap((item) => item.assignments);
		const unassignedReviews = reviewQueue.filter((item) => item.assignments.length === 0).length;
		const staleAssignments = totalAssignments.filter((assignment) => Date.now() - assignment.updatedAt > 1000 * 60 * 60 * 24 * 2).length;
		const reviewerLoad = members
			.map((member) => ({
				member,
				load: totalAssignments.filter((assignment) => assignment.assigneeId === member.id && assignment.status !== 'done').length,
			}))
			.filter((entry) => entry.load > 0)
			.sort((left, right) => right.load - left.load)
			.slice(0, 5);
		return { unassignedReviews, staleAssignments, reviewerLoad };
	}, [members, reviewQueue]);

	return (
		<TabsContent value='team' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='space-y-5 p-5'>
					<div className='grid gap-4 lg:grid-cols-4'>
						<InsightsCard
							label='Members'
							value={String(insights?.memberCount ?? members.length)}
							hint='Registered project collaborators'
						/>
						<InsightsCard
							label='Owners + Managers'
							value={String((insights?.ownerCount ?? 0) + (insights?.managerCount ?? 0))}
							hint='Higher-permission collaborators coordinating the shared workflow'
						/>
						<InsightsCard
							label='Live Presence'
							value={String(insights?.activePresenceCount ?? presence.length)}
							hint='Machines currently publishing presence'
						/>
						<InsightsCard
							label='Blocked'
							value={String(insights?.blockedAssignments ?? 0)}
							hint='Assignments currently blocked'
						/>
						<InsightsCard
							label='Open Work'
							value={String((insights?.openAssignments ?? 0) + (insights?.inProgressAssignments ?? 0))}
							hint='Open and in-progress assignments'
						/>
					</div>
					<div className='grid gap-4 lg:grid-cols-3'>
						<InsightsCard
							label='Unassigned Reviews'
							value={String(reviewDashboard.unassignedReviews)}
							hint='Shared pull requests that still have no reviewer owner'
						/>
						<InsightsCard
							label='Stale Review Work'
							value={String(reviewDashboard.staleAssignments)}
							hint='Assignments untouched for more than two days'
						/>
						<InsightsCard
							label='Top Reviewer Load'
							value={reviewDashboard.reviewerLoad[0] ? `${reviewDashboard.reviewerLoad[0].member.displayName} · ${String(reviewDashboard.reviewerLoad[0].load)}` : 'Balanced'}
							hint='Highest active review load across the current team'
						/>
					</div>

					<div className='grid gap-5 xl:grid-cols-[0.92fr_1.08fr]'>
					<div className='space-y-5'>
					<TeamProfileCard profile={teamProfile} disabled={mutationPending} onSave={onTeamProfileSave} />
					<Card className='border-border/70'>
						<CardHeader>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<CardTitle className='flex items-center gap-2 text-sm'>
										<Users2 className='h-4 w-4' />
										Active Collaborators
									</CardTitle>
									<CardDescription>
										Live project presence from connected machines and teammates.
									</CardDescription>
								</div>
								<Button variant='outline' className='h-10' onClick={onRefresh}>
									<RefreshCw className='mr-1.5 h-4 w-4' />
									Refresh
								</Button>
							</div>
						</CardHeader>
						<CardContent className='space-y-3'>
							{presenceError ? (
								<div className='rounded-xl border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] px-3 py-4 text-sm leading-6 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
									{presenceError}
								</div>
							) : loadingPresence && presence.length === 0 ? (
								<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
									Loading live presence…
								</div>
							) : presence.length === 0 ? (
								<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
									No active collaborators are publishing presence for this project yet.
								</div>
							) : (
								presence.map((entry) => <PresenceCard key={entry.id} entry={entry} />)
							)}
							</CardContent>
						</Card>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='text-sm'>Team Roster</CardTitle>
								<CardDescription>
									Registered collaborators for this shared project endpoint.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								{memberError ? (
									<div className='rounded-xl border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] px-3 py-4 text-sm leading-6 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
										{memberError}
									</div>
								) : loadingMembers && members.length === 0 ? (
									<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
										Loading team roster…
									</div>
								) : members.length === 0 ? (
									<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
										No members registered yet. Publish a collaboration session from the sync settings identity.
									</div>
							) : (
								members.map((member) => (
									<MemberCard
										key={member.id}
										member={member}
										disabled={mutationPending}
										onRoleChange={onMemberRoleChange}
										onPermissionChange={onMemberPermissionChange}
										onRemove={onMemberRemove}
									/>
								))
							)}
							</CardContent>
						</Card>
						</div>

						<CollaborationReviewQueueSection
							items={reviewQueue}
							members={members}
							assignmentDrafts={assignmentDrafts}
							commentDrafts={commentDrafts}
							pending={mutationPending}
							onOpen={onOpenReviewUrl}
							onCommentDraftChange={onCommentDraftChange}
							onCommentSubmit={onCommentSubmit}
							onCommentDelete={onCommentDelete}
							onAssignmentAssigneeChange={onAssignmentAssigneeChange}
							onAssignmentNoteChange={onAssignmentNoteChange}
							onAssignmentCreate={onAssignmentCreate}
							onAssignmentStatusChange={onAssignmentStatusChange}
							onAssignmentDelete={onAssignmentDelete}
						/>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='text-sm'>Remote Team Activity</CardTitle>
								<CardDescription>
								Shared project activity emitted by the collaboration service.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-3'>
							{activityError ? (
								<div className='rounded-xl border border-[color-mix(in_oklch,var(--warning)_35%,transparent)] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] px-3 py-4 text-sm leading-6 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
									{activityError}
								</div>
							) : loadingRemoteActivity && remoteActivity.length === 0 ? (
								<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
									Loading remote team activity…
								</div>
							) : remoteActivity.length === 0 ? (
								<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
									No shared team activity has been recorded for this project yet.
								</div>
							) : (
								remoteActivity.map((entry) => <TeamActivityItem key={entry.id} entry={entry} />)
							)}
							</CardContent>
						</Card>
					</div>
				</div>
				</ScrollArea>
			</TabsContent>
		);
}

import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { appStore, instanceStore } from '@/app/backend/store';
import { getCollaborationReviewRootTargetId, isSameCollaborationReviewTarget, parseCollaborationReviewTargetId } from '@/lib/collaboration-review-targets';

const MAX_WORKSPACE_SHARES = 40;
const MAX_PATCH_SHELF_ITEMS = 60;
const MAX_COLLABORATION_COMMENTS = 400;
const MAX_COLLABORATION_ASSIGNMENTS = 240;
const MAX_COLLABORATION_ACTIVITY = 500;

export const collaborationWorkspaceShareRepoSchema = z.object({
	path: z.string().min(1),
	name: z.string().min(1),
	head: z.string().nullable(),
	headSha: z.string().nullable(),
	lastCommitAt: z.number().nullable(),
	dirtyCount: z.number().int().nonnegative(),
	openPullRequests: z.number().int().nonnegative().nullable(),
	needsAttention: z.boolean(),
	deepLink: z.string().min(1),
});

export const collaborationWorkspaceShareSchema = z.object({
	id: z.string().min(1),
	workspaceId: z.string().min(1),
	name: z.string().min(1),
	note: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
	repos: z.array(collaborationWorkspaceShareRepoSchema),
});

export const collaborationPatchShareSchema = z.object({
	id: z.string().min(1),
	repo: z.string().min(1),
	name: z.string().min(1),
	baseRef: z.string().min(1),
	headRef: z.string().min(1),
	summary: z.string().min(1),
	patch: z.string(),
	fileCount: z.number().int().nonnegative(),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	createdAt: z.number(),
});

export const collaborationCommentTargetSchema = z.enum(['workspace-share', 'patch-share', 'pull-request', 'pull-request-file']);
export const collaborationCommentProviderSchema = z.enum(['github', 'gitlab', 'bitbucket', 'azure']);
export const collaborationCommentSyncStatusSchema = z.enum(['pending', 'synced', 'failed']);
export const collaborationCommentProviderSyncSchema = z.object({
	status: collaborationCommentSyncStatusSchema,
	provider: collaborationCommentProviderSchema,
	remoteCommentId: z.string().min(1).optional(),
	remoteThreadId: z.string().min(1).optional(),
	remoteThreadStatus: z.enum(['open', 'resolved']).optional(),
	remoteUrl: z.string().min(1).optional(),
	syncedAt: z.number().optional(),
	error: z.string().optional(),
});

export const collaborationCommentSchema = z.object({
	id: z.string().min(1),
	targetType: collaborationCommentTargetSchema,
	targetId: z.string().min(1),
	author: z.string().min(1),
	body: z.string().min(1),
	createdAt: z.number(),
	updatedAt: z.number(),
	providerSync: collaborationCommentProviderSyncSchema.optional(),
});

export const collaborationAssignmentStatusSchema = z.enum(['open', 'in-progress', 'done', 'blocked']);
export const collaborationAssignmentProviderReviewStateSchema = z.enum([
	'requested',
	'commented',
	'approved',
	'changes-requested',
	'waiting',
]);
export const collaborationAssignmentProviderSyncSchema = z.object({
	provider: collaborationCommentProviderSchema,
	reviewerId: z.string().min(1),
	reviewerName: z.string().min(1),
	reviewerStatus: collaborationAssignmentProviderReviewStateSchema,
	providerState: z.string().optional(),
	syncedAt: z.number(),
});

export const collaborationAssignmentSchema = z.object({
	id: z.string().min(1),
	targetType: collaborationCommentTargetSchema,
	targetId: z.string().min(1),
	assigneeId: z.string().min(1),
	assigneeName: z.string().min(1),
	status: collaborationAssignmentStatusSchema,
	note: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
	createdBy: z.string().min(1),
	providerSync: collaborationAssignmentProviderSyncSchema.optional(),
});

const collaborationLegacyBundleSchema = z.object({
	version: z.literal(1),
	projectId: z.string().min(1).optional(),
	exportedAt: z.number(),
	workspaceShares: z.array(collaborationWorkspaceShareSchema),
	patchShelf: z.array(collaborationPatchShareSchema),
});

export const collaborationBundleSchema = z.object({
	version: z.literal(2),
	projectId: z.string().min(1).optional(),
	exportedAt: z.number(),
	workspaceShares: z.array(collaborationWorkspaceShareSchema),
	patchShelf: z.array(collaborationPatchShareSchema),
	comments: z.array(collaborationCommentSchema).default([]),
	assignments: z.array(collaborationAssignmentSchema).default([]),
});

export const collaborationActivityEntrySchema = z.object({
	id: z.string().min(1),
	timestamp: z.number(),
	type: z.enum(['workspace-share', 'patch-share', 'bundle-export', 'bundle-import', 'remote-sync', 'comment', 'assignment']),
	action: z.enum(['created', 'deleted', 'exported', 'imported', 'pushed', 'pulled', 'roundtrip', 'failed', 'updated']),
	status: z.enum(['success', 'failed', 'info']),
	title: z.string().min(1),
	description: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	actor: z.string().optional(),
});

export type CollaborationWorkspaceShare = z.infer<typeof collaborationWorkspaceShareSchema>;
export type CollaborationPatchShare = z.infer<typeof collaborationPatchShareSchema>;
export type CollaborationComment = z.infer<typeof collaborationCommentSchema>;
export type CollaborationAssignment = z.infer<typeof collaborationAssignmentSchema>;
export type CollaborationBundle = z.infer<typeof collaborationBundleSchema>;
export type CollaborationActivityEntry = z.infer<typeof collaborationActivityEntrySchema>;
export type CollaborationCommentTarget = z.infer<typeof collaborationCommentTargetSchema>;
export type CollaborationAssignmentStatus = z.infer<typeof collaborationAssignmentStatusSchema>;
export type CollaborationCommentProviderSync = z.infer<typeof collaborationCommentProviderSyncSchema>;
export type CollaborationAssignmentProviderSync = z.infer<typeof collaborationAssignmentProviderSyncSchema>;
export interface CollaborationReviewDashboard {
	summary: {
		totalReviewTargets: number;
		openReviewTargets: number;
		unassignedReviewTargets: number;
		staleReviewTargets: number;
		unresolvedThreads: number;
		lineThreadCount: number;
	};
	statusBreakdown: Array<{
		status: CollaborationAssignmentStatus;
		count: number;
	}>;
	reviewerLoad: Array<{
		memberId: string;
		memberName: string;
		activeAssignments: number;
		completedAssignments: number;
		blockedAssignments: number;
		lastUpdatedAt: number | null;
	}>;
	activityByDay: Array<{
		date: string;
		comments: number;
		assignments: number;
	}>;
	reviewTargets: Array<{
		rootTargetId: string;
		repoKey: string | null;
		assignmentCount: number;
		commentCount: number;
		fileThreadCount: number;
		lineThreadCount: number;
		openAssignments: number;
		blockedAssignments: number;
		completedAssignments: number;
		unassigned: boolean;
		stale: boolean;
		lastActivityAt: number;
	}>;
	repositories: Array<{
		repoKey: string;
		reviewTargetCount: number;
		openReviewTargets: number;
		unassignedReviewTargets: number;
		staleReviewTargets: number;
		lineThreadCount: number;
		lastActivityAt: number;
	}>;
}

export function parseCollaborationBundle(input: unknown): CollaborationBundle {
	const legacy = collaborationLegacyBundleSchema.safeParse(input);
	if (legacy.success) {
		return {
			...legacy.data,
			version: 2,
			comments: [],
			assignments: [],
		};
	}
	return collaborationBundleSchema.parse(input);
}

export function getCollaborationState(): {
	workspaceShares: CollaborationWorkspaceShare[];
	patchShelf: CollaborationPatchShare[];
	comments: CollaborationComment[];
	assignments: CollaborationAssignment[];
} {
	return {
		workspaceShares: collaborationWorkspaceShareSchema.array().parse(instanceStore.get('collaborationWorkspaceShares') ?? []),
		patchShelf: collaborationPatchShareSchema.array().parse(instanceStore.get('collaborationPatchShelf') ?? []),
		comments: collaborationCommentSchema.array().parse(instanceStore.get('collaborationComments') ?? []),
		assignments: collaborationAssignmentSchema.array().parse(instanceStore.get('collaborationAssignments') ?? []),
	};
}

export function setCollaborationState(input: {
	workspaceShares: CollaborationWorkspaceShare[];
	patchShelf: CollaborationPatchShare[];
	comments: CollaborationComment[];
	assignments: CollaborationAssignment[];
}): void {
	const workspaceShares = [...input.workspaceShares].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_WORKSPACE_SHARES);
	const patchShelf = [...input.patchShelf].sort((left, right) => right.createdAt - left.createdAt).slice(0, MAX_PATCH_SHELF_ITEMS);
	const comments = [...input.comments].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_COLLABORATION_COMMENTS);
	const assignments = [...input.assignments].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_COLLABORATION_ASSIGNMENTS);
	instanceStore.set('collaborationWorkspaceShares', workspaceShares);
	instanceStore.set('collaborationPatchShelf', patchShelf);
	instanceStore.set('collaborationComments', comments);
	instanceStore.set('collaborationAssignments', assignments);
}

export function buildCollaborationBundle(projectId?: string): CollaborationBundle {
	const state = getCollaborationState();
	return {
		version: 2,
		...(projectId ? { projectId } : {}),
		exportedAt: Date.now(),
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: state.comments,
		assignments: state.assignments,
	};
}

export function mergeCollaborationRecords<T extends { id: string }>(current: T[], incoming: T[]): T[] {
	const next = new Map<string, T>();
	for (const item of current) {
		next.set(item.id, item);
	}
	for (const item of incoming) {
		next.set(item.id, item);
	}
	return [...next.values()];
}

export function listCollaborationComments(targetType?: CollaborationCommentTarget, targetId?: string): CollaborationComment[] {
	const comments = getCollaborationState().comments.sort((left, right) => left.createdAt - right.createdAt);
	if (!targetType || !targetId) {
		return comments;
	}
	if (targetType === 'pull-request' || targetType === 'pull-request-file') {
		return comments.filter(
			(comment) => comment.targetType === targetType && isSameCollaborationReviewTarget(comment.targetId, targetId)
		);
	}
	return comments.filter((comment) => comment.targetType === targetType && comment.targetId === targetId);
}

export function listCollaborationAssignments(targetType?: CollaborationCommentTarget, targetId?: string): CollaborationAssignment[] {
	const assignments = getCollaborationState().assignments.sort((left, right) => right.updatedAt - left.updatedAt);
	if (!targetType || !targetId) {
		return assignments;
	}
	if (targetType === 'pull-request' || targetType === 'pull-request-file') {
		return assignments.filter(
			(assignment) => assignment.targetType === targetType && isSameCollaborationReviewTarget(assignment.targetId, targetId)
		);
	}
	return assignments.filter((assignment) => assignment.targetType === targetType && assignment.targetId === targetId);
}

export function upsertCollaborationComment(input: {
	id?: string;
	targetType: CollaborationCommentTarget;
	targetId: string;
	author: string;
	body: string;
}): CollaborationComment {
	const state = getCollaborationState();
	const now = Date.now();
	const existing = input.id ? state.comments.find((comment) => comment.id === input.id) : null;
	const nextComment: CollaborationComment = {
		id: existing?.id ?? `collab-comment-${randomUUID()}`,
		targetType: input.targetType,
		targetId: input.targetId,
		author: input.author.trim(),
		body: input.body.trim(),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	};
	setCollaborationState({
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: [...state.comments.filter((comment) => comment.id !== nextComment.id), nextComment],
		assignments: state.assignments,
	});
	return nextComment;
}

export function deleteCollaborationComment(commentId: string): CollaborationComment | null {
	const state = getCollaborationState();
	const existing = state.comments.find((comment) => comment.id === commentId) ?? null;
	if (!existing) {
		return null;
	}
	setCollaborationState({
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: state.comments.filter((comment) => comment.id !== commentId),
		assignments: state.assignments,
	});
	return existing;
}

export function updateCollaborationCommentProviderSync(
	commentId: string,
	providerSync: CollaborationCommentProviderSync | null
): CollaborationComment | null {
	const state = getCollaborationState();
	const existing = state.comments.find((comment) => comment.id === commentId) ?? null;
	if (!existing) {
		return null;
	}
	const nextComment: CollaborationComment = {
		...existing,
		updatedAt: Date.now(),
		...(providerSync ? { providerSync } : {}),
		...(providerSync ? {} : { providerSync: undefined }),
	};
	setCollaborationState({
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: [...state.comments.filter((comment) => comment.id !== commentId), nextComment],
		assignments: state.assignments,
	});
	return nextComment;
}

export function upsertCollaborationAssignment(input: {
	id?: string;
	targetType: CollaborationCommentTarget;
	targetId: string;
	assigneeId: string;
	assigneeName: string;
	status: CollaborationAssignmentStatus;
	note?: string;
	createdBy: string;
	providerSync?: CollaborationAssignmentProviderSync;
}): CollaborationAssignment {
	const state = getCollaborationState();
	const now = Date.now();
	const existing = input.id ? state.assignments.find((assignment) => assignment.id === input.id) : null;
	const nextAssignment: CollaborationAssignment = {
		id: existing?.id ?? `collab-assignment-${randomUUID()}`,
		targetType: input.targetType,
		targetId: input.targetId,
		assigneeId: input.assigneeId.trim(),
		assigneeName: input.assigneeName.trim(),
		status: input.status,
		note: input.note?.trim() ?? existing?.note ?? '',
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		createdBy: existing?.createdBy ?? input.createdBy.trim(),
		...(input.providerSync ? { providerSync: input.providerSync } : existing?.providerSync ? { providerSync: existing.providerSync } : {}),
	};
	setCollaborationState({
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: state.comments,
		assignments: [...state.assignments.filter((assignment) => assignment.id !== nextAssignment.id), nextAssignment],
	});
	return nextAssignment;
}

export function deleteCollaborationAssignment(assignmentId: string): CollaborationAssignment | null {
	const state = getCollaborationState();
	const existing = state.assignments.find((assignment) => assignment.id === assignmentId) ?? null;
	if (!existing) {
		return null;
	}
	setCollaborationState({
		workspaceShares: state.workspaceShares,
		patchShelf: state.patchShelf,
		comments: state.comments,
		assignments: state.assignments.filter((assignment) => assignment.id !== assignmentId),
	});
	return existing;
}

export function listCollaborationActivity(limit: number = 100): CollaborationActivityEntry[] {
	return (instanceStore.get('collaborationActivity') ?? [])
		.map((entry) => collaborationActivityEntrySchema.safeParse(entry))
		.filter((result): result is { success: true; data: CollaborationActivityEntry } => result.success)
		.map((result) => result.data)
		.sort((left, right) => right.timestamp - left.timestamp)
		.slice(0, limit);
}

export function appendCollaborationActivity(input: {
	type: CollaborationActivityEntry['type'];
	action: CollaborationActivityEntry['action'];
	status?: CollaborationActivityEntry['status'];
	title: string;
	description?: string;
	metadata?: Record<string, unknown>;
	actor?: string;
}): CollaborationActivityEntry {
	const entry: CollaborationActivityEntry = {
		id: `collab-${randomUUID()}`,
		timestamp: Date.now(),
		type: input.type,
		action: input.action,
		status: input.status ?? 'info',
		title: input.title,
		...(input.description ? { description: input.description } : {}),
		...(input.metadata ? { metadata: input.metadata } : {}),
		...(input.actor ? { actor: input.actor } : {}),
	};
	instanceStore.set('collaborationActivity', [entry, ...listCollaborationActivity(MAX_COLLABORATION_ACTIVITY)].slice(0, MAX_COLLABORATION_ACTIVITY));
	return entry;
}

export function clearCollaborationActivity(): void {
	instanceStore.set('collaborationActivity', []);
}

function getReviewRootTargetId(targetId: string): string {
	return getCollaborationReviewRootTargetId(targetId);
}

function isLineThreadTarget(targetId: string): boolean {
	const segments = targetId.split(':');
	if (segments.length < 4) {
		return false;
	}
	const lineNumber = Number(segments.at(-1));
	const side = segments.at(-2);
	return Number.isFinite(lineNumber) && lineNumber > 0 && (side === 'old' || side === 'new' || side === 'left' || side === 'right');
}

function formatDayKey(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function buildCollaborationReviewDashboard(now: number = Date.now()): CollaborationReviewDashboard {
	const state = getCollaborationState();
	const reviewComments = state.comments.filter(
		(comment) => comment.targetType === 'pull-request' || comment.targetType === 'pull-request-file'
	);
	const reviewAssignments = state.assignments.filter(
		(assignment) => assignment.targetType === 'pull-request' || assignment.targetType === 'pull-request-file'
	);
	const reviewTargets = new Map<
		string,
		{
			rootTargetId: string;
			commentCount: number;
			fileThreadTargets: Set<string>;
			lineThreadCount: number;
			assignments: CollaborationAssignment[];
			lastActivityAt: number;
		}
	>();

	for (const comment of reviewComments) {
		const rootTargetId = getReviewRootTargetId(comment.targetId);
		const entry = reviewTargets.get(rootTargetId) ?? {
			rootTargetId,
			commentCount: 0,
			fileThreadTargets: new Set<string>(),
			lineThreadCount: 0,
			assignments: [],
			lastActivityAt: 0,
		};
		entry.commentCount += 1;
		if (comment.targetType === 'pull-request-file') {
			const fileThreadTarget = isLineThreadTarget(comment.targetId)
				? comment.targetId.split(':').slice(0, -2).join(':')
				: comment.targetId;
			entry.fileThreadTargets.add(fileThreadTarget);
			if (isLineThreadTarget(comment.targetId)) {
				entry.lineThreadCount += 1;
			}
		}
		entry.lastActivityAt = Math.max(entry.lastActivityAt, comment.updatedAt);
		reviewTargets.set(rootTargetId, entry);
	}

	for (const assignment of reviewAssignments) {
		const rootTargetId = getReviewRootTargetId(assignment.targetId);
		const entry = reviewTargets.get(rootTargetId) ?? {
			rootTargetId,
			commentCount: 0,
			fileThreadTargets: new Set<string>(),
			lineThreadCount: 0,
			assignments: [],
			lastActivityAt: 0,
		};
		entry.assignments.push(assignment);
		entry.lastActivityAt = Math.max(entry.lastActivityAt, assignment.updatedAt);
		reviewTargets.set(rootTargetId, entry);
	}

	const reviewTargetList = [...reviewTargets.values()]
		.map((entry) => {
			const openAssignments = entry.assignments.filter((assignment) => assignment.status === 'open').length;
			const blockedAssignments = entry.assignments.filter((assignment) => assignment.status === 'blocked').length;
			const completedAssignments = entry.assignments.filter((assignment) => assignment.status === 'done').length;
			const latestAssignmentAt =
				entry.assignments.length > 0 ? Math.max(...entry.assignments.map((assignment) => assignment.updatedAt)) : 0;
			const lastActivityAt = Math.max(entry.lastActivityAt, latestAssignmentAt);
			return {
				rootTargetId: entry.rootTargetId,
				repoKey: parseCollaborationReviewTargetId(entry.rootTargetId)?.repoKey ?? null,
				assignmentCount: entry.assignments.length,
				commentCount: entry.commentCount,
				fileThreadCount: entry.fileThreadTargets.size,
				lineThreadCount: entry.lineThreadCount,
				openAssignments,
				blockedAssignments,
				completedAssignments,
				unassigned: entry.assignments.length === 0,
				stale: now - lastActivityAt > 1000 * 60 * 60 * 24 * 2,
				lastActivityAt,
			};
		})
		.sort((left, right) => right.lastActivityAt - left.lastActivityAt);

	const repositories = [...reviewTargetList.reduce((accumulator, target) => {
		if (!target.repoKey) {
			return accumulator;
		}
		const existing = accumulator.get(target.repoKey) ?? {
			repoKey: target.repoKey,
			reviewTargetCount: 0,
			openReviewTargets: 0,
			unassignedReviewTargets: 0,
			staleReviewTargets: 0,
			lineThreadCount: 0,
			lastActivityAt: 0,
		};
		existing.reviewTargetCount += 1;
		existing.openReviewTargets += target.openAssignments > 0 || target.blockedAssignments > 0 || target.unassigned ? 1 : 0;
		existing.unassignedReviewTargets += target.unassigned ? 1 : 0;
		existing.staleReviewTargets += target.stale ? 1 : 0;
		existing.lineThreadCount += target.lineThreadCount;
		existing.lastActivityAt = Math.max(existing.lastActivityAt, target.lastActivityAt);
		accumulator.set(target.repoKey, existing);
		return accumulator;
	}, new Map<string, {
		repoKey: string;
		reviewTargetCount: number;
		openReviewTargets: number;
		unassignedReviewTargets: number;
		staleReviewTargets: number;
		lineThreadCount: number;
		lastActivityAt: number;
	}>()).values()].sort((left, right) => right.lastActivityAt - left.lastActivityAt);

	const reviewerBuckets = new Map<
		string,
		{
			memberId: string;
			memberName: string;
			activeAssignments: number;
			completedAssignments: number;
			blockedAssignments: number;
			lastUpdatedAt: number | null;
		}
	>();
	for (const assignment of reviewAssignments) {
		const bucket = reviewerBuckets.get(assignment.assigneeId) ?? {
			memberId: assignment.assigneeId,
			memberName: assignment.assigneeName,
			activeAssignments: 0,
			completedAssignments: 0,
			blockedAssignments: 0,
			lastUpdatedAt: null,
		};
		if (assignment.status === 'done') {
			bucket.completedAssignments += 1;
		} else {
			bucket.activeAssignments += 1;
			if (assignment.status === 'blocked') {
				bucket.blockedAssignments += 1;
			}
		}
		bucket.lastUpdatedAt = Math.max(bucket.lastUpdatedAt ?? 0, assignment.updatedAt);
		reviewerBuckets.set(assignment.assigneeId, bucket);
	}

	const statusBreakdown = (['open', 'in-progress', 'done', 'blocked'] as const).map((status) => ({
		status,
		count: reviewAssignments.filter((assignment) => assignment.status === status).length,
	}));

	const activityByDayMap = new Map<string, { comments: number; assignments: number }>();
	for (const comment of reviewComments) {
		const key = formatDayKey(comment.updatedAt);
		const entry = activityByDayMap.get(key) ?? { comments: 0, assignments: 0 };
		entry.comments += 1;
		activityByDayMap.set(key, entry);
	}
	for (const assignment of reviewAssignments) {
		const key = formatDayKey(assignment.updatedAt);
		const entry = activityByDayMap.get(key) ?? { comments: 0, assignments: 0 };
		entry.assignments += 1;
		activityByDayMap.set(key, entry);
	}
	const activityByDay = [...activityByDayMap.entries()]
		.map(([date, entry]) => ({
			date,
			comments: entry.comments,
			assignments: entry.assignments,
		}))
		.sort((left, right) => left.date.localeCompare(right.date))
		.slice(-14);

	return {
		summary: {
			totalReviewTargets: reviewTargetList.length,
			openReviewTargets: reviewTargetList.filter((target) => target.openAssignments > 0 || target.blockedAssignments > 0 || target.unassigned).length,
			unassignedReviewTargets: reviewTargetList.filter((target) => target.unassigned).length,
			staleReviewTargets: reviewTargetList.filter((target) => target.stale).length,
			unresolvedThreads: new Set(
				reviewComments
					.filter((comment) => comment.providerSync?.remoteThreadStatus !== 'resolved')
					.map((comment) =>
						comment.providerSync?.remoteThreadId
							? `${comment.targetId}:${comment.providerSync.remoteThreadId}`
							: comment.targetId
					)
			).size,
			lineThreadCount: reviewTargetList.reduce((total, target) => total + target.lineThreadCount, 0),
		},
		statusBreakdown,
		reviewerLoad: [...reviewerBuckets.values()].sort(
			(left, right) =>
				right.activeAssignments - left.activeAssignments ||
				right.blockedAssignments - left.blockedAssignments ||
				(right.lastUpdatedAt ?? 0) - (left.lastUpdatedAt ?? 0)
		),
		activityByDay,
		reviewTargets: reviewTargetList,
		repositories,
	};
}

export function setCollaborationSyncState(input: {
	lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
	lastSyncedAt?: number | null;
	lastSyncError?: string | null;
}): void {
	const current = appStore.get('collaborationSyncConfig');
	appStore.set('collaborationSyncConfig', {
		...current,
		lastSyncStatus: input.lastSyncStatus,
		lastSyncedAt: input.lastSyncedAt ?? current.lastSyncedAt,
		lastSyncError: input.lastSyncError ?? null,
	});
}

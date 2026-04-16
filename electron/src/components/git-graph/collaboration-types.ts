export type CollaborationTargetType = 'workspace-share' | 'patch-share' | 'pull-request' | 'pull-request-file';

export interface CollaborationComment {
	id: string;
	targetType: CollaborationTargetType;
	targetId: string;
	author: string;
	body: string;
	createdAt: number;
	updatedAt: number;
	providerSync?: {
		status: 'pending' | 'synced' | 'failed';
		provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
		remoteCommentId?: string;
		remoteThreadId?: string;
		remoteThreadStatus?: 'open' | 'resolved';
		remoteUrl?: string;
		syncedAt?: number;
		error?: string;
	};
}

export interface CollaborationRemotePresence {
	id: string;
	actor: string;
	deviceLabel?: string;
	repo?: string | null;
	branch?: string | null;
	status?: string | null;
	lastSeenAt: number;
}

export interface CollaborationRemoteActivityEntry {
	id: string;
	timestamp: number;
	actor?: string;
	type: 'sync' | 'comment' | 'share' | 'assignment';
	title: string;
	description?: string;
	status: 'success' | 'info' | 'failed';
}

export interface CollaborationMemberProfile {
	id: string;
	displayName: string;
	email?: string;
	role: 'developer' | 'reviewer' | 'lead' | 'qa';
	permissionLevel: 'owner' | 'manager' | 'member' | 'observer';
	organizationId?: string;
	organizationName?: string;
	teamId?: string;
	teamName?: string;
	avatarUrl?: string;
	deviceLabel?: string;
	lastSeenAt: number;
}

export interface CollaborationTeamProfile {
	organizationId: string;
	organizationName: string;
	teamId: string;
	teamName: string;
	defaultPermissionLevel: 'owner' | 'manager' | 'member' | 'observer';
	updatedAt: number;
}

export interface CollaborationAssignment {
	id: string;
	targetType: CollaborationTargetType;
	targetId: string;
	assigneeId: string;
	assigneeName: string;
	status: 'open' | 'in-progress' | 'done' | 'blocked';
	note: string;
	createdAt: number;
	updatedAt: number;
	createdBy: string;
	providerSync?: {
		provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
		reviewerId: string;
		reviewerName: string;
		reviewerStatus: 'requested' | 'commented' | 'approved' | 'changes-requested' | 'waiting';
		providerState?: string;
		syncedAt: number;
	};
}

export interface CollaborationTeamInsights {
	organizationName?: string;
	teamName?: string;
	memberCount: number;
	ownerCount: number;
	managerCount: number;
	memberPermissionCount: number;
	observerCount: number;
	activePresenceCount: number;
	openAssignments: number;
	inProgressAssignments: number;
	blockedAssignments: number;
	completedAssignments: number;
	topActors: Array<{ actor: string; count: number }>;
}

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
		status: CollaborationAssignment['status'];
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

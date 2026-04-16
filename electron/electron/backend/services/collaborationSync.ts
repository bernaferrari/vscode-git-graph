import type { z } from 'zod';

import { collaborationBundleSchema, parseCollaborationBundle } from '@/app/backend/store/collaboration';

export interface CollaborationRemoteRequest {
	endpointUrl: string;
	authToken: string;
	timeoutMs: number;
	memberId?: string | undefined;
	memberApiKey?: string | undefined;
}

export interface CollaborationSyncRequest extends CollaborationRemoteRequest {
	projectId: string;
	direction: 'push' | 'pull' | 'roundtrip';
	bundle: z.infer<typeof collaborationBundleSchema>;
	actor?: string | undefined;
}

export interface CollaborationRemoteHealth {
	ok: boolean;
	serverTime?: string;
	projectCount?: number;
	storagePath?: string;
	version?: string;
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

export interface CollaborationPresenceRequest extends CollaborationRemoteRequest {
	projectId: string;
	presence: Omit<CollaborationRemotePresence, 'lastSeenAt'>;
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

export interface CollaborationSessionRequest extends CollaborationRemoteRequest {
	projectId: string;
	member: Omit<CollaborationMemberProfile, 'lastSeenAt'>;
}

export interface CollaborationMemberMutationRequest extends CollaborationRemoteRequest {
	projectId: string;
	member: Omit<CollaborationMemberProfile, 'lastSeenAt'>;
}

export interface CollaborationMemberRemoveRequest extends CollaborationRemoteRequest {
	projectId: string;
	targetMemberId: string;
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

export interface CollaborationActivityRequest extends CollaborationRemoteRequest {
	projectId: string;
	limit?: number;
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
	topActors: Array<{
		actor: string;
		count: number;
	}>;
}

export interface CollaborationTeamProfileRequest extends CollaborationRemoteRequest {
	projectId: string;
}

export interface CollaborationTeamProfileMutationRequest extends CollaborationRemoteRequest {
	projectId: string;
	profile: Omit<CollaborationTeamProfile, 'updatedAt'>;
}

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await run(controller.signal);
	} finally {
		clearTimeout(timeout);
	}
}

function makeAuthHeaders(authToken: string): Record<string, string> {
	return authToken.trim() ? { Authorization: `Bearer ${authToken.trim()}` } : {};
}

function makeMemberHeaders(memberId?: string, memberApiKey?: string): Record<string, string> {
	return {
		...(memberId?.trim() ? { 'X-Collaboration-Member': memberId.trim() } : {}),
		...(memberApiKey?.trim() ? { 'X-Collaboration-Member-Key': memberApiKey.trim() } : {}),
	};
}

async function requestJson<T>(input: CollaborationRemoteRequest & { method?: 'GET' | 'POST'; path?: string; body?: unknown }): Promise<T> {
	return withTimeout(input.timeoutMs, async (signal) => {
		const endpoint = new URL(input.path ?? '/', input.endpointUrl);
		const response = await fetch(endpoint, {
			method: input.method ?? 'GET',
			headers: {
				Accept: 'application/json',
				...(input.body ? { 'Content-Type': 'application/json' } : {}),
				...makeAuthHeaders(input.authToken),
				...makeMemberHeaders(input.memberId, input.memberApiKey),
			},
			...(input.body ? { body: JSON.stringify(input.body) } : {}),
			signal,
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`HTTP ${String(response.status)}: ${body || response.statusText}`);
		}

		return (await response.json()) as T;
	});
}

export async function requestCollaborationSync(input: CollaborationSyncRequest): Promise<z.infer<typeof collaborationBundleSchema> | null> {
	const payload = await requestJson<{ bundle?: unknown; error?: string; ok?: boolean }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/',
		body: {
			projectId: input.projectId,
			direction: input.direction,
			bundle: input.bundle,
			actor: input.actor,
		},
	});

	if (payload.error) {
		throw new Error(payload.error);
	}
	if (input.direction === 'push') {
		return null;
	}
	if (!payload.bundle) {
		throw new Error('Remote collaboration sync did not return a bundle.');
	}
	return parseCollaborationBundle(payload.bundle);
}

export async function requestCollaborationHealth(input: CollaborationRemoteRequest): Promise<CollaborationRemoteHealth> {
	return requestJson<CollaborationRemoteHealth>(input);
}

export async function publishCollaborationPresence(input: CollaborationPresenceRequest): Promise<{ entries: CollaborationRemotePresence[] }> {
	return requestJson<{ entries: CollaborationRemotePresence[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/presence',
		body: {
			projectId: input.projectId,
			presence: input.presence,
		},
	});
}

export async function publishCollaborationSession(input: CollaborationSessionRequest): Promise<{ members: CollaborationMemberProfile[] }> {
	return requestJson<{ members: CollaborationMemberProfile[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/session',
		body: {
			projectId: input.projectId,
			member: input.member,
		},
	});
}

export async function requestCollaborationPresence(input: CollaborationActivityRequest): Promise<{ entries: CollaborationRemotePresence[] }> {
	const query = new URLSearchParams({ projectId: input.projectId });
	return requestJson<{ entries: CollaborationRemotePresence[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		path: `/presence?${query.toString()}`,
	});
}

export async function requestCollaborationMembers(input: CollaborationActivityRequest): Promise<{ members: CollaborationMemberProfile[] }> {
	const query = new URLSearchParams({ projectId: input.projectId });
	return requestJson<{ members: CollaborationMemberProfile[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		path: `/members?${query.toString()}`,
	});
}

export async function upsertCollaborationMember(input: CollaborationMemberMutationRequest): Promise<{ members: CollaborationMemberProfile[] }> {
	return requestJson<{ members: CollaborationMemberProfile[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		memberId: input.memberId,
		memberApiKey: input.memberApiKey,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/members/upsert',
		body: {
			projectId: input.projectId,
			member: input.member,
		},
	});
}

export async function removeCollaborationMember(input: CollaborationMemberRemoveRequest): Promise<{ members: CollaborationMemberProfile[] }> {
	return requestJson<{ members: CollaborationMemberProfile[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		memberId: input.memberId,
		memberApiKey: input.memberApiKey,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/members/remove',
		body: {
			projectId: input.projectId,
			memberId: input.targetMemberId,
		},
	});
}

export async function requestCollaborationRemoteActivity(input: CollaborationActivityRequest): Promise<{ entries: CollaborationRemoteActivityEntry[] }> {
	const query = new URLSearchParams({ projectId: input.projectId, limit: String(input.limit ?? 30) });
	return requestJson<{ entries: CollaborationRemoteActivityEntry[] }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		path: `/activity?${query.toString()}`,
	});
}

export async function requestCollaborationTeamInsights(input: CollaborationActivityRequest): Promise<CollaborationTeamInsights> {
	const query = new URLSearchParams({ projectId: input.projectId });
	return requestJson<CollaborationTeamInsights>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		path: `/insights?${query.toString()}`,
	});
}

export async function requestCollaborationTeamProfile(input: CollaborationTeamProfileRequest): Promise<{ profile: CollaborationTeamProfile | null }> {
	const query = new URLSearchParams({ projectId: input.projectId });
	return requestJson<{ profile: CollaborationTeamProfile | null }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		timeoutMs: input.timeoutMs,
		path: `/team?${query.toString()}`,
	});
}

export async function upsertCollaborationTeamProfile(input: CollaborationTeamProfileMutationRequest): Promise<{ profile: CollaborationTeamProfile }> {
	return requestJson<{ profile: CollaborationTeamProfile }>({
		endpointUrl: input.endpointUrl,
		authToken: input.authToken,
		memberId: input.memberId,
		memberApiKey: input.memberApiKey,
		timeoutMs: input.timeoutMs,
		method: 'POST',
		path: '/team/upsert',
		body: {
			projectId: input.projectId,
			profile: input.profile,
		},
	});
}

export function buildCollaborationEventStreamUrl(input: CollaborationActivityRequest): string {
	const endpoint = new URL('/events', input.endpointUrl);
	endpoint.searchParams.set('projectId', input.projectId);
	if (input.memberId?.trim()) {
		endpoint.searchParams.set('memberId', input.memberId.trim());
	}
	return endpoint.toString();
}

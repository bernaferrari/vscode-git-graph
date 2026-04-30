#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

interface CollaborationWorkspaceShareRepo {
	path: string;
	name: string;
	head: string | null;
	headSha: string | null;
	lastCommitAt: number | null;
	dirtyCount: number;
	openPullRequests: number | null;
	needsAttention: boolean;
	deepLink: string;
}

interface CollaborationWorkspaceShare {
	id: string;
	workspaceId: string;
	name: string;
	note: string;
	createdAt: number;
	updatedAt: number;
	repos: CollaborationWorkspaceShareRepo[];
}

interface CollaborationPatchShare {
	id: string;
	repo: string;
	name: string;
	baseRef: string;
	headRef: string;
	summary: string;
	patch: string;
	fileCount: number;
	additions: number;
	deletions: number;
	createdAt: number;
}

interface CollaborationComment {
	id: string;
	targetType: 'workspace-share' | 'patch-share' | 'pull-request' | 'pull-request-file';
	targetId: string;
	author: string;
	body: string;
	createdAt: number;
	updatedAt: number;
}

interface CollaborationAssignment {
	id: string;
	targetType: 'workspace-share' | 'patch-share' | 'pull-request' | 'pull-request-file';
	targetId: string;
	assigneeId: string;
	assigneeName: string;
	status: 'open' | 'in-progress' | 'done' | 'blocked';
	note: string;
	createdAt: number;
	updatedAt: number;
	createdBy: string;
}

interface CollaborationBundle {
	version: 2;
	projectId?: string;
	exportedAt: number;
	workspaceShares: CollaborationWorkspaceShare[];
	patchShelf: CollaborationPatchShare[];
	comments: CollaborationComment[];
	assignments: CollaborationAssignment[];
}

interface CollaborationMemberProfile {
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

interface CollaborationTeamProfile {
	organizationId: string;
	organizationName: string;
	teamId: string;
	teamName: string;
	defaultPermissionLevel: 'owner' | 'manager' | 'member' | 'observer';
	updatedAt: number;
}

interface CollaborationRemoteActivityEntry {
	id: string;
	timestamp: number;
	actor?: string;
	type: 'sync' | 'comment' | 'share' | 'assignment';
	title: string;
	description?: string;
	status: 'success' | 'info' | 'failed';
}

interface CollaborationPresenceEntry {
	id: string;
	actor: string;
	deviceLabel?: string;
	repo?: string | null;
	branch?: string | null;
	status?: string | null;
	lastSeenAt: number;
}

interface CollaborationProjectState extends CollaborationBundle {
	members: CollaborationMemberProfile[];
	teamProfile: CollaborationTeamProfile | null;
	activity: CollaborationRemoteActivityEntry[];
}

interface CollaborationRealtimeEvent {
	id: string;
	projectId: string;
	type: 'presence' | 'session' | 'sync';
	memberId?: string;
	actor?: string;
	timestamp: number;
}

interface CollaborationTeamInsights {
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

interface SyncRequestBody {
	projectId: string;
	direction: 'push' | 'pull' | 'roundtrip';
	bundle: CollaborationBundle;
	actor?: string;
}

interface PresenceRequestBody {
	projectId: string;
	presence: Omit<CollaborationPresenceEntry, 'lastSeenAt'>;
}

interface SessionRequestBody {
	projectId: string;
	member: Omit<CollaborationMemberProfile, 'lastSeenAt'>;
}

interface MemberMutationRequestBody {
	projectId: string;
	member: Omit<CollaborationMemberProfile, 'lastSeenAt'>;
}

interface MemberRemoveRequestBody {
	projectId: string;
	memberId: string;
}

interface TeamProfileMutationRequestBody {
	projectId: string;
	profile: Omit<CollaborationTeamProfile, 'updatedAt'>;
}

const DEFAULT_STORAGE = path.join(os.homedir(), '.git-graph-collaboration-sync');
const host = process.env.GIT_GRAPH_COLLAB_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.GIT_GRAPH_COLLAB_PORT || '4310', 10);
const storageDir = path.resolve(process.env.GIT_GRAPH_COLLAB_STORAGE || DEFAULT_STORAGE);
const requiredToken = process.env.GIT_GRAPH_COLLAB_TOKEN?.trim() || '';
const PRESENCE_TTL_MS = 150_000;
const MAX_ACTIVITY = 250;

function readArg(name: string): string | null {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return null;
	}
	const next = process.argv[index + 1];
	return typeof next === 'string' ? next : null;
}

const cliHost = readArg('--host');
const cliPort = readArg('--port');
const cliStorage = readArg('--storage');
const cliToken = readArg('--token');

const resolvedHost = cliHost || host;
const resolvedPort = cliPort ? Number.parseInt(cliPort, 10) : port;
const resolvedStorageDir = path.resolve(cliStorage || storageDir);
const resolvedToken = (cliToken || requiredToken).trim();
const memberKeyRegistry = new Map<string, string>(
	(process.env.GIT_GRAPH_COLLAB_MEMBER_KEYS || '')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const [memberId, ...keyParts] = entry.split(':');
			return [memberId?.trim() || '', keyParts.join(':').trim()] as const;
		})
		.filter(([memberId, key]) => Boolean(memberId) && Boolean(key))
);
const projectStreams = new Map<string, Set<http.ServerResponse>>();

function sanitizeProjectId(projectId: string): string {
	return projectId.replace(/[^a-zA-Z0-9-_]/g, '_') || 'default';
}

function mergeById<T extends { id: string }>(left: T[], right: T[]): T[] {
	const next = new Map<string, T>();
	for (const item of left) next.set(item.id, item);
	for (const item of right) next.set(item.id, item);
	return [...next.values()];
}

function normalizeBundle(input: unknown, projectId: string): CollaborationBundle {
	if (input && typeof input === 'object') {
		const candidate = input as {
			version?: number;
			exportedAt?: unknown;
			workspaceShares?: unknown;
			patchShelf?: unknown;
			comments?: unknown;
			assignments?: unknown;
		};
		if (candidate.version === 1) {
			return {
				version: 2,
				projectId,
				exportedAt: typeof candidate.exportedAt === 'number' ? candidate.exportedAt : Date.now(),
				workspaceShares: Array.isArray(candidate.workspaceShares) ? candidate.workspaceShares as CollaborationWorkspaceShare[] : [],
				patchShelf: Array.isArray(candidate.patchShelf) ? candidate.patchShelf as CollaborationPatchShare[] : [],
				comments: [],
				assignments: [],
			};
		}
		if (candidate.version === 2) {
			return {
				version: 2,
				projectId,
				exportedAt: typeof candidate.exportedAt === 'number' ? candidate.exportedAt : Date.now(),
				workspaceShares: Array.isArray(candidate.workspaceShares) ? candidate.workspaceShares as CollaborationWorkspaceShare[] : [],
				patchShelf: Array.isArray(candidate.patchShelf) ? candidate.patchShelf as CollaborationPatchShare[] : [],
				comments: Array.isArray(candidate.comments) ? candidate.comments as CollaborationComment[] : [],
				assignments: Array.isArray(candidate.assignments) ? candidate.assignments as CollaborationAssignment[] : [],
			};
		}
	}
	return {
		version: 2,
		projectId,
		exportedAt: Date.now(),
		workspaceShares: [],
		patchShelf: [],
		comments: [],
		assignments: [],
	};
}

function normalizeProjectState(input: unknown, projectId: string): CollaborationProjectState {
	if (input && typeof input === 'object') {
		const candidate = input as Partial<CollaborationProjectState>;
		const bundle = normalizeBundle(candidate, projectId);
			return {
				...bundle,
				members: Array.isArray(candidate.members)
					? candidate.members.map((member): CollaborationMemberProfile => ({
							id: typeof member.id === 'string' ? member.id : '',
							displayName: typeof member.displayName === 'string' ? member.displayName : 'Collaborator',
							...(typeof member.email === 'string' ? { email: member.email } : {}),
						role:
							member.role === 'reviewer' || member.role === 'lead' || member.role === 'qa'
								? member.role
								: 'developer',
						permissionLevel:
							member.permissionLevel === 'owner' ||
							member.permissionLevel === 'manager' ||
							member.permissionLevel === 'observer'
								? member.permissionLevel
								: 'member',
						...(typeof member.organizationId === 'string' ? { organizationId: member.organizationId } : {}),
						...(typeof member.organizationName === 'string' ? { organizationName: member.organizationName } : {}),
						...(typeof member.teamId === 'string' ? { teamId: member.teamId } : {}),
						...(typeof member.teamName === 'string' ? { teamName: member.teamName } : {}),
						...(typeof member.avatarUrl === 'string' ? { avatarUrl: member.avatarUrl } : {}),
						...(typeof member.deviceLabel === 'string' ? { deviceLabel: member.deviceLabel } : {}),
						lastSeenAt: typeof member.lastSeenAt === 'number' ? member.lastSeenAt : Date.now(),
				  })).filter((member) => Boolean(member.id))
				: [],
			teamProfile:
				candidate.teamProfile && typeof candidate.teamProfile === 'object'
					? {
							organizationId: typeof candidate.teamProfile.organizationId === 'string' ? candidate.teamProfile.organizationId : '',
							organizationName: typeof candidate.teamProfile.organizationName === 'string' ? candidate.teamProfile.organizationName : '',
							teamId: typeof candidate.teamProfile.teamId === 'string' ? candidate.teamProfile.teamId : '',
							teamName: typeof candidate.teamProfile.teamName === 'string' ? candidate.teamProfile.teamName : '',
							defaultPermissionLevel:
								candidate.teamProfile.defaultPermissionLevel === 'owner' ||
								candidate.teamProfile.defaultPermissionLevel === 'manager' ||
								candidate.teamProfile.defaultPermissionLevel === 'observer'
									? candidate.teamProfile.defaultPermissionLevel
									: 'member',
							updatedAt:
								typeof candidate.teamProfile.updatedAt === 'number' ? candidate.teamProfile.updatedAt : Date.now(),
					  }
					: null,
			activity: Array.isArray(candidate.activity) ? candidate.activity.filter(Boolean).slice(0, MAX_ACTIVITY) : [],
		};
	}
	return {
		...normalizeBundle(input, projectId),
		members: [],
		teamProfile: null,
		activity: [],
	};
}

function mergeBundles(localBundle: CollaborationBundle, remoteBundle: CollaborationProjectState, projectId: string): CollaborationBundle {
	return {
		version: 2,
		projectId,
		exportedAt: Date.now(),
		workspaceShares: mergeById(remoteBundle.workspaceShares, localBundle.workspaceShares).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40),
		patchShelf: mergeById(remoteBundle.patchShelf, localBundle.patchShelf).sort((a, b) => b.createdAt - a.createdAt).slice(0, 60),
		comments: mergeById(remoteBundle.comments, localBundle.comments).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 400),
		assignments: mergeById(remoteBundle.assignments, localBundle.assignments).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 240),
	};
}

async function ensureStorage(): Promise<void> {
	await fs.mkdir(resolvedStorageDir, { recursive: true });
}

function projectStateFile(projectId: string): string {
	return path.join(resolvedStorageDir, `${sanitizeProjectId(projectId)}.project.json`);
}

function legacyBundleFile(projectId: string): string {
	return path.join(resolvedStorageDir, `${sanitizeProjectId(projectId)}.json`);
}

function presenceFile(projectId: string): string {
	return path.join(resolvedStorageDir, `${sanitizeProjectId(projectId)}.presence.json`);
}

async function readProjectState(projectId: string): Promise<CollaborationProjectState> {
	for (const candidate of [projectStateFile(projectId), legacyBundleFile(projectId)]) {
		try {
			const raw = await fs.readFile(candidate, 'utf8');
			return normalizeProjectState(JSON.parse(raw), projectId);
		} catch {
			continue;
		}
	}
	return normalizeProjectState(null, projectId);
}

async function writeProjectState(projectId: string, state: CollaborationProjectState): Promise<void> {
	await ensureStorage();
	await fs.writeFile(projectStateFile(projectId), JSON.stringify(state, null, 2), 'utf8');
}

function prunePresence(entries: CollaborationPresenceEntry[]): CollaborationPresenceEntry[] {
	const threshold = Date.now() - PRESENCE_TTL_MS;
	return entries.filter((entry) => entry.lastSeenAt >= threshold).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

async function readPresence(projectId: string): Promise<CollaborationPresenceEntry[]> {
	try {
		const raw = await fs.readFile(presenceFile(projectId), 'utf8');
		return prunePresence(JSON.parse(raw) as CollaborationPresenceEntry[]);
	} catch {
		return [];
	}
}

async function writePresence(projectId: string, entries: CollaborationPresenceEntry[]): Promise<void> {
	await ensureStorage();
	await fs.writeFile(presenceFile(projectId), JSON.stringify(prunePresence(entries), null, 2), 'utf8');
}

async function countProjects(): Promise<number> {
	await ensureStorage();
	const entries = await fs.readdir(resolvedStorageDir);
	return entries.filter((entry) => entry.endsWith('.project.json') || (/\.json$/.test(entry) && !entry.endsWith('.presence.json'))).length;
}

function appendActivity(state: CollaborationProjectState, entry: Omit<CollaborationRemoteActivityEntry, 'id' | 'timestamp'>): CollaborationProjectState {
	return {
		...state,
		activity: [
			{ id: `activity-${String(Date.now())}-${String(Math.round(Math.random() * 10_000))}`, timestamp: Date.now(), ...entry },
			...state.activity,
		].slice(0, MAX_ACTIVITY),
	};
}

function getMemberCredentials(request: http.IncomingMessage, url: URL): { memberId: string; memberKey: string } {
	return {
		memberId:
			(String(request.headers['x-collaboration-member'] || '').trim() ||
				url.searchParams.get('memberId')?.trim() ||
				''),
		memberKey:
			(String(request.headers['x-collaboration-member-key'] || '').trim() ||
				url.searchParams.get('memberKey')?.trim() ||
				''),
	};
}

function isMemberAuthorized(request: http.IncomingMessage, url: URL, fallbackMemberId?: string): boolean {
	if (memberKeyRegistry.size === 0) {
		return true;
	}

	const { memberId, memberKey } = getMemberCredentials(request, url);
	const effectiveMemberId = memberId || fallbackMemberId || '';
	if (!effectiveMemberId) {
		return false;
	}

	return memberKeyRegistry.get(effectiveMemberId) === memberKey;
}

function sseHeaders(response: http.ServerResponse): void {
	response.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		Connection: 'keep-alive',
		'Access-Control-Allow-Origin': '*',
	});
}

function publishRealtimeEvent(projectId: string, event: Omit<CollaborationRealtimeEvent, 'id' | 'timestamp' | 'projectId'>): void {
	const streams = projectStreams.get(projectId);
	if (!streams || streams.size === 0) {
		return;
	}

	const payload: CollaborationRealtimeEvent = {
		id: `event-${String(Date.now())}-${String(Math.round(Math.random() * 10_000))}`,
		projectId,
		timestamp: Date.now(),
		...event,
	};
	const frame = `data: ${JSON.stringify(payload)}\n\n`;
	for (const stream of streams) {
		stream.write(frame);
	}
}

function summarizeInsights(state: CollaborationProjectState, presence: CollaborationPresenceEntry[]): CollaborationTeamInsights {
	const topActorsMap = new Map<string, number>();
	for (const entry of state.activity) {
		const actor = entry.actor?.trim();
		if (!actor) continue;
		topActorsMap.set(actor, (topActorsMap.get(actor) ?? 0) + 1);
	}
	const topActors = [...topActorsMap.entries()]
		.map(([actor, count]) => ({ actor, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 5);
	const assignments = state.assignments;
	const members = state.members;
	return {
		...(state.teamProfile?.organizationName ? { organizationName: state.teamProfile.organizationName } : {}),
		...(state.teamProfile?.teamName ? { teamName: state.teamProfile.teamName } : {}),
		memberCount: members.length,
		ownerCount: members.filter((member) => member.permissionLevel === 'owner').length,
		managerCount: members.filter((member) => member.permissionLevel === 'manager').length,
		memberPermissionCount: members.filter((member) => member.permissionLevel === 'member').length,
		observerCount: members.filter((member) => member.permissionLevel === 'observer').length,
		activePresenceCount: presence.length,
		openAssignments: assignments.filter((assignment) => assignment.status === 'open').length,
		inProgressAssignments: assignments.filter((assignment) => assignment.status === 'in-progress').length,
		blockedAssignments: assignments.filter((assignment) => assignment.status === 'blocked').length,
		completedAssignments: assignments.filter((assignment) => assignment.status === 'done').length,
		topActors,
	};
}

function json(response: http.ServerResponse, statusCode: number, body: unknown): void {
	response.writeHead(statusCode, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Collaboration-Member, X-Collaboration-Member-Key',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	});
	response.end(JSON.stringify(body));
}

function unauthorized(response: http.ServerResponse): void {
	json(response, 401, { error: 'Unauthorized' });
}

function isAuthorized(request: http.IncomingMessage, url: URL): boolean {
	if (!resolvedToken) return true;
	const authHeader = request.headers.authorization || '';
	return authHeader === `Bearer ${resolvedToken}` || url.searchParams.get('token')?.trim() === resolvedToken;
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
	}
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? JSON.parse(raw) : {};
}

function requestUrl(request: http.IncomingMessage): URL {
	return new URL(request.url || '/', `http://${request.headers.host || `${resolvedHost}:${String(resolvedPort)}`}`);
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = http.createServer(async (request, response) => {
	if (!request.url) {
		json(response, 404, { error: 'Not found' });
		return;
	}

	if (request.method === 'OPTIONS') {
		json(response, 204, {});
		return;
	}

	const url = requestUrl(request);
	if (!isAuthorized(request, url)) {
		unauthorized(response);
		return;
	}

	if (request.method === 'GET') {
		if (url.pathname === '/' || url.pathname === '/health') {
			json(response, 200, {
				ok: true,
				version: '2.1.0',
				serverTime: new Date().toISOString(),
				projectCount: await countProjects(),
				storagePath: resolvedStorageDir,
			});
			return;
		}

		if (url.pathname === '/presence') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const entries = await readPresence(projectId);
			await writePresence(projectId, entries);
			json(response, 200, { entries });
			return;
		}

		if (url.pathname === '/members') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const state = await readProjectState(projectId);
			json(response, 200, { members: state.members.sort((a, b) => b.lastSeenAt - a.lastSeenAt) });
			return;
		}

		if (url.pathname === '/team') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const state = await readProjectState(projectId);
			json(response, 200, { profile: state.teamProfile });
			return;
		}

		if (url.pathname === '/activity') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '30', 10) || 30));
			const state = await readProjectState(projectId);
			json(response, 200, { entries: state.activity.slice(0, limit) });
			return;
		}

		if (url.pathname === '/insights') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const state = await readProjectState(projectId);
			const presence = await readPresence(projectId);
			json(response, 200, summarizeInsights(state, presence));
			return;
		}

		if (url.pathname === '/events') {
			const projectId = url.searchParams.get('projectId')?.trim() || 'default';
			const memberId = url.searchParams.get('memberId')?.trim() || '';
			if (!isMemberAuthorized(request, url, memberId)) {
				unauthorized(response);
				return;
			}

			sseHeaders(response);
			const streams = projectStreams.get(projectId) ?? new Set<http.ServerResponse>();
			streams.add(response);
			projectStreams.set(projectId, streams);
			response.write(`data: ${JSON.stringify({ id: `event-${String(Date.now())}`, projectId, type: 'session', timestamp: Date.now() })}\n\n`);
			const keepAlive = setInterval(() => {
				response.write(': keep-alive\n\n');
			}, 20_000);
			request.on('close', () => {
				clearInterval(keepAlive);
				const current = projectStreams.get(projectId);
				current?.delete(response);
				if (current && current.size === 0) {
					projectStreams.delete(projectId);
				}
			});
			return;
		}

		json(response, 404, { error: 'Not found' });
		return;
	}

	if (request.method !== 'POST') {
		json(response, 405, { error: 'Method not allowed' });
		return;
	}

	try {
		if (url.pathname === '/presence') {
			const body = (await readJsonBody(request)) as Partial<PresenceRequestBody>;
			const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
			if (!body.presence || typeof body.presence.id !== 'string' || typeof body.presence.actor !== 'string') {
				json(response, 400, { error: 'Invalid presence payload' });
				return;
			}
			if (!isMemberAuthorized(request, url)) {
				unauthorized(response);
				return;
			}
			const entries = await readPresence(projectId);
				const nextPresence: CollaborationPresenceEntry = {
					id: body.presence.id,
					actor: body.presence.actor,
					...(typeof body.presence.deviceLabel === 'string'
						? { deviceLabel: body.presence.deviceLabel }
						: {}),
					repo: body.presence.repo ?? null,
					branch: body.presence.branch ?? null,
					status: body.presence.status ?? null,
				lastSeenAt: Date.now(),
			};
			const next = prunePresence([nextPresence, ...entries.filter((entry) => entry.id !== nextPresence.id)]);
			await writePresence(projectId, next);
			publishRealtimeEvent(projectId, {
				type: 'presence',
				actor: nextPresence.actor,
			});
			json(response, 200, { entries: next });
			return;
		}

		if (url.pathname === '/session') {
			const body = (await readJsonBody(request)) as Partial<SessionRequestBody>;
			const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
			if (!body.member || typeof body.member.id !== 'string' || typeof body.member.displayName !== 'string' || typeof body.member.role !== 'string') {
				json(response, 400, { error: 'Invalid session payload' });
				return;
			}
			if (!isMemberAuthorized(request, url, body.member.id)) {
				unauthorized(response);
				return;
			}
			let state = await readProjectState(projectId);
			const member: CollaborationMemberProfile = {
				id: body.member.id,
				displayName: body.member.displayName,
				...(body.member.email ? { email: body.member.email } : {}),
				role: body.member.role,
				permissionLevel:
					body.member.permissionLevel === 'owner' ||
					body.member.permissionLevel === 'manager' ||
					body.member.permissionLevel === 'observer'
						? body.member.permissionLevel
						: 'member',
				...(body.member.organizationId ? { organizationId: body.member.organizationId } : {}),
				...(body.member.organizationName ? { organizationName: body.member.organizationName } : {}),
				...(body.member.teamId ? { teamId: body.member.teamId } : {}),
				...(body.member.teamName ? { teamName: body.member.teamName } : {}),
				...(body.member.avatarUrl ? { avatarUrl: body.member.avatarUrl } : {}),
				...(body.member.deviceLabel ? { deviceLabel: body.member.deviceLabel } : {}),
				lastSeenAt: Date.now(),
			};
			state = {
				...state,
				members: mergeById(state.members, [member]).sort((a, b) => b.lastSeenAt - a.lastSeenAt),
			};
			await writeProjectState(projectId, state);
			publishRealtimeEvent(projectId, {
				type: 'session',
				memberId: member.id,
				actor: member.displayName,
			});
			json(response, 200, { members: state.members });
			return;
		}

		if (url.pathname === '/members/upsert') {
			const body = (await readJsonBody(request)) as Partial<MemberMutationRequestBody>;
			const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
			if (!body.member || typeof body.member.id !== 'string' || typeof body.member.displayName !== 'string' || typeof body.member.role !== 'string') {
				json(response, 400, { error: 'Invalid member payload' });
				return;
			}
			if (!isMemberAuthorized(request, url)) {
				unauthorized(response);
				return;
			}
			let state = await readProjectState(projectId);
			const member: CollaborationMemberProfile = {
				id: body.member.id,
				displayName: body.member.displayName,
				...(body.member.email ? { email: body.member.email } : {}),
				role: body.member.role,
				permissionLevel:
					body.member.permissionLevel === 'owner' ||
					body.member.permissionLevel === 'manager' ||
					body.member.permissionLevel === 'observer'
						? body.member.permissionLevel
						: 'member',
				...(body.member.organizationId ? { organizationId: body.member.organizationId } : {}),
				...(body.member.organizationName ? { organizationName: body.member.organizationName } : {}),
				...(body.member.teamId ? { teamId: body.member.teamId } : {}),
				...(body.member.teamName ? { teamName: body.member.teamName } : {}),
				...(body.member.avatarUrl ? { avatarUrl: body.member.avatarUrl } : {}),
				...(body.member.deviceLabel ? { deviceLabel: body.member.deviceLabel } : {}),
				lastSeenAt: Date.now(),
			};
			state = {
				...state,
				members: mergeById(state.members, [member]).sort((a, b) => b.lastSeenAt - a.lastSeenAt),
			};
			await writeProjectState(projectId, state);
			publishRealtimeEvent(projectId, {
				type: 'session',
				memberId: member.id,
				actor: member.displayName,
			});
			json(response, 200, { members: state.members });
			return;
		}

		if (url.pathname === '/members/remove') {
			const body = (await readJsonBody(request)) as Partial<MemberRemoveRequestBody>;
			const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
			const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
			if (!memberId) {
				json(response, 400, { error: 'Invalid member id' });
				return;
			}
			if (!isMemberAuthorized(request, url)) {
				unauthorized(response);
				return;
			}
			let state = await readProjectState(projectId);
			state = {
				...state,
				members: state.members.filter((member) => member.id !== memberId),
			};
			await writeProjectState(projectId, state);
			publishRealtimeEvent(projectId, {
				type: 'session',
				memberId,
			});
			json(response, 200, { members: state.members });
			return;
		}

		if (url.pathname === '/team/upsert') {
			const body = (await readJsonBody(request)) as Partial<TeamProfileMutationRequestBody>;
			const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
			if (
				!body.profile ||
				typeof body.profile.organizationId !== 'string' ||
				typeof body.profile.organizationName !== 'string' ||
				typeof body.profile.teamId !== 'string' ||
				typeof body.profile.teamName !== 'string'
			) {
				json(response, 400, { error: 'Invalid team profile payload' });
				return;
			}
			if (!isMemberAuthorized(request, url)) {
				unauthorized(response);
				return;
			}
			let state = await readProjectState(projectId);
			const profile: CollaborationTeamProfile = {
				organizationId: body.profile.organizationId.trim(),
				organizationName: body.profile.organizationName.trim(),
				teamId: body.profile.teamId.trim(),
				teamName: body.profile.teamName.trim(),
				defaultPermissionLevel:
					body.profile.defaultPermissionLevel === 'owner' ||
					body.profile.defaultPermissionLevel === 'manager' ||
					body.profile.defaultPermissionLevel === 'observer'
						? body.profile.defaultPermissionLevel
						: 'member',
				updatedAt: Date.now(),
			};
			state = {
				...state,
				teamProfile: profile,
			};
				await writeProjectState(projectId, state);
				const sessionMemberId = getMemberCredentials(request, url).memberId.trim();
				publishRealtimeEvent(projectId, {
					type: 'session',
					...(sessionMemberId ? { memberId: sessionMemberId } : {}),
				});
			json(response, 200, { profile });
			return;
		}

		const body = (await readJsonBody(request)) as Partial<SyncRequestBody>;
		const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : 'default';
		const direction = body.direction;
		if (!body.bundle || (direction !== 'push' && direction !== 'pull' && direction !== 'roundtrip')) {
			json(response, 400, { error: 'Invalid collaboration sync payload' });
			return;
		}
		if (!isMemberAuthorized(request, url)) {
			unauthorized(response);
			return;
		}

		let state = await readProjectState(projectId);
		const incomingBundle = normalizeBundle(body.bundle, projectId);
		const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : undefined;

		if (direction === 'push') {
			state = appendActivity({ ...state, ...incomingBundle }, {
				type: 'sync',
				status: 'success',
				title: 'Collaboration state pushed',
				description: `${actor ?? 'A collaborator'} published ${String(incomingBundle.workspaceShares.length)} handoff${incomingBundle.workspaceShares.length === 1 ? '' : 's'}, ${String(incomingBundle.patchShelf.length)} patch${incomingBundle.patchShelf.length === 1 ? '' : 'es'}, and ${String(incomingBundle.assignments.length)} assignment${incomingBundle.assignments.length === 1 ? '' : 's'}.`,
				...(actor ? { actor } : {}),
				});
				await writeProjectState(projectId, state);
				const syncMemberId = getMemberCredentials(request, url).memberId.trim();
				publishRealtimeEvent(projectId, {
					type: 'sync',
					...(actor ? { actor } : {}),
					...(syncMemberId ? { memberId: syncMemberId } : {}),
				});
			json(response, 200, { ok: true });
			return;
		}

		if (direction === 'pull') {
			state = appendActivity(state, {
				type: 'sync',
				status: 'info',
				title: 'Collaboration state pulled',
				description: `${actor ?? 'A collaborator'} requested the latest shared project state.`,
				...(actor ? { actor } : {}),
				});
				await writeProjectState(projectId, state);
				const pullMemberId = getMemberCredentials(request, url).memberId.trim();
				publishRealtimeEvent(projectId, {
					type: 'sync',
					...(actor ? { actor } : {}),
					...(pullMemberId ? { memberId: pullMemberId } : {}),
				});
			json(response, 200, {
				bundle: {
					version: state.version,
					projectId: state.projectId,
					exportedAt: state.exportedAt,
					workspaceShares: state.workspaceShares,
					patchShelf: state.patchShelf,
					comments: state.comments,
					assignments: state.assignments,
				},
			});
			return;
		}

		const merged = mergeBundles(incomingBundle, state, projectId);
		state = appendActivity({ ...state, ...merged }, {
			type: 'sync',
			status: 'success',
			title: 'Collaboration roundtrip completed',
			description: `${actor ?? 'A collaborator'} merged local and remote collaboration state.`,
			...(actor ? { actor } : {}),
			});
			await writeProjectState(projectId, state);
			const roundtripMemberId = getMemberCredentials(request, url).memberId.trim();
			publishRealtimeEvent(projectId, {
				type: 'sync',
				...(actor ? { actor } : {}),
				...(roundtripMemberId ? { memberId: roundtripMemberId } : {}),
			});
		json(response, 200, {
			bundle: {
				version: state.version,
				projectId: state.projectId,
				exportedAt: state.exportedAt,
				workspaceShares: state.workspaceShares,
				patchShelf: state.patchShelf,
				comments: state.comments,
				assignments: state.assignments,
			},
		});
	} catch (error) {
		json(response, 500, { error: error instanceof Error ? error.message : 'Collaboration sync server error' });
	}
});

server.listen(resolvedPort, resolvedHost, () => {
	console.log(`Git Graph collaboration sync server listening on http://${resolvedHost}:${String(resolvedPort)}`);
	console.log(`Storage: ${resolvedStorageDir}`);
	if (resolvedToken) {
		console.log('Auth: bearer token required');
	}
});

/**
 * Repository tRPC Router
 * Exposes repository management operations to the renderer
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import type { GitRepoState } from '@/web/lib/types';

import { appStore, instanceStore } from '@/app/backend/store';
import { readSecretValue, setSecretValue } from '@/app/backend/store/secret';
import {
	buildCollaborationPullRequestFileTargetId,
	buildCollaborationPullRequestTargetId,
	deriveCollaborationRepoKey,
	parseCollaborationReviewTargetId,
} from '@/lib/collaboration-review-targets';
import { listAuditEntries } from '@/app/backend/store/audit';
import {
	appendCollaborationActivity,
	buildCollaborationReviewDashboard,
	collaborationAssignmentStatusSchema,
	buildCollaborationBundle,
	collaborationCommentTargetSchema,
	collaborationPatchShareSchema,
	collaborationWorkspaceShareRepoSchema,
	collaborationWorkspaceShareSchema,
	deleteCollaborationAssignment,
	deleteCollaborationComment,
	getCollaborationState,
	listCollaborationActivity,
	listCollaborationAssignments,
	listCollaborationComments,
	mergeCollaborationRecords,
	parseCollaborationBundle,
	setCollaborationState,
	setCollaborationSyncState,
	updateCollaborationCommentProviderSync,
	upsertCollaborationAssignment,
	upsertCollaborationComment,
} from '@/app/backend/store/collaboration';
import { toDeepLink } from '@/app/backend/trpc/routers/app';
import {
	getCodeReviewProgress,
	resetCodeReviewProgress,
	updateCodeReviewProgress,
} from '@/app/backend/store/codeReviews';
import { getRepoPolicy, repoPolicySchema, upsertRepoPolicy } from '@/app/backend/store/repoPolicies';
import {
	requestCollaborationHealth,
	requestCollaborationMembers,
	requestCollaborationPresence,
	requestCollaborationRemoteActivity,
	requestCollaborationTeamProfile,
	requestCollaborationTeamInsights,
	requestCollaborationSync,
	removeCollaborationMember,
	publishCollaborationPresence,
	publishCollaborationSession,
	upsertCollaborationTeamProfile,
	upsertCollaborationMember,
} from '@/app/backend/services/collaborationSync';

import { findGit } from '../../../services/gitExecutable';
import { getGitService } from '../../../services/gitService';
import {
	addPullRequestComment as addRemotePullRequestComment,
	addPullRequestInlineComment as addRemotePullRequestInlineComment,
	getPullRequestReviewState as getRemotePullRequestReviewState,
	listPullRequestComments as listRemotePullRequestComments,
	listPullRequests as listRemotePullRequests,
	parseRemoteUrl as parsePullRequestRemoteUrl,
	setPullRequestThreadResolved as setRemotePullRequestThreadResolved,
	type ProviderAuthConfig,
	type PullRequestComment,
	type PullRequestProvider,
} from '../../../services/pullRequest';
import { getRepoManager } from '../../../services/repoManager';
import { router, publicProcedure } from '../../init';

let gitInitPromise: Promise<string | null> | null = null;

async function ensureGitInitialized(): Promise<string | null> {
	const gitService = getGitService();
	if (gitService.isGitAvailable()) {
		return null;
	}

	if (gitInitPromise === null) {
		gitInitPromise = (async () => {
			try {
				const executable = await findGit();
				gitService.setGitExecutable(executable);
				return null;
			} catch (error) {
				return error instanceof Error ? error.message : 'Failed to find Git executable';
			} finally {
				gitInitPromise = null;
			}
		})();
	}

	return gitInitPromise;
}

async function getPreferredRemoteUrlForPullRequests(repo: string): Promise<string | null> {
	const git = getGitService();
	const originRemote = await git.runGitCommandWithOutput(['config', '--get', 'remote.origin.url'], repo);
	const normalizedOrigin = originRemote?.trim();
	if (normalizedOrigin) {
		return normalizedOrigin;
	}

	const remotes = await git.getRemotes(repo);
	for (const remoteName of remotes) {
		const remoteUrl = await git.runGitCommandWithOutput(['config', '--get', `remote.${remoteName}.url`], repo);
		const normalized = remoteUrl?.trim();
		if (normalized) {
			return normalized;
		}
	}

	return null;
}

function parseCollaborationReviewCommentTarget(comment: { targetType: string; targetId: string; body: string }):
	| {
			provider: PullRequestProvider;
			repoKey: string | null;
			pullRequestNumber: number;
			kind: 'pull-request' | 'file-thread' | 'line-thread';
			filePath?: string;
			line?: number;
			side?: 'left' | 'right';
			body: string;
	  }
	| { error: string } {
	const parsed = parseCollaborationReviewTargetId(comment.targetId);
	if (!parsed) {
		return { error: 'Collaboration comment target is not linked to a pull request.' };
	}
	if (comment.targetType === 'pull-request') {
		return {
			provider: parsed.provider,
			repoKey: parsed.repoKey,
			pullRequestNumber: parsed.pullRequestNumber,
			kind: 'pull-request',
			body: comment.body,
		};
	}
	if (!parsed.filePath) {
		return { error: 'File review target is missing its path.' };
	}
	if (parsed.line && parsed.side) {
		return {
			provider: parsed.provider,
			repoKey: parsed.repoKey,
			pullRequestNumber: parsed.pullRequestNumber,
			kind: 'line-thread',
			filePath: parsed.filePath,
			line: parsed.line,
			side: parsed.side,
			body: comment.body,
		};
	}
	return {
		provider: parsed.provider,
		repoKey: parsed.repoKey,
		pullRequestNumber: parsed.pullRequestNumber,
		kind: 'file-thread',
		filePath: parsed.filePath,
		body: `[${parsed.filePath}] ${comment.body}`,
	};
}

function toCollaborationTargetIdFromProviderComment(
	provider: PullRequestProvider,
	repoKey: string | null,
	pullRequestNumber: number,
	comment: PullRequestComment
): { targetType: 'pull-request' | 'pull-request-file'; targetId: string } {
	if (comment.inline?.filePath) {
		if (comment.inline.line && comment.inline.side) {
			return {
				targetType: 'pull-request-file',
				targetId: buildCollaborationPullRequestFileTargetId({
					provider,
					repoKey,
					pullRequestNumber,
					filePath: comment.inline.filePath,
					side: comment.inline.side,
					line: comment.inline.line,
				}),
			};
		}
		return {
			targetType: 'pull-request-file',
			targetId: buildCollaborationPullRequestFileTargetId({
				provider,
				repoKey,
				pullRequestNumber,
				filePath: comment.inline.filePath,
			}),
		};
	}
	return {
		targetType: 'pull-request',
		targetId: buildCollaborationPullRequestTargetId({ provider, repoKey, pullRequestNumber }),
	};
}

function mapProviderReviewerStatusToAssignmentStatus(status: 'requested' | 'commented' | 'approved' | 'changes-requested' | 'waiting'):
	| 'open'
	| 'in-progress'
	| 'done'
	| 'blocked' {
	switch (status) {
		case 'approved':
			return 'done';
		case 'changes-requested':
			return 'blocked';
		case 'commented':
			return 'in-progress';
		case 'requested':
		case 'waiting':
		default:
			return 'open';
	}
}

interface RemoteRepository {
	provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
	name: string;
	fullName: string;
	description: string;
	cloneUrl: string;
	sshUrl: string;
	webUrl: string;
	private: boolean;
	defaultBranch: string;
}

const workspaceRepoSchema = z.object({
	path: z.string().min(1),
	name: z.string().min(1),
	lastOpened: z.number().optional(),
	isFavorite: z.boolean().optional(),
});

const workspaceSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().min(1),
	repos: z.array(workspaceRepoSchema),
	createdAt: z.number(),
	updatedAt: z.number(),
});

function normalizeWorkspaceRepo(repo: z.infer<typeof workspaceRepoSchema>) {
	return {
		path: repo.path,
		name: repo.name,
		...(repo.lastOpened === undefined ? {} : { lastOpened: repo.lastOpened }),
		...(repo.isFavorite === undefined ? {} : { isFavorite: repo.isFavorite }),
	};
}

function normalizeWorkspace(workspace: z.infer<typeof workspaceSchema>) {
	return {
		id: workspace.id,
		name: workspace.name,
		color: workspace.color,
		repos: workspace.repos.map(normalizeWorkspaceRepo),
		createdAt: workspace.createdAt,
		updatedAt: workspace.updatedAt,
	};
}

type RepoPolicyPatch = {
	[K in keyof z.infer<typeof repoPolicySchema>]?: z.infer<typeof repoPolicySchema>[K] | undefined;
};

function normalizeRepoPolicyPatch(patch: RepoPolicyPatch): Partial<z.infer<typeof repoPolicySchema>> {
	const nextPatch: Partial<z.infer<typeof repoPolicySchema>> = {};
	if (patch.repoPath !== undefined) nextPatch.repoPath = patch.repoPath;
	if (patch.requireSignedCommits !== undefined) nextPatch.requireSignedCommits = patch.requireSignedCommits;
	if (patch.allowedMergeStrategies !== undefined) nextPatch.allowedMergeStrategies = patch.allowedMergeStrategies;
	if (patch.requireUpToDate !== undefined) nextPatch.requireUpToDate = patch.requireUpToDate;
	if (patch.enableStacking !== undefined) nextPatch.enableStacking = patch.enableStacking;
	if (patch.defaultStackBase !== undefined) nextPatch.defaultStackBase = patch.defaultStackBase;
	if (patch.customWorkflow !== undefined) nextPatch.customWorkflow = patch.customWorkflow;
	return nextPatch;
}

const commitFilterStateSchema = z.object({
	repo: z.string().min(1),
	author: z.string().optional(),
	filePath: z.string().optional(),
	search: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
});

const pinnedCommitSchema = z.object({
	hash: z.string().min(1),
	message: z.string().min(1),
	author: z.string().min(1),
	date: z.string().min(1),
	branch: z.string().optional(),
	pinnedAt: z.number(),
	note: z.string().optional(),
});
const recentRepoSchema = z.object({
	path: z.string().min(1),
	name: z.string().min(1),
	lastOpened: z.number(),
	openCount: z.number(),
	pinned: z.boolean(),
	currentBranch: z.string().optional(),
});
const undoHistoryOperationSchema = z.object({
	id: z.string().min(1),
	type: z.string().min(1),
	timestamp: z.number(),
	description: z.string().min(1),
	details: z.record(z.string(), z.unknown()),
	undoable: z.boolean(),
	undone: z.boolean().optional(),
	reflogEntry: z.string().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback: string = ''): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return fallback;
}

type CollaborationSyncConfig = {
	enabled: boolean;
	provider: 'self-host';
	endpointUrl: string;
	projectId: string;
	authToken: string;
	memberId: string;
	memberApiKey: string;
	displayName: string;
	email: string;
	role: 'developer' | 'reviewer' | 'lead' | 'qa';
	permissionLevel: 'owner' | 'manager' | 'member' | 'observer';
	organizationId: string;
	organizationName: string;
	teamId: string;
	teamName: string;
	avatarUrl: string;
	deviceLabel: string;
	presenceEnabled: boolean;
	liveSyncEnabled: boolean;
	realtimeEnabled: boolean;
	timeoutMs: number;
	autoSyncOnOpen: boolean;
	lastSyncedAt: number | null;
	lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
	lastSyncError: string | null;
};

const providerGithubTokenSecretKey = 'providerAuth.githubToken';
const providerGitlabTokenSecretKey = 'providerAuth.gitlabToken';
const providerBitbucketTokenSecretKey = 'providerAuth.bitbucketToken';
const providerAzureTokenSecretKey = 'providerAuth.azureToken';
const collaborationAuthTokenSecretKey = 'collaborationSyncConfig.authToken';
const collaborationMemberApiKeySecretKey = 'collaborationSyncConfig.memberApiKey';

function hydrateProviderAuthConfig(): ProviderAuthConfig {
	const current = (appStore.get('providerAuth') ?? {}) as Partial<Record<string, unknown>>;
	const githubToken = readSecretValue(providerGithubTokenSecretKey);
	const gitlabToken = readSecretValue(providerGitlabTokenSecretKey);
	const bitbucketToken = readSecretValue(providerBitbucketTokenSecretKey);
	const azureToken = readSecretValue(providerAzureTokenSecretKey);

	const currentGithubToken = readString(current.githubToken).trim();
	const currentGitlabToken = readString(current.gitlabToken).trim();
	const currentBitbucketToken = readString(current.bitbucketToken).trim();
	const currentAzureToken = readString(current.azureToken).trim();
	const currentBitbucketUsername = readString(current.bitbucketUsername).trim();

	if (currentGithubToken || currentGitlabToken || currentBitbucketToken || currentAzureToken) {
		setSecretValue(providerGithubTokenSecretKey, currentGithubToken);
		setSecretValue(providerGitlabTokenSecretKey, currentGitlabToken);
		setSecretValue(providerBitbucketTokenSecretKey, currentBitbucketToken);
		setSecretValue(providerAzureTokenSecretKey, currentAzureToken);
		appStore.set('providerAuth', {
			githubToken: '',
			gitlabToken: '',
			bitbucketToken: '',
			bitbucketUsername: currentBitbucketUsername,
			azureToken: '',
		});
	}

	const auth: ProviderAuthConfig = {};
	const normalizedGithubToken = githubToken || currentGithubToken;
	const normalizedGitlabToken = gitlabToken || currentGitlabToken;
	const normalizedBitbucketToken = bitbucketToken || currentBitbucketToken;
	const normalizedAzureToken = azureToken || currentAzureToken;

	if (normalizedGithubToken) auth.githubToken = normalizedGithubToken;
	if (normalizedGitlabToken) auth.gitlabToken = normalizedGitlabToken;
	if (normalizedBitbucketToken) auth.bitbucketToken = normalizedBitbucketToken;
	if (currentBitbucketUsername) auth.bitbucketUsername = currentBitbucketUsername;
	if (normalizedAzureToken) auth.azureToken = normalizedAzureToken;

	return auth;
}

function getStoredProviderAuthConfig(): ProviderAuthConfig {
	return hydrateProviderAuthConfig();
}

function hydrateCollaborationSyncConfig(): CollaborationSyncConfig {
	const current = (appStore.get('collaborationSyncConfig') ?? {}) as Partial<CollaborationSyncConfig>;
	const authToken = readSecretValue(collaborationAuthTokenSecretKey);
	const memberApiKey = readSecretValue(collaborationMemberApiKeySecretKey);
	const currentAuthToken = readString(current.authToken).trim();
	const currentMemberApiKey = readString(current.memberApiKey).trim();

	if (currentAuthToken || currentMemberApiKey) {
		setSecretValue(collaborationAuthTokenSecretKey, currentAuthToken);
		setSecretValue(collaborationMemberApiKeySecretKey, currentMemberApiKey);
		appStore.set('collaborationSyncConfig', {
			enabled: current.enabled ?? false,
			provider: 'self-host',
			endpointUrl: readString(current.endpointUrl),
			projectId: readString(current.projectId) || 'default',
			authToken: '',
			memberId: readString(current.memberId),
			memberApiKey: '',
			displayName: readString(current.displayName),
			email: readString(current.email),
			role: current.role ?? 'developer',
			permissionLevel: current.permissionLevel ?? 'member',
			organizationId: readString(current.organizationId),
			organizationName: readString(current.organizationName),
			teamId: readString(current.teamId),
			teamName: readString(current.teamName),
			avatarUrl: readString(current.avatarUrl),
			deviceLabel: readString(current.deviceLabel) || 'desktop',
			presenceEnabled: current.presenceEnabled ?? true,
			liveSyncEnabled: current.liveSyncEnabled ?? true,
			realtimeEnabled: current.realtimeEnabled ?? true,
			timeoutMs: typeof current.timeoutMs === 'number' ? current.timeoutMs : 15_000,
			autoSyncOnOpen: current.autoSyncOnOpen ?? false,
			lastSyncedAt: current.lastSyncedAt ?? null,
			lastSyncStatus: current.lastSyncStatus ?? 'idle',
			lastSyncError: current.lastSyncError ?? null,
		});
	}

	return {
		enabled: current.enabled ?? false,
		provider: 'self-host',
		endpointUrl: readString(current.endpointUrl),
		projectId: readString(current.projectId) || 'default',
		authToken: authToken || currentAuthToken,
		memberId: readString(current.memberId),
		memberApiKey: memberApiKey || currentMemberApiKey,
		displayName: readString(current.displayName),
		email: readString(current.email),
		role: current.role ?? 'developer',
		permissionLevel: current.permissionLevel ?? 'member',
		organizationId: readString(current.organizationId),
		organizationName: readString(current.organizationName),
		teamId: readString(current.teamId),
		teamName: readString(current.teamName),
		avatarUrl: readString(current.avatarUrl),
		deviceLabel: readString(current.deviceLabel) || 'desktop',
		presenceEnabled: current.presenceEnabled ?? true,
		liveSyncEnabled: current.liveSyncEnabled ?? true,
		realtimeEnabled: current.realtimeEnabled ?? true,
		timeoutMs: typeof current.timeoutMs === 'number' ? current.timeoutMs : 15_000,
		autoSyncOnOpen: current.autoSyncOnOpen ?? false,
		lastSyncedAt: current.lastSyncedAt ?? null,
		lastSyncStatus: current.lastSyncStatus ?? 'idle',
		lastSyncError: current.lastSyncError ?? null,
	};
}

function buildProviderAuthHeader(provider: 'github' | 'gitlab' | 'bitbucket'): Record<string, string> {
	const auth = hydrateProviderAuthConfig();
	if (provider === 'github') {
		if (!auth.githubToken) {
			throw new Error('GitHub token is not configured.');
		}
		return { Authorization: `Bearer ${auth.githubToken}` };
	}

	if (provider === 'gitlab') {
		if (!auth.gitlabToken) {
			throw new Error('GitLab token is not configured.');
		}
		return { 'PRIVATE-TOKEN': auth.gitlabToken };
	}

	if (!auth.bitbucketToken) {
		throw new Error('Bitbucket token is not configured.');
	}
	if (auth.bitbucketUsername) {
		const encoded = Buffer.from(`${auth.bitbucketUsername}:${auth.bitbucketToken}`).toString('base64');
		return { Authorization: `Basic ${encoded}` };
	}
	return { Authorization: `Bearer ${auth.bitbucketToken}` };
}

async function requestProviderJson<T>(url: string, headers: Record<string, string>): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'vscode-git-graph-electron',
			...headers,
		},
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`HTTP ${String(response.status)}: ${body || response.statusText}`);
	}
	return (await response.json()) as T;
}

async function readCollaborationRepoSummary(
	repoPath: string
): Promise<z.infer<typeof collaborationWorkspaceShareRepoSchema>> {
	const gitService = getGitService();
	const [headRaw, headShaRaw, lastCommitRaw, dirtyRaw] = await Promise.all([
		gitService.runGitCommandWithOutput(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath),
		gitService.runGitCommandWithOutput(['rev-parse', 'HEAD'], repoPath),
		gitService.runGitCommandWithOutput(['log', '-1', '--format=%ct'], repoPath),
		gitService.runGitCommandWithOutput(['status', '--porcelain'], repoPath),
	]);
	const head = (headRaw ?? '').trim();
	const headSha = (headShaRaw ?? '').trim();
	const lastCommitSeconds = Number.parseInt((lastCommitRaw ?? '').trim(), 10);
	const dirtyCount = (dirtyRaw ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean).length;

	return {
		path: repoPath,
		name: path.basename(repoPath),
		head: head && head !== 'HEAD' ? head : null,
		headSha: headSha || null,
		lastCommitAt: Number.isFinite(lastCommitSeconds) ? lastCommitSeconds * 1000 : null,
		dirtyCount,
		openPullRequests: null,
		needsAttention: dirtyCount > 0,
		deepLink: toDeepLink({ repo: repoPath }),
	};
}

function summarizePatchStats(output: string): { fileCount: number; additions: number; deletions: number } {
	return output
		.split('\n')
		.filter(Boolean)
		.reduce(
			(acc, line) => {
				const [addedRaw, deletedRaw] = line.split('\t');
				const additions = addedRaw === '-' ? 0 : Number.parseInt(addedRaw ?? '0', 10);
				const deletions = deletedRaw === '-' ? 0 : Number.parseInt(deletedRaw ?? '0', 10);
				return {
					fileCount: acc.fileCount + 1,
					additions: acc.additions + (Number.isFinite(additions) ? additions : 0),
					deletions: acc.deletions + (Number.isFinite(deletions) ? deletions : 0),
				};
			},
			{ fileCount: 0, additions: 0, deletions: 0 }
		);
}

function getCollaborationIdentity() {
	const config = hydrateCollaborationSyncConfig();
	const displayName = config.displayName.trim();
	const email = config.email.trim();
	const deviceLabel = config.deviceLabel.trim() || 'desktop';
	const memberId = config.memberId.trim() || email || (displayName ? `${displayName.toLowerCase()}@${deviceLabel.toLowerCase()}` : '');
	return {
		displayName,
		email,
		role: config.role,
		permissionLevel: config.permissionLevel,
		organizationId: config.organizationId.trim(),
		organizationName: config.organizationName.trim(),
		teamId: config.teamId.trim(),
		teamName: config.teamName.trim(),
		avatarUrl: config.avatarUrl.trim(),
		deviceLabel,
		presenceId: displayName ? `${displayName.toLowerCase()}::${deviceLabel.toLowerCase()}` : '',
		memberId,
		memberApiKey: config.memberApiKey.trim(),
	};
}

function ensureCollaborationRemoteConfig() {
	const config = hydrateCollaborationSyncConfig();
	if (!config.enabled || !config.endpointUrl.trim()) {
		return {
			error: 'Collaboration sync endpoint is not configured.',
		};
	}
	return {
		config,
		projectId: config.projectId.trim() || 'default',
	};
}

async function syncCollaborationStateIfEnabled(): Promise<void> {
	const remote = ensureCollaborationRemoteConfig();
	if ('error' in remote || !remote.config.liveSyncEnabled) {
		return;
	}

	try {
		const identity = getCollaborationIdentity();
		const remoteBundle = await requestCollaborationSync({
			endpointUrl: remote.config.endpointUrl.trim(),
			projectId: remote.projectId,
			authToken: remote.config.authToken,
			memberId: identity.memberId || undefined,
			memberApiKey: identity.memberApiKey || undefined,
			timeoutMs: remote.config.timeoutMs,
			direction: 'roundtrip',
			bundle: buildCollaborationBundle(remote.projectId),
			actor: identity.displayName || undefined,
		});

		if (remoteBundle) {
			setCollaborationState({
				workspaceShares: remoteBundle.workspaceShares,
				patchShelf: remoteBundle.patchShelf,
				comments: remoteBundle.comments,
				assignments: remoteBundle.assignments,
			});
		}

		setCollaborationSyncState({
			lastSyncStatus: 'success',
			lastSyncedAt: Date.now(),
			lastSyncError: null,
		});
	} catch (error) {
		setCollaborationSyncState({
			lastSyncStatus: 'error',
			lastSyncedAt: Date.now(),
			lastSyncError: error instanceof Error ? error.message : 'Live collaboration sync failed.',
		});
	}
}

export const repoRouter = router({
	/**
	 * Get all known repositories.
	 */
	list: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		const repos = manager.getRepos();

		return {
			repos: Object.entries(repos).map(([path, state]: [string, GitRepoState]) => ({
				path,
				name: state.name ?? path.split('/').pop() ?? path,
				state,
			})),
			numRepos: manager.getNumRepos(),
		};
	}),

	/**
	 * Get recent repositories.
	 */
	recent: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		return manager.getRecentRepos();
	}),

	/**
	 * Get the last active repository.
	 */
	lastActive: publicProcedure.query(() => {
		const manager = getRepoManager(getGitService());
		return manager.getLastActiveRepo();
	}),

	/**
	 * Set the last active repository.
	 */
	setLastActive: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.setActiveRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Register a new repository.
	 */
	register: publicProcedure
		.input(
			z.object({
				path: z.string(),
			})
		)
			.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					root: null,
					error: `Unable to initialize Git: ${initError}`,
				};
			}

			const manager = getRepoManager(getGitService());
			const result = await manager.registerRepo(input.path);
			return result;
		}),

	/**
	 * Remove a repository.
	 */
	remove: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.removeRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Ignore a repository.
	 */
	ignore: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			const success = manager.ignoreRepo(input.repo);
			return { success };
		}),

	/**
	 * Unignore a repository.
	 */
	unignore: publicProcedure
		.input(
			z.object({
				repo: z.string(),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			manager.unignoreRepo(input.repo);
			return { success: true };
		}),

	/**
	 * Get ignored repositories.
	 */
	ignoredList: publicProcedure.query(() => {
		return instanceStore.get('ignoredRepos');
	}),

	/**
	 * Update repository state.
	 */
	updateState: publicProcedure
		.input(
			z.object({
				repo: z.string(),
				state: z.object({
					cdvDivider: z.number().optional(),
					cdvHeight: z.number().optional(),
					columnWidths: z.array(z.number()).nullable().optional(),
					commitOrdering: z.string().optional(),
					fileViewType: z.string().optional(),
					hideRemotes: z.array(z.string()).optional(),
					includeCommitsMentionedByReflogs: z.string().optional(),
					issueLinkingConfig: z
						.object({
							issue: z.string(),
							url: z.string(),
						})
						.nullable()
						.optional(),
					name: z.string().nullable().optional(),
					onlyFollowFirstParent: z.string().optional(),
					onRepoLoadShowCheckedOutBranch: z.string().optional(),
					onRepoLoadShowSpecificBranches: z.array(z.string()).nullable().optional(),
					pullRequestConfig: z.record(z.string(), z.unknown()).nullable().optional(),
					showRemoteBranches: z.boolean().optional(),
					showRemoteBranchesV2: z.string().optional(),
					showStashes: z.string().optional(),
					showTags: z.string().optional(),
				}),
			})
		)
			.mutation(({ input }) => {
			const manager = getRepoManager(getGitService());
			// Strip undefined values and cast to satisfy exactOptionalPropertyTypes
			const state = Object.fromEntries(
				Object.entries(input.state).filter(([, v]) => v !== undefined)
			) as Partial<GitRepoState>;
			manager.updateRepoState(input.repo, state);
			return { success: true };
		}),

	/**
	 * Backend-managed workspace persistence.
	 */
	workspace: router({
		list: publicProcedure.query(() => {
			const workspaces = instanceStore.get('workspaces');
			return {
				workspaces: Array.isArray(workspaces) ? workspaces : [],
				error: null as string | null,
			};
		}),

			setAll: publicProcedure
				.input(
					z.object({
						workspaces: z.array(workspaceSchema),
					})
				)
				.mutation(({ input }) => {
					instanceStore.set('workspaces', input.workspaces.map(normalizeWorkspace));
					return { success: true };
				}),

		upsert: publicProcedure
			.input(workspaceSchema)
				.mutation(({ input }) => {
					const current = instanceStore.get('workspaces');
					const list = Array.isArray(current) ? [...current] : [];
					const nextWorkspace = normalizeWorkspace(input);
					const index = list.findIndex((entry) => entry.id === input.id);
					if (index >= 0) {
						list[index] = nextWorkspace;
					} else {
						list.push(nextWorkspace);
					}
					instanceStore.set('workspaces', list);
					return { success: true, workspace: nextWorkspace };
				}),

		remove: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const current = instanceStore.get('workspaces');
				const list = Array.isArray(current) ? current : [];
				instanceStore.set(
					'workspaces',
					list.filter((workspace) => workspace.id !== input.id)
				);
				return { success: true };
		}),
	}),

	collaboration: router({
		list: publicProcedure.query(() => {
			return getCollaborationState();
		}),

		reviewDashboard: publicProcedure.query(() => {
			return {
				dashboard: buildCollaborationReviewDashboard(),
			};
		}),

		activity: publicProcedure
			.input(
				z.object({
					limit: z.number().int().min(1).max(200).default(40),
				}).optional()
			)
			.query(({ input }) => {
				return {
					entries: listCollaborationActivity(input?.limit ?? 40),
				};
			}),

		probeRemote: publicProcedure.mutation(async () => {
			const config = hydrateCollaborationSyncConfig();
			if (!config.endpointUrl.trim()) {
				return {
					success: false,
					error: 'Collaboration sync endpoint is not configured.',
					health: null,
				};
			}

			try {
				const health = await requestCollaborationHealth({
					endpointUrl: config.endpointUrl.trim(),
					authToken: config.authToken,
					timeoutMs: config.timeoutMs,
				});
				return {
					success: true,
					error: null,
					health,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to probe collaboration sync endpoint.',
					health: null,
				};
			}
		}),

		exportBundle: publicProcedure.query(() => {
			const config = hydrateCollaborationSyncConfig();
			const bundle = buildCollaborationBundle(config.projectId.trim() || undefined);
			appendCollaborationActivity({
				type: 'bundle-export',
				action: 'exported',
				status: 'info',
				title: 'Collaboration bundle exported',
				description: `Prepared ${bundle.workspaceShares.length} handoff${bundle.workspaceShares.length === 1 ? '' : 's'}, ${bundle.patchShelf.length} patch${bundle.patchShelf.length === 1 ? '' : 'es'}, and ${bundle.comments.length} comment${bundle.comments.length === 1 ? '' : 's'} for exchange.`,
				metadata: {
					projectId: config.projectId,
					workspaceShares: bundle.workspaceShares.length,
					patchShelf: bundle.patchShelf.length,
					comments: bundle.comments.length,
				},
			});
			return {
				bundle,
			};
		}),

		importBundle: publicProcedure
			.input(
				z.object({
					bundle: z.unknown().transform((value) => parseCollaborationBundle(value)),
					strategy: z.enum(['merge', 'replace']).default('merge'),
				})
			)
			.mutation(({ input }) => {
				const current = getCollaborationState();
				const nextWorkspaceShares =
					input.strategy === 'replace'
						? input.bundle.workspaceShares
						: mergeCollaborationRecords(current.workspaceShares, input.bundle.workspaceShares);
				const nextPatchShelf =
					input.strategy === 'replace'
						? input.bundle.patchShelf
						: mergeCollaborationRecords(current.patchShelf, input.bundle.patchShelf);
				const nextComments =
					input.strategy === 'replace'
						? input.bundle.comments
						: mergeCollaborationRecords(current.comments, input.bundle.comments);
				const nextAssignments =
					input.strategy === 'replace'
						? input.bundle.assignments
						: mergeCollaborationRecords(current.assignments, input.bundle.assignments);
				setCollaborationState({
					workspaceShares: nextWorkspaceShares,
					patchShelf: nextPatchShelf,
					comments: nextComments,
					assignments: nextAssignments,
				});
				appendCollaborationActivity({
					type: 'bundle-import',
					action: 'imported',
					status: 'success',
					title: 'Collaboration bundle imported',
					description: `Imported ${input.bundle.workspaceShares.length} handoff${input.bundle.workspaceShares.length === 1 ? '' : 's'}, ${input.bundle.patchShelf.length} patch${input.bundle.patchShelf.length === 1 ? '' : 'es'}, and ${input.bundle.comments.length} comment${input.bundle.comments.length === 1 ? '' : 's'} using ${input.strategy} mode.`,
					metadata: {
						strategy: input.strategy,
						projectId: input.bundle.projectId ?? null,
					},
				});
				void syncCollaborationStateIfEnabled();
					return {
						success: true,
						workspaceSharesImported: input.bundle.workspaceShares.length,
						patchSharesImported: input.bundle.patchShelf.length,
						commentsImported: input.bundle.comments.length,
						assignmentsImported: input.bundle.assignments.length,
					};
				}),

		createWorkspaceShare: publicProcedure
			.input(
				z.object({
					workspaceId: z.string().min(1),
					name: z.string().min(1),
					note: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { share: null, error: initError };
				}

				const workspaces = instanceStore.get('workspaces') ?? [];
				const workspace = workspaces.find((entry) => entry.id === input.workspaceId);
				if (!workspace) {
					return { share: null, error: 'Workspace not found.' };
				}

				const repos = await Promise.all(
					workspace.repos.map(async (repoEntry) => readCollaborationRepoSummary(repoEntry.path))
				);
				const now = Date.now();
				const share: z.infer<typeof collaborationWorkspaceShareSchema> = {
					id: `workspace-share-${now}`,
					workspaceId: workspace.id,
					name: input.name.trim(),
					note: input.note?.trim() ?? '',
					createdAt: now,
					updatedAt: now,
					repos,
				};
				const current = getCollaborationState();
				setCollaborationState({
					workspaceShares: [share, ...current.workspaceShares],
					patchShelf: current.patchShelf,
					comments: current.comments,
					assignments: current.assignments,
				});
				appendCollaborationActivity({
					type: 'workspace-share',
					action: 'created',
					status: 'success',
					title: `Workspace handoff created: ${share.name}`,
					description: `${share.repos.length} repo${share.repos.length === 1 ? '' : 's'} captured for workspace ${workspace.name}.`,
					metadata: {
						workspaceId: share.workspaceId,
						repoCount: share.repos.length,
					},
				});
				void syncCollaborationStateIfEnabled();
				return { share, error: null };
			}),

		deleteWorkspaceShare: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const current = getCollaborationState();
				const removed = current.workspaceShares.find((share) => share.id === input.id);
				setCollaborationState({
					workspaceShares: current.workspaceShares.filter((share) => share.id !== input.id),
					patchShelf: current.patchShelf,
					comments: current.comments.filter(
						(comment) => !(comment.targetType === 'workspace-share' && comment.targetId === input.id)
					),
					assignments: current.assignments.filter(
						(assignment) => !(assignment.targetType === 'workspace-share' && assignment.targetId === input.id)
					),
				});
				if (removed) {
					appendCollaborationActivity({
						type: 'workspace-share',
						action: 'deleted',
						status: 'info',
						title: `Workspace handoff removed: ${removed.name}`,
						description: 'Removed from the local collaboration shelf.',
						metadata: {
							workspaceId: removed.workspaceId,
						},
					});
				}
				void syncCollaborationStateIfEnabled();
				return { success: true };
			}),

		createPatchShare: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					name: z.string().min(1),
					baseRef: z.string().min(1),
					headRef: z.string().min(1),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { share: null, error: initError };
				}

				try {
					const gitService = getGitService();
					const range = `${input.baseRef}...${input.headRef}`;
					const [patch, numstat] = await Promise.all([
						gitService.runGitCommandWithOutput(['diff', '--binary', range], input.repo),
						gitService.runGitCommandWithOutput(['diff', '--numstat', range], input.repo),
					]);
					const normalizedPatch = patch ?? '';
					if (!normalizedPatch.trim()) {
						return { share: null, error: 'No diff available for the selected range.' };
					}

					const stats = summarizePatchStats(numstat ?? '');
					const now = Date.now();
					const share: z.infer<typeof collaborationPatchShareSchema> = {
						id: `patch-share-${now}`,
						repo: input.repo,
						name: input.name.trim(),
						baseRef: input.baseRef,
						headRef: input.headRef,
						summary: `${stats.fileCount} file${stats.fileCount === 1 ? '' : 's'} changed, +${stats.additions}/-${stats.deletions}`,
						patch: normalizedPatch,
						fileCount: stats.fileCount,
						additions: stats.additions,
						deletions: stats.deletions,
						createdAt: now,
					};
					const current = getCollaborationState();
					setCollaborationState({
						workspaceShares: current.workspaceShares,
						patchShelf: [share, ...current.patchShelf],
						comments: current.comments,
						assignments: current.assignments,
					});
					appendCollaborationActivity({
						type: 'patch-share',
						action: 'created',
						status: 'success',
						title: `Patch shelf item created: ${share.name}`,
						description: `${share.summary} from ${share.baseRef} to ${share.headRef}.`,
						metadata: {
							repo: share.repo,
							fileCount: share.fileCount,
						},
					});
					void syncCollaborationStateIfEnabled();
					return { share, error: null };
				} catch (error) {
					return {
						share: null,
						error: error instanceof Error ? error.message : 'Failed to create patch share.',
					};
				}
			}),

		deletePatchShare: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const current = getCollaborationState();
				const removed = current.patchShelf.find((share) => share.id === input.id);
				setCollaborationState({
					workspaceShares: current.workspaceShares,
					patchShelf: current.patchShelf.filter((share) => share.id !== input.id),
					comments: current.comments.filter(
						(comment) => !(comment.targetType === 'patch-share' && comment.targetId === input.id)
					),
					assignments: current.assignments.filter(
						(assignment) => !(assignment.targetType === 'patch-share' && assignment.targetId === input.id)
					),
				});
				if (removed) {
					appendCollaborationActivity({
						type: 'patch-share',
						action: 'deleted',
						status: 'info',
						title: `Patch shelf item removed: ${removed.name}`,
						description: `${removed.baseRef}...${removed.headRef} removed from local shelf.`,
						metadata: {
							repo: removed.repo,
						},
					});
				}
				void syncCollaborationStateIfEnabled();
				return { success: true };
			}),

		addComment: publicProcedure
			.input(
				z.object({
					targetType: collaborationCommentTargetSchema,
					targetId: z.string().min(1),
					body: z.string().min(1).max(5_000),
				})
			)
			.mutation(({ input }) => {
				const identity = getCollaborationIdentity();
				const author = identity.displayName || 'Local collaborator';
				const comment = upsertCollaborationComment({
					targetType: input.targetType,
					targetId: input.targetId,
					body: input.body,
					author,
				});
				appendCollaborationActivity({
					type: 'comment',
					action: 'created',
					status: 'info',
					title: `Comment added by ${author}`,
					description: comment.body,
					metadata: {
						targetType: comment.targetType,
						targetId: comment.targetId,
					},
					actor: author,
				});
				void syncCollaborationStateIfEnabled();
				return { success: true, comment };
			}),

		deleteComment: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const removed = deleteCollaborationComment(input.id);
				if (removed) {
					appendCollaborationActivity({
						type: 'comment',
						action: 'deleted',
						status: 'info',
						title: `Comment removed from ${removed.targetType}`,
						description: removed.body,
						metadata: {
							targetType: removed.targetType,
							targetId: removed.targetId,
						},
						actor: removed.author,
					});
				}
				void syncCollaborationStateIfEnabled();
				return { success: true };
			}),

		syncCommentToProvider: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
					repo: z.string().min(1),
					baseSha: z.string().optional(),
					startSha: z.string().optional(),
					headSha: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { success: false, error: initError, comment: null, remoteComment: null };
				}

				const comment = getCollaborationState().comments.find((entry) => entry.id === input.id) ?? null;
				if (!comment) {
					return { success: false, error: 'Collaboration comment not found.', comment: null, remoteComment: null };
				}
				if (comment.targetType !== 'pull-request' && comment.targetType !== 'pull-request-file') {
					return { success: false, error: 'Only pull request discussion can be synced to a provider.', comment: comment ?? null, remoteComment: null };
				}

				const target = parseCollaborationReviewCommentTarget(comment);
				if ('error' in target) {
					return { success: false, error: target.error, comment, remoteComment: null };
				}

				try {
					const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
					if (!remoteUrl) {
						const updatedComment = updateCollaborationCommentProviderSync(comment.id, {
							status: 'failed',
							provider: target.provider,
							error: 'No remotes configured for this repository.',
						});
						return { success: false, error: 'No remotes configured for this repository.', comment: updatedComment, remoteComment: null };
					}
					const auth = getStoredProviderAuthConfig();
						const remoteComment =
							target.kind === 'line-thread'
								? await addRemotePullRequestInlineComment(
										remoteUrl,
										target.provider,
										auth,
										target.pullRequestNumber,
										{
											body: target.body,
											filePath: target.filePath ?? '',
											line: target.line ?? 1,
											side: target.side ?? 'right',
											...(input.baseSha === undefined ? {} : { baseSha: input.baseSha }),
											...(input.startSha === undefined ? {} : { startSha: input.startSha }),
											...(input.headSha === undefined ? {} : { headSha: input.headSha }),
										}
								  )
								: await addRemotePullRequestComment(
										remoteUrl,
										target.provider,
									auth,
									target.pullRequestNumber,
									target.body
							  );
					const updatedComment = updateCollaborationCommentProviderSync(comment.id, {
						status: 'synced',
						provider: target.provider,
						remoteCommentId: remoteComment.id,
						remoteUrl: remoteComment.url || undefined,
						syncedAt: Date.now(),
					});
					appendCollaborationActivity({
						type: 'comment',
						action: 'updated',
						status: 'success',
						title: `Comment mirrored to ${target.provider}`,
						description:
							target.kind === 'line-thread'
								? `${target.filePath}:${String(target.line)} synced to the provider review thread.`
								: 'Shared collaboration note mirrored to the provider pull request discussion.',
						metadata: {
							commentId: comment.id,
							targetId: comment.targetId,
							provider: target.provider,
							pullRequestNumber: target.pullRequestNumber,
						},
						actor: comment.author,
					});
					return { success: true, error: null, comment: updatedComment, remoteComment };
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Failed to sync comment to provider.';
					const updatedComment = updateCollaborationCommentProviderSync(comment.id, {
						status: 'failed',
						provider: target.provider,
						error: message,
					});
					appendCollaborationActivity({
						type: 'comment',
						action: 'updated',
						status: 'failed',
						title: `Comment sync failed for ${target.provider}`,
						description: message,
						metadata: {
							commentId: comment.id,
							targetId: comment.targetId,
							provider: target.provider,
							pullRequestNumber: target.pullRequestNumber,
						},
						actor: comment.author,
					});
					return { success: false, error: message, comment: updatedComment, remoteComment: null };
				}
			}),

		importProviderComments: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure']),
					number: z.number().int().positive(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { success: false, error: initError, imported: 0 };
				}

				try {
					const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
					if (!remoteUrl) {
						return { success: false, error: 'No remotes configured for this repository.', imported: 0 };
					}
					const repoKey = deriveCollaborationRepoKey(remoteUrl);
					const auth = getStoredProviderAuthConfig();
					const providerComments = await listRemotePullRequestComments(
						remoteUrl,
						input.provider as PullRequestProvider,
						auth,
						input.number
					);
					const current = getCollaborationState();
					const importedComments = providerComments.map((comment) => {
						const target = toCollaborationTargetIdFromProviderComment(
							input.provider as PullRequestProvider,
							repoKey,
							input.number,
							comment
						);
						return {
							id: `provider-comment:${input.provider}:${String(input.number)}:${comment.id}`,
							targetType: target.targetType,
							targetId: target.targetId,
							author: comment.author || input.provider,
							body: comment.body,
							createdAt: Date.parse(comment.createdAt) || Date.now(),
							updatedAt: Date.parse(comment.updatedAt) || Date.now(),
							providerSync: {
								status: 'synced' as const,
								provider: input.provider as PullRequestProvider,
								remoteCommentId: comment.id,
								...(comment.thread?.id ? { remoteThreadId: comment.thread.id } : {}),
								...(comment.thread?.status ? { remoteThreadStatus: comment.thread.status } : {}),
								remoteUrl: comment.url || undefined,
								syncedAt: Date.now(),
							},
						};
					});
					setCollaborationState({
						workspaceShares: current.workspaceShares,
						patchShelf: current.patchShelf,
						comments: mergeCollaborationRecords(current.comments, importedComments),
						assignments: current.assignments,
					});
					appendCollaborationActivity({
						type: 'comment',
						action: 'imported',
						status: 'success',
						title: `Imported provider review discussion from ${input.provider}`,
						description: `${providerComments.length} comment${providerComments.length === 1 ? '' : 's'} mirrored into local collaboration threads for PR #${String(input.number)}.`,
						metadata: {
							provider: input.provider,
							pullRequestNumber: input.number,
							imported: providerComments.length,
						},
					});
					return { success: true, error: null, imported: providerComments.length };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to import provider review discussion.',
						imported: 0,
					};
				}
			}),

		setProviderThreadResolved: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
					repo: z.string().min(1),
					resolved: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { success: false, error: initError, comment: null };
				}

				const state = getCollaborationState();
				const comment = state.comments.find((entry) => entry.id === input.id) ?? null;
				if (!comment?.providerSync?.remoteThreadId || !comment.providerSync.provider) {
					return { success: false, error: 'This comment is not linked to a provider thread.', comment: null };
				}

				const parsedTarget = parseCollaborationReviewTargetId(comment.targetId);
				if (!parsedTarget) {
					return { success: false, error: 'Comment target is not linked to a pull request.', comment };
				}

				try {
					const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
					if (!remoteUrl) {
						return { success: false, error: 'No remotes configured for this repository.', comment };
					}
					const auth = getStoredProviderAuthConfig();
					const threadState = await setRemotePullRequestThreadResolved(
						remoteUrl,
						comment.providerSync.provider,
						auth,
						parsedTarget.pullRequestNumber,
						comment.providerSync.remoteThreadId,
						input.resolved
					);

						const nextComments = state.comments.map((entry) => {
							const providerSync = entry.providerSync;
							if (
								!providerSync ||
								providerSync.provider !== comment.providerSync?.provider ||
								providerSync.remoteThreadId !== comment.providerSync?.remoteThreadId
							) {
								return entry;
							}
							return {
								...entry,
								updatedAt: Date.now(),
								providerSync: {
									...providerSync,
									remoteThreadStatus: threadState.status,
									syncedAt: Date.now(),
								},
							};
						});
					setCollaborationState({
						workspaceShares: state.workspaceShares,
						patchShelf: state.patchShelf,
						comments: nextComments,
						assignments: state.assignments,
					});
						appendCollaborationActivity({
							type: 'comment',
							action: 'updated',
							status: 'success',
							title: `${input.resolved ? 'Resolved' : 'Reopened'} provider thread`,
							description: `${comment.providerSync.provider} thread ${comment.providerSync.remoteThreadId} is now ${threadState.status}.`,
							metadata: {
								commentId: comment.id,
								threadId: comment.providerSync.remoteThreadId,
								provider: comment.providerSync.provider,
							},
							...(getCollaborationIdentity().displayName ? { actor: getCollaborationIdentity().displayName } : {}),
						});
					void syncCollaborationStateIfEnabled();
					return {
						success: true,
						error: null,
						comment: nextComments.find((entry) => entry.id === input.id) ?? comment,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to update provider thread state.',
						comment,
					};
				}
			}),

		syncProviderReviewAssignments: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure']),
					number: z.number().int().positive(),
				})
			)
			.mutation(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError) {
					return { success: false, error: initError, synced: 0, removed: 0, reviewState: null };
				}

				try {
					const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
					if (!remoteUrl) {
						return { success: false, error: 'No remotes configured for this repository.', synced: 0, removed: 0, reviewState: null };
					}
					const repoKey = deriveCollaborationRepoKey(remoteUrl);
					const auth = getStoredProviderAuthConfig();
					const reviewState = await getRemotePullRequestReviewState(
						remoteUrl,
						input.provider as PullRequestProvider,
						auth,
						input.number
					);
					const targetId = buildCollaborationPullRequestTargetId({
						provider: input.provider as PullRequestProvider,
						repoKey,
						pullRequestNumber: input.number,
					});
					const current = getCollaborationState();
					const existingAssignments = current.assignments.filter(
						(assignment) =>
							assignment.targetType === 'pull-request' &&
							parseCollaborationReviewTargetId(assignment.targetId)?.pullRequestNumber === input.number &&
							parseCollaborationReviewTargetId(assignment.targetId)?.provider === input.provider &&
							assignment.providerSync?.provider === input.provider
					);
					const syncedAt = Date.now();
					const nextAssignments = reviewState.reviewers.map((reviewer) => {
						const stableAssignmentId = `provider-review-assignment:${input.provider}:${encodeURIComponent(repoKey ?? 'repo')}:${String(input.number)}:${encodeURIComponent(reviewer.id)}`;
						const existingAssignment =
							existingAssignments.find((assignment) => assignment.id === stableAssignmentId) ??
							existingAssignments.find((assignment) => assignment.providerSync?.reviewerId === reviewer.id);
						return upsertCollaborationAssignment({
							id: existingAssignment?.id ?? stableAssignmentId,
							targetType: 'pull-request',
							targetId,
							assigneeId: reviewer.id,
							assigneeName: reviewer.name,
							status: mapProviderReviewerStatusToAssignmentStatus(reviewer.status),
							note:
								existingAssignment?.note ||
								`Provider review state: ${reviewer.status.replace(/-/g, ' ')}${reviewer.required ? ' · required reviewer' : ''}`,
							createdBy: existingAssignment?.createdBy ?? `${input.provider} review sync`,
							providerSync: {
								provider: input.provider as PullRequestProvider,
								reviewerId: reviewer.id,
								reviewerName: reviewer.name,
								reviewerStatus: reviewer.status,
								...(reviewer.providerState ? { providerState: reviewer.providerState } : {}),
								syncedAt,
							},
						});
					});

					const nextReviewerIds = new Set(reviewState.reviewers.map((reviewer) => reviewer.id));
					let removed = 0;
					for (const assignment of existingAssignments) {
						const reviewerId = assignment.providerSync?.reviewerId ?? assignment.assigneeId;
						if (!nextReviewerIds.has(reviewerId)) {
							deleteCollaborationAssignment(assignment.id);
							removed += 1;
						}
					}

					appendCollaborationActivity({
						type: 'assignment',
						action: 'updated',
						status: 'success',
						title: `Synced ${input.provider} reviewer state for PR #${String(input.number)}`,
						description: `${reviewState.reviewers.length} provider reviewer${reviewState.reviewers.length === 1 ? '' : 's'} mirrored into the shared review queue.`,
						metadata: {
							provider: input.provider,
							pullRequestNumber: input.number,
							synced: nextAssignments.length,
							removed,
							overall: reviewState.overall,
						},
					});
					void syncCollaborationStateIfEnabled();
					return {
						success: true,
						error: null,
						synced: nextAssignments.length,
						removed,
						reviewState,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to sync provider reviewer state.',
						synced: 0,
						removed: 0,
						reviewState: null,
					};
				}
			}),

		comments: publicProcedure
			.input(
				z.object({
					targetType: collaborationCommentTargetSchema.optional(),
					targetId: z.string().min(1).optional(),
				}).optional()
			)
			.query(({ input }) => {
				return {
					comments: listCollaborationComments(input?.targetType, input?.targetId),
				};
			}),

		assignments: publicProcedure
			.input(
				z.object({
					targetType: collaborationCommentTargetSchema.optional(),
					targetId: z.string().min(1).optional(),
				}).optional()
			)
			.query(({ input }) => {
				return {
					assignments: listCollaborationAssignments(input?.targetType, input?.targetId),
				};
			}),

		assignItem: publicProcedure
			.input(
				z.object({
					targetType: collaborationCommentTargetSchema,
					targetId: z.string().min(1),
					assigneeId: z.string().min(1),
					assigneeName: z.string().min(1),
					status: collaborationAssignmentStatusSchema.default('open'),
					note: z.string().max(280).optional(),
				})
			)
			.mutation(({ input }) => {
				const identity = getCollaborationIdentity();
				const createdBy = identity.displayName || 'Local collaborator';
					const assignment = upsertCollaborationAssignment({
						targetType: input.targetType,
						targetId: input.targetId,
						assigneeId: input.assigneeId,
						assigneeName: input.assigneeName,
						status: input.status,
						...(input.note === undefined ? {} : { note: input.note }),
						createdBy,
					});
					appendCollaborationActivity({
						type: 'assignment',
						action: 'created',
						status: 'info',
						title: `Assigned to ${assignment.assigneeName}`,
						description: assignment.note || `${assignment.targetType} queued for ${assignment.assigneeName}.`,
					metadata: {
						targetType: assignment.targetType,
						targetId: assignment.targetId,
						status: assignment.status,
					},
						actor: createdBy,
					});
				void syncCollaborationStateIfEnabled();
				return { success: true, assignment };
			}),

		updateAssignment: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
					status: collaborationAssignmentStatusSchema.optional(),
					note: z.string().max(280).optional(),
				})
			)
			.mutation(({ input }) => {
				const existing = getCollaborationState().assignments.find((assignment) => assignment.id === input.id);
				if (!existing) {
					return {
						success: false,
						error: 'Assignment not found.',
						assignment: null,
					};
				}
				const assignment = upsertCollaborationAssignment({
					id: existing.id,
					targetType: existing.targetType,
					targetId: existing.targetId,
					assigneeId: existing.assigneeId,
					assigneeName: existing.assigneeName,
					status: input.status ?? existing.status,
					note: input.note ?? existing.note,
					createdBy: existing.createdBy,
				});
				appendCollaborationActivity({
					type: 'assignment',
					action: 'updated',
					status: 'info',
					title: `Assignment updated: ${assignment.assigneeName}`,
					description: `Status moved to ${assignment.status}.`,
					metadata: {
						targetType: assignment.targetType,
						targetId: assignment.targetId,
						status: assignment.status,
					},
					actor: existing.createdBy,
				});
				void syncCollaborationStateIfEnabled();
				return { success: true, error: null, assignment };
			}),

		deleteAssignment: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				const removed = deleteCollaborationAssignment(input.id);
				if (removed) {
					appendCollaborationActivity({
						type: 'assignment',
						action: 'deleted',
						status: 'info',
						title: `Assignment removed: ${removed.assigneeName}`,
						description: removed.note || `Removed from ${removed.targetType}.`,
						metadata: {
							targetType: removed.targetType,
							targetId: removed.targetId,
						},
						actor: removed.createdBy,
					});
				}
				void syncCollaborationStateIfEnabled();
				return { success: true };
			}),

		remotePresence: publicProcedure.query(async () => {
			const remote = ensureCollaborationRemoteConfig();
			if ('error' in remote) {
				return {
					success: false,
					error: remote.error,
					entries: [],
				};
			}

			try {
				const identity = getCollaborationIdentity();
				const result = await requestCollaborationPresence({
					endpointUrl: remote.config.endpointUrl.trim(),
					authToken: remote.config.authToken,
					memberId: identity.memberId || undefined,
					memberApiKey: identity.memberApiKey || undefined,
					timeoutMs: remote.config.timeoutMs,
					projectId: remote.projectId,
				});
				return {
					success: true,
					error: null,
					entries: result.entries,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to load remote presence.',
					entries: [],
					};
				}
			}),

		remoteMembers: publicProcedure.query(async () => {
			const remote = ensureCollaborationRemoteConfig();
			if ('error' in remote) {
				return {
					success: false,
					error: remote.error,
					members: [],
				};
			}

			try {
				const identity = getCollaborationIdentity();
				const result = await requestCollaborationMembers({
					endpointUrl: remote.config.endpointUrl.trim(),
					authToken: remote.config.authToken,
					memberId: identity.memberId || undefined,
					memberApiKey: identity.memberApiKey || undefined,
					timeoutMs: remote.config.timeoutMs,
					projectId: remote.projectId,
				});
				return {
					success: true,
					error: null,
					members: result.members,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to load collaboration team roster.',
					members: [],
				};
			}
		}),

		teamProfile: publicProcedure.query(async () => {
			const remote = ensureCollaborationRemoteConfig();
			if ('error' in remote) {
				return {
					success: false,
					error: remote.error,
					profile: null,
				};
			}

			try {
				const identity = getCollaborationIdentity();
				const result = await requestCollaborationTeamProfile({
					endpointUrl: remote.config.endpointUrl.trim(),
					authToken: remote.config.authToken,
					memberId: identity.memberId || undefined,
					memberApiKey: identity.memberApiKey || undefined,
					timeoutMs: remote.config.timeoutMs,
					projectId: remote.projectId,
				});
				return {
					success: true,
					error: null,
					profile: result.profile,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to load collaboration team profile.',
					profile: null,
				};
			}
		}),

		updateTeamProfile: publicProcedure
			.input(
				z.object({
					organizationId: z.string().min(1),
					organizationName: z.string().min(1),
					teamId: z.string().min(1),
					teamName: z.string().min(1),
					defaultPermissionLevel: z.enum(['owner', 'manager', 'member', 'observer']),
				})
			)
			.mutation(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						profile: null,
					};
				}

				try {
					const identity = getCollaborationIdentity();
					const result = await upsertCollaborationTeamProfile({
						endpointUrl: remote.config.endpointUrl.trim(),
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						projectId: remote.projectId,
						profile: input,
					});
					return {
						success: true,
						error: null,
						profile: result.profile,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to update collaboration team profile.',
						profile: null,
					};
				}
			}),

		updateMember: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
					displayName: z.string().min(1),
					email: z.string().optional(),
					role: z.enum(['developer', 'reviewer', 'lead', 'qa']),
					permissionLevel: z.enum(['owner', 'manager', 'member', 'observer']).optional(),
					organizationId: z.string().optional(),
					organizationName: z.string().optional(),
					teamId: z.string().optional(),
					teamName: z.string().optional(),
					avatarUrl: z.string().optional(),
					deviceLabel: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						members: [],
					};
				}

				try {
					const identity = getCollaborationIdentity();
					const result = await upsertCollaborationMember({
						endpointUrl: remote.config.endpointUrl.trim(),
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						projectId: remote.projectId,
						member: {
							id: input.id,
							displayName: input.displayName,
							...(input.email ? { email: input.email } : {}),
							role: input.role,
							permissionLevel: input.permissionLevel ?? identity.permissionLevel,
							...(input.organizationId ? { organizationId: input.organizationId } : identity.organizationId ? { organizationId: identity.organizationId } : {}),
							...(input.organizationName ? { organizationName: input.organizationName } : identity.organizationName ? { organizationName: identity.organizationName } : {}),
							...(input.teamId ? { teamId: input.teamId } : identity.teamId ? { teamId: identity.teamId } : {}),
							...(input.teamName ? { teamName: input.teamName } : identity.teamName ? { teamName: identity.teamName } : {}),
							...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
							...(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
						},
					});
					return {
						success: true,
						error: null,
						members: result.members,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to update collaboration member.',
						members: [],
					};
				}
			}),

		removeMember: publicProcedure
			.input(
				z.object({
					id: z.string().min(1),
				})
			)
			.mutation(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						members: [],
					};
				}

				try {
					const identity = getCollaborationIdentity();
					const result = await removeCollaborationMember({
						endpointUrl: remote.config.endpointUrl.trim(),
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						projectId: remote.projectId,
						targetMemberId: input.id,
					});
					return {
						success: true,
						error: null,
						members: result.members,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to remove collaboration member.',
						members: [],
					};
				}
			}),

		publishSession: publicProcedure.mutation(async () => {
			const remote = ensureCollaborationRemoteConfig();
			if ('error' in remote) {
				return {
					success: false,
					error: remote.error,
					members: [],
				};
			}

			const identity = getCollaborationIdentity();
			if (!identity.displayName || !identity.memberId) {
				return {
					success: false,
					error: 'Collaboration identity is not configured.',
					members: [],
				};
			}

			try {
				const result = await publishCollaborationSession({
					endpointUrl: remote.config.endpointUrl.trim(),
					authToken: remote.config.authToken,
					memberId: identity.memberId || undefined,
					memberApiKey: identity.memberApiKey || undefined,
					timeoutMs: remote.config.timeoutMs,
					projectId: remote.projectId,
					member: {
						id: identity.memberId,
						displayName: identity.displayName,
						...(identity.email ? { email: identity.email } : {}),
						role: identity.role,
						permissionLevel: identity.permissionLevel,
						...(identity.organizationId ? { organizationId: identity.organizationId } : {}),
						...(identity.organizationName ? { organizationName: identity.organizationName } : {}),
						...(identity.teamId ? { teamId: identity.teamId } : {}),
						...(identity.teamName ? { teamName: identity.teamName } : {}),
						...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
						deviceLabel: identity.deviceLabel,
					},
				});
				return {
					success: true,
					error: null,
					members: result.members,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to publish collaboration session.',
					members: [],
				};
			}
		}),

		publishPresence: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1).nullable().optional(),
					branch: z.string().min(1).nullable().optional(),
					status: z.string().max(140).nullable().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						entries: [],
					};
				}

				const identity = getCollaborationIdentity();
				if (!remote.config.presenceEnabled || !identity.displayName || !identity.presenceId) {
					return {
						success: false,
						error: 'Collaboration identity is not configured for live presence.',
						entries: [],
					};
				}

				try {
					const result = await publishCollaborationPresence({
						endpointUrl: remote.config.endpointUrl.trim(),
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						projectId: remote.projectId,
						presence: {
							id: identity.presenceId,
							actor: identity.displayName,
							deviceLabel: identity.deviceLabel,
							repo: input.repo ?? null,
							branch: input.branch ?? null,
							status: input.status ?? null,
						},
					});
					return {
						success: true,
						error: null,
						entries: result.entries,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to publish presence.',
						entries: [],
					};
				}
			}),

		teamInsights: publicProcedure.query(async () => {
			const remote = ensureCollaborationRemoteConfig();
			if ('error' in remote) {
				return {
					success: false,
					error: remote.error,
					insights: null,
				};
			}

			try {
				const identity = getCollaborationIdentity();
				const insights = await requestCollaborationTeamInsights({
					endpointUrl: remote.config.endpointUrl.trim(),
					authToken: remote.config.authToken,
					memberId: identity.memberId || undefined,
					memberApiKey: identity.memberApiKey || undefined,
					timeoutMs: remote.config.timeoutMs,
					projectId: remote.projectId,
				});
				return {
					success: true,
					error: null,
					insights,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Failed to load collaboration team insights.',
					insights: null,
				};
			}
		}),

		remoteActivity: publicProcedure
			.input(
				z.object({
					limit: z.number().int().min(1).max(100).default(30),
				}).optional()
			)
			.query(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						entries: [],
					};
				}

				try {
					const identity = getCollaborationIdentity();
					const result = await requestCollaborationRemoteActivity({
						endpointUrl: remote.config.endpointUrl.trim(),
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						projectId: remote.projectId,
						limit: input?.limit ?? 30,
					});
					return {
						success: true,
						error: null,
						entries: result.entries,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : 'Failed to load remote collaboration activity.',
						entries: [],
					};
				}
			}),

		syncRemote: publicProcedure
			.input(
				z.object({
					direction: z.enum(['push', 'pull', 'roundtrip']),
				})
			)
			.mutation(async ({ input }) => {
				const remote = ensureCollaborationRemoteConfig();
				if ('error' in remote) {
					return {
						success: false,
						error: remote.error,
						bundle: null,
					};
				}

				setCollaborationSyncState({ lastSyncStatus: 'syncing', lastSyncError: null });

				try {
					const identity = getCollaborationIdentity();
					const localBundle = buildCollaborationBundle(remote.projectId);
					const remoteBundle = await requestCollaborationSync({
						endpointUrl: remote.config.endpointUrl.trim(),
						projectId: remote.projectId,
						authToken: remote.config.authToken,
						memberId: identity.memberId || undefined,
						memberApiKey: identity.memberApiKey || undefined,
						timeoutMs: remote.config.timeoutMs,
						direction: input.direction,
						bundle: localBundle,
						actor: identity.displayName || undefined,
					});

					if (remoteBundle) {
						const current = getCollaborationState();
						setCollaborationState({
							workspaceShares:
								input.direction === 'pull'
									? remoteBundle.workspaceShares
									: mergeCollaborationRecords(current.workspaceShares, remoteBundle.workspaceShares),
							patchShelf:
								input.direction === 'pull'
									? remoteBundle.patchShelf
									: mergeCollaborationRecords(current.patchShelf, remoteBundle.patchShelf),
							comments:
								input.direction === 'pull'
									? remoteBundle.comments
									: mergeCollaborationRecords(current.comments, remoteBundle.comments),
							assignments:
								input.direction === 'pull'
									? remoteBundle.assignments
									: mergeCollaborationRecords(current.assignments, remoteBundle.assignments),
						});
					}

					const syncedAt = Date.now();
					setCollaborationSyncState({
						lastSyncStatus: 'success',
						lastSyncedAt: syncedAt,
						lastSyncError: null,
					});
						appendCollaborationActivity({
							type: 'remote-sync',
							action: input.direction === 'pull' ? 'pulled' : input.direction === 'push' ? 'pushed' : 'roundtrip',
							status: 'success',
							title: `Collaboration ${input.direction} sync completed`,
							description: `Endpoint ${remote.config.endpointUrl.trim()} responded successfully.`,
							metadata: {
								projectId: remote.projectId,
								endpointUrl: remote.config.endpointUrl.trim(),
							},
							...(identity.displayName ? { actor: identity.displayName } : {}),
						});
					return {
						success: true,
						error: null,
						bundle: remoteBundle ?? localBundle,
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Collaboration sync failed.';
					setCollaborationSyncState({
						lastSyncStatus: 'error',
						lastSyncedAt: Date.now(),
						lastSyncError: message,
					});
					appendCollaborationActivity({
						type: 'remote-sync',
						action: 'failed',
						status: 'failed',
						title: `Collaboration ${input.direction} sync failed`,
						description: message,
						metadata: {
							projectId: remote.projectId,
							endpointUrl: remote.config.endpointUrl.trim(),
						},
					});
					return {
						success: false,
						error: message,
						bundle: null,
					};
				}
			}),
	}),

	commitFilters: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
			})
		)
		.query(({ input }) => {
			const current = instanceStore.get('commitFiltersByRepo');
			return {
				filters: current?.[input.repo] ?? {},
			};
		}),

	setCommitFilters: publicProcedure
		.input(commitFilterStateSchema)
		.mutation(({ input }) => {
			const current = instanceStore.get('commitFiltersByRepo') ?? {};
			const { repo, ...filters } = input;
			const nextFilters = Object.fromEntries(
				Object.entries(filters).filter(([, value]) => typeof value === 'string' && value.length > 0)
			);
			instanceStore.set('commitFiltersByRepo', {
				...current,
				[repo]: nextFilters,
			});
			return {
				success: true,
				filters: nextFilters,
			};
		}),

	pinnedCommits: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
			})
		)
		.query(({ input }) => {
			const current = instanceStore.get('pinnedCommitsByRepo') ?? {};
			return {
				commits: current[input.repo] ?? [],
			};
		}),

	setPinnedCommits: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
				commits: z.array(pinnedCommitSchema),
			})
		)
		.mutation(({ input }) => {
			const current = instanceStore.get('pinnedCommitsByRepo') ?? {};
			instanceStore.set('pinnedCommitsByRepo', {
				...current,
				[input.repo]: input.commits,
			});
			return {
				success: true,
				commits: input.commits,
			};
		}),

	recentRepoDetails: publicProcedure.query(() => {
		return {
			repos: instanceStore.get('recentRepoDetails') ?? [],
		};
	}),

	setRecentRepoDetails: publicProcedure
		.input(
			z.object({
				repos: z.array(recentRepoSchema),
			})
		)
		.mutation(({ input }) => {
			instanceStore.set('recentRepoDetails', input.repos);
			return {
				success: true,
				repos: input.repos,
			};
		}),

	undoHistory: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
			})
		)
		.query(({ input }) => {
			const current = instanceStore.get('undoHistoryByRepo') ?? {};
			return {
				history: current[input.repo] ?? { operations: [], currentIndex: -1 },
			};
		}),

	setUndoHistory: publicProcedure
		.input(
			z.object({
				repo: z.string().min(1),
				operations: z.array(undoHistoryOperationSchema),
				currentIndex: z.number().int(),
			})
		)
		.mutation(({ input }) => {
			const current = instanceStore.get('undoHistoryByRepo') ?? {};
			const nextHistory = {
				operations: input.operations.slice(0, 100),
				currentIndex: input.currentIndex,
			};
			instanceStore.set('undoHistoryByRepo', {
				...current,
				[input.repo]: nextHistory,
			});
			return {
				success: true,
				history: nextHistory,
			};
		}),

	policy: router({
		get: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
				})
			)
			.query(({ input }) => {
				const policy = getRepoPolicy(input.repo);
				return { policy, error: null as string | null };
			}),

			set: publicProcedure
				.input(
					z.object({
						repo: z.string().min(1),
						policy: repoPolicySchema.partial(),
					})
				)
				.mutation(({ input }) => {
					const nextPolicy = upsertRepoPolicy(input.repo, normalizeRepoPolicyPatch(input.policy));
					return { success: true, policy: nextPolicy };
				}),
	}),

	review: router({
		summary: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
					baseRef: z.string().min(1),
					headRef: z.string().min(1),
				})
			)
			.query(async ({ input }) => {
				const initError = await ensureGitInitialized();
				if (initError !== null) {
					return {
						files: [] as string[],
						progress: null,
						error: initError,
					};
				}

				const root = await getGitService().getRepoRoot(input.repo);
				if (!root) {
					return {
						files: [] as string[],
						progress: null,
						error: 'Not a Git repository.',
					};
				}

				const diffOutput = await getGitService().runGitCommandWithOutput(
					['diff', '--name-only', `${input.baseRef}...${input.headRef}`],
					root
				);
				const files = (diffOutput ?? '')
					.split('\n')
					.map((file) => file.trim())
					.filter(Boolean);
				const progress = getCodeReviewProgress(root, input.reviewId) ?? {
					lastActive: 0,
					lastViewedFile: null,
					remainingFiles: files,
				};
				const normalizedRemaining = progress.remainingFiles.filter((file) => files.includes(file));
				const effectiveRemaining = normalizedRemaining.length > 0 || files.length === 0 ? normalizedRemaining : files;

				return {
					files,
					progress: {
						lastActive: progress.lastActive,
						lastViewedFile: progress.lastViewedFile,
						remainingFiles: effectiveRemaining,
						reviewedCount: Math.max(0, files.length - effectiveRemaining.length),
						totalFiles: files.length,
					},
					error: null as string | null,
				};
			}),

		update: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
					lastViewedFile: z.string().nullable().optional(),
					remainingFiles: z.array(z.string()).optional(),
				})
			)
			.mutation(({ input }) => {
				const next = updateCodeReviewProgress(input.repo, input.reviewId, {
					...(input.lastViewedFile !== undefined ? { lastViewedFile: input.lastViewedFile } : {}),
					...(input.remainingFiles ? { remainingFiles: input.remainingFiles } : {}),
				});
				return { success: true, progress: next };
			}),

		reset: publicProcedure
			.input(
				z.object({
					repo: z.string().min(1),
					reviewId: z.string().min(1),
				})
			)
			.mutation(({ input }) => {
				resetCodeReviewProgress(input.repo, input.reviewId);
				return { success: true };
			}),
	}),

	audit: router({
		list: publicProcedure
			.input(
				z.object({
					repo: z.string().nullable().optional(),
					limit: z.number().int().min(1).max(500).optional().default(100),
				})
			)
			.query(({ input }) => {
				const entries = listAuditEntries(input.repo, input.limit);
				return { entries, error: null as string | null };
			}),
	}),

	/**
	 * Search for repositories in a directory.
	 */
	search: publicProcedure
		.input(
			z.object({
				directory: z.string(),
				maxDepth: z.number().default(0),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					found: false,
					error: `Unable to initialize Git: ${initError}`,
				};
			}

			const manager = getRepoManager(getGitService());
			const found = await manager.searchDirectoryForRepos(input.directory, input.maxDepth);
			return { found };
		}),

	/**
	 * Aggregate launchpad status for multiple repositories.
	 */
	launchpad: publicProcedure
		.input(
			z.object({
				repos: z.array(z.string()).max(100),
				includePullRequests: z.boolean().optional().default(true),
			})
		)
		.query(async ({ input }) => {
			const initError = await ensureGitInitialized();
			const statusMapStore = instanceStore.get('launchpadStatusMap') ?? {};
			if (initError !== null) {
				return {
					repos: input.repos.map((repoPath) => ({
						path: repoPath,
						name: repoPath.split('/').pop() ?? repoPath,
						head: null,
						dirtyCount: 0,
						ahead: 0,
						behind: 0,
						lastCommit: null,
						provider: null,
						openPullRequests: null,
						needsAttention: false,
						stale: false,
						statusSignals: [] as string[],
						mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
						error: initError,
					})),
					error: initError,
				};
			}

			const gitService = getGitService();
			const authConfig = getStoredProviderAuthConfig();

			const repos = await Promise.all(
				input.repos.map(async (repoPath) => {
					const normalizedPath = repoPath.trim();
					if (!normalizedPath) {
						return {
							path: repoPath,
							name: repoPath.split('/').pop() ?? repoPath,
							head: null as string | null,
							dirtyCount: 0,
							ahead: 0,
							behind: 0,
							lastCommit: null as {
								hash: string;
								message: string;
								author: string;
								timestamp: number;
							} | null,
							provider: null as string | null,
							openPullRequests: null as number | null,
							needsAttention: false,
							stale: false,
							statusSignals: [] as string[],
							mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
							error: 'Repository path is empty.',
						};
					}

					const root = await gitService.getRepoRoot(normalizedPath);
					if (!root) {
						return {
							path: normalizedPath,
							name: normalizedPath.split('/').pop() ?? normalizedPath,
							head: null as string | null,
							dirtyCount: 0,
							ahead: 0,
							behind: 0,
							lastCommit: null as {
								hash: string;
								message: string;
								author: string;
								timestamp: number;
							} | null,
							provider: null as string | null,
							openPullRequests: null as number | null,
							needsAttention: false,
							stale: false,
							statusSignals: [] as string[],
							mappedStatuses: [] as Array<{ key: string; label: string; severity: 'info' | 'warn' | 'error' }>,
							error: 'Not a Git repository.',
						};
					}

					const [headRaw, statusRaw, aheadBehindRaw, lastCommitRaw, originRemoteRaw] = await Promise.all([
						gitService.runGitCommandWithOutput(['rev-parse', '--abbrev-ref', 'HEAD'], root),
						gitService.runGitCommandWithOutput(['status', '--porcelain'], root),
						gitService.runGitCommandWithOutput(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], root),
						gitService.runGitCommandWithOutput(['log', '-1', '--format=%h%x1f%s%x1f%ct%x1f%an'], root),
						gitService.runGitCommandWithOutput(['config', '--get', 'remote.origin.url'], root),
					]);

					let ahead = 0;
					let behind = 0;
					const aheadBehindMatch = aheadBehindRaw?.trim().match(/^(\d+)\s+(\d+)/);
					if (aheadBehindMatch?.[1] && aheadBehindMatch[2]) {
						ahead = parseInt(aheadBehindMatch[1], 10);
						behind = parseInt(aheadBehindMatch[2], 10);
					}

					let lastCommit: {
						hash: string;
						message: string;
						author: string;
						timestamp: number;
					} | null = null;
					const commitTokens = (lastCommitRaw ?? '').split('\x1f');
					if (
						commitTokens.length >= 4 &&
						commitTokens[0] &&
						commitTokens[1] &&
						commitTokens[2] &&
						commitTokens[3]
					) {
						lastCommit = {
							hash: commitTokens[0],
							message: commitTokens[1],
							timestamp: parseInt(commitTokens[2], 10) * 1000,
							author: commitTokens[3],
						};
					}

					const originRemote = originRemoteRaw?.trim() || null;
					const provider = originRemote ? parsePullRequestRemoteUrl(originRemote)?.provider ?? null : null;

					let openPullRequests: number | null = null;
					if (input.includePullRequests && originRemote && provider) {
						try {
							const pullRequests = await listRemotePullRequests(originRemote, provider, authConfig, 'open');
							openPullRequests = pullRequests.length;
						} catch {
							openPullRequests = null;
						}
					}

					const lastCommitAgeHours = lastCommit
						? Math.floor((Date.now() - lastCommit.timestamp) / (1000 * 60 * 60))
						: Number.POSITIVE_INFINITY;
					const stale = Number.isFinite(lastCommitAgeHours) && lastCommitAgeHours > 24 * 7;
					const statusSignals: string[] = [];
					const dirtyCount = (statusRaw ?? '')
						.split('\n')
						.map((line) => line.trim())
						.filter(Boolean).length;
					if (dirtyCount > 0) statusSignals.push('dirty');
					if (behind > 0) statusSignals.push('behind');
					if ((openPullRequests ?? 0) > 0) statusSignals.push('openPullRequests');
					if (stale) statusSignals.push('stale');
					const needsAttention = statusSignals.length > 0;

					const repoStatusMap = statusMapStore[root] ?? statusMapStore[normalizedPath] ?? {};
					const mappedStatuses = statusSignals
						.map((key) => ({ key, value: repoStatusMap[key] }))
						.filter((entry): entry is { key: string; value: { label: string; severity: 'info' | 'warn' | 'error' } } => Boolean(entry.value))
						.map((entry) => ({
							key: entry.key,
							label: entry.value.label,
							severity: entry.value.severity,
						}));

					return {
						path: root,
						name: root.split('/').pop() ?? root,
						head: headRaw?.trim() || null,
						dirtyCount,
						ahead,
						behind,
						lastCommit,
						provider,
						openPullRequests,
						needsAttention,
						stale,
						statusSignals,
						mappedStatuses,
						error: null as string | null,
					};
				})
			);

			return { repos, error: null as string | null };
		}),

	/**
	 * Fetch many repositories in batch.
	 */
	fetchMany: publicProcedure
		.input(
			z.object({
				repos: z.array(z.string()).max(100),
				prune: z.boolean().optional().default(true),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return {
					results: input.repos.map((repoPath) => ({
						path: repoPath,
						error: initError,
					})),
					error: initError,
				};
			}

			const gitService = getGitService();
			const results = await Promise.all(
				input.repos.map(async (repoPath) => {
					const root = await gitService.getRepoRoot(repoPath);
					if (!root) {
						return {
							path: repoPath,
							error: 'Not a Git repository.',
						};
					}
					const args = ['fetch', '--all'];
					if (input.prune) {
						args.push('--prune');
					}
					const error = await gitService.runGitCommand(args, root);
					return {
						path: root,
						error,
					};
				})
			);

			return { results, error: null as string | null };
		}),

	/**
	 * List remote repositories for a provider using stored account credentials.
	 */
	listRemoteRepositories: publicProcedure
		.input(
			z.object({
				provider: z.enum(['github', 'gitlab', 'bitbucket', 'azure']),
			})
		)
		.query(async ({ input }) => {
			try {
				if (input.provider === 'azure') {
					return {
						repositories: [] as RemoteRepository[],
						error: 'Azure DevOps repository listing requires organization/project context. Use clone URL directly.',
					};
				}

				const headers = buildProviderAuthHeader(input.provider);
				let repositories: RemoteRepository[] = [];

				if (input.provider === 'github') {
					const data = await requestProviderJson<Array<Record<string, unknown>>>(
						'https://api.github.com/user/repos?sort=updated&per_page=100',
						headers
					);
					repositories = data.map((repo) => ({
						provider: 'github',
						name: readString(repo.name),
						fullName: readString(repo.full_name, readString(repo.name)),
						description: readString(repo.description),
						cloneUrl: readString(repo.clone_url),
						sshUrl: readString(repo.ssh_url),
						webUrl: readString(repo.html_url),
						private: Boolean(repo.private),
						defaultBranch: readString(repo.default_branch, 'main'),
					}));
				}

				if (input.provider === 'gitlab') {
					const data = await requestProviderJson<Array<Record<string, unknown>>>(
						'https://gitlab.com/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&sort=desc&per_page=100',
						headers
					);
					repositories = data.map((repo) => ({
						provider: 'gitlab',
						name: readString(repo.name),
						fullName: readString(repo.path_with_namespace, readString(repo.name)),
						description: readString(repo.description),
						cloneUrl: readString(repo.http_url_to_repo),
						sshUrl: readString(repo.ssh_url_to_repo),
						webUrl: readString(repo.web_url),
						private: readString(repo.visibility) !== 'public',
						defaultBranch: readString(repo.default_branch, 'main'),
					}));
				}

				if (input.provider === 'bitbucket') {
					const data = await requestProviderJson<{ values?: Array<Record<string, unknown>> }>(
						'https://api.bitbucket.org/2.0/repositories?role=member&sort=-updated_on&pagelen=100',
						headers
					);
					repositories = (data.values ?? []).map((repo) => {
						const links = isRecord(repo.links) ? repo.links : {};
						const cloneLinks = Array.isArray(links.clone)
							? links.clone.filter((entry): entry is Record<string, unknown> => isRecord(entry))
							: [];
						const httpsLink = cloneLinks.find((entry) => readString(entry.name) === 'https');
						const sshLink = cloneLinks.find((entry) => readString(entry.name) === 'ssh');
						const htmlLink = isRecord(links.html) ? links.html : {};
						const mainBranch = isRecord(repo.mainbranch) ? repo.mainbranch : {};
						return {
							provider: 'bitbucket',
							name: readString(repo.name),
							fullName: readString(repo.full_name, readString(repo.name)),
							description: readString(repo.description),
							cloneUrl: readString(httpsLink?.href),
							sshUrl: readString(sshLink?.href),
							webUrl: readString(htmlLink.href),
							private: Boolean(repo.is_private),
							defaultBranch: readString(mainBranch.name, 'main'),
						};
					});
				}

				return { repositories, error: null as string | null };
			} catch (error) {
				return {
					repositories: [] as RemoteRepository[],
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Clone a repository into a destination directory and register it.
	 */
	clone: publicProcedure
		.input(
			z.object({
				url: z.string().min(1),
				destination: z.string().min(1),
				branch: z.string().optional(),
				depth: z.number().int().min(1).max(1000).optional(),
			})
		)
		.mutation(async ({ input }) => {
			const initError = await ensureGitInitialized();
			if (initError !== null) {
				return { root: null, error: `Unable to initialize Git: ${initError}` };
			}

			try {
				const destination = path.resolve(input.destination);
				const parentDir = path.dirname(destination);
				const destinationName = path.basename(destination);
				await fs.mkdir(parentDir, { recursive: true });

				const gitService = getGitService();
				const cloneArgs = ['clone'];
				if (input.branch) {
					cloneArgs.push('--branch', input.branch);
				}
				if (input.depth) {
					cloneArgs.push('--depth', String(input.depth));
				}
				cloneArgs.push(input.url, destinationName);

				const cloneError = await gitService.runGitCommand(cloneArgs, parentDir);
				if (cloneError) {
					return { root: null, error: cloneError };
				}

				const manager = getRepoManager(gitService);
				const result = await manager.registerRepo(destination);
				return {
					root: result.root ?? destination,
					error: result.error ?? null,
				};
			} catch (error) {
				return {
					root: null,
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}),

	/**
	 * Mute file watcher (before Git operations).
	 */
	muteWatcher: publicProcedure.mutation(() => {
		const manager = getRepoManager(getGitService());
		manager.muteWatcher();
		return { success: true };
	}),

	/**
	 * Unmute file watcher (after Git operations).
	 */
	unmuteWatcher: publicProcedure.mutation(() => {
		const manager = getRepoManager(getGitService());
		manager.unmuteWatcher();
		return { success: true };
	}),
});

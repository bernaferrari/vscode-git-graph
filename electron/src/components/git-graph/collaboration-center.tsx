import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { BarChart3, FolderGit2, PackageOpen, Server, Users } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	CollaborationActivityTab,
	type CollaborationRemoteHealth,
	CollaborationSummaryStrip,
	CollaborationSyncTab,
	PatchShelfTab,
	type CollaborationWorkspaceOption,
	WorkspaceHandoffsTab,
	type SyncConfigState,
} from '@/components/git-graph/collaboration-center-sections';
import {
	CollaborationTeamTab,
} from '@/components/git-graph/collaboration-center-team';
import { CollaborationReviewDashboardTab } from '@/components/git-graph/collaboration-review-dashboard';
import type {
	CollaborationAssignment,
	CollaborationComment,
	CollaborationMemberProfile,
	CollaborationReviewDashboard,
	CollaborationTeamProfile,
	CollaborationTeamInsights,
} from '@/components/git-graph/collaboration-types';
import { detectPullRequestProvider } from '@/components/git-graph/pull-request-provider';
import { buildCollaborationPullRequestTargetId, deriveCollaborationRepoKey, parseCollaborationReviewTargetId } from '@/lib/collaboration-review-targets';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface CollaborationCenterProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface CollaborationRemoteSource {
	name: string;
	url?: string | null;
}

interface CollaborationPullRequestSummary {
	state: 'open' | 'closed';
	number: number;
	title: string;
	base: { ref: string };
	head: { ref: string };
	webUrl: string;
	author: string;
	draft: boolean;
}

interface CollaborationMutationResult {
	error?: string | null;
}

interface CollaborationUpdateResult {
	success: boolean;
	error?: string | null;
}

interface CollaborationImportBundleResult {
	workspaceSharesImported: number;
	patchSharesImported: number;
	commentsImported: number;
	assignmentsImported: number;
}

interface CollaborationSyncMutationResult extends CollaborationUpdateResult {}

interface CollaborationSyncMutationVariables {
	direction: 'push' | 'pull' | 'roundtrip';
}

interface CollaborationWorkspaceQueryItem extends CollaborationWorkspaceOption {}

const DEFAULT_SYNC_CONFIG: SyncConfigState = {
	enabled: false,
	provider: 'self-host',
	endpointUrl: '',
	projectId: 'default',
	authToken: '',
	memberId: '',
	memberApiKey: '',
	displayName: '',
	email: '',
	role: 'developer',
	permissionLevel: 'member',
	organizationId: '',
	organizationName: '',
	teamId: '',
	teamName: '',
	avatarUrl: '',
	deviceLabel: globalThis.navigator?.platform || 'desktop',
	presenceEnabled: true,
	liveSyncEnabled: true,
	realtimeEnabled: true,
	timeoutMs: 15_000,
	autoSyncOnOpen: false,
	lastSyncedAt: null,
	lastSyncStatus: 'idle',
	lastSyncError: null,
};

export function CollaborationCenter({ open, onOpenChange }: CollaborationCenterProps) {
	const { activeRepo } = useAppStore();
	const { notifySuccess, notifyError, notifyInfo } = useAppNotifications();
	const utils = trpc.useUtils();
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const autoSyncTriggeredRef = useRef(false);

	const workspaceQuery = trpc.repo.workspace.list.useQuery(undefined, { enabled: open });
	const collaborationQuery = trpc.repo.collaboration.list.useQuery(undefined, { enabled: open, staleTime: 10_000 });
	const reviewDashboardQuery = trpc.repo.collaboration.reviewDashboard.useQuery(undefined, {
		enabled: open,
		staleTime: 10_000,
	});
	const collaborationActivityQuery = trpc.repo.collaboration.activity.useQuery({ limit: 40 }, { enabled: open, staleTime: 8_000 });
	const remotePresenceQuery = trpc.repo.collaboration.remotePresence.useQuery(undefined, {
		enabled: open,
		staleTime: 10_000,
		refetchInterval: open ? 30_000 : false,
	});
	const remoteMembersQuery = trpc.repo.collaboration.remoteMembers.useQuery(undefined, {
		enabled: open,
		staleTime: 20_000,
	});
	const remoteActivityQuery = trpc.repo.collaboration.remoteActivity.useQuery({ limit: 40 }, {
		enabled: open,
		staleTime: 12_000,
		refetchInterval: open ? 30_000 : false,
	});
	const teamInsightsQuery = trpc.repo.collaboration.teamInsights.useQuery(undefined, {
		enabled: open,
		staleTime: 15_000,
	});
	const teamProfileQuery = trpc.repo.collaboration.teamProfile.useQuery(undefined, {
		enabled: open,
		staleTime: 15_000,
	});
	const collaborationConfigQuery = trpc.config.collaborationSyncConfig.useQuery(undefined, {
		enabled: open,
		staleTime: 10_000,
	});
	const remotesQuery = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: open && !!activeRepo, staleTime: 10_000 }
	);
	const remotes = (remotesQuery.data?.remotes ?? []) as CollaborationRemoteSource[];
	const originUrl = remotes.find((remote) => remote.name === 'origin')?.url ?? undefined;
	const repoInfoQuery = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: true,
			showStashes: false,
			hideRemotes: [],
		},
		{ enabled: open && !!activeRepo, staleTime: 10_000 }
	);
	const detectedProvider = useMemo(
		() => detectPullRequestProvider(originUrl),
		[originUrl]
	);
	const collaborationRepoKey = useMemo(
		() => deriveCollaborationRepoKey(originUrl),
		[originUrl]
	);
	const pullRequestQuery = trpc.git.listPullRequests.useQuery(
		{
			repo: activeRepo ?? '',
			provider: detectedProvider?.name ?? 'github',
			state: 'open',
		},
		{
			enabled: open && !!activeRepo && !!detectedProvider,
			staleTime: 10_000,
		}
	);

	const invalidateCollaboration = async () => {
		await Promise.allSettled([
			utils.repo.collaboration.list.invalidate(),
			utils.repo.collaboration.reviewDashboard.invalidate(),
			utils.repo.collaboration.activity.invalidate(),
			utils.repo.collaboration.remotePresence.invalidate(),
			utils.repo.collaboration.remoteMembers.invalidate(),
			utils.repo.collaboration.remoteActivity.invalidate(),
			utils.repo.collaboration.teamInsights.invalidate(),
			utils.repo.collaboration.teamProfile.invalidate(),
			utils.config.collaborationSyncConfig.invalidate(),
		]);
	};

	const createWorkspaceShare = trpc.repo.collaboration.createWorkspaceShare.useMutation({
		onSuccess: async (result: CollaborationMutationResult) => {
			if (result.error) {
				notifyError('Workspace handoff creation failed', { description: result.error });
				return;
			}
			notifySuccess('Workspace handoff created');
			await invalidateCollaboration();
		},
	});
	const createPatchShare = trpc.repo.collaboration.createPatchShare.useMutation({
		onSuccess: async (result: CollaborationMutationResult) => {
			if (result.error) {
				notifyError('Patch shelf creation failed', { description: result.error });
				return;
			}
			notifySuccess('Patch saved to shelf');
			await invalidateCollaboration();
		},
	});
	const deleteWorkspaceShare = trpc.repo.collaboration.deleteWorkspaceShare.useMutation({
		onSuccess: async () => {
			await invalidateCollaboration();
		},
	});
	const deletePatchShare = trpc.repo.collaboration.deletePatchShare.useMutation({
		onSuccess: async () => {
			await invalidateCollaboration();
		},
	});
	const addCommentMutation = trpc.repo.collaboration.addComment.useMutation({
		onSuccess: async () => {
			notifySuccess('Collaboration comment added', { persist: false });
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to add collaboration comment', { description: error.message });
		},
	});
	const deleteCommentMutation = trpc.repo.collaboration.deleteComment.useMutation({
		onSuccess: async () => {
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to delete collaboration comment', { description: error.message });
		},
	});
	const assignItemMutation = trpc.repo.collaboration.assignItem.useMutation({
		onSuccess: async () => {
			notifySuccess('Assignment created', { persist: false });
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to create assignment', { description: error.message });
		},
	});
	const updateAssignmentMutation = trpc.repo.collaboration.updateAssignment.useMutation({
		onSuccess: async (result: CollaborationUpdateResult) => {
			if (result.success) {
				await invalidateCollaboration();
				return;
			}
			notifyError('Failed to update assignment', { description: result.error ?? 'Unknown assignment error' });
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to update assignment', { description: error.message });
		},
	});
	const deleteAssignmentMutation = trpc.repo.collaboration.deleteAssignment.useMutation({
		onSuccess: async () => {
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to delete assignment', { description: error.message });
		},
	});
	const updateMemberMutation = trpc.repo.collaboration.updateMember.useMutation({
		onSuccess: async (result: CollaborationUpdateResult) => {
			if (!result.success) {
				notifyError('Failed to update member', { description: result.error ?? 'Unknown member update error' });
				return;
			}
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to update member', { description: error.message });
		},
	});
	const updateTeamProfileMutation = trpc.repo.collaboration.updateTeamProfile.useMutation({
		onSuccess: async (result: CollaborationUpdateResult) => {
			if (!result.success) {
				notifyError('Failed to update team profile', { description: result.error ?? 'Unknown team profile error' });
				return;
			}
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to update team profile', { description: error.message });
		},
	});
	const removeMemberMutation = trpc.repo.collaboration.removeMember.useMutation({
		onSuccess: async (result: CollaborationUpdateResult) => {
			if (!result.success) {
				notifyError('Failed to remove member', { description: result.error ?? 'Unknown member removal error' });
				return;
			}
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to remove member', { description: error.message });
		},
	});
	const saveSyncConfigMutation = trpc.config.setCollaborationSyncConfig.useMutation({
		onSuccess: async () => {
			notifySuccess('Collaboration sync settings saved');
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Failed to save collaboration sync settings', { description: error.message });
		},
	});
	const importBundleMutation = trpc.repo.collaboration.importBundle.useMutation({
		onSuccess: async (result: CollaborationImportBundleResult) => {
			notifySuccess('Collaboration bundle imported', {
				description: `${result.workspaceSharesImported} handoff${result.workspaceSharesImported === 1 ? '' : 's'}, ${result.patchSharesImported} patch${result.patchSharesImported === 1 ? '' : 'es'}, ${result.commentsImported} comment${result.commentsImported === 1 ? '' : 's'}, and ${result.assignmentsImported} assignment${result.assignmentsImported === 1 ? '' : 's'} applied`,
			});
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Collaboration import failed', { description: error.message });
		},
	});
	const syncRemoteMutation = trpc.repo.collaboration.syncRemote.useMutation({
		onSuccess: async (result: CollaborationSyncMutationResult, variables: CollaborationSyncMutationVariables) => {
			if (!result.success) {
				notifyError('Collaboration sync failed', { description: result.error ?? 'Unknown sync failure' });
				await invalidateCollaboration();
				return;
			}
			notifySuccess(
				variables.direction === 'push'
					? 'Collaboration state pushed'
					: variables.direction === 'pull'
						? 'Collaboration state pulled'
						: 'Collaboration sync completed'
			);
			await invalidateCollaboration();
		},
		onError: (error: { message: string }) => {
			notifyError('Collaboration sync failed', { description: error.message });
		},
	});
	const probeRemoteMutation = trpc.repo.collaboration.probeRemote.useMutation();
	const publishPresenceMutation = trpc.repo.collaboration.publishPresence.useMutation();
	const publishSessionMutation = trpc.repo.collaboration.publishSession.useMutation();

	const workspaces = (workspaceQuery.data?.workspaces ?? []) as CollaborationWorkspaceQueryItem[];
	const workspaceShares = collaborationQuery.data?.workspaceShares ?? [];
	const patchShelf = collaborationQuery.data?.patchShelf ?? [];
	const comments = (collaborationQuery.data?.comments ?? []) as CollaborationComment[];
	const assignments = (collaborationQuery.data?.assignments ?? []) as CollaborationAssignment[];
	const activity = collaborationActivityQuery.data?.entries ?? [];
	const remotePresence = remotePresenceQuery.data?.entries ?? [];
	const remotePresenceError = remotePresenceQuery.data?.success === false ? (remotePresenceQuery.data.error ?? 'Presence unavailable') : null;
	const remoteMembers = (remoteMembersQuery.data?.members ?? []) as CollaborationMemberProfile[];
	const remoteMembersError = remoteMembersQuery.data?.success === false ? (remoteMembersQuery.data.error ?? 'Team roster unavailable') : null;
	const remoteActivity = remoteActivityQuery.data?.entries ?? [];
	const remoteActivityError = remoteActivityQuery.data?.success === false ? (remoteActivityQuery.data.error ?? 'Remote activity unavailable') : null;
	const teamInsights = teamInsightsQuery.data?.insights ?? null;
	const reviewDashboard = reviewDashboardQuery.data?.dashboard as CollaborationReviewDashboard | null | undefined;
	const repoBranches = repoInfoQuery.data?.branches ?? [];
	const currentHead = repoInfoQuery.data?.head ?? '';

	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
	const [workspaceShareName, setWorkspaceShareName] = useState('Daily handoff');
	const [workspaceShareNote, setWorkspaceShareNote] = useState('');
	const [patchName, setPatchName] = useState('Review patch');
	const [patchBaseRef, setPatchBaseRef] = useState('main');
	const [patchHeadRef, setPatchHeadRef] = useState('');
	const [syncConfig, setSyncConfig] = useState<SyncConfigState>(DEFAULT_SYNC_CONFIG);
	const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
	const [remoteHealth, setRemoteHealth] = useState<CollaborationRemoteHealth | null>(null);
	const [probeError, setProbeError] = useState<string | null>(null);
	const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
	const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, { assigneeId: string; note: string }>>({});

	useEffect(() => {
		if (workspaces.length > 0 && !selectedWorkspaceId) {
			setSelectedWorkspaceId(workspaces[0]?.id ?? '');
		}
	}, [selectedWorkspaceId, workspaces]);

	useEffect(() => {
		if (currentHead) {
			setPatchHeadRef((previous) => previous || currentHead);
		}
	}, [currentHead]);

	useEffect(() => {
		const config = collaborationConfigQuery.data?.config;
		if (!config) {
			return;
		}
		setSyncConfig({
			enabled: Boolean(config.enabled),
			provider: 'self-host',
			endpointUrl: config.endpointUrl ?? '',
			projectId: config.projectId ?? 'default',
			authToken: config.authToken ?? '',
			memberId: config.memberId ?? '',
			memberApiKey: config.memberApiKey ?? '',
			displayName: config.displayName ?? '',
			email: config.email ?? '',
			role: config.role ?? 'developer',
			permissionLevel: config.permissionLevel ?? 'member',
			organizationId: config.organizationId ?? '',
			organizationName: config.organizationName ?? '',
			teamId: config.teamId ?? '',
			teamName: config.teamName ?? '',
			avatarUrl: config.avatarUrl ?? '',
			deviceLabel: config.deviceLabel ?? DEFAULT_SYNC_CONFIG.deviceLabel,
			presenceEnabled: Boolean(config.presenceEnabled ?? true),
			liveSyncEnabled: Boolean(config.liveSyncEnabled ?? true),
			realtimeEnabled: Boolean(config.realtimeEnabled ?? true),
			timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_SYNC_CONFIG.timeoutMs,
			autoSyncOnOpen: Boolean(config.autoSyncOnOpen),
			lastSyncedAt: typeof config.lastSyncedAt === 'number' ? config.lastSyncedAt : null,
			lastSyncStatus: config.lastSyncStatus ?? 'idle',
			lastSyncError: config.lastSyncError ?? null,
		});
	}, [collaborationConfigQuery.data?.config]);

	useEffect(() => {
		setRemoteHealth(null);
		setProbeError(null);
	}, [syncConfig.endpointUrl, syncConfig.projectId, syncConfig.authToken]);

	useEffect(() => {
		if (!open) {
			autoSyncTriggeredRef.current = false;
			return;
		}
		if (!syncConfig.enabled || !syncConfig.autoSyncOnOpen || !syncConfig.endpointUrl.trim()) {
			return;
		}
		if (autoSyncTriggeredRef.current || syncRemoteMutation.isPending) {
			return;
		}
		autoSyncTriggeredRef.current = true;
		syncRemoteMutation.mutate({ direction: 'roundtrip' });
	}, [open, syncConfig.autoSyncOnOpen, syncConfig.enabled, syncConfig.endpointUrl, syncRemoteMutation]);

	const selectedWorkspace = useMemo(
		() => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
		[selectedWorkspaceId, workspaces]
	);
	const commentsByTarget = useMemo(() => {
		return comments.reduce((acc: Record<string, CollaborationComment[]>, comment) => {
			const parsedTarget =
				comment.targetType === 'pull-request' ? parseCollaborationReviewTargetId(comment.targetId) : null;
			const normalizedTargetId =
				comment.targetType === 'pull-request' && parsedTarget
					? buildCollaborationPullRequestTargetId({
							provider: parsedTarget.provider,
							repoKey: parsedTarget.repoKey ?? collaborationRepoKey,
							pullRequestNumber: parsedTarget.pullRequestNumber,
					  })
					: comment.targetId;
			const key = `${comment.targetType}:${normalizedTargetId}`;
			acc[key] = [...(acc[key] ?? []), comment];
			return acc;
		}, {});
	}, [collaborationRepoKey, comments]);
	const assignmentsByTarget = useMemo(() => {
		return assignments.reduce((acc: Record<string, CollaborationAssignment[]>, assignment) => {
			const parsedTarget =
				assignment.targetType === 'pull-request' ? parseCollaborationReviewTargetId(assignment.targetId) : null;
			const normalizedTargetId =
				assignment.targetType === 'pull-request' && parsedTarget
					? buildCollaborationPullRequestTargetId({
							provider: parsedTarget.provider,
							repoKey: parsedTarget.repoKey ?? collaborationRepoKey,
							pullRequestNumber: parsedTarget.pullRequestNumber,
					  })
					: assignment.targetId;
			const key = `${assignment.targetType}:${normalizedTargetId}`;
			acc[key] = [...(acc[key] ?? []), assignment];
			return acc;
		}, {});
	}, [assignments, collaborationRepoKey]);
	const memberOptions = useMemo<CollaborationMemberProfile[]>(() => {
		const localIdentityId = syncConfig.email.trim() || (syncConfig.displayName.trim() ? `${syncConfig.displayName.trim().toLowerCase()}@${syncConfig.deviceLabel.trim().toLowerCase()}` : '');
		const localMember =
			syncConfig.displayName.trim() && localIdentityId
				? [{
						id: localIdentityId,
						displayName: syncConfig.displayName.trim(),
						...(syncConfig.email.trim() ? { email: syncConfig.email.trim() } : {}),
						role: syncConfig.role,
						permissionLevel: syncConfig.permissionLevel,
						...(syncConfig.organizationId.trim() ? { organizationId: syncConfig.organizationId.trim() } : {}),
						...(syncConfig.organizationName.trim() ? { organizationName: syncConfig.organizationName.trim() } : {}),
						...(syncConfig.teamId.trim() ? { teamId: syncConfig.teamId.trim() } : {}),
						...(syncConfig.teamName.trim() ? { teamName: syncConfig.teamName.trim() } : {}),
						...(syncConfig.avatarUrl.trim() ? { avatarUrl: syncConfig.avatarUrl.trim() } : {}),
						deviceLabel: syncConfig.deviceLabel.trim() || DEFAULT_SYNC_CONFIG.deviceLabel,
						lastSeenAt: Date.now(),
				  }]
				: [];
		const byId = new Map<string, CollaborationMemberProfile>();
		for (const member of [...remoteMembers, ...localMember]) {
			byId.set(member.id, member);
		}
		return [...byId.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
	}, [remoteMembers, syncConfig.avatarUrl, syncConfig.deviceLabel, syncConfig.displayName, syncConfig.email, syncConfig.organizationId, syncConfig.organizationName, syncConfig.permissionLevel, syncConfig.role, syncConfig.teamId, syncConfig.teamName]);
	const reviewQueueItems = useMemo(() => {
		if (!detectedProvider) {
			return [];
		}

		const pullRequests = (pullRequestQuery.data?.pullRequests ?? []) as CollaborationPullRequestSummary[];
		return pullRequests
			.filter((pullRequest: CollaborationPullRequestSummary) => pullRequest.state === 'open')
			.map((pullRequest: CollaborationPullRequestSummary) => {
				const targetId = buildCollaborationPullRequestTargetId({
					provider: detectedProvider.name,
					repoKey: collaborationRepoKey,
					pullRequestNumber: pullRequest.number,
				});
				const assignmentsForPullRequest = assignmentsByTarget[`pull-request:${targetId}`] ?? [];
				const commentsForPullRequest = commentsByTarget[`pull-request:${targetId}`] ?? [];
				if (assignmentsForPullRequest.length === 0 && commentsForPullRequest.length === 0) {
					return null;
				}
				return {
					id: targetId,
					targetId,
					provider: detectedProvider.name,
					number: pullRequest.number,
					title: pullRequest.title,
					baseRef: pullRequest.base.ref,
					headRef: pullRequest.head.ref,
					webUrl: pullRequest.webUrl,
					author: pullRequest.author,
					draft: pullRequest.draft,
					assignments: assignmentsForPullRequest,
					comments: commentsForPullRequest,
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
			.sort((left: { number: number }, right: { number: number }) => right.number - left.number);
	}, [assignmentsByTarget, collaborationRepoKey, commentsByTarget, detectedProvider, pullRequestQuery.data?.pullRequests]);

	const handleCopy = useCallback(async (value: string, message: string) => {
		try {
			await navigator.clipboard.writeText(value);
			notifySuccess(message, { persist: false });
		} catch (error) {
			notifyError('Copy failed', { description: error instanceof Error ? error.message : 'Clipboard unavailable' });
		}
	}, [notifyError, notifySuccess]);
	const handleOpenReviewUrl = useCallback((url: string) => {
		try {
			globalThis.open(url, '_blank', 'noopener,noreferrer');
		} catch (error) {
			notifyError('Unable to open pull request', {
				description: error instanceof Error ? error.message : 'Open the URL from the copied link instead.',
			});
		}
	}, [notifyError]);

	const handleCommentSubmit = useCallback(async (targetType: 'workspace-share' | 'patch-share' | 'pull-request', targetId: string) => {
		const targetKey = `${targetType}:${targetId}`;
		const body = commentDrafts[targetKey]?.trim();
		if (!body) {
			return;
		}
		await addCommentMutation.mutateAsync({ targetType, targetId, body });
		setCommentDrafts((previous) => ({ ...previous, [targetKey]: '' }));
	}, [addCommentMutation, commentDrafts]);

	const handleAssignmentCreate = useCallback(async (targetType: 'workspace-share' | 'patch-share' | 'pull-request', targetId: string) => {
		const targetKey = `${targetType}:${targetId}`;
		const draft = assignmentDrafts[targetKey];
		const assigneeId = draft?.assigneeId?.trim();
		if (!assigneeId) {
			return;
		}
		const member = memberOptions.find((entry) => entry.id === assigneeId);
		if (!member) {
			return;
		}
		await assignItemMutation.mutateAsync({
			targetType,
			targetId,
			assigneeId: member.id,
			assigneeName: member.displayName,
			note: draft?.note ?? '',
			status: 'open',
		});
		setAssignmentDrafts((previous) => ({
			...previous,
			[targetKey]: { assigneeId: '', note: '' },
		}));
	}, [assignItemMutation, assignmentDrafts, memberOptions]);

	const handleRefreshTeamContext = useCallback(async () => {
		try {
			if (syncConfig.enabled && syncConfig.endpointUrl.trim() && syncConfig.displayName.trim()) {
				await publishSessionMutation.mutateAsync();
			}
			if (syncConfig.enabled && syncConfig.endpointUrl.trim() && syncConfig.presenceEnabled && syncConfig.displayName.trim()) {
				await publishPresenceMutation.mutateAsync({
					repo: activeRepo ?? null,
					branch: currentHead || null,
					status: activeRepo ? `Working in ${activeRepo.split('/').pop() ?? activeRepo}` : 'Browsing collaboration context',
				});
			}
			await Promise.allSettled([
				remotePresenceQuery.refetch(),
				remoteMembersQuery.refetch(),
				remoteActivityQuery.refetch(),
				teamProfileQuery.refetch(),
				teamInsightsQuery.refetch(),
				detectedProvider ? pullRequestQuery.refetch() : Promise.resolve(),
			]);
		} catch (error) {
			notifyError('Failed to refresh team context', { description: error instanceof Error ? error.message : 'Presence refresh failed' });
		}
	}, [activeRepo, currentHead, detectedProvider, notifyError, publishPresenceMutation, publishSessionMutation, pullRequestQuery, remoteActivityQuery, remoteMembersQuery, remotePresenceQuery, syncConfig.displayName, syncConfig.enabled, syncConfig.endpointUrl, syncConfig.presenceEnabled, teamInsightsQuery, teamProfileQuery]);

	useEffect(() => {
		if (!open || !syncConfig.enabled || !syncConfig.endpointUrl.trim()) {
			return;
		}
		void handleRefreshTeamContext();
	}, [handleRefreshTeamContext, open, syncConfig.enabled, syncConfig.endpointUrl]);

	const handleExportBundle = async () => {
		try {
			const result = await utils.repo.collaboration.exportBundle.fetch();
			const blob = new Blob([JSON.stringify(result.bundle, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `git-graph-collaboration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			notifySuccess('Collaboration bundle exported', { persist: false });
			await utils.repo.collaboration.activity.invalidate();
		} catch (error) {
			notifyError('Export failed', { description: error instanceof Error ? error.message : 'Unable to export bundle' });
		}
	};

	const handleImportBundle = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}
		try {
			const raw = await file.text();
			const bundle = JSON.parse(raw) as unknown;
			await importBundleMutation.mutateAsync({ bundle, strategy: importStrategy });
		} catch (error) {
			notifyError('Import failed', { description: error instanceof Error ? error.message : 'Invalid collaboration bundle' });
		} finally {
			event.target.value = '';
		}
	};

	const handleProbeRemote = async () => {
		const result = await probeRemoteMutation.mutateAsync();
		if (!result.success) {
			setRemoteHealth(null);
			setProbeError(result.error ?? 'Endpoint probe failed.');
			notifyError('Collaboration endpoint probe failed', {
				description: result.error ?? 'Unknown probe failure',
			});
			return;
		}
		setRemoteHealth(result.health);
		setProbeError(null);
		notifySuccess('Collaboration endpoint reachable', { persist: false });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='ui-surface max-h-[88vh] max-w-6xl overflow-hidden p-0'>
				<DialogHeader className='border-border/70 border-b px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-base'>
						<Users className='h-5 w-5' />
						Collaboration Center
					</DialogTitle>
				</DialogHeader>

				<CollaborationSummaryStrip workspaceShares={workspaceShares} patchShelf={patchShelf} syncConfig={syncConfig} />

				<Tabs defaultValue='handoffs' className='flex min-h-0 flex-1 flex-col overflow-hidden'>
					<TabsList className='mx-5 mt-4 w-fit'>
						<TabsTrigger value='handoffs' className='text-xs'>
							<FolderGit2 className='mr-1 h-3 w-3' />
							Workspace Handoffs
						</TabsTrigger>
						<TabsTrigger value='patches' className='text-xs'>
							<PackageOpen className='mr-1 h-3 w-3' />
							Patch Shelf
						</TabsTrigger>
						<TabsTrigger value='team' className='text-xs'>
							<Users className='mr-1 h-3 w-3' />
							Team
						</TabsTrigger>
						<TabsTrigger value='reporting' className='text-xs'>
							<BarChart3 className='mr-1 h-3 w-3' />
							Reporting
						</TabsTrigger>
						<TabsTrigger value='sync' className='text-xs'>
							<Server className='mr-1 h-3 w-3' />
							Sync
						</TabsTrigger>
						<TabsTrigger value='activity' className='text-xs'>
							<Users className='mr-1 h-3 w-3' />
							Activity
						</TabsTrigger>
					</TabsList>

					<WorkspaceHandoffsTab
						workspaces={workspaces}
						selectedWorkspaceId={selectedWorkspaceId}
						workspaceShareName={workspaceShareName}
						workspaceShareNote={workspaceShareNote}
						workspaceShares={workspaceShares}
						commentDrafts={commentDrafts}
						assignmentDrafts={assignmentDrafts}
						commentMutating={addCommentMutation.isPending || deleteCommentMutation.isPending}
						assignmentMutating={
							assignItemMutation.isPending ||
							updateAssignmentMutation.isPending ||
							deleteAssignmentMutation.isPending
						}
						commentsByTarget={commentsByTarget}
						assignmentsByTarget={assignmentsByTarget}
						memberOptions={memberOptions}
						createPending={createWorkspaceShare.isPending}
						selectedWorkspaceAvailable={Boolean(selectedWorkspace)}
						onWorkspaceChange={setSelectedWorkspaceId}
						onShareNameChange={setWorkspaceShareName}
						onShareNoteChange={setWorkspaceShareNote}
						onCreate={() =>
							createWorkspaceShare.mutate({
								workspaceId: selectedWorkspaceId,
								name: workspaceShareName.trim() || 'Workspace handoff',
								note: workspaceShareNote,
							})
						}
						onDelete={(id) => deleteWorkspaceShare.mutate({ id })}
						onCopyLink={(value) => void handleCopy(value, 'Deep link copied')}
						onCommentDraftChange={(targetKey, value) => setCommentDrafts((previous) => ({ ...previous, [targetKey]: value }))}
						onCommentSubmit={(targetType, targetId) => void handleCommentSubmit(targetType, targetId)}
						onCommentDelete={(id) => deleteCommentMutation.mutate({ id })}
						onAssignmentAssigneeChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: value, note: previous[targetKey]?.note ?? '' } }))}
						onAssignmentNoteChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: previous[targetKey]?.assigneeId ?? '', note: value } }))}
						onAssignmentCreate={(targetType, targetId) => void handleAssignmentCreate(targetType, targetId)}
						onAssignmentStatusChange={(assignmentId, status) => updateAssignmentMutation.mutate({ id: assignmentId, status })}
						onAssignmentDelete={(id) => deleteAssignmentMutation.mutate({ id })}
					/>

					<PatchShelfTab
						activeRepo={activeRepo}
						patchName={patchName}
						patchBaseRef={patchBaseRef}
						patchHeadRef={patchHeadRef}
						repoBranches={repoBranches}
						patchShelf={patchShelf}
						commentDrafts={commentDrafts}
						assignmentDrafts={assignmentDrafts}
						commentMutating={addCommentMutation.isPending || deleteCommentMutation.isPending}
						assignmentMutating={
							assignItemMutation.isPending ||
							updateAssignmentMutation.isPending ||
							deleteAssignmentMutation.isPending
						}
						commentsByTarget={commentsByTarget}
						assignmentsByTarget={assignmentsByTarget}
						memberOptions={memberOptions}
						createPending={createPatchShare.isPending}
						onPatchNameChange={setPatchName}
						onPatchBaseRefChange={setPatchBaseRef}
						onPatchHeadRefChange={setPatchHeadRef}
						onCreate={() =>
							activeRepo
								? createPatchShare.mutate({
										repo: activeRepo,
										name: patchName.trim() || 'Review patch',
										baseRef: patchBaseRef.trim(),
										headRef: patchHeadRef.trim(),
								  })
								: notifyInfo('Open a repository first', { persist: false })
						}
						onDelete={(id) => deletePatchShare.mutate({ id })}
						onCopyPatch={(value) => void handleCopy(value, 'Patch copied')}
						onCommentDraftChange={(targetKey, value) => setCommentDrafts((previous) => ({ ...previous, [targetKey]: value }))}
						onCommentSubmit={(targetType, targetId) => void handleCommentSubmit(targetType, targetId)}
						onCommentDelete={(id) => deleteCommentMutation.mutate({ id })}
						onAssignmentAssigneeChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: value, note: previous[targetKey]?.note ?? '' } }))}
						onAssignmentNoteChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: previous[targetKey]?.assigneeId ?? '', note: value } }))}
						onAssignmentCreate={(targetType, targetId) => void handleAssignmentCreate(targetType, targetId)}
						onAssignmentStatusChange={(assignmentId, status) => updateAssignmentMutation.mutate({ id: assignmentId, status })}
						onAssignmentDelete={(id) => deleteAssignmentMutation.mutate({ id })}
					/>

					<CollaborationTeamTab
						teamProfile={(teamProfileQuery.data?.profile as CollaborationTeamProfile | null | undefined) ?? null}
						members={memberOptions}
						insights={teamInsights as CollaborationTeamInsights | null}
						presence={remotePresence}
						remoteActivity={remoteActivity}
						reviewQueue={reviewQueueItems}
						assignmentDrafts={assignmentDrafts}
						commentDrafts={commentDrafts}
						loadingMembers={remoteMembersQuery.isLoading || publishSessionMutation.isPending}
						loadingPresence={remotePresenceQuery.isLoading || publishPresenceMutation.isPending}
						loadingRemoteActivity={remoteActivityQuery.isLoading}
						memberError={remoteMembersError}
						presenceError={remotePresenceError}
						activityError={remoteActivityError}
						mutationPending={
							addCommentMutation.isPending ||
							deleteCommentMutation.isPending ||
							assignItemMutation.isPending ||
							updateAssignmentMutation.isPending ||
							deleteAssignmentMutation.isPending ||
							updateMemberMutation.isPending ||
							removeMemberMutation.isPending ||
							updateTeamProfileMutation.isPending
						}
						onRefresh={() => void handleRefreshTeamContext()}
						onMemberRoleChange={(memberId, role) => {
							const member = memberOptions.find((entry) => entry.id === memberId);
							if (!member) {
								return;
							}
							updateMemberMutation.mutate({
								id: member.id,
								displayName: member.displayName,
								email: member.email,
								role,
								permissionLevel: member.permissionLevel,
								organizationId: member.organizationId,
								organizationName: member.organizationName,
								teamId: member.teamId,
								teamName: member.teamName,
								avatarUrl: member.avatarUrl,
								deviceLabel: member.deviceLabel,
							});
						}}
						onMemberPermissionChange={(memberId, permissionLevel) => {
							const member = memberOptions.find((entry) => entry.id === memberId);
							if (!member) {
								return;
							}
							updateMemberMutation.mutate({
								id: member.id,
								displayName: member.displayName,
								email: member.email,
								role: member.role,
								permissionLevel,
								organizationId: member.organizationId,
								organizationName: member.organizationName,
								teamId: member.teamId,
								teamName: member.teamName,
								avatarUrl: member.avatarUrl,
								deviceLabel: member.deviceLabel,
							});
						}}
						onMemberRemove={(memberId) => removeMemberMutation.mutate({ id: memberId })}
						onTeamProfileSave={(profile) => updateTeamProfileMutation.mutate(profile)}
						onOpenReviewUrl={handleOpenReviewUrl}
						onCommentDraftChange={(targetKey, value) => setCommentDrafts((previous) => ({ ...previous, [targetKey]: value }))}
						onCommentSubmit={(targetId) => void handleCommentSubmit('pull-request', targetId)}
						onCommentDelete={(id) => deleteCommentMutation.mutate({ id })}
						onAssignmentAssigneeChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: value, note: previous[targetKey]?.note ?? '' } }))}
						onAssignmentNoteChange={(targetKey, value) => setAssignmentDrafts((previous) => ({ ...previous, [targetKey]: { assigneeId: previous[targetKey]?.assigneeId ?? '', note: value } }))}
						onAssignmentCreate={(targetId) => void handleAssignmentCreate('pull-request', targetId)}
						onAssignmentStatusChange={(assignmentId, status) => updateAssignmentMutation.mutate({ id: assignmentId, status })}
						onAssignmentDelete={(id) => deleteAssignmentMutation.mutate({ id })}
					/>

					<CollaborationReviewDashboardTab
						dashboard={reviewDashboard ?? null}
						reviewQueue={reviewQueueItems}
						loading={reviewDashboardQuery.isLoading}
					/>

					<CollaborationSyncTab
						syncConfig={syncConfig}
						importStrategy={importStrategy}
						activity={activity}
						remoteHealth={remoteHealth}
						probeError={probeError}
						syncPending={syncRemoteMutation.isPending}
						savePending={saveSyncConfigMutation.isPending}
						importPending={importBundleMutation.isPending}
						probePending={probeRemoteMutation.isPending}
						onSyncConfigChange={(patch) => setSyncConfig((previous) => ({ ...previous, ...patch }))}
						onImportStrategyChange={setImportStrategy}
						onSave={() => saveSyncConfigMutation.mutate(syncConfig)}
						onProbe={() => void handleProbeRemote()}
						onPush={() => syncRemoteMutation.mutate({ direction: 'push' })}
						onPull={() => syncRemoteMutation.mutate({ direction: 'pull' })}
						onRoundtrip={() => syncRemoteMutation.mutate({ direction: 'roundtrip' })}
						onExport={() => void handleExportBundle()}
						onImport={() => importInputRef.current?.click()}
					/>

					<CollaborationActivityTab activity={activity} />
				</Tabs>

				<input ref={importInputRef} type='file' accept='application/json,.json' className='hidden' onChange={(event) => void handleImportBundle(event)} />
			</DialogContent>
		</Dialog>
	);
}

export default CollaborationCenter;

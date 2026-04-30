/**
 * Configuration tRPC Router
 * Exposes configuration management to the renderer
 */

import { z } from 'zod';

import { configStore, appStore, instanceStore } from '@/app/backend/store';
import { readSecretValue, setSecretValue } from '@/app/backend/store/secret';

import { router, publicProcedure } from '../../init';

const commitTemplateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	content: z.string().min(1),
	isDefault: z.boolean().optional(),
});
const diffToolSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	command: z.string().min(1),
	args: z.string().min(1),
	supports3Way: z.boolean(),
	supportsDirDiff: z.boolean(),
	icon: z.string().optional(),
});
const externalDiffConfigSchema = z.object({
	tools: z.array(diffToolSchema),
	selectedTool: z.string().min(1),
	useForMergeConflicts: z.boolean(),
});
const issueTrackerConfigSchema = z.object({
	providers: z.record(
		z.string(),
		z.object({
			enabled: z.boolean(),
			apiKey: z.string().optional(),
			domain: z.string().optional(),
			projectKey: z.string().optional(),
		})
	),
	autoDetect: z.boolean(),
	patterns: z.array(z.string()),
});
const issueProviderSchema = z.enum(['github', 'jira', 'linear', 'asana', 'trello', 'clickup', 'notion']);
const issueStatusSchema = z.enum(['open', 'in_progress', 'closed', 'done']);
const linkedIssueSchema = z.object({
	id: z.string().min(1),
	commitHash: z.string().min(1),
	issueKey: z.string().min(1),
	provider: issueProviderSchema,
	title: z.string().min(1),
	status: issueStatusSchema,
	url: z.string().min(1),
	addedAt: z.number(),
});
const issueSearchResultSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	status: issueStatusSchema,
	provider: issueProviderSchema,
	url: z.string().min(1),
	labels: z.array(z.string()).optional(),
	assignee: z.string().optional(),
	priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});
const customCommandSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	command: z.string().min(1),
	description: z.string().optional(),
	alias: z.string().optional(),
	lastUsed: z.number().optional(),
	useCount: z.number().int().nonnegative(),
});
const gitGraphSettingsSchema = z.object({
	confirmDestructiveActions: z.boolean(),
	autoFetchInterval: z.number(),
	checkForUpdates: z.boolean(),
	launchAtStartup: z.boolean(),
	lensMode: z.enum(['guided', 'craft', 'control']),
	theme: z.enum(['light', 'dark', 'system']),
	graphTheme: z.enum(['default', 'colorful', 'minimal']),
	commitMessageLength: z.number(),
	showAvatars: z.boolean(),
	showRelativeDates: z.boolean(),
	dateFormat: z.enum(['relative', 'iso', 'locale']),
	enhancedAccessibility: z.boolean(),
	commitTemplate: z.string(),
	autoSignCommits: z.boolean(),
	defaultBranch: z.string(),
	mergeTool: z.string(),
	notifyOnPush: z.boolean(),
	notifyOnPull: z.boolean(),
	notifyOnMerge: z.boolean(),
	soundEnabled: z.boolean(),
	maxCommits: z.number(),
	enableVirtualization: z.boolean(),
	lazyLoadImages: z.boolean(),
	telemetryEnabled: z.boolean(),
	crashReports: z.boolean(),
});
const appShellStateSchema = z.object({
	sidebarOpen: z.boolean(),
	repoNavMode: z.enum(['sidebar', 'tabs']),
	openedRepos: z.array(z.string()),
});
const collaborationSyncConfigSchema = z.object({
	enabled: z.boolean(),
	provider: z.literal('self-host'),
	endpointUrl: z.string(),
	projectId: z.string(),
	authToken: z.string(),
	memberId: z.string(),
	memberApiKey: z.string(),
	displayName: z.string(),
	email: z.string(),
	role: z.enum(['developer', 'reviewer', 'lead', 'qa']),
	permissionLevel: z.enum(['owner', 'manager', 'member', 'observer']),
	organizationId: z.string(),
	organizationName: z.string(),
	teamId: z.string(),
	teamName: z.string(),
	avatarUrl: z.string(),
	deviceLabel: z.string(),
	presenceEnabled: z.boolean(),
	liveSyncEnabled: z.boolean(),
	realtimeEnabled: z.boolean(),
	timeoutMs: z.number().int().min(2_000).max(120_000),
	autoSyncOnOpen: z.boolean(),
	lastSyncedAt: z.number().nullable(),
	lastSyncStatus: z.enum(['idle', 'syncing', 'success', 'error']),
	lastSyncError: z.string().nullable(),
});

type CollaborationSyncConfig = z.infer<typeof collaborationSyncConfigSchema>;
type IssueProvider = z.infer<typeof issueProviderSchema>;
type IssueSearchResult = z.infer<typeof issueSearchResultSchema>;
type LinkedIssue = z.infer<typeof linkedIssueSchema>;
type IssueProviderConfig = {
	enabled: boolean;
	apiKey?: string | undefined;
	domain?: string | undefined;
	projectKey?: string | undefined;
};
type CollaborationSyncConfigPatch = {
	[K in keyof CollaborationSyncConfig]?: CollaborationSyncConfig[K] | undefined;
};
const collaborationAuthTokenSecretKey = 'collaborationSyncConfig.authToken';
const collaborationMemberApiKeySecretKey = 'collaborationSyncConfig.memberApiKey'; // eslint-disable-line no-secrets/no-secrets

function readStoredString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function hydrateCollaborationSyncConfig(config: Partial<CollaborationSyncConfig> | undefined): CollaborationSyncConfig {
	const current = config ?? {};
	const authToken = readSecretValue(collaborationAuthTokenSecretKey);
	const memberApiKey = readSecretValue(collaborationMemberApiKeySecretKey);
	const currentAuthToken = readStoredString(current.authToken);
	const currentMemberApiKey = readStoredString(current.memberApiKey);
	const nextConfig = {
		enabled: current.enabled ?? false,
		provider: 'self-host' as const,
		endpointUrl: readStoredString(current.endpointUrl),
		projectId: readStoredString(current.projectId) || 'default',
		authToken: authToken || currentAuthToken,
		memberId: readStoredString(current.memberId),
		memberApiKey: memberApiKey || currentMemberApiKey,
		displayName: readStoredString(current.displayName),
		email: readStoredString(current.email),
		role: current.role ?? 'developer',
		permissionLevel: current.permissionLevel ?? 'member',
		organizationId: readStoredString(current.organizationId),
		organizationName: readStoredString(current.organizationName),
		teamId: readStoredString(current.teamId),
		teamName: readStoredString(current.teamName),
		avatarUrl: readStoredString(current.avatarUrl),
		deviceLabel: readStoredString(current.deviceLabel) || 'desktop',
		presenceEnabled: current.presenceEnabled ?? true,
		liveSyncEnabled: current.liveSyncEnabled ?? true,
		realtimeEnabled: current.realtimeEnabled ?? true,
		timeoutMs: typeof current.timeoutMs === 'number' ? current.timeoutMs : 15_000,
		autoSyncOnOpen: current.autoSyncOnOpen ?? false,
		lastSyncedAt: current.lastSyncedAt ?? null,
		lastSyncStatus: current.lastSyncStatus ?? 'idle',
		lastSyncError: current.lastSyncError ?? null,
	} satisfies CollaborationSyncConfig;

	if (currentAuthToken || currentMemberApiKey) {
		setSecretValue(collaborationAuthTokenSecretKey, currentAuthToken);
		setSecretValue(collaborationMemberApiKeySecretKey, currentMemberApiKey);
		appStore.set('collaborationSyncConfig', {
			...nextConfig,
			authToken: '',
			memberApiKey: '',
		});
	}

	return nextConfig;
}

function normalizeCollaborationSyncConfig(
	current: CollaborationSyncConfig,
	input: CollaborationSyncConfigPatch
): CollaborationSyncConfig {
	return {
		enabled: input.enabled ?? current.enabled,
		provider: 'self-host',
		endpointUrl: input.endpointUrl === undefined ? current.endpointUrl : readStoredString(input.endpointUrl),
		projectId: input.projectId === undefined ? current.projectId : readStoredString(input.projectId) || 'default',
		authToken: input.authToken === undefined ? current.authToken : readStoredString(input.authToken),
		memberId: input.memberId === undefined ? current.memberId : readStoredString(input.memberId),
		memberApiKey: input.memberApiKey === undefined ? current.memberApiKey : readStoredString(input.memberApiKey),
		displayName: input.displayName === undefined ? current.displayName : readStoredString(input.displayName),
		email: input.email === undefined ? current.email : readStoredString(input.email),
		role: input.role ?? current.role,
		permissionLevel: input.permissionLevel ?? current.permissionLevel,
		organizationId: input.organizationId === undefined ? current.organizationId : readStoredString(input.organizationId),
		organizationName:
			input.organizationName === undefined ? current.organizationName : readStoredString(input.organizationName),
		teamId: input.teamId === undefined ? current.teamId : readStoredString(input.teamId),
		teamName: input.teamName === undefined ? current.teamName : readStoredString(input.teamName),
		avatarUrl: input.avatarUrl === undefined ? current.avatarUrl : readStoredString(input.avatarUrl),
		deviceLabel: input.deviceLabel === undefined ? current.deviceLabel : readStoredString(input.deviceLabel) || 'desktop',
		presenceEnabled: input.presenceEnabled ?? current.presenceEnabled,
		liveSyncEnabled: input.liveSyncEnabled ?? current.liveSyncEnabled,
		realtimeEnabled: input.realtimeEnabled ?? current.realtimeEnabled,
		timeoutMs:
			input.timeoutMs !== undefined ? Math.max(2_000, Math.min(120_000, Math.round(input.timeoutMs))) : current.timeoutMs,
		autoSyncOnOpen: input.autoSyncOnOpen ?? current.autoSyncOnOpen,
		lastSyncedAt: input.lastSyncedAt === undefined ? current.lastSyncedAt : input.lastSyncedAt,
		lastSyncStatus: input.lastSyncStatus ?? current.lastSyncStatus,
		lastSyncError: input.lastSyncError === undefined ? current.lastSyncError : input.lastSyncError,
	};
}

function persistCollaborationSyncConfig(config: CollaborationSyncConfig): CollaborationSyncConfig {
	setSecretValue(collaborationAuthTokenSecretKey, config.authToken);
	setSecretValue(collaborationMemberApiKeySecretKey, config.memberApiKey);

	const nextConfig = {
		...config,
		authToken: '',
		memberApiKey: '',
	};

	appStore.set('collaborationSyncConfig', nextConfig);

	return config;
}

function normalizeIssueStatus(provider: IssueProvider, value: string | undefined): z.infer<typeof issueStatusSchema> {
	const normalized = value?.toLowerCase().replace(/\s+/g, '_') ?? '';
	if (provider === 'linear') {
		if (normalized === 'completed' || normalized === 'done') return 'done';
		if (normalized === 'started' || normalized === 'triage' || normalized === 'backlog') return 'in_progress';
		if (normalized === 'canceled' || normalized === 'cancelled') return 'closed';
	}
	if (normalized === 'closed' || normalized === 'merged') return 'closed';
	if (normalized === 'done' || normalized === 'resolved') return 'done';
	if (normalized === 'in_progress' || normalized === 'in-progress') return 'in_progress';
	return 'open';
}

function getIssueLinksStore(): Record<string, LinkedIssue[]> {
	return z.record(z.string(), z.array(linkedIssueSchema)).catch({}).parse(appStore.get('issueLinksByCommit'));
}

function setIssueLinksStore(next: Record<string, LinkedIssue[]>): void {
	appStore.set('issueLinksByCommit', next);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(`${String(response.status)} ${response.statusText}`);
	}
	return response.json() as Promise<T>;
}

async function searchGithubIssues(query: string, config: IssueProviderConfig): Promise<IssueSearchResult[]> {
	const searchTerms = [query.trim(), 'is:issue'];
	if (config.projectKey?.trim()) {
		searchTerms.push(`repo:${config.projectKey.trim()}`);
	}
	const headers = new Headers({ Accept: 'application/vnd.github+json' });
	if (config.apiKey?.trim()) {
		headers.set('Authorization', `Bearer ${config.apiKey.trim()}`);
	}
	const params = new URLSearchParams({
		q: searchTerms.join(' '),
		per_page: '20',
	});
	const result = await fetchJson<{
		items?: Array<{
			id: number;
			number: number;
			title: string;
			body?: string | null;
			state: string;
			html_url: string;
			labels?: Array<{ name?: string } | string>;
			assignees?: Array<{ login?: string }>;
		}>;
	}>(`https://api.github.com/search/issues?${params.toString()}`, { headers });

	return (result.items ?? []).map((issue) => ({
		id: `github-${String(issue.id)}`,
		key: `#${String(issue.number)}`,
		title: issue.title,
		...(issue.body ? { description: issue.body } : {}),
		status: normalizeIssueStatus('github', issue.state),
		provider: 'github',
		url: issue.html_url,
		labels: issue.labels
			?.map((label) => (typeof label === 'string' ? label : label.name ?? ''))
			.filter((label) => label.length > 0),
		...(issue.assignees?.[0]?.login ? { assignee: issue.assignees[0].login } : {}),
	}));
}

async function searchJiraIssues(query: string, config: IssueProviderConfig): Promise<IssueSearchResult[]> {
	const domain = config.domain?.trim();
	const apiKey = config.apiKey?.trim();
	if (!domain || !apiKey || !apiKey.includes(':')) {
		throw new Error('Jira requires domain and apiKey formatted as email:token.');
	}
	const [email, token] = apiKey.split(/:(.*)/s);
	if (!email || !token) {
		throw new Error('Jira requires domain and apiKey formatted as email:token.');
	}
	const projectClause = config.projectKey?.trim() ? `project = "${config.projectKey.trim()}" AND ` : '';
	const escapedQuery = query.trim().replace(/["\\]/g, '\\$&');
	const jql = `${projectClause}(summary ~ "${escapedQuery}" OR text ~ "${escapedQuery}") ORDER BY updated DESC`;
	const host = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}.atlassian.net`;
	const params = new URLSearchParams({
		jql,
		maxResults: '20',
		fields: 'summary,status,priority,assignee,labels,description',
	});
	const result = await fetchJson<{
		issues?: Array<{
			id: string;
			key: string;
			fields: {
				summary?: string;
				status?: { name?: string };
				priority?: { name?: string };
				assignee?: { displayName?: string };
				labels?: string[];
			};
		}>;
	}>(`${host}/rest/api/3/search?${params.toString()}`, {
		headers: {
			Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
			Accept: 'application/json',
		},
	});

	return (result.issues ?? []).map((issue) => ({
		id: `jira-${issue.id}`,
		key: issue.key,
		title: issue.fields.summary ?? issue.key,
		status: normalizeIssueStatus('jira', issue.fields.status?.name),
		provider: 'jira',
		url: `${host}/browse/${issue.key}`,
		labels: issue.fields.labels ?? [],
		...(issue.fields.assignee?.displayName ? { assignee: issue.fields.assignee.displayName } : {}),
		...(issue.fields.priority?.name
			? { priority: issue.fields.priority.name.toLowerCase() as 'low' | 'medium' | 'high' | 'urgent' }
			: {}),
	}));
}

async function searchLinearIssues(query: string, config: IssueProviderConfig): Promise<IssueSearchResult[]> {
	const apiKey = config.apiKey?.trim();
	if (!apiKey) {
		throw new Error('Linear requires an API key.');
	}
	const teamClause = config.projectKey?.trim() ? `, team: { key: { eq: "${config.projectKey.trim()}" } }` : '';
	const graphql = `
		query SearchIssues($term: String!) {
			issues(first: 20, filter: { or: [{ title: { containsIgnoreCase: $term } }, { description: { containsIgnoreCase: $term } }]${teamClause} }) {
				nodes {
					id
					identifier
					title
					description
					url
					priorityLabel
					state { name type }
					assignee { name }
					labels { nodes { name } }
				}
			}
		}
	`;
	const result = await fetchJson<{
		data?: {
			issues?: {
				nodes?: Array<{
					id: string;
					identifier: string;
					title: string;
					description?: string | null;
					url: string;
					priorityLabel?: string | null;
					state?: { name?: string; type?: string };
					assignee?: { name?: string } | null;
					labels?: { nodes?: Array<{ name?: string }> };
				}>;
			};
		};
		errors?: Array<{ message?: string }>;
	}>('https://api.linear.app/graphql', {
		method: 'POST',
		headers: {
			Authorization: apiKey,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query: graphql, variables: { term: query.trim() } }),
	});
	if (result.errors?.length) {
		throw new Error(result.errors[0]?.message ?? 'Linear API error');
	}

	return (result.data?.issues?.nodes ?? []).map((issue) => ({
		id: `linear-${issue.id}`,
		key: issue.identifier,
		title: issue.title,
		...(issue.description ? { description: issue.description } : {}),
		status: normalizeIssueStatus('linear', issue.state?.type ?? issue.state?.name),
		provider: 'linear',
		url: issue.url,
		labels: issue.labels?.nodes?.map((label) => label.name ?? '').filter((label) => label.length > 0) ?? [],
		...(issue.assignee?.name ? { assignee: issue.assignee.name } : {}),
		...(issue.priorityLabel
			? { priority: issue.priorityLabel.toLowerCase() as 'low' | 'medium' | 'high' | 'urgent' }
			: {}),
	}));
}

async function searchProviderIssues(
	provider: IssueProvider,
	query: string,
	config: IssueProviderConfig
): Promise<IssueSearchResult[]> {
	switch (provider) {
		case 'github':
			return searchGithubIssues(query, config);
		case 'jira':
			return searchJiraIssues(query, config);
		case 'linear':
			return searchLinearIssues(query, config);
		default:
			throw new Error(`${provider} issue search is not implemented yet.`);
	}
}

export const configRouter = router({
	/**
	 * Get all configuration.
	 */
	getAll: publicProcedure.query(() => {
		return {
			graph: configStore.get('graph'),
			date: configStore.get('date'),
			repository: configStore.get('repository'),
			dialog: configStore.get('dialog'),
			ui: configStore.get('ui'),
			fileEncoding: configStore.get('fileEncoding'),
		};
	}),

	/**
	 * Get graph configuration.
	 */
	graph: publicProcedure.query(() => {
		return configStore.get('graph');
	}),

	/**
	 * Set graph configuration.
	 */
	setGraph: publicProcedure
		.input(
			z.object({
				colours: z.array(z.string()).optional(),
				style: z.enum(['rounded', 'angular']).optional(),
				uncommittedChanges: z.enum(['openCircleAtUncommittedChanges', 'openCircleAtCheckedOutCommit']).optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('graph');
			configStore.set('graph', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get date configuration.
	 */
	date: publicProcedure.query(() => {
		return configStore.get('date');
	}),

	/**
	 * Set date configuration.
	 */
	setDate: publicProcedure
		.input(
			z.object({
				format: z.enum(['dateAndTime', 'dateOnly', 'relative', 'isoDateAndTime', 'isoDateOnly']).optional(),
				type: z.enum(['author', 'commit']).optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('date');
			configStore.set('date', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get repository configuration.
	 */
	repository: publicProcedure.query(() => {
		return configStore.get('repository');
	}),

	/**
	 * Set repository configuration.
	 */
	setRepository: publicProcedure
		.input(
			z.object({
				initialLoadCommits: z.number().optional(),
				loadMoreCommits: z.number().optional(),
				loadMoreCommitsAutomatically: z.boolean().optional(),
				showRemoteBranches: z.boolean().optional(),
				showStashes: z.boolean().optional(),
				showTags: z.boolean().optional(),
				showUncommittedChanges: z.boolean().optional(),
				showUntrackedFiles: z.boolean().optional(),
				muteMergeCommits: z.boolean().optional(),
				onlyFollowFirstParent: z.boolean().optional(),
				fetchAndPrune: z.boolean().optional(),
				useMailmap: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('repository');
			configStore.set('repository', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get dialog defaults.
	 */
	dialog: publicProcedure.query(() => {
		return configStore.get('dialog');
	}),

	/**
	 * Set dialog defaults.
	 */
	setDialog: publicProcedure
		.input(
			z.object({
				resetCommitMode: z.enum(['soft', 'mixed', 'hard']).optional(),
				resetUncommittedMode: z.enum(['soft', 'mixed', 'hard']).optional(),
				deleteBranchForce: z.boolean().optional(),
				createBranchCheckout: z.boolean().optional(),
				mergeNoFastForward: z.boolean().optional(),
				mergeSquash: z.boolean().optional(),
				rebaseInteractive: z.boolean().optional(),
				addTagPushToRemote: z.boolean().optional(),
				addTagType: z.enum(['annotated', 'lightweight']).optional(),
				stashIncludeUntracked: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('dialog');
			configStore.set('dialog', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get UI configuration.
	 */
	ui: publicProcedure.query(() => {
		return configStore.get('ui');
	}),

	/**
	 * Set UI configuration.
	 */
	setUi: publicProcedure
		.input(
			z.object({
				enhancedAccessibility: z.boolean().optional(),
				markdown: z.boolean().optional(),
				tabIconColourTheme: z.enum(['colour', 'grey']).optional(),
				featureFlags: z
					.object({
						worktreePro: z.boolean().optional(),
						workflowEngine: z.boolean().optional(),
						graphiteInterop: z.boolean().optional(),
						aiProd: z.boolean().optional(),
						deepLinks: z.boolean().optional(),
						branchPinning: z.boolean().optional(),
					})
					.optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('ui');
			const nextFeatureFlags = input.featureFlags
				? { ...current.featureFlags, ...input.featureFlags }
				: current.featureFlags;
			configStore.set('ui', {
				...current,
				...input,
				featureFlags: nextFeatureFlags,
			});
			return { success: true };
		}),

	/**
	 * Get global view state.
	 */
	globalViewState: publicProcedure.query(() => {
		return appStore.get('globalViewState');
	}),

	/**
	 * Set global view state.
	 */
	setGlobalViewState: publicProcedure
		.input(
			z.object({
				alwaysAcceptCheckoutCommit: z.boolean().optional(),
				issueLinkingConfig: z
					.object({
						issue: z.string(),
						url: z.string(),
					})
					.nullable()
					.optional(),
				pushTagSkipRemoteCheck: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = appStore.get('globalViewState');
			appStore.set('globalViewState', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get workspace view state.
	 */
	workspaceViewState: publicProcedure.query(() => {
		return instanceStore.get('workspaceViewState');
	}),

	/**
	 * Set workspace view state.
	 */
	setWorkspaceViewState: publicProcedure
		.input(
			z.object({
				findIsCaseSensitive: z.boolean().optional(),
				findIsRegex: z.boolean().optional(),
				findOpenCommitDetailsView: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = instanceStore.get('workspaceViewState');
			instanceStore.set('workspaceViewState', { ...current, ...input });
			return { success: true };
		}),

	appShellState: publicProcedure.query(() => {
		return {
			state: instanceStore.get('appShellState'),
		};
	}),

	setAppShellState: publicProcedure
		.input(appShellStateSchema.partial())
		.mutation(({ input }) => {
			const current = instanceStore.get('appShellState');
			const nextState = {
				...current,
				...input,
				...(input.openedRepos ? { openedRepos: input.openedRepos.slice(0, 20) } : {}),
			};
			instanceStore.set('appShellState', nextState);
			return {
				success: true,
				state: nextState,
			};
		}),

	collaborationSyncConfig: publicProcedure.query(() => {
		return {
			config: hydrateCollaborationSyncConfig(appStore.get('collaborationSyncConfig')),
		};
	}),

	setCollaborationSyncConfig: publicProcedure
		.input(collaborationSyncConfigSchema.partial())
		.mutation(({ input }) => {
			const current = hydrateCollaborationSyncConfig(appStore.get('collaborationSyncConfig'));
			const nextConfig = normalizeCollaborationSyncConfig(current, input);
			persistCollaborationSyncConfig(nextConfig);
			return {
				success: true,
				config: nextConfig,
			};
		}),

	/**
	 * Keybinding overrides.
	 */
	keybindings: publicProcedure.query(() => {
		return {
			overrides: instanceStore.get('keybindingOverrides'),
		};
	}),

	commitTemplates: publicProcedure.query(() => {
		return {
			templates: appStore.get('commitTemplates'),
		};
	}),

	setCommitTemplates: publicProcedure
		.input(
			z.object({
				templates: z.array(commitTemplateSchema),
			})
		)
		.mutation(({ input }) => {
			appStore.set('commitTemplates', input.templates);
			return { success: true };
		}),

	customCommands: publicProcedure.query(() => {
		return {
			commands: appStore.get('customCommands'),
		};
	}),

	setCustomCommands: publicProcedure
		.input(
			z.object({
				commands: z.array(customCommandSchema),
			})
		)
		.mutation(({ input }) => {
			appStore.set('customCommands', input.commands);
			return {
				success: true,
				commands: input.commands,
			};
		}),

	externalDiffConfig: publicProcedure.query(() => {
		return {
			config: appStore.get('externalDiffConfig'),
		};
	}),

	setExternalDiffConfig: publicProcedure
		.input(externalDiffConfigSchema)
		.mutation(({ input }) => {
			appStore.set('externalDiffConfig', input);
			return { success: true };
		}),

	issueTrackerConfig: publicProcedure.query(() => {
		return {
			config: appStore.get('issueTrackerConfig'),
		};
	}),

	setIssueTrackerConfig: publicProcedure
		.input(issueTrackerConfigSchema)
		.mutation(({ input }) => {
			appStore.set('issueTrackerConfig', input);
			return { success: true };
		}),

	issueSearch: publicProcedure
		.input(
			z.object({
				query: z.string().min(1),
				providers: z.array(issueProviderSchema).optional(),
			})
		)
		.query(async ({ input }) => {
			const config = issueTrackerConfigSchema.catch({ providers: {}, autoDetect: true, patterns: [] }).parse(
				appStore.get('issueTrackerConfig')
			);
			const requestedProviders = input.providers?.length
				? input.providers
				: (Object.entries(config.providers)
						.filter(([, providerConfig]) => providerConfig.enabled)
						.map(([provider]) => provider)
						.filter((provider): provider is IssueProvider => issueProviderSchema.safeParse(provider).success));
			const uniqueProviders = [...new Set(requestedProviders)];
			const results: IssueSearchResult[] = [];
			const errors: Array<{ provider: IssueProvider; message: string }> = [];

			await Promise.all(
				uniqueProviders.map(async (provider) => {
					const providerConfig = config.providers[provider];
					if (!providerConfig?.enabled) {
						return;
					}
					try {
						results.push(...(await searchProviderIssues(provider, input.query, providerConfig)));
					} catch (error) {
						errors.push({
							provider,
							message: error instanceof Error ? error.message : 'Unknown issue search error',
						});
					}
				})
			);

			return {
				issues: results
					.sort((left, right) => left.key.localeCompare(right.key))
					.slice(0, 50),
				errors,
			};
		}),

	issueLinks: publicProcedure
		.input(z.object({ commitHash: z.string().min(1) }))
		.query(({ input }) => {
			const linksByCommit = getIssueLinksStore();
			return {
				links: linksByCommit[input.commitHash] ?? [],
			};
		}),

	linkIssue: publicProcedure
		.input(
			z.object({
				commitHash: z.string().min(1),
				issue: issueSearchResultSchema,
			})
		)
		.mutation(({ input }) => {
			const linksByCommit = getIssueLinksStore();
			const currentLinks = linksByCommit[input.commitHash] ?? [];
			const existing = currentLinks.find(
				(link) => link.provider === input.issue.provider && link.issueKey === input.issue.key
			);
			const nextLink: LinkedIssue = {
				id: existing?.id ?? `${input.issue.provider}-${input.issue.key}-${String(Date.now())}`,
				commitHash: input.commitHash,
				issueKey: input.issue.key,
				provider: input.issue.provider,
				title: input.issue.title,
				status: input.issue.status,
				url: input.issue.url,
				addedAt: existing?.addedAt ?? Date.now(),
			};
			setIssueLinksStore({
				...linksByCommit,
				[input.commitHash]: [nextLink, ...currentLinks.filter((link) => link.id !== nextLink.id)],
			});
			return { link: nextLink };
		}),

	unlinkIssue: publicProcedure
		.input(
			z.object({
				commitHash: z.string().min(1),
				linkId: z.string().min(1),
			})
		)
		.mutation(({ input }) => {
			const linksByCommit = getIssueLinksStore();
			const currentLinks = linksByCommit[input.commitHash] ?? [];
			const nextLinks = currentLinks.filter((link) => link.id !== input.linkId);
			setIssueLinksStore({
				...linksByCommit,
				[input.commitHash]: nextLinks,
			});
			return { success: nextLinks.length !== currentLinks.length };
		}),

	settings: publicProcedure.query(() => {
		return {
			settings: appStore.get('gitGraphSettings'),
		};
	}),

	setSettings: publicProcedure
		.input(gitGraphSettingsSchema)
		.mutation(({ input }) => {
			appStore.set('gitGraphSettings', input);
			return { success: true };
		}),

	onboardingState: publicProcedure.query(() => {
		return {
			state: appStore.get('onboardingState'),
		};
	}),

	setOnboardingState: publicProcedure
		.input(
			z.object({
				gitGraphCompleted: z.boolean().optional(),
				lensOnboardingSeen: z.boolean().optional(),
			})
		)
		.mutation(({ input }) => {
			const current = appStore.get('onboardingState');
			appStore.set('onboardingState', { ...current, ...input });
			return { success: true };
		}),

	notifications: publicProcedure.query(() => {
		const current = appStore.get('notificationCenter');
		const notifications = [...current.notifications]
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, 50);
		return { notifications };
	}),

	addNotification: publicProcedure
		.input(
			z.object({
				type: z.enum(['info', 'success', 'warning', 'error']),
				title: z.string().min(1),
				message: z.string().optional(),
				actionId: z.string().optional(),
				actionLabel: z.string().optional(),
			})
		)
		.mutation(({ input }) => {
			const current = appStore.get('notificationCenter');
			const nextNotification = {
				id: `${String(Date.now())}-${Math.random().toString(36).slice(2, 9)}`,
				type: input.type,
				title: input.title,
				...(input.message ? { message: input.message } : {}),
				timestamp: Date.now(),
				read: false,
				...(input.actionId ? { actionId: input.actionId } : {}),
				...(input.actionLabel ? { actionLabel: input.actionLabel } : {}),
			};
			const notifications = [nextNotification, ...current.notifications].slice(0, 50);
			appStore.set('notificationCenter', { notifications });
			return {
				success: true,
				notification: nextNotification,
			};
		}),

	markNotificationRead: publicProcedure
		.input(
			z.object({
				id: z.string().min(1),
			})
		)
		.mutation(({ input }) => {
			const current = appStore.get('notificationCenter');
			const notifications = current.notifications.map((notification) =>
				notification.id === input.id ? { ...notification, read: true } : notification
			);
			appStore.set('notificationCenter', { notifications });
			return { success: true };
		}),

	markAllNotificationsRead: publicProcedure.mutation(() => {
		const current = appStore.get('notificationCenter');
		const notifications = current.notifications.map((notification) => ({ ...notification, read: true }));
		appStore.set('notificationCenter', { notifications });
		return { success: true };
	}),

	removeNotification: publicProcedure
		.input(
			z.object({
				id: z.string().min(1),
			})
		)
		.mutation(({ input }) => {
			const current = appStore.get('notificationCenter');
			const notifications = current.notifications.filter((notification) => notification.id !== input.id);
			appStore.set('notificationCenter', { notifications });
			return { success: true };
		}),

	clearNotifications: publicProcedure.mutation(() => {
		appStore.set('notificationCenter', { notifications: [] });
		return { success: true };
	}),

	setKeybindings: publicProcedure
		.input(
			z.object({
				overrides: z.record(z.string(), z.string()),
			})
		)
		.mutation(({ input }) => {
			instanceStore.set('keybindingOverrides', input.overrides);
			return { success: true };
		}),

	/**
	 * Reset all configuration to defaults.
	 */
	reset: publicProcedure.mutation(() => {
		configStore.clear();
		return { success: true };
	}),
});

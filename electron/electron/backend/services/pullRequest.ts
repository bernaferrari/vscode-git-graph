/**
 * Pull Request Integration Service
 * Provider-backed PR operations for GitHub, GitLab, Bitbucket, and Azure DevOps.
 */

export type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';

export interface PullRequestInfo {
	url: string;
	title?: string;
	status?: 'open' | 'merged' | 'closed' | 'draft';
	number?: number;
	author?: string;
}

export interface PullRequestRecord {
	id: number;
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed' | 'merged';
	author: string;
	createdAt: string;
	updatedAt: string;
	head: { ref: string; sha: string };
	base: { ref: string; sha: string };
	draft: boolean;
	mergeable?: boolean | null;
	webUrl: string;
	reviewPosition?: {
		baseSha?: string;
		startSha?: string;
		headSha?: string;
	};
}

export interface PullRequestComment {
	id: string;
	author: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	url: string;
	thread?: {
		id: string;
		status: 'open' | 'resolved';
		canResolve?: boolean;
	};
	inline?: {
		filePath: string;
		line?: number;
		side?: 'left' | 'right';
	};
}

export interface PullRequestInlineCommentInput {
	body: string;
	filePath: string;
	line: number;
	side: 'left' | 'right';
	baseSha?: string;
	startSha?: string;
	headSha?: string;
}

export type PullRequestReviewerStatus =
	| 'requested'
	| 'commented'
	| 'approved'
	| 'changes-requested'
	| 'waiting';

export interface PullRequestReviewerState {
	id: string;
	name: string;
	username?: string;
	role?: string;
	required?: boolean;
	status: PullRequestReviewerStatus;
	providerState?: string;
	updatedAt?: string;
}

export interface PullRequestReviewState {
	overall: 'pending' | 'approved' | 'changes-requested';
	reviewers: PullRequestReviewerState[];
	requestedCount: number;
	approvedCount: number;
	commentedCount: number;
	changesRequestedCount: number;
	waitingCount: number;
}

export interface PullRequestThreadState {
	threadId: string;
	status: 'open' | 'resolved';
}

export interface ProviderAuthConfig {
	githubToken?: string;
	gitlabToken?: string;
	bitbucketToken?: string;
	bitbucketUsername?: string;
	azureToken?: string;
}

type PullRequestState = 'open' | 'closed' | 'all';
type PullRequestMergeMethod = 'merge' | 'squash' | 'rebase';

interface PullRequestApiTargetBase {
	provider: PullRequestProvider;
	host: string;
	remoteUrl: string;
	webBaseUrl: string;
}

interface GitHubPullRequestTarget extends PullRequestApiTargetBase {
	provider: 'github';
	owner: string;
	repo: string;
	apiBaseUrl: string;
}

interface GitLabPullRequestTarget extends PullRequestApiTargetBase {
	provider: 'gitlab';
	projectPath: string;
	apiBaseUrl: string;
}

interface BitbucketPullRequestTarget extends PullRequestApiTargetBase {
	provider: 'bitbucket';
	workspace: string;
	repoSlug: string;
	apiBaseUrl: string;
}

interface AzurePullRequestTarget extends PullRequestApiTargetBase {
	provider: 'azure';
	organization: string;
	project: string;
	repo: string;
	apiBaseUrl: string;
}

export type PullRequestApiTarget =
	| GitHubPullRequestTarget
	| GitLabPullRequestTarget
	| BitbucketPullRequestTarget
	| AzurePullRequestTarget;

interface RequestJsonOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
	headers?: Record<string, string>;
	body?: unknown;
}

interface BranchPullRequestSearchOptions {
	state?: PullRequestState;
	branchName?: string;
}

function trimGitSuffix(value: string): string {
	return value.trim().replace(/\/$/, '').replace(/\.git$/i, '');
}

function toHttpsRemote(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) return null;

	if (/^https?:\/\//i.test(trimmed)) {
		return trimGitSuffix(trimmed);
	}

	const defaultSshMatch = trimmed.match(/^git@([^:]+):(.+)$/);
	if (defaultSshMatch?.[1] && defaultSshMatch[2]) {
		return trimGitSuffix(`https://${defaultSshMatch[1]}/${defaultSshMatch[2]}`);
	}

	const scpLikeMatch = trimmed.match(/^ssh:\/\/git@([^/]+)\/(.+)$/);
	if (scpLikeMatch?.[1] && scpLikeMatch[2]) {
		return trimGitSuffix(`https://${scpLikeMatch[1]}/${scpLikeMatch[2]}`);
	}

	if (trimmed.startsWith('git@ssh.dev.azure.com:v3/')) {
		const path = trimmed.replace('git@ssh.dev.azure.com:v3/', '');
		const [organization, project, repo] = path.split('/').filter(Boolean);
		if (!organization || !project || !repo) return null;
		return trimGitSuffix(`https://dev.azure.com/${organization}/${project}/_git/${repo}`);
	}

	return null;
}

export function parseRemoteUrl(remoteUrl: string): PullRequestApiTarget | null {
	const normalizedRemote = toHttpsRemote(remoteUrl);
	if (!normalizedRemote) return null;

	let parsed: URL;
	try {
		parsed = new URL(normalizedRemote);
	} catch {
		return null;
	}

	const host = parsed.hostname.toLowerCase();
	const segments = parsed.pathname.split('/').filter(Boolean);
	if (segments.length < 2) {
		return null;
	}

	if (host === 'github.com') {
		const owner = segments[0];
		const repo = segments[1];
		if (!owner || !repo) return null;
		return {
			provider: 'github',
			host,
			owner,
			repo,
			remoteUrl: normalizedRemote,
			webBaseUrl: `https://github.com/${owner}/${repo}`,
			apiBaseUrl: 'https://api.github.com',
		};
	}

	if (host === 'bitbucket.org') {
		const workspace = segments[0];
		const repoSlug = segments[1];
		if (!workspace || !repoSlug) return null;
		return {
			provider: 'bitbucket',
			host,
			workspace,
			repoSlug,
			remoteUrl: normalizedRemote,
			webBaseUrl: `https://bitbucket.org/${workspace}/${repoSlug}`,
			apiBaseUrl: 'https://api.bitbucket.org/2.0',
		};
	}

	if (
		host === 'dev.azure.com' &&
		segments.length >= 4 &&
		segments[2]?.toLowerCase() === '_git'
	) {
		const organization = segments[0];
		const project = segments[1];
		const repo = segments[3];
		if (!organization || !project || !repo) return null;
		return {
			provider: 'azure',
			host,
			organization,
			project,
			repo,
			remoteUrl: normalizedRemote,
			webBaseUrl: `https://dev.azure.com/${organization}/${project}/_git/${repo}`,
			apiBaseUrl: `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${encodeURIComponent(repo)}`,
		};
	}

	if (host.endsWith('.visualstudio.com') && segments.length >= 3 && segments[1]?.toLowerCase() === '_git') {
		const organization = host.replace('.visualstudio.com', '');
		const project = segments[0];
		const repo = segments[2];
		if (!organization || !project || !repo) return null;
		return {
			provider: 'azure',
			host,
			organization,
			project,
			repo,
			remoteUrl: normalizedRemote,
			webBaseUrl: `https://${host}/${project}/_git/${repo}`,
			apiBaseUrl: `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${encodeURIComponent(repo)}`,
		};
	}

	const projectPath = segments.join('/');
	return {
		provider: 'gitlab',
		host,
		projectPath,
		remoteUrl: normalizedRemote,
		webBaseUrl: `${parsed.protocol}//${parsed.host}/${projectPath}`,
		apiBaseUrl: `${parsed.protocol}//${parsed.host}/api/v4`,
	};
}

function extractErrorMessage(payload: unknown): string | null {
	if (typeof payload === 'string') {
		return payload.trim() || null;
	}

	if (Array.isArray(payload)) {
		const first = (payload as unknown[])[0];
		return typeof first === 'string' ? first : null;
	}

	if (payload && typeof payload === 'object') {
		const data = payload as Record<string, unknown>;
		const preferredKeys = ['message', 'error_description', 'error', 'detail'];
		for (const key of preferredKeys) {
			const value = data[key];
			if (typeof value === 'string' && value.trim()) {
				return value;
			}
		}
	}

	return null;
}

async function requestJson<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
	const requestInit: RequestInit = {
		method: options.method ?? 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': 'vscode-git-graph-electron',
			...(options.headers ?? {}),
		},
	};
	if (options.body !== undefined) {
		requestInit.body = JSON.stringify(options.body);
	}

	const response = await fetch(url, requestInit);

	if (!response.ok) {
		let parsedBody: unknown = null;
		let rawBody = '';
		try {
			parsedBody = await response.json();
		} catch {
			try {
				rawBody = await response.text();
			} catch {
				// ignore body parsing errors
			}
		}

		const payloadMessage = extractErrorMessage(parsedBody) ?? rawBody.trim();
		const statusText = payloadMessage || response.statusText || 'Unknown error';
		throw new Error(`HTTP ${String(response.status)}: ${statusText}`);
	}

	if (response.status === 204) {
		return null as T;
	}

	return (await response.json()) as T;
}

function getTokenForProvider(provider: PullRequestProvider, auth?: ProviderAuthConfig): string | null {
	if (!auth) return null;

	switch (provider) {
		case 'github':
			return auth.githubToken?.trim() || null;
		case 'gitlab':
			return auth.gitlabToken?.trim() || null;
		case 'bitbucket':
			return auth.bitbucketToken?.trim() || null;
		case 'azure':
			return auth.azureToken?.trim() || null;
		default:
			return null;
	}
}

function buildProviderHeaders(
	provider: PullRequestProvider,
	auth?: ProviderAuthConfig
): Record<string, string> {
	const token = getTokenForProvider(provider, auth);
	if (!token) {
		throw new Error(`Missing ${provider} API token. Configure it in Pull Request settings.`);
	}

	switch (provider) {
		case 'github':
			return { Authorization: `Bearer ${token}` };
		case 'gitlab':
			return { 'PRIVATE-TOKEN': token };
		case 'bitbucket': {
			const username = auth?.bitbucketUsername?.trim();
			if (username) {
				const basic = Buffer.from(`${username}:${token}`).toString('base64');
				return { Authorization: `Basic ${basic}` };
			}
			return { Authorization: `Bearer ${token}` };
		}
		case 'azure': {
			const basic = Buffer.from(`:${token}`).toString('base64');
			return { Authorization: `Basic ${basic}` };
		}
		default:
			return {};
	}
}

function normalizeBranchRef(ref: string): string {
	if (ref.startsWith('refs/heads/')) {
		return ref.slice('refs/heads/'.length);
	}
	return ref;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function toText(value: unknown, fallback = ''): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function toIsoDate(value: unknown): string {
	return typeof value === 'string' && value ? value : new Date().toISOString();
}

function toBoolean(value: unknown, fallback = false): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') {
		if (value === 'true' || value === '1') return true;
		if (value === 'false' || value === '0') return false;
	}
	return fallback;
}

function toStateLabel(state: string, merged = false): 'open' | 'closed' | 'merged' {
	if (merged) return 'merged';
	if (state === 'open' || state === 'opened' || state === 'active' || state === 'OPEN') return 'open';
	if (state === 'merged' || state === 'MERGED' || state === 'completed') return 'merged';
	return 'closed';
}

function normalizeReviewerStatus(value: string): PullRequestReviewerStatus {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'approved' || normalized === 'approval' || normalized === 'accept') return 'approved';
	if (
		normalized === 'changes_requested' ||
		normalized === 'changes-requested' ||
		normalized === 'rejected' ||
		normalized === 'needs_work'
	) {
		return 'changes-requested';
	}
	if (normalized === 'commented' || normalized === 'comment') return 'commented';
	if (normalized === 'waiting' || normalized === 'pending' || normalized === 'unreviewed') return 'waiting';
	return 'requested';
}

function reviewerSortKey(review: PullRequestReviewerState): number {
	return Date.parse(review.updatedAt ?? '') || 0;
}

function mergeReviewerStates(reviewers: PullRequestReviewerState[]): PullRequestReviewerState[] {
	const merged = new Map<string, PullRequestReviewerState>();
	for (const reviewer of reviewers) {
		const existing = merged.get(reviewer.id);
		if (!existing || reviewerSortKey(reviewer) >= reviewerSortKey(existing)) {
			merged.set(reviewer.id, reviewer);
		}
	}
	return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildReviewState(reviewers: PullRequestReviewerState[]): PullRequestReviewState {
	const merged = mergeReviewerStates(reviewers);
	const requestedCount = merged.filter((reviewer) => reviewer.status === 'requested').length;
	const approvedCount = merged.filter((reviewer) => reviewer.status === 'approved').length;
	const commentedCount = merged.filter((reviewer) => reviewer.status === 'commented').length;
	const changesRequestedCount = merged.filter((reviewer) => reviewer.status === 'changes-requested').length;
	const waitingCount = merged.filter((reviewer) => reviewer.status === 'waiting').length;
	return {
		overall:
			changesRequestedCount > 0
				? 'changes-requested'
				: approvedCount > 0 && requestedCount === 0 && waitingCount === 0
					? 'approved'
					: 'pending',
		reviewers: merged,
		requestedCount,
		approvedCount,
		commentedCount,
		changesRequestedCount,
		waitingCount,
	};
}

function buildReviewPosition(position: {
	baseSha?: string;
	startSha?: string;
	headSha?: string;
}): PullRequestRecord['reviewPosition'] {
	const reviewPosition: NonNullable<PullRequestRecord['reviewPosition']> = {};

	if (position.baseSha) {
		reviewPosition.baseSha = position.baseSha;
	}
	if (position.startSha) {
		reviewPosition.startSha = position.startSha;
	}
	if (position.headSha) {
		reviewPosition.headSha = position.headSha;
	}

	return Object.keys(reviewPosition).length > 0 ? reviewPosition : undefined;
}

function mapGitHubReviewer(user: Record<string, unknown>, status: PullRequestReviewerStatus, updatedAt?: string, providerState?: string): PullRequestReviewerState {
	const reviewer: PullRequestReviewerState = {
		id: toText(user.id, toText(user.node_id, toText(user.login, 'github-reviewer'))),
		name: toText(user.login, toText(user.name, 'GitHub reviewer')),
		status,
	};
	const username = toText(user.login);
	if (username) {
		reviewer.username = username;
	}
	if (providerState) {
		reviewer.providerState = providerState;
	}
	if (updatedAt) {
		reviewer.updatedAt = updatedAt;
	}
	return reviewer;
}

function mapGitLabReviewer(user: Record<string, unknown>, status: PullRequestReviewerStatus, updatedAt?: string, providerState?: string): PullRequestReviewerState {
	const reviewer: PullRequestReviewerState = {
		id: toText(user.id, toText(user.username, 'gitlab-reviewer')),
		name: toText(user.name, toText(user.username, 'GitLab reviewer')),
		status,
	};
	const username = toText(user.username);
	if (username) {
		reviewer.username = username;
	}
	if (providerState) {
		reviewer.providerState = providerState;
	}
	if (updatedAt) {
		reviewer.updatedAt = updatedAt;
	}
	return reviewer;
}

function mapBitbucketReviewer(user: Record<string, unknown>, status: PullRequestReviewerStatus, updatedAt?: string, providerState?: string): PullRequestReviewerState {
	const reviewer: PullRequestReviewerState = {
		id: toText(user.uuid, toText(user.account_id, toText(user.nickname, 'bitbucket-reviewer'))),
		name: toText(user.display_name, toText(user.nickname, 'Bitbucket reviewer')),
		status,
	};
	const username = toText(user.nickname);
	if (username) {
		reviewer.username = username;
	}
	if (providerState) {
		reviewer.providerState = providerState;
	}
	if (updatedAt) {
		reviewer.updatedAt = updatedAt;
	}
	return reviewer;
}

function mapAzureReviewer(user: Record<string, unknown>, status: PullRequestReviewerStatus, required: boolean, updatedAt?: string, providerState?: string): PullRequestReviewerState {
	const reviewer: PullRequestReviewerState = {
		id: toText(user.id, toText(user.uniqueName, 'azure-reviewer')),
		name: toText(user.displayName, toText(user.uniqueName, 'Azure reviewer')),
		required,
		status,
	};
	const username = toText(user.uniqueName);
	if (username) {
		reviewer.username = username;
	}
	if (providerState) {
		reviewer.providerState = providerState;
	}
	if (updatedAt) {
		reviewer.updatedAt = updatedAt;
	}
	return reviewer;
}

function mapGitHubPullRequest(pr: Record<string, unknown>): PullRequestRecord {
	const user = isRecord(pr.user) ? pr.user : {};
	const head = isRecord(pr.head) ? pr.head : {};
	const base = isRecord(pr.base) ? pr.base : {};
	const mergeable = pr.mergeable;
	const state = toStateLabel(toText(pr.state), Boolean(pr.merged_at));
	const reviewPosition = buildReviewPosition({
		baseSha: toText(base.sha),
		headSha: toText(head.sha),
	});
	const record: PullRequestRecord = {
		id: toNumber(pr.id),
		number: toNumber(pr.number),
		title: toText(pr.title),
		body: toText(pr.body),
		state,
		author: toText(user.login),
		createdAt: toIsoDate(pr.created_at),
		updatedAt: toIsoDate(pr.updated_at),
		head: {
			ref: toText(head.ref),
			sha: toText(head.sha),
		},
		base: {
			ref: toText(base.ref),
			sha: toText(base.sha),
		},
		draft: Boolean(pr.draft),
		mergeable: typeof mergeable === 'boolean' ? mergeable : null,
		webUrl: toText(pr.html_url),
	};
	if (reviewPosition) {
		record.reviewPosition = reviewPosition;
	}
	return record;
}

function mapGitLabPullRequest(pr: Record<string, unknown>): PullRequestRecord {
	const author = isRecord(pr.author) ? pr.author : {};
	const diffRefs = isRecord(pr.diff_refs) ? pr.diff_refs : {};
	const reviewPosition = buildReviewPosition({
		baseSha: toText(diffRefs.base_sha),
		startSha: toText(diffRefs.start_sha),
		headSha: toText(diffRefs.head_sha),
	});
	const record: PullRequestRecord = {
		id: toNumber(pr.id),
		number: toNumber(pr.iid),
		title: toText(pr.title),
		body: toText(pr.description),
		state: toStateLabel(toText(pr.state)),
		author: toText(author.username, toText(author.name)),
		createdAt: toIsoDate(pr.created_at),
		updatedAt: toIsoDate(pr.updated_at),
		head: {
			ref: toText(pr.source_branch),
			sha: toText(diffRefs.head_sha),
		},
		base: {
			ref: toText(pr.target_branch),
			sha: toText(diffRefs.base_sha),
		},
		draft: Boolean(pr.draft) || toText(pr.work_in_progress, 'false') === 'true',
		mergeable:
			typeof pr.merge_status === 'string'
				? pr.merge_status === 'can_be_merged'
				: null,
		webUrl: toText(pr.web_url),
	};
	if (reviewPosition) {
		record.reviewPosition = reviewPosition;
	}
	return record;
}

function mapBitbucketPullRequest(pr: Record<string, unknown>): PullRequestRecord {
	const author = isRecord(pr.author) ? pr.author : {};
	const source = isRecord(pr.source) ? pr.source : {};
	const destination = isRecord(pr.destination) ? pr.destination : {};
	const sourceBranch = isRecord(source.branch) ? source.branch : {};
	const sourceCommit = isRecord(source.commit) ? source.commit : {};
	const destinationBranch = isRecord(destination.branch) ? destination.branch : {};
	const destinationCommit = isRecord(destination.commit) ? destination.commit : {};
	const links = isRecord(pr.links) ? pr.links : {};
	const html = isRecord(links.html) ? links.html : {};
	const reviewPosition = buildReviewPosition({
		baseSha: toText(destinationCommit.hash),
		headSha: toText(sourceCommit.hash),
	});
	const record: PullRequestRecord = {
		id: toNumber(pr.id),
		number: toNumber(pr.id),
		title: toText(pr.title),
		body: toText(pr.description),
		state: toStateLabel(toText(pr.state)),
		author: toText(author.display_name, toText(author.nickname)),
		createdAt: toIsoDate(pr.created_on),
		updatedAt: toIsoDate(pr.updated_on),
		head: {
			ref: toText(sourceBranch.name),
			sha: toText(sourceCommit.hash),
		},
		base: {
			ref: toText(destinationBranch.name),
			sha: toText(destinationCommit.hash),
		},
		draft: false,
		webUrl: toText(html.href),
	};
	if (reviewPosition) {
		record.reviewPosition = reviewPosition;
	}
	return record;
}

function mapAzurePullRequest(
	target: AzurePullRequestTarget,
	pr: Record<string, unknown>
): PullRequestRecord {
	const createdBy = isRecord(pr.createdBy) ? pr.createdBy : {};
	const sourceCommit = isRecord(pr.lastMergeSourceCommit) ? pr.lastMergeSourceCommit : {};
	const targetCommit = isRecord(pr.lastMergeTargetCommit) ? pr.lastMergeTargetCommit : {};
	const id = toNumber(pr.pullRequestId, toNumber(pr.codeReviewId));
	const reviewPosition = buildReviewPosition({
		baseSha: toText(targetCommit.commitId),
		headSha: toText(sourceCommit.commitId),
	});
	const record: PullRequestRecord = {
		id,
		number: id,
		title: toText(pr.title),
		body: toText(pr.description),
		state: toStateLabel(toText(pr.status)),
		author: toText(createdBy.displayName, toText(createdBy.uniqueName)),
		createdAt: toIsoDate(pr.creationDate),
		updatedAt: toIsoDate(pr.closedDate ?? pr.creationDate),
		head: {
			ref: normalizeBranchRef(toText(pr.sourceRefName)),
			sha: toText(sourceCommit.commitId),
		},
		base: {
			ref: normalizeBranchRef(toText(pr.targetRefName)),
			sha: toText(targetCommit.commitId),
		},
		draft: Boolean(pr.isDraft),
		webUrl: `${target.webBaseUrl}/pullrequest/${String(id)}`,
	};
	if (reviewPosition) {
		record.reviewPosition = reviewPosition;
	}
	return record;
}

function parseTarget(remoteUrl: string, provider: PullRequestProvider): PullRequestApiTarget {
	const parsed = parseRemoteUrl(remoteUrl);
	if (!parsed) {
		throw new Error('Unable to parse repository remote URL for pull request operations.');
	}
	if (parsed.provider !== provider) {
		throw new Error(
			`Remote is detected as ${parsed.provider}, but ${provider} was requested.`
		);
	}
	return parsed;
}

function gitLabStateToApi(state: PullRequestState): 'opened' | 'closed' | 'all' {
	if (state === 'open') return 'opened';
	if (state === 'closed') return 'closed';
	return 'all';
}

function azureStatusToApi(state: PullRequestState): 'active' | 'completed' | 'all' {
	if (state === 'open') return 'active';
	if (state === 'closed') return 'completed';
	return 'all';
}

export function generateCreatePullRequestUrl(
	remoteUrl: string,
	sourceBranch: string,
	targetBranch = 'main',
	title?: string
): string | null {
	const target = parseRemoteUrl(remoteUrl);
	if (!target) return null;

	if (target.provider === 'github') {
		return `${target.webBaseUrl}/compare/${encodeURIComponent(targetBranch)}...${encodeURIComponent(sourceBranch)}?expand=1${title ? `&title=${encodeURIComponent(title)}` : ''}`;
	}

	if (target.provider === 'gitlab') {
		return `${target.webBaseUrl}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(sourceBranch)}&merge_request[target_branch]=${encodeURIComponent(targetBranch)}${title ? `&merge_request[title]=${encodeURIComponent(title)}` : ''}`;
	}

	if (target.provider === 'bitbucket') {
		return `${target.webBaseUrl}/pull-requests/new?source=${encodeURIComponent(sourceBranch)}&dest=${encodeURIComponent(targetBranch)}`;
	}

	return `${target.webBaseUrl}?path=/pullrequestcreate&sourceRef=${encodeURIComponent(`refs/heads/${sourceBranch}`)}&targetRef=${encodeURIComponent(`refs/heads/${targetBranch}`)}`;
}

export function generatePullRequestsUrl(remoteUrl: string): string | null {
	const target = parseRemoteUrl(remoteUrl);
	if (!target) return null;

	if (target.provider === 'github') return `${target.webBaseUrl}/pulls`;
	if (target.provider === 'gitlab') return `${target.webBaseUrl}/-/merge_requests`;
	if (target.provider === 'bitbucket') return `${target.webBaseUrl}/pull-requests`;
	return `${target.webBaseUrl}/pullrequests`;
}

export async function listPullRequests(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	state: PullRequestState = 'open'
): Promise<PullRequestRecord[]> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const data = await requestJson<Array<Record<string, unknown>>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls?state=${state}&per_page=100`,
			{ headers }
		);
		return data.map((entry) => mapGitHubPullRequest(entry));
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const data = await requestJson<Array<Record<string, unknown>>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests?scope=all&state=${gitLabStateToApi(state)}&per_page=100`,
			{ headers }
		);
		return data.map((entry) => mapGitLabPullRequest(entry));
	}

	if (target.provider === 'bitbucket') {
		const query =
			state === 'open'
				? `q=${encodeURIComponent('state = "OPEN"')}&`
				: state === 'closed'
					? `q=${encodeURIComponent('state = "DECLINED" OR state = "MERGED"')}&`
					: '';
		const data = await requestJson<{ values?: Array<Record<string, unknown>> }>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests?${query}pagelen=50`,
			{ headers }
		);
		return (data.values ?? []).map((entry) => mapBitbucketPullRequest(entry));
	}

	const data = await requestJson<{ value?: Array<Record<string, unknown>> }>(
			`${target.apiBaseUrl}/pullrequests?searchCriteria.status=${azureStatusToApi(state)}&api-version=7.1`,
			{ headers }
		);
	return (data.value ?? []).map((entry) => mapAzurePullRequest(target, entry));
}

export async function getPullRequest(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number
): Promise<PullRequestRecord | null> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}`,
			{ headers }
		);
		return mapGitHubPullRequest(pr);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}`,
			{ headers }
		);
		return mapGitLabPullRequest(pr);
	}

	if (target.provider === 'bitbucket') {
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}`,
			{ headers }
		);
		return mapBitbucketPullRequest(pr);
	}

	const pr = await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullrequests/${String(number)}?api-version=7.1`,
		{ headers }
	);
	return mapAzurePullRequest(target, pr);
}

export async function createPullRequest(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	input: {
		title: string;
		body?: string;
		head: string;
		base: string;
		draft?: boolean;
	}
): Promise<PullRequestRecord> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls`,
			{
				method: 'POST',
				headers,
				body: {
					title: input.title,
					body: input.body ?? '',
					head: input.head,
					base: input.base,
					draft: Boolean(input.draft),
				},
			}
		);
		return mapGitHubPullRequest(pr);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const title = input.draft && !/^draft:/i.test(input.title) ? `Draft: ${input.title}` : input.title;
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests`,
			{
				method: 'POST',
				headers,
				body: {
					title,
					description: input.body ?? '',
					source_branch: input.head,
					target_branch: input.base,
				},
			}
		);
		return mapGitLabPullRequest(pr);
	}

	if (target.provider === 'bitbucket') {
		const pr = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests`,
			{
				method: 'POST',
				headers,
				body: {
					title: input.title,
					description: input.body ?? '',
					source: { branch: { name: input.head } },
					destination: { branch: { name: input.base } },
				},
			}
		);
		return mapBitbucketPullRequest(pr);
	}

	const pr = await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullrequests?api-version=7.1`,
		{
			method: 'POST',
			headers,
			body: {
				sourceRefName: `refs/heads/${input.head}`,
				targetRefName: `refs/heads/${input.base}`,
				title: input.title,
				description: input.body ?? '',
				isDraft: Boolean(input.draft),
			},
		}
	);
	return mapAzurePullRequest(target, pr);
}

export async function mergePullRequest(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number,
	mergeMethod: PullRequestMergeMethod = 'merge'
): Promise<void> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}/merge`,
			{
				method: 'PUT',
				headers,
				body: {
					merge_method: mergeMethod,
				},
			}
		);
		return;
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/merge`,
			{
				method: 'PUT',
				headers,
				body: {
					squash: mergeMethod === 'squash',
				},
			}
		);
		return;
	}

	if (target.provider === 'bitbucket') {
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}/merge`,
			{
				method: 'POST',
				headers,
			}
		);
		return;
	}

	const mergeStrategyByMethod: Record<PullRequestMergeMethod, string> = {
		merge: 'noFastForward',
		squash: 'squash',
		rebase: 'rebase',
	};
	await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullrequests/${String(number)}?api-version=7.1`,
		{
			method: 'PATCH',
			headers,
			body: {
				status: 'completed',
				completionOptions: {
					mergeStrategy: mergeStrategyByMethod[mergeMethod],
				},
			},
		}
	);
}

export async function closePullRequest(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number
): Promise<void> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}`,
			{
				method: 'PATCH',
				headers,
				body: { state: 'closed' },
			}
		);
		return;
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}`,
			{
				method: 'PUT',
				headers,
				body: { state_event: 'close' },
			}
		);
		return;
	}

	if (target.provider === 'bitbucket') {
		await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}/decline`,
			{
				method: 'POST',
				headers,
			}
		);
		return;
	}

	await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullrequests/${String(number)}?api-version=7.1`,
		{
			method: 'PATCH',
			headers,
			body: {
				status: 'abandoned',
			},
		}
	);
}

function mapGitHubPullRequestComment(comment: Record<string, unknown>): PullRequestComment {
	const user = isRecord(comment.user) ? comment.user : {};
	const path = toText(comment.path);
	const line = typeof comment.line === 'number' ? comment.line : undefined;
	const side = typeof comment.side === 'string'
		? comment.side.toLowerCase() === 'left'
			? 'left'
			: comment.side.toLowerCase() === 'right'
				? 'right'
				: undefined
		: undefined;
	return {
		id: toText(comment.id),
		author: toText(user.login),
		body: toText(comment.body),
		createdAt: toIsoDate(comment.created_at),
		updatedAt: toIsoDate(comment.updated_at),
		url: toText(comment.html_url),
		...(path ? { inline: { filePath: path, ...(line ? { line } : {}), ...(side ? { side } : {}) } } : {}),
	};
}

function mapGitLabPullRequestComment(comment: Record<string, unknown>, discussion?: Record<string, unknown>): PullRequestComment {
	const author = isRecord(comment.author) ? comment.author : {};
	const position = isRecord(comment.position) ? comment.position : {};
	const oldPath = toText(position.old_path);
	const newPath = toText(position.new_path);
	const filePath = newPath || oldPath;
	const line =
		typeof position.new_line === 'number'
			? position.new_line
			: typeof position.old_line === 'number'
				? position.old_line
				: undefined;
	const side =
		typeof position.new_line === 'number'
			? 'right'
			: typeof position.old_line === 'number'
				? 'left'
				: undefined;
	return {
		id: toText(comment.id),
		author: toText(author.username, toText(author.name)),
		body: toText(comment.body),
		createdAt: toIsoDate(comment.created_at),
		updatedAt: toIsoDate(comment.updated_at),
		url: '',
		...(discussion
			? {
					thread: {
						id: toText(discussion.id),
						status: toBoolean(discussion.resolved) ? 'resolved' : 'open',
						canResolve: toBoolean(discussion.resolvable, true),
					},
			  }
			: {}),
		...(filePath ? { inline: { filePath, ...(line ? { line } : {}), ...(side ? { side } : {}) } } : {}),
	};
}

function mapBitbucketPullRequestComment(comment: Record<string, unknown>): PullRequestComment {
	const user = isRecord(comment.user) ? comment.user : {};
	const content = isRecord(comment.content) ? comment.content : {};
	const links = isRecord(comment.links) ? comment.links : {};
	const html = isRecord(links.html) ? links.html : {};
	const inline = isRecord(comment.inline) ? comment.inline : {};
	const filePath = toText(inline.path);
	const line =
		typeof inline.to === 'number'
			? inline.to
			: typeof inline.from === 'number'
				? inline.from
				: undefined;
	const side =
		typeof inline.to === 'number'
			? 'right'
			: typeof inline.from === 'number'
				? 'left'
				: undefined;
	return {
		id: toText(comment.id),
		author: toText(user.display_name, toText(user.nickname)),
		body: toText(content.raw),
		createdAt: toIsoDate(comment.created_on),
		updatedAt: toIsoDate(comment.updated_on),
		url: toText(html.href),
		...(filePath ? { inline: { filePath, ...(line ? { line } : {}), ...(side ? { side } : {}) } } : {}),
	};
}

function mapAzurePullRequestComment(
	target: AzurePullRequestTarget,
	comment: Record<string, unknown>,
	fallbackThreadId: number,
	thread?: Record<string, unknown>
): PullRequestComment {
	const author = isRecord(comment.author) ? comment.author : {};
	const commentId = toNumber(comment.id);
	const threadContext = isRecord(thread?.threadContext) ? thread.threadContext : {};
	const rightFileStart = isRecord(threadContext.rightFileStart) ? threadContext.rightFileStart : {};
	const leftFileStart = isRecord(threadContext.leftFileStart) ? threadContext.leftFileStart : {};
	const filePath = toText(threadContext.filePath).replace(/^\//, '');
	const line =
		typeof rightFileStart.line === 'number'
			? rightFileStart.line
			: typeof leftFileStart.line === 'number'
				? leftFileStart.line
				: undefined;
	const side =
		typeof rightFileStart.line === 'number'
			? 'right'
			: typeof leftFileStart.line === 'number'
				? 'left'
				: undefined;
	return {
		id: toText(commentId || fallbackThreadId),
		author: toText(author.displayName, toText(author.uniqueName)),
		body: toText(comment.content),
		createdAt: toIsoDate(comment.publishedDate),
		updatedAt: toIsoDate(comment.lastUpdatedDate ?? comment.publishedDate),
		url: `${target.webBaseUrl}/pullrequest/${String(fallbackThreadId)}`,
		thread: {
			id: String(fallbackThreadId),
			status: (() => {
				const status = toText(thread?.status).toLowerCase();
				return status === 'closed' || status === 'fixed' || status === 'resolved' ? 'resolved' : 'open';
			})(),
			canResolve: true,
		},
		...(filePath ? { inline: { filePath, ...(line ? { line } : {}), ...(side ? { side } : {}) } } : {}),
	};
}

export async function listPullRequestComments(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number
): Promise<PullRequestComment[]> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const [issueComments, reviewComments] = await Promise.all([
			requestJson<Array<Record<string, unknown>>>(
				`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/issues/${String(number)}/comments?per_page=100`,
				{ headers }
			),
			requestJson<Array<Record<string, unknown>>>(
				`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}/comments?per_page=100`,
				{ headers }
			),
		]);
		return [...issueComments, ...reviewComments].map((comment) => mapGitHubPullRequestComment(comment));
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const [notes, discussions] = await Promise.all([
			requestJson<Array<Record<string, unknown>>>(
				`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/notes?per_page=100`,
				{ headers }
			),
			requestJson<Array<Record<string, unknown>>>(
				`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/discussions?per_page=100`,
				{ headers }
			),
		]);
		const topLevelNotes = notes
			.filter((comment) => comment.system !== true)
			.map((comment) => mapGitLabPullRequestComment(comment));
		const discussionNotes = discussions.flatMap((discussion) =>
			Array.isArray(discussion.notes)
				? discussion.notes
						.filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.system !== true)
						.map((note) => mapGitLabPullRequestComment(note, discussion))
				: []
		);
		return [...topLevelNotes, ...discussionNotes];
	}

	if (target.provider === 'bitbucket') {
		const response = await requestJson<{ values?: Array<Record<string, unknown>> }>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}/comments?pagelen=100`,
			{ headers }
		);
		return (response.values ?? []).map((comment) => mapBitbucketPullRequestComment(comment));
	}

	const response = await requestJson<{ value?: Array<Record<string, unknown>> }>(
		`${target.apiBaseUrl}/pullRequests/${String(number)}/threads?api-version=7.1`,
		{ headers }
	);

	const comments: PullRequestComment[] = [];
	for (const thread of response.value ?? []) {
		const threadId = toNumber(thread.id, number);
		const threadComments = Array.isArray(thread.comments) ? thread.comments : [];
		for (const comment of threadComments) {
			if (isRecord(comment)) {
				comments.push(mapAzurePullRequestComment(target, comment, threadId, thread));
			}
		}
	}
	return comments;
}

export async function getPullRequestReviewState(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number
): Promise<PullRequestReviewState> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const [pullRequest, reviews] = await Promise.all([
			requestJson<Record<string, unknown>>(
				`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}`,
				{ headers }
			),
			requestJson<Array<Record<string, unknown>>>(
				`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}/reviews?per_page=100`,
				{ headers }
			),
		]);
		const reviewers: PullRequestReviewerState[] = [];
		const requestedReviewers = Array.isArray(pullRequest.requested_reviewers)
			? pullRequest.requested_reviewers.filter((entry): entry is Record<string, unknown> => isRecord(entry))
			: [];
		for (const reviewer of requestedReviewers) {
			reviewers.push(mapGitHubReviewer(reviewer, 'requested'));
		}
		for (const review of reviews) {
			const user = isRecord(review.user) ? review.user : {};
			const state = normalizeReviewerStatus(toText(review.state));
			reviewers.push(
				mapGitHubReviewer(
					user,
					state,
					toIsoDate(review.submitted_at ?? review.commit_id ?? review.id),
					toText(review.state)
				)
			);
		}
		return buildReviewState(reviewers);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const [pullRequest, approvals] = await Promise.all([
			requestJson<Record<string, unknown>>(
				`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}`,
				{ headers }
			),
			requestJson<Record<string, unknown>>(
				`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/approval_state`,
				{ headers }
			),
		]);
		const reviewers: PullRequestReviewerState[] = [];
		const requestedReviewers = Array.isArray(pullRequest.reviewers)
			? pullRequest.reviewers.filter((entry): entry is Record<string, unknown> => isRecord(entry))
			: [];
		for (const reviewer of requestedReviewers) {
			reviewers.push(mapGitLabReviewer(reviewer, 'requested'));
		}
		const approvedBy = Array.isArray(approvals.approved_by)
			? approvals.approved_by.filter((entry): entry is Record<string, unknown> => isRecord(entry))
			: [];
		for (const approval of approvedBy) {
			const user = isRecord(approval.user) ? approval.user : approval;
			reviewers.push(
				mapGitLabReviewer(
					user,
					'approved',
					toIsoDate(approval.approved_at ?? approval.created_at),
					'approved'
				)
			);
		}
		return buildReviewState(reviewers);
	}

	if (target.provider === 'bitbucket') {
		const pullRequest = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}`,
			{ headers }
		);
		const reviewers: PullRequestReviewerState[] = [];
		const requestedReviewers = Array.isArray(pullRequest.reviewers)
			? pullRequest.reviewers.filter((entry): entry is Record<string, unknown> => isRecord(entry))
			: [];
		for (const reviewer of requestedReviewers) {
			reviewers.push(mapBitbucketReviewer(reviewer, 'requested'));
		}
		const participants = Array.isArray(pullRequest.participants)
			? pullRequest.participants.filter((entry): entry is Record<string, unknown> => isRecord(entry))
			: [];
		for (const participant of participants) {
			const user = isRecord(participant.user) ? participant.user : participant;
			const status = toBoolean(participant.approved)
				? 'approved'
				: toText(participant.state).toUpperCase() === 'CHANGES_REQUESTED'
					? 'changes-requested'
					: 'commented';
			reviewers.push(
				mapBitbucketReviewer(
					user,
					status,
					toIsoDate(participant.updated_on ?? participant.participated_on),
					toText(participant.state)
				)
			);
		}
		return buildReviewState(reviewers);
	}

	const response = await requestJson<{ value?: Array<Record<string, unknown>> }>(
		`${target.apiBaseUrl}/pullRequests/${String(number)}/reviewers?api-version=7.1`,
		{ headers }
	);
	const reviewers = (response.value ?? []).map((reviewer) => {
		const vote = toNumber(reviewer.vote);
		const status: PullRequestReviewerStatus =
			vote >= 5 ? 'approved' : vote <= -5 ? 'changes-requested' : vote === 0 ? 'requested' : 'waiting';
		return mapAzureReviewer(
			reviewer,
			status,
			toBoolean(reviewer.isRequired),
			toIsoDate(reviewer.votedForDate ?? reviewer.lastUpdatedDate),
			String(vote)
		);
	});
	return buildReviewState(reviewers);
}

export async function setPullRequestThreadResolved(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number,
	threadId: string,
	resolved: boolean
): Promise<PullRequestThreadState> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const discussion = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/discussions/${encodeURIComponent(threadId)}?resolved=${resolved ? 'true' : 'false'}`,
			{
				method: 'PUT',
				headers,
			}
		);
		return {
			threadId: toText(discussion.id, threadId),
			status: toBoolean(discussion.resolved) ? 'resolved' : 'open',
		};
	}

	if (target.provider === 'azure') {
		const thread = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/pullRequests/${String(number)}/threads/${encodeURIComponent(threadId)}?api-version=7.1`,
			{
				method: 'PATCH',
				headers,
				body: {
					status: resolved ? 'closed' : 'active',
				},
			}
		);
		const status = toText(thread.status).toLowerCase();
		return {
			threadId: String(toNumber(thread.id, Number(threadId))),
			status: status === 'closed' || status === 'fixed' || status === 'resolved' ? 'resolved' : 'open',
		};
	}

	throw new Error(`${provider} does not expose provider thread resolution in the current integration path.`);
}

export async function addPullRequestComment(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number,
	body: string
): Promise<PullRequestComment> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/issues/${String(number)}/comments`,
			{
				method: 'POST',
				headers,
				body: { body },
			}
		);
		return mapGitHubPullRequestComment(comment);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/notes`,
			{
				method: 'POST',
				headers,
				body: { body },
			}
		);
		return mapGitLabPullRequestComment(comment);
	}

	if (target.provider === 'bitbucket') {
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}/comments`,
			{
				method: 'POST',
				headers,
				body: { content: { raw: body } },
			}
		);
		return mapBitbucketPullRequestComment(comment);
	}

	const thread = await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullRequests/${String(number)}/threads?api-version=7.1`,
		{
			method: 'POST',
			headers,
			body: {
				comments: [
					{
						parentCommentId: 0,
						content: body,
						commentType: 1,
					},
				],
				status: 'active',
			},
		}
	);
	const threadId = toNumber(thread.id, number);
	const firstComment = Array.isArray(thread.comments) && isRecord(thread.comments[0])
		? thread.comments[0]
		: null;
	return mapAzurePullRequestComment(target, firstComment ?? { content: body }, threadId);
}

export async function addPullRequestInlineComment(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	number: number,
	input: PullRequestInlineCommentInput
): Promise<PullRequestComment> {
	const target = parseTarget(remoteUrl, provider);
	const headers = buildProviderHeaders(provider, auth);

	if (target.provider === 'github') {
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${String(number)}/comments`,
			{
				method: 'POST',
				headers,
				body: {
					body: input.body,
					commit_id: input.headSha,
					path: input.filePath,
					line: input.line,
					side: input.side === 'right' ? 'RIGHT' : 'LEFT',
				},
			}
		);
		return mapGitHubPullRequestComment(comment);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${String(number)}/discussions`,
			{
				method: 'POST',
				headers,
				body: {
					body: input.body,
					position: {
						position_type: 'text',
						base_sha: input.baseSha,
						start_sha: input.startSha ?? input.baseSha,
						head_sha: input.headSha,
						old_path: input.filePath,
						new_path: input.filePath,
						...(input.side === 'right' ? { new_line: input.line } : { old_line: input.line }),
					},
				},
			}
		);
		const notes = Array.isArray(comment.notes) ? comment.notes : [];
		const firstNote = notes.find((entry) => isRecord(entry));
		return mapGitLabPullRequestComment(isRecord(firstNote) ? firstNote : comment);
	}

	if (target.provider === 'bitbucket') {
		const comment = await requestJson<Record<string, unknown>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${String(number)}/comments`,
			{
				method: 'POST',
				headers,
				body: {
					content: { raw: input.body },
					inline: {
						path: input.filePath,
						...(input.side === 'right' ? { to: input.line } : { from: input.line }),
					},
				},
			}
		);
		return mapBitbucketPullRequestComment(comment);
	}

	const thread = await requestJson<Record<string, unknown>>(
		`${target.apiBaseUrl}/pullRequests/${String(number)}/threads?api-version=7.1`,
		{
			method: 'POST',
			headers,
			body: {
				comments: [
					{
						parentCommentId: 0,
						content: input.body,
						commentType: 1,
					},
				],
				status: 'active',
				threadContext: {
					filePath: input.filePath.startsWith('/') ? input.filePath : `/${input.filePath}`,
					...(input.side === 'right'
						? {
								rightFileStart: { line: input.line, offset: 1 },
								rightFileEnd: { line: input.line, offset: 1 },
						  }
						: {
								leftFileStart: { line: input.line, offset: 1 },
								leftFileEnd: { line: input.line, offset: 1 },
						  }),
				},
			},
		}
	);
	const threadId = toNumber(thread.id, number);
	const firstComment = Array.isArray(thread.comments) && isRecord(thread.comments[0])
		? thread.comments[0]
		: null;
	return mapAzurePullRequestComment(target, firstComment ?? { content: input.body }, threadId);
}

export async function checkBranchPullRequest(
	remoteUrl: string,
	branchName: string,
	githubToken?: string
): Promise<PullRequestInfo | null> {
	try {
		const parsed = parseRemoteUrl(remoteUrl);
		if (!parsed) return null;

		const auth: ProviderAuthConfig = {};
		if (githubToken) {
			auth.githubToken = githubToken;
			auth.gitlabToken = githubToken;
			auth.bitbucketToken = githubToken;
			auth.azureToken = githubToken;
		}

		const results = await listPullRequests(
			remoteUrl,
			parsed.provider,
			auth,
			'open'
		);

		const match = results.find((pr) => pr.head.ref === branchName);
		if (!match) return null;

		return {
			url: match.webUrl,
			title: match.title,
			status: match.draft ? 'draft' : match.state,
			number: match.number,
			author: match.author,
		};
	} catch {
		return null;
	}
}

export async function getPullRequests(
	remoteUrl: string,
	state: PullRequestState = 'open',
	githubToken?: string
): Promise<PullRequestInfo[]> {
	try {
		const parsed = parseRemoteUrl(remoteUrl);
		if (!parsed) return [];
		const auth: ProviderAuthConfig = {};
		if (githubToken) {
			auth.githubToken = githubToken;
			auth.gitlabToken = githubToken;
			auth.bitbucketToken = githubToken;
			auth.azureToken = githubToken;
		}
		const pullRequests = await listPullRequests(
			remoteUrl,
			parsed.provider,
			auth,
			state
		);
		return pullRequests.map((pr) => ({
			url: pr.webUrl,
			title: pr.title,
			status: pr.draft ? 'draft' : pr.state,
			number: pr.number,
			author: pr.author,
		}));
	} catch {
		return [];
	}
}

export async function searchBranchPullRequests(
	remoteUrl: string,
	provider: PullRequestProvider,
	auth: ProviderAuthConfig | undefined,
	options: BranchPullRequestSearchOptions
): Promise<PullRequestRecord[]> {
	const pullRequests = await listPullRequests(
		remoteUrl,
		provider,
		auth,
		options.state ?? 'open'
	);
	if (!options.branchName) return pullRequests;
	return pullRequests.filter((pr) => pr.head.ref === options.branchName);
}

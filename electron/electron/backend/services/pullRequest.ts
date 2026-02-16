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
		const first = payload[0];
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
	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': 'vscode-git-graph-electron',
			...(options.headers ?? {}),
		},
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});

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
		throw new Error(`HTTP ${response.status}: ${statusText}`);
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

function toIsoDate(value: unknown): string {
	return typeof value === 'string' && value ? value : new Date().toISOString();
}

function toStateLabel(state: string, merged = false): 'open' | 'closed' | 'merged' {
	if (merged) return 'merged';
	if (state === 'open' || state === 'opened' || state === 'active' || state === 'OPEN') return 'open';
	if (state === 'merged' || state === 'MERGED' || state === 'completed') return 'merged';
	return 'closed';
}

function mapGitHubPullRequest(pr: Record<string, any>): PullRequestRecord {
	const state = toStateLabel(String(pr.state ?? ''), Boolean(pr.merged_at));
	return {
		id: Number(pr.id ?? 0),
		number: Number(pr.number ?? 0),
		title: String(pr.title ?? ''),
		body: String(pr.body ?? ''),
		state,
		author: String(pr.user?.login ?? ''),
		createdAt: toIsoDate(pr.created_at),
		updatedAt: toIsoDate(pr.updated_at),
		head: {
			ref: String(pr.head?.ref ?? ''),
			sha: String(pr.head?.sha ?? ''),
		},
		base: {
			ref: String(pr.base?.ref ?? ''),
			sha: String(pr.base?.sha ?? ''),
		},
		draft: Boolean(pr.draft),
		mergeable: typeof pr.mergeable === 'boolean' ? pr.mergeable : null,
		webUrl: String(pr.html_url ?? ''),
	};
}

function mapGitLabPullRequest(pr: Record<string, any>): PullRequestRecord {
	return {
		id: Number(pr.id ?? 0),
		number: Number(pr.iid ?? 0),
		title: String(pr.title ?? ''),
		body: String(pr.description ?? ''),
		state: toStateLabel(String(pr.state ?? '')),
		author: String(pr.author?.username ?? pr.author?.name ?? ''),
		createdAt: toIsoDate(pr.created_at),
		updatedAt: toIsoDate(pr.updated_at),
		head: {
			ref: String(pr.source_branch ?? ''),
			sha: String(pr.diff_refs?.head_sha ?? ''),
		},
		base: {
			ref: String(pr.target_branch ?? ''),
			sha: String(pr.diff_refs?.base_sha ?? ''),
		},
		draft: Boolean(pr.draft) || String(pr.work_in_progress ?? 'false') === 'true',
		mergeable:
			typeof pr.merge_status === 'string'
				? pr.merge_status === 'can_be_merged'
				: null,
		webUrl: String(pr.web_url ?? ''),
	};
}

function mapBitbucketPullRequest(pr: Record<string, any>): PullRequestRecord {
	return {
		id: Number(pr.id ?? 0),
		number: Number(pr.id ?? 0),
		title: String(pr.title ?? ''),
		body: String(pr.description ?? ''),
		state: toStateLabel(String(pr.state ?? '')),
		author: String(pr.author?.display_name ?? pr.author?.nickname ?? ''),
		createdAt: toIsoDate(pr.created_on),
		updatedAt: toIsoDate(pr.updated_on),
		head: {
			ref: String(pr.source?.branch?.name ?? ''),
			sha: String(pr.source?.commit?.hash ?? ''),
		},
		base: {
			ref: String(pr.destination?.branch?.name ?? ''),
			sha: String(pr.destination?.commit?.hash ?? ''),
		},
		draft: false,
		webUrl: String(pr.links?.html?.href ?? ''),
	};
}

function mapAzurePullRequest(
	target: AzurePullRequestTarget,
	pr: Record<string, any>
): PullRequestRecord {
	const id = Number(pr.pullRequestId ?? pr.codeReviewId ?? 0);
	return {
		id,
		number: id,
		title: String(pr.title ?? ''),
		body: String(pr.description ?? ''),
		state: toStateLabel(String(pr.status ?? '')),
		author: String(pr.createdBy?.displayName ?? pr.createdBy?.uniqueName ?? ''),
		createdAt: toIsoDate(pr.creationDate),
		updatedAt: toIsoDate(pr.closedDate ?? pr.creationDate),
		head: {
			ref: normalizeBranchRef(String(pr.sourceRefName ?? '')),
			sha: String(pr.lastMergeSourceCommit?.commitId ?? ''),
		},
		base: {
			ref: normalizeBranchRef(String(pr.targetRefName ?? '')),
			sha: String(pr.lastMergeTargetCommit?.commitId ?? ''),
		},
		draft: Boolean(pr.isDraft),
		webUrl: `${target.webBaseUrl}/pullrequest/${id}`,
	};
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
		const data = await requestJson<Array<Record<string, any>>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls?state=${state}&per_page=100`,
			{ headers }
		);
		return data.map((entry) => mapGitHubPullRequest(entry));
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const data = await requestJson<Array<Record<string, any>>>(
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
		const data = await requestJson<{ values?: Array<Record<string, any>> }>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests?${query}pagelen=50`,
			{ headers }
		);
		return (data.values ?? []).map((entry) => mapBitbucketPullRequest(entry));
	}

	const data = await requestJson<{ value?: Array<Record<string, any>> }>(
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
		const pr = await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${number}`,
			{ headers }
		);
		return mapGitHubPullRequest(pr);
	}

	if (target.provider === 'gitlab') {
		const projectId = encodeURIComponent(target.projectPath);
		const pr = await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${number}`,
			{ headers }
		);
		return mapGitLabPullRequest(pr);
	}

	if (target.provider === 'bitbucket') {
		const pr = await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${number}`,
			{ headers }
		);
		return mapBitbucketPullRequest(pr);
	}

	const pr = await requestJson<Record<string, any>>(
		`${target.apiBaseUrl}/pullrequests/${number}?api-version=7.1`,
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
		const pr = await requestJson<Record<string, any>>(
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
		const pr = await requestJson<Record<string, any>>(
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
		const pr = await requestJson<Record<string, any>>(
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

	const pr = await requestJson<Record<string, any>>(
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
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${number}/merge`,
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
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${number}/merge`,
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
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${number}/merge`,
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
	await requestJson<Record<string, any>>(
		`${target.apiBaseUrl}/pullrequests/${number}?api-version=7.1`,
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
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${number}`,
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
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/projects/${projectId}/merge_requests/${number}`,
			{
				method: 'PUT',
				headers,
				body: { state_event: 'close' },
			}
		);
		return;
	}

	if (target.provider === 'bitbucket') {
		await requestJson<Record<string, any>>(
			`${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/pullrequests/${number}/decline`,
			{
				method: 'POST',
				headers,
			}
		);
		return;
	}

	await requestJson<Record<string, any>>(
		`${target.apiBaseUrl}/pullrequests/${number}?api-version=7.1`,
		{
			method: 'PATCH',
			headers,
			body: {
				status: 'abandoned',
			},
		}
	);
}

export async function checkBranchPullRequest(
	remoteUrl: string,
	branchName: string,
	githubToken?: string
): Promise<PullRequestInfo | null> {
	try {
		const parsed = parseRemoteUrl(remoteUrl);
		if (!parsed) return null;

		const results = await listPullRequests(
			remoteUrl,
			parsed.provider,
			{
				githubToken,
				gitlabToken: githubToken,
				bitbucketToken: githubToken,
				azureToken: githubToken,
			},
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
		const pullRequests = await listPullRequests(
			remoteUrl,
			parsed.provider,
			{
				githubToken,
				gitlabToken: githubToken,
				bitbucketToken: githubToken,
				azureToken: githubToken,
			},
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

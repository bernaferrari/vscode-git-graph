/**
 * GitHub API Integration
 * Real API calls for issues, PRs, and CI/CD status
 */

// GitHub API types
export interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: 'open' | 'closed';
	html_url: string;
	labels: Array<{ name: string; color: string }>;
	assignees: Array<{ login: string; avatar_url: string }>;
	created_at: string;
	updated_at: string;
	user: { login: string; avatar_url: string };
}

export interface GitHubPullRequest {
	id: number;
	number: number;
	title: string;
	body?: string;
	state: 'open' | 'closed' | 'merged';
	html_url: string;
	head: { ref: string; sha: string };
	base: { ref: string; sha: string };
	user: { login: string; avatar_url: string };
	merged: boolean;
	draft: boolean;
	created_at: string;
	updated_at: string;
}

export interface GitHubWorkflowRun {
	id: number;
	name: string;
	status: 'queued' | 'in_progress' | 'completed';
	conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
	created_at: string;
	updated_at: string;
	head_branch: string;
	head_sha: string;
	html_url: string;
}

export interface GitHubRepo {
	id: number;
	name: string;
	full_name: string;
	html_url: string;
	default_branch: string;
	private: boolean;
}

// GitHub API client
export class GitHubClient {
	private token: string;
	private baseUrl = 'https://api.github.com';

	constructor(token: string) {
		this.token = token;
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const headers = new Headers(options.headers);
		headers.set('Authorization', `Bearer ${this.token}`);
		headers.set('Accept', 'application/vnd.github.v3+json');
		headers.set('Content-Type', 'application/json');

		const response = await fetch(`${this.baseUrl}${path}`, {
			...options,
			headers,
		});

		if (!response.ok) {
			throw new Error(`GitHub API error: ${String(response.status)} ${response.statusText}`);
		}

		const data: unknown = await response.json();
		return data as T;
	}

	// Get authenticated user
	async getUser() {
		return this.request<{ login: string; avatar_url: string; name: string }>('/user');
	}

	// Get repository info
	async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
		return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
	}

	// List issues
	async listIssues(owner: string, repo: string, options: {
		state?: 'open' | 'closed' | 'all';
		labels?: string;
		since?: string;
		page?: number;
		per_page?: number;
	} = {}): Promise<GitHubIssue[]> {
		const params = new URLSearchParams();
		if (options.state) params.set('state', options.state);
		if (options.labels) params.set('labels', options.labels);
		if (options.since) params.set('since', options.since);
		if (options.page) params.set('page', String(options.page));
		if (options.per_page) params.set('per_page', String(options.per_page));

		return this.request<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?${params}`);
	}

	// Get issue
	async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
		return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${String(issueNumber)}`);
	}

	// Create issue
	async createIssue(owner: string, repo: string, data: {
		title: string;
		body?: string;
		labels?: string[];
		assignees?: string[];
	}): Promise<GitHubIssue> {
		return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	// List pull requests
	async listPullRequests(owner: string, repo: string, options: {
		state?: 'open' | 'closed' | 'all';
		head?: string;
		base?: string;
		page?: number;
		per_page?: number;
	} = {}): Promise<GitHubPullRequest[]> {
		const params = new URLSearchParams();
		if (options.state) params.set('state', options.state);
		if (options.head) params.set('head', options.head);
		if (options.base) params.set('base', options.base);
		if (options.page) params.set('page', String(options.page));
		if (options.per_page) params.set('per_page', String(options.per_page));

		return this.request<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?${params}`);
	}

	// Get pull request
	async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPullRequest> {
		return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${String(prNumber)}`);
	}

	// Create pull request
	async createPullRequest(owner: string, repo: string, data: {
		title: string;
		body?: string;
		head: string;
		base: string;
		draft?: boolean;
	}): Promise<GitHubPullRequest> {
		return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	// List workflow runs (GitHub Actions)
	async listWorkflowRuns(owner: string, repo: string, options: {
		branch?: string;
		status?: 'queued' | 'in_progress' | 'completed';
		per_page?: number;
	} = {}): Promise<{ total_count: number; workflow_runs: GitHubWorkflowRun[] }> {
		const params = new URLSearchParams();
		if (options.branch) params.set('branch', options.branch);
		if (options.status) params.set('status', options.status);
		if (options.per_page) params.set('per_page', String(options.per_page));

		return this.request(`/repos/${owner}/${repo}/actions/runs?${params}`);
	}

	// Get CI status for a commit
	async getCommitStatus(owner: string, repo: string, sha: string): Promise<{
		state: 'pending' | 'success' | 'failure' | 'error';
		statuses: Array<{
			id: number;
			context: string;
			state: string;
			description?: string;
			target_url?: string;
			created_at: string;
		}>;
	}> {
		return this.request(`/repos/${owner}/${repo}/commits/${sha}/status`);
	}

	// Get check runs for a commit (GitHub Actions, etc.)
	async getCheckRuns(owner: string, repo: string, sha: string): Promise<{
		total_count: number;
		check_runs: Array<{
			id: number;
			name: string;
			status: 'queued' | 'in_progress' | 'completed';
			conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
			html_url: string;
			started_at?: string;
			completed_at?: string;
		}>;
	}> {
		return this.request(`/repos/${owner}/${repo}/commits/${sha}/check-runs`);
	}

	// Search issues and PRs
	async searchIssues(query: string): Promise<{
		total_count: number;
		items: GitHubIssue[];
	}> {
		return this.request(`/search/issues?q=${encodeURIComponent(query)}`);
	}

	// Parse GitHub URL to extract owner/repo
	static parseUrl(url: string): { owner: string; repo: string } | null {
		const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
		if (match) {
			const owner = match[1];
			const repo = match[2];
			if (owner !== undefined && repo !== undefined) {
				return { owner, repo: repo.replace('.git', '') };
			}
		}
		return null;
	}
}

// Create singleton instance
let githubClient: GitHubClient | null = null;

export function getGitHubClient(): GitHubClient | null {
	return githubClient;
}

export function setGitHubToken(token: string) {
	githubClient = new GitHubClient(token);
}

export default GitHubClient;

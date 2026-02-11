/**
 * Jira API Integration
 * Real API calls for Jira issues
 */

// Jira API types
export interface JiraIssue {
	id: string;
	key: string;
	fields: {
		summary: string;
		description?: string;
		status: { name: string; id: string };
		priority?: { name: string; id: string };
		assignee?: { displayName: string; emailAddress: string; avatarUrls: Record<string, string> };
		reporter: { displayName: string; emailAddress: string; avatarUrls: Record<string, string> };
		labels: string[];
		created: string;
		updated: string;
		issuetype: { name: string; id: string };
		project: { key: string; name: string; id: string };
	};
	self: string;
}

export interface JiraSearchResult {
	expand: string;
	startAt: number;
	maxResults: number;
	total: number;
	issues: JiraIssue[];
}

export interface JiraProject {
	id: string;
	key: string;
	name: string;
	projectTypeKey: string;
}

export interface JiraUser {
	accountId: string;
	displayName: string;
	emailAddress: string;
	avatarUrls: Record<string, string>;
}

// Jira API client
export class JiraClient {
	private domain: string;
	private email: string;
	private apiToken: string;
	private baseUrl: string;

	constructor(domain: string, email: string, apiToken: string) {
		this.domain = domain;
		this.email = email;
		this.apiToken = apiToken;
		this.baseUrl = `https://${domain}.atlassian.net/rest/api/3`;
	}

	private getAuthHeader(): string {
		const credentials = btoa(`${this.email}:${this.apiToken}`);
		return `Basic ${credentials}`;
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			...options,
			headers: {
				'Authorization': this.getAuthHeader(),
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${error}`);
		}

		return response.json();
	}

	// Get current user
	async getCurrentUser(): Promise<JiraUser> {
		return this.request<JiraUser>('/myself');
	}

	// Get issue by key
	async getIssue(issueKey: string): Promise<JiraIssue> {
		return this.request<JiraIssue>(`/issue/${issueKey}`);
	}

	// Search issues with JQL
	async searchIssues(jql: string, options: {
		startAt?: number;
		maxResults?: number;
		fields?: string[];
	} = {}): Promise<JiraSearchResult> {
		const params = new URLSearchParams();
		params.set('jql', jql);
		if (options.startAt) params.set('startAt', String(options.startAt));
		if (options.maxResults) params.set('maxResults', String(options.maxResults));
		if (options.fields) params.set('fields', options.fields.join(','));

		return this.request<JiraSearchResult>(`/search?${params}`);
	}

	// Get issues assigned to current user
	async getMyIssues(): Promise<JiraIssue[]> {
		const result = await this.searchIssues('assignee = currentUser() AND resolution = Unresolved', {
			maxResults: 50,
			fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'issuetype', 'project'],
		});
		return result.issues;
	}

	// Get issues for a project
	async getProjectIssues(projectKey: string): Promise<JiraIssue[]> {
		const result = await this.searchIssues(`project = ${projectKey} AND resolution = Unresolved`, {
			maxResults: 50,
			fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'issuetype'],
		});
		return result.issues;
	}

	// Get recent issues
	async getRecentIssues(days: number = 7): Promise<JiraIssue[]> {
		const result = await this.searchIssues(`updated >= -${days}d ORDER BY updated DESC`, {
			maxResults: 50,
			fields: ['summary', 'status', 'priority', 'assignee', 'updated', 'issuetype', 'project'],
		});
		return result.issues;
	}

	// Create issue
	async createIssue(data: {
		project: { key: string };
		summary: string;
		description?: string;
		issuetype: { name: string };
		priority?: { name: string };
		labels?: string[];
	}): Promise<JiraIssue> {
		return this.request<JiraIssue>('/issue', {
			method: 'POST',
			body: JSON.stringify({ fields: data }),
		});
	}

	// Update issue
	async updateIssue(issueKey: string, fields: Record<string, unknown>): Promise<void> {
		await this.request(`/issue/${issueKey}`, {
			method: 'PUT',
			body: JSON.stringify({ fields }),
		});
	}

	// Add comment to issue
	async addComment(issueKey: string, comment: string): Promise<{ id: string }> {
		return this.request(`/issue/${issueKey}/comment`, {
			method: 'POST',
			body: JSON.stringify({ body: comment }),
		});
	}

	// Transition issue
	async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
		await this.request(`/issue/${issueKey}/transitions`, {
			method: 'POST',
			body: JSON.stringify({ transition: { id: transitionId } }),
		});
	}

	// Get projects
	async getProjects(): Promise<JiraProject[]> {
		return this.request<JiraProject[]>('/project');
	}

	// Get project
	async getProject(projectKey: string): Promise<JiraProject> {
		return this.request<JiraProject>(`/project/${projectKey}`);
	}

	// Search users
	async searchUsers(query: string): Promise<JiraUser[]> {
		return this.request<JiraUser[]>(`/user/search?query=${encodeURIComponent(query)}`);
	}

	// Get issue types
	async getIssueTypes(): Promise<Array<{ id: string; name: string; subtask: boolean }>> {
		return this.request('/issuetype');
	}

	// Get priorities
	async getPriorities(): Promise<Array<{ id: string; name: string }>> {
		return this.request('/priority');
	}

	// Get statuses for a project
	async getStatuses(projectKey: string): Promise<Array<{ id: string; name: string }>> {
		const project = await this.getProject(projectKey);
		return this.request(`/project/${project.id}/statuses`);
	}
}

// Singleton instance
let jiraClient: JiraClient | null = null;

export function getJiraClient(): JiraClient | null {
	return jiraClient;
}

export function initJiraClient(domain: string, email: string, apiToken: string) {
	jiraClient = new JiraClient(domain, email, apiToken);
}

// Parse Jira issue key from text
export function parseJiraKey(text: string): string[] {
	const matches = text.match(/[A-Z]{2,10}-\d+/g);
	return matches ? [...new Set(matches)] : [];
}

export default JiraClient;

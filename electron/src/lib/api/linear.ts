/**
 * Linear API Integration
 * GraphQL API for Linear issues
 */

// Linear API types
export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	status: {
		id: string;
		name: string;
		type: string;
		color: string;
	};
	priority: {
		id: string;
		name: string;
		label: string;
	} | null;
	assignee?: {
		id: string;
		name: string;
		email: string;
		avatarUrl: string;
	} | null;
	creator: {
		id: string;
		name: string;
		email: string;
	};
	labels: Array<{ id: string; name: string; color: string }>;
	createdAt: string;
	updatedAt: string;
	url: string;
	team: {
		id: string;
		name: string;
		key: string;
	};
	project?: {
		id: string;
		name: string;
	};
}

export interface LinearTeam {
	id: string;
	name: string;
	key: string;
	description?: string;
}

export interface LinearUser {
	id: string;
	name: string;
	email: string;
	avatarUrl: string;
}

// GraphQL queries
const QUERIES = {
	// Get current user
	currentUser: `
		query currentUser {
			viewer {
				id
				name
				email
				avatarUrl
			}
		}
	`,

	// Get teams
	teams: `
		query teams {
			teams {
				nodes {
					id
					name
					key
					description
				}
			}
		}
	`,

	// Get issues
	issues: `
		query issues($filter: IssueFilter, $first: Int) {
			issues(filter: $filter, first: $first) {
				nodes {
					id
					identifier
					title
					description
					status {
						id
						name
						type
						color
					}
					priority {
						id
						name
						label
					}
					assignee {
						id
						name
						email
						avatarUrl
					}
					creator {
						id
						name
						email
					}
					labels {
						id
						name
						color
					}
					createdAt
					updatedAt
					url
					team {
						id
						name
						key
					}
					project {
						id
						name
					}
				}
			}
		}
	`,

	// Get issue by ID or identifier
	issue: `
		query issue($id: String) {
			issue(id: $id) {
				id
				identifier
				title
				description
				status {
					id
					name
					type
					color
				}
				priority {
					id
					name
					label
				}
				assignee {
					id
					name
					email
					avatarUrl
				}
				creator {
					id
					name
					email
				}
				labels {
					id
					name
					color
				}
				createdAt
				updatedAt
				url
				team {
					id
					name
					key
				}
			}
		}
	`,

	// Create issue
	createIssue: `
		mutation createIssue($input: IssueCreateInput!) {
			issueCreate(input: $input) {
				success
				issue {
					id
					identifier
					title
					url
				}
			}
		}
	`,

	// Update issue
	updateIssue: `
		mutation updateIssue($id: String!, $input: IssueUpdateInput!) {
			issueUpdate(id: $id, input: $input) {
				success
			}
		}
	`,
};

// Linear API client
export class LinearClient {
	private apiKey: string;
	private baseUrl = 'https://api.linear.app/graphql';

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
		const response = await fetch(this.baseUrl, {
			method: 'POST',
			headers: {
				'Authorization': this.apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
		}

		const result = await response.json();

		if (result.errors) {
			throw new Error(`Linear API error: ${result.errors[0].message}`);
		}

		return result.data;
	}

	// Get current user
	async getCurrentUser(): Promise<LinearUser> {
		const data = await this.query<{ viewer: LinearUser }>(QUERIES.currentUser);
		return data.viewer;
	}

	// Get teams
	async getTeams(): Promise<LinearTeam[]> {
		const data = await this.query<{ teams: { nodes: LinearTeam[] } }>(QUERIES.teams);
		return data.teams.nodes;
	}

	// Get issues
	async getIssues(filter?: {
		teamId?: string;
		assigneeId?: string;
		status?: string;
		searchQuery?: string;
	}, first: number = 50): Promise<LinearIssue[]> {
		const variables: Record<string, unknown> = { first };
		
		const filterObj: Record<string, unknown> = {};
		if (filter?.teamId) filterObj.team = { id: { eq: filter.teamId } };
		if (filter?.assigneeId) filterObj.assignee = { id: { eq: filter.assigneeId } };
		if (filter?.status) filterObj.status = { type: { eq: filter.status } };
		if (filter?.searchQuery) filterObj.search = filter.searchQuery;
		
		if (Object.keys(filterObj).length > 0) {
			variables.filter = filterObj;
		}

		const data = await this.query<{ issues: { nodes: LinearIssue[] } }>(QUERIES.issues, variables);
		return data.issues.nodes;
	}

	// Get issue by identifier
	async getIssue(identifier: string): Promise<LinearIssue> {
		const data = await this.query<{ issue: LinearIssue }>(QUERIES.issue, { id: identifier });
		return data.issue;
	}

	// Get my issues
	async getMyIssues(): Promise<LinearIssue[]> {
		const user = await this.getCurrentUser();
		return this.getIssues({ assigneeId: user.id });
	}

	// Create issue
	async createIssue(data: {
		teamId: string;
		title: string;
		description?: string;
		priority?: number;
		assigneeId?: string;
		labelIds?: string[];
	}): Promise<{ id: string; identifier: string; title: string; url: string }> {
		const result = await this.query<{
			issueCreate: {
				success: boolean;
				issue: { id: string; identifier: string; title: string; url: string };
			};
		}>(QUERIES.createIssue, { input: data });

		if (!result.issueCreate.success) {
			throw new Error('Failed to create issue');
		}

		return result.issueCreate.issue;
	}

	// Update issue
	async updateIssue(issueId: string, data: {
		title?: string;
		description?: string;
		statusId?: string;
		priority?: number;
		assigneeId?: string;
	}): Promise<boolean> {
		const result = await this.query<{ issueUpdate: { success: boolean } }>(
			QUERIES.updateIssue,
			{ id: issueId, input: data }
		);
		return result.issueUpdate.success;
	}
}

// Singleton instance
let linearClient: LinearClient | null = null;

export function getLinearClient(): LinearClient | null {
	return linearClient;
}

export function initLinearClient(apiKey: string) {
	linearClient = new LinearClient(apiKey);
}

// Parse Linear issue key from text
export function parseLinearKey(text: string): string[] {
	const matches = text.match(/[A-Z]{2,4}\d+/g);
	return matches ? [...new Set(matches)] : [];
}

export default LinearClient;

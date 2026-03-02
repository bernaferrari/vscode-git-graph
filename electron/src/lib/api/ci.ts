/**
 * CI/CD Integration Service
 * Unified API for GitHub Actions, CircleCI, GitLab CI, etc.
 */

import { GitHubClient } from './github';

// CI/CD types
export interface CIPipeline {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
	branch: string;
	commit: {
		sha: string;
		message: string;
		author: string;
	};
	url: string;
	startedAt?: string;
	finishedAt?: string;
	provider: 'github' | 'circleci' | 'gitlab' | 'azure' | 'jenkins';
	stages?: CIStage[];
}

export interface CIStage {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
	startedAt?: string;
	finishedAt?: string;
}

export interface CIStatus {
	pipeline: CIPipeline | null;
	checks: CICheck[];
	summary: {
		total: number;
		passed: number;
		failed: number;
		pending: number;
		running: number;
	};
}

export interface CICheck {
	id: string;
	name: string;
	status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
	description?: string;
	url?: string;
	startedAt?: string;
	finishedAt?: string;
}

// CircleCI API client
export class CircleCIClient {
	private token: string;
	private baseUrl = 'https://circleci.com/api/v2';

	constructor(token: string) {
		this.token = token;
	}

	private async request<T>(path: string): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			headers: {
				'Circle-Token': this.token,
				'Accept': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`CircleCI API error: ${String(response.status)}`);
		}

		const data: unknown = await response.json();
		return data as T;
	}

	async getPipelines(projectSlug: string): Promise<CIPipeline[]> {
		const data = await this.request<{
			items: Array<{
				id: string;
				number: number;
				state: string;
				created_at: string;
				updated_at: string;
				branch: string;
				commit: { sha: string; message: string; author: { name: string } };
				vcs: { origin_repository_url: string };
			}>;
		}>(`/project/${projectSlug}/pipeline`);

			return data.items.map(item => ({
				id: item.id,
				name: `Pipeline #${String(item.number)}`,
			status: this.mapStatus(item.state),
			branch: item.branch,
			commit: {
				sha: item.commit.sha,
				message: item.commit.message,
				author: item.commit.author.name,
			},
				url: `https://app.circleci.com/pipelines/${projectSlug}/${String(item.number)}`,
			startedAt: item.created_at,
			finishedAt: item.updated_at,
			provider: 'circleci' as const,
		}));
	}

	private mapStatus(state: string): CIPipeline['status'] {
		switch (state) {
			case 'pending': return 'pending';
			case 'running': return 'running';
			case 'succeeded': return 'success';
			case 'failed': return 'failed';
			case 'canceled': return 'cancelled';
			default: return 'pending';
		}
	}
}

// GitLab CI API client
export class GitLabCIClient {
	private token: string;
	private baseUrl: string;

	constructor(token: string, baseUrl: string = 'https://gitlab.com/api/v4') {
		this.token = token;
		this.baseUrl = baseUrl;
	}

	private async request<T>(path: string): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			headers: {
				'PRIVATE-TOKEN': this.token,
			},
		});

		if (!response.ok) {
			throw new Error(`GitLab API error: ${String(response.status)}`);
		}

		const data: unknown = await response.json();
		return data as T;
	}

	async getPipelines(projectId: string | number): Promise<CIPipeline[]> {
		const data = await this.request<Array<{
			id: number;
			sha: string;
			ref: string;
			status: string;
			created_at: string;
			updated_at: string;
			web_url: string;
			user: { name: string };
		}>>(`/projects/${String(projectId)}/pipelines`);

		return data.map(item => ({
			id: String(item.id),
			name: `Pipeline ${String(item.id)}`,
			status: this.mapStatus(item.status),
			branch: item.ref,
			commit: {
				sha: item.sha,
				message: '',
				author: item.user.name,
			},
			url: item.web_url,
			startedAt: item.created_at,
			finishedAt: item.updated_at,
			provider: 'gitlab' as const,
		}));
	}

	private mapStatus(status: string): CIPipeline['status'] {
		switch (status) {
			case 'pending': return 'pending';
			case 'running': return 'running';
			case 'success': return 'success';
			case 'failed': return 'failed';
			case 'canceled': return 'cancelled';
			default: return 'pending';
		}
	}
}

// Unified CI service
export class CIService {
	private github?: GitHubClient;
	private circleci?: CircleCIClient;
	private gitlab?: GitLabCIClient;

	setGitHub(token: string) {
		this.github = new GitHubClient(token);
	}

	setCircleCI(token: string) {
		this.circleci = new CircleCIClient(token);
	}

	setGitLab(token: string, baseUrl?: string) {
		this.gitlab = new GitLabCIClient(token, baseUrl);
	}

	// Get CI status for a commit
	async getStatusForCommit(
		owner: string,
		repo: string,
		sha: string
	): Promise<CIStatus> {
		const checks: CICheck[] = [];

		// GitHub
		if (this.github) {
			try {
				const [status, checkRuns] = await Promise.all([
					this.github.getCommitStatus(owner, repo, sha),
					this.github.getCheckRuns(owner, repo, sha),
				]);

				// Add commit statuses
				status.statuses.forEach(s => {
					checks.push({
						id: String(s.id),
						name: s.context,
						status: this.mapGitHubStatus(s.state),
						description: s.description,
						url: s.target_url,
					});
				});

				// Add check runs
				checkRuns.check_runs.forEach(run => {
					checks.push({
						id: String(run.id),
						name: run.name,
						status: this.mapGitHubCheckStatus(run.status, run.conclusion),
						url: run.html_url,
						startedAt: run.started_at,
						finishedAt: run.completed_at,
					});
				});
			} catch (error) {
				console.error('Failed to fetch GitHub status:', error);
			}
		}

		// Calculate summary
		const summary = {
			total: checks.length,
			passed: checks.filter(c => c.status === 'success').length,
			failed: checks.filter(c => c.status === 'failed').length,
			pending: checks.filter(c => c.status === 'pending').length,
			running: checks.filter(c => c.status === 'running').length,
		};

		return { pipeline: null, checks, summary };
	}

	// Get pipelines for a branch
	async getPipelines(owner: string, repo: string, branch?: string): Promise<CIPipeline[]> {
		const pipelines: CIPipeline[] = [];

		// GitHub Actions
		if (this.github) {
			try {
				const runs = await this.github.listWorkflowRuns(owner, repo, { branch });
				
				runs.workflow_runs.forEach(run => {
					pipelines.push({
						id: String(run.id),
						name: run.name,
						status: this.mapGitHubRunStatus(run.status, run.conclusion),
						branch: run.head_branch,
						commit: {
							sha: run.head_sha,
							message: '',
							author: '',
						},
						url: run.html_url,
						startedAt: run.created_at,
						finishedAt: run.updated_at,
						provider: 'github',
					});
				});
			} catch (error) {
				console.error('Failed to fetch GitHub workflow runs:', error);
			}
		}

		return pipelines;
	}

	private mapGitHubStatus(state: string): CICheck['status'] {
		switch (state) {
			case 'pending': return 'pending';
			case 'success': return 'success';
			case 'failure': return 'failed';
			case 'error': return 'failed';
			default: return 'pending';
		}
	}

	private mapGitHubCheckStatus(status: string, conclusion: string | null): CICheck['status'] {
		if (status === 'in_progress' || status === 'queued') return 'running';
		if (conclusion === 'success') return 'success';
		if (conclusion === 'failure') return 'failed';
		if (conclusion === 'cancelled' || conclusion === 'skipped') return 'cancelled';
		return 'pending';
	}

	private mapGitHubRunStatus(status: string, conclusion: string | null): CIPipeline['status'] {
		if (status === 'in_progress' || status === 'queued') return 'running';
		if (conclusion === 'success') return 'success';
		if (conclusion === 'failure') return 'failed';
		if (conclusion === 'cancelled') return 'cancelled';
		return 'pending';
	}
}

// Singleton instance
let ciService: CIService | null = null;

export function getCIService(): CIService {
	if (!ciService) {
		ciService = new CIService();
	}
	return ciService;
}

export default CIService;

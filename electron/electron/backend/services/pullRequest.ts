/**
 * Pull Request Integration Service
 * Provides PR creation and status checking
 */

import * as https from 'https';

export interface PullRequestConfig {
	provider: 'github' | 'gitlab' | 'bitbucket' | 'custom';
	/** Custom template URL for custom providers */
	templateUrl?: string;
}

export interface PullRequestInfo {
	url: string;
	title?: string;
	status?: 'open' | 'merged' | 'closed' | 'draft';
	number?: number;
	author?: string;
}

export interface CreatePullRequestOptions {
	repo: string;
	sourceBranch: string;
	targetBranch: string;
	title?: string;
	body?: string;
	draft?: boolean;
}

/**
 * Extract repository info from remote URL
 */
function parseRemoteUrl(url: string): { provider: string; owner: string; repo: string } | null {
	// HTTPS URLs
	const httpsMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
	if (httpsMatch && httpsMatch[1] && httpsMatch[2] && httpsMatch[3]) {
		return {
			provider: httpsMatch[1].replace('.com', ''),
			owner: httpsMatch[2],
			repo: httpsMatch[3],
		};
	}

	// SSH URLs
	const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
	if (sshMatch && sshMatch[1] && sshMatch[2] && sshMatch[3]) {
		return {
			provider: sshMatch[1].replace('.com', ''),
			owner: sshMatch[2],
			repo: sshMatch[3],
		};
	}

	return null;
}

/**
 * Generate a URL to create a pull request
 */
export function generateCreatePullRequestUrl(
	remoteUrl: string,
	sourceBranch: string,
	targetBranch: string = 'main',
	title?: string
): string | null {
	const info = parseRemoteUrl(remoteUrl);
	if (!info) return null;

	const baseUrl = remoteUrl.replace(/\.git$/, '');

	switch (info.provider.toLowerCase()) {
		case 'github':
			return `${baseUrl}/compare/${targetBranch}...${sourceBranch}?expand=1${title ? `&title=${encodeURIComponent(title)}` : ''}`;
		case 'gitlab':
			return `${baseUrl}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(sourceBranch)}&merge_request[target_branch]=${encodeURIComponent(targetBranch)}${title ? `&merge_request[title]=${encodeURIComponent(title)}` : ''}`;
		case 'bitbucket':
			return `${baseUrl}/pull-requests/new?source=${encodeURIComponent(sourceBranch)}&dest=${encodeURIComponent(targetBranch)}`;
		default:
			return null;
	}
}

/**
 * Generate a URL to view pull requests
 */
export function generatePullRequestsUrl(remoteUrl: string): string | null {
	const info = parseRemoteUrl(remoteUrl);
	if (!info) return null;

	const baseUrl = remoteUrl.replace(/\.git$/, '');

	switch (info.provider.toLowerCase()) {
		case 'github':
			return `${baseUrl}/pulls`;
		case 'gitlab':
			return `${baseUrl}/-/merge_requests`;
		case 'bitbucket':
			return `${baseUrl}/pull-requests`;
		default:
			return null;
	}
}

/**
 * Check if a branch has an open pull request (GitHub API)
 */
export async function checkBranchPullRequest(
	remoteUrl: string,
	branchName: string,
	githubToken?: string
): Promise<PullRequestInfo | null> {
	const info = parseRemoteUrl(remoteUrl);
	if (!info || info.provider.toLowerCase() !== 'github') return null;

	return new Promise((resolve) => {
		const options: https.RequestOptions = {
			hostname: 'api.github.com',
			path: `/repos/${info.owner}/${info.repo}/pulls?head=${info.owner}:${branchName}&state=open`,
			method: 'GET',
			headers: {
				'User-Agent': 'vscode-git-graph-electron',
				Accept: 'application/vnd.github.v3+json',
			} as Record<string, string>,
		};

		if (githubToken) {
			(options.headers as Record<string, string>)['Authorization'] = `Bearer ${githubToken}`;
		}

		https.get(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				try {
					const prs = JSON.parse(data);
					if (Array.isArray(prs) && prs.length > 0) {
						const pr = prs[0];
						resolve({
							url: pr.html_url,
							title: pr.title,
							status: pr.draft ? 'draft' : 'open',
							number: pr.number,
							author: pr.user?.login,
						});
					} else {
						resolve(null);
					}
				} catch {
					resolve(null);
				}
			});
		}).on('error', () => resolve(null));
	});
}

/**
 * Get all open pull requests for a repository (GitHub API)
 */
export async function getPullRequests(
	remoteUrl: string,
	state: 'open' | 'closed' | 'all' = 'open',
	githubToken?: string
): Promise<PullRequestInfo[]> {
	const info = parseRemoteUrl(remoteUrl);
	if (!info || info.provider.toLowerCase() !== 'github') return [];

	return new Promise((resolve) => {
		const options: https.RequestOptions = {
			hostname: 'api.github.com',
			path: `/repos/${info.owner}/${info.repo}/pulls?state=${state}&per_page=100`,
			method: 'GET',
			headers: {
				'User-Agent': 'vscode-git-graph-electron',
				Accept: 'application/vnd.github.v3+json',
			} as Record<string, string>,
		};

		if (githubToken) {
			(options.headers as Record<string, string>)['Authorization'] = `Bearer ${githubToken}`;
		}

		https.get(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				try {
					const prs = JSON.parse(data);
					if (Array.isArray(prs)) {
						resolve(
							prs.map((pr) => ({
								url: pr.html_url,
								title: pr.title,
								status: pr.state === 'closed' ? (pr.merged_at ? 'merged' : 'closed') : pr.draft ? 'draft' : 'open',
								number: pr.number,
								author: pr.user?.login,
							}))
						);
					} else {
						resolve([]);
					}
				} catch {
					resolve([]);
				}
			});
		}).on('error', () => resolve([]));
	});
}

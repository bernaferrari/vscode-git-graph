/**
 * Issue Linking Service
 * Detects and links issue references in commit messages
 */

import * as crypto from 'crypto';
import * as https from 'https';

export interface IssueLinkingConfig {
	/** Issue pattern (regex) */
	issue: string;
	/** URL template with {issue} placeholder */
	url: string;
}

export interface IssueInfo {
	/** The matched issue identifier */
	id: string;
	/** The full URL to the issue */
	url: string;
	/** Issue title (if fetched from API) */
	title?: string;
	/** Issue status */
	status?: 'open' | 'closed';
}

// Default issue patterns for common platforms
const DEFAULT_PATTERNS: IssueLinkingConfig[] = [
	// GitHub: #123 or GH-123
	{ issue: '#(\\d+)', url: 'https://github.com/{repo}/issues/{issue}' },
	{ issue: 'GH-(\\d+)', url: 'https://github.com/{repo}/issues/{issue}' },
	// GitLab: #123 or !123 (merge request)
	{ issue: '!(\\d+)', url: 'https://gitlab.com/{repo}/-/merge_requests/{issue}' },
	// Jira: PROJECT-123
	{ issue: '([A-Z][A-Z0-9]+)-(\\d+)', url: 'https://atlassian.net/browse/{issue}' },
	// Linear: ENG-123
	{ issue: '([A-Z][A-Z0-9]+)-(\\d+)', url: 'https://linear.app/issue/{issue}' },
];

/**
 * Issue Linking Manager
 */
export class IssueLinkingManager {
	private config: IssueLinkingConfig | null = null;
	private repoRemoteUrl: string | null = null;
	private issueCache: Map<string, IssueInfo> = new Map();

	/**
	 * Set the issue linking configuration
	 */
	public setConfig(config: IssueLinkingConfig | null): void {
		this.config = config;
		this.issueCache.clear();
	}

	/**
	 * Set the repository remote URL for generating issue links
	 */
	public setRepoRemoteUrl(url: string | null): void {
		this.repoRemoteUrl = url;
		this.issueCache.clear();
	}

	/**
	 * Extract issue references from a commit message
	 */
	public extractIssues(message: string): IssueInfo[] {
		if (!this.config) return [];

		const issues: IssueInfo[] = [];
		const pattern = new RegExp(this.config.issue, 'g');
		let match;

		while ((match = pattern.exec(message)) !== null) {
			const issueId = match[0];
			const cached = this.issueCache.get(issueId);

			if (cached) {
				issues.push(cached);
			} else {
				const url = this.generateIssueUrl(issueId);
				if (url) {
					const info: IssueInfo = { id: issueId, url };
					this.issueCache.set(issueId, info);
					issues.push(info);
				}
			}
		}

		return issues;
	}

	/**
	 * Generate a URL for an issue
	 */
	private generateIssueUrl(issueId: string): string | null {
		if (!this.config) return null;

		let url = this.config.url;

		// Replace {issue} placeholder
		url = url.replace('{issue}', issueId);

		// Replace {repo} placeholder with repo path from remote
		if (this.repoRemoteUrl) {
			const repoPath = this.extractRepoPath(this.repoRemoteUrl);
			if (repoPath) {
				url = url.replace('{repo}', repoPath);
			}
		}

		return url;
	}

	/**
	 * Extract repo path from remote URL
	 * e.g., "https://github.com/owner/repo.git" -> "owner/repo"
	 */
	private extractRepoPath(remoteUrl: string): string | null {
		// HTTPS URL
		const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
		if (httpsMatch) return httpsMatch[1];

		// SSH URL (git@github.com:owner/repo.git)
		const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
		if (sshMatch) return sshMatch[1];

		return null;
	}

	/**
	 * Detect issue linking config from repository remote URL
	 */
	public detectConfigFromRemote(remoteUrl: string): IssueLinkingConfig | null {
		const repoPath = this.extractRepoPath(remoteUrl);
		if (!repoPath) return null;

		// GitHub
		if (remoteUrl.includes('github.com')) {
			return {
				issue: '#(\\d+)|GH-(\\d+)',
				url: `https://github.com/${repoPath}/issues/{issue}`,
			};
		}

		// GitLab
		if (remoteUrl.includes('gitlab.com')) {
			return {
				issue: '#(\\d+)|!(\\d+)',
				url: `https://gitlab.com/${repoPath}/-/issues/{issue}`,
			};
		}

		// Bitbucket
		if (remoteUrl.includes('bitbucket.org')) {
			return {
				issue: '#(\\d+)',
				url: `https://bitbucket.org/${repoPath}/issues/{issue}`,
			};
		}

		return null;
	}

	/**
	 * Clear the issue cache
	 */
	public clearCache(): void {
		this.issueCache.clear();
	}
}

// Singleton instance
let issueLinkingInstance: IssueLinkingManager | null = null;

export function getIssueLinkingManager(): IssueLinkingManager {
	if (!issueLinkingInstance) {
		issueLinkingInstance = new IssueLinkingManager();
	}
	return issueLinkingInstance;
}

export function resetIssueLinkingManager(): void {
	issueLinkingInstance = null;
}

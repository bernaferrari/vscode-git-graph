/**
 * Issue Linking Service
 * Detects and links issue references in commit messages
 */

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
			const rawIssueId = match[0];
			const issueId = this.normalizeIssueId(rawIssueId);
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

	private normalizeIssueId(issueId: string): string {
		return issueId.replace(/^(?:GH-|AB#|#|!)/i, '');
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
		const azureHttpsMatch = remoteUrl.match(
			/https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(?:\.git)?$/i
		);
		if (azureHttpsMatch?.[1] && azureHttpsMatch[2] && azureHttpsMatch[3]) {
			return `${azureHttpsMatch[1]}/${azureHttpsMatch[2]}/${azureHttpsMatch[3]}`;
		}

		const azureVisualStudioMatch = remoteUrl.match(
			/https?:\/\/([^/.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+?)(?:\.git)?$/i
		);
		if (azureVisualStudioMatch?.[1] && azureVisualStudioMatch[2] && azureVisualStudioMatch[3]) {
			return `${azureVisualStudioMatch[1]}/${azureVisualStudioMatch[2]}/${azureVisualStudioMatch[3]}`;
		}

		// HTTPS URL
		const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
		if (httpsMatch) return httpsMatch[1] ?? null;

		// SSH URL (git@github.com:owner/repo.git)
		const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
		if (sshMatch) return sshMatch[1] ?? null;

		// Azure DevOps SSH URL (git@ssh.dev.azure.com:v3/org/project/repo)
		const azureSshMatch = remoteUrl.match(/git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
		if (azureSshMatch?.[1] && azureSshMatch[2] && azureSshMatch[3]) {
			return `${azureSshMatch[1]}/${azureSshMatch[2]}/${azureSshMatch[3]}`;
		}

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

		if (
			remoteUrl.includes('dev.azure.com') ||
			remoteUrl.includes('visualstudio.com') ||
			remoteUrl.includes('ssh.dev.azure.com')
		) {
			const parts = repoPath.split('/');
			const organization = parts[0];
			const project = parts[1];
			if (organization && project) {
				return {
					issue: 'AB#(\\d+)|#(\\d+)',
					url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/{issue}`,
				};
			}
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

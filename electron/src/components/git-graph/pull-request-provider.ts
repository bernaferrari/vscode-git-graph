export type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';

export interface PRProvider {
	name: PullRequestProvider;
	host: string;
}

function extractHost(url: string): string {
	try {
		if (url.startsWith('git@')) {
			return url.split(':')[0]?.replace('git@', '') ?? 'unknown';
		}
		return new URL(url).host;
	} catch {
		return 'unknown';
	}
}

export function detectPullRequestProvider(remoteUrl?: string): PRProvider | null {
	if (!remoteUrl) {
		return null;
	}

	const url = remoteUrl.toLowerCase();
	if (url.includes('github.com')) {
		return { name: 'github', host: 'github.com' };
	}

	if (url.includes('gitlab.com') || url.includes('gitlab')) {
		return { name: 'gitlab', host: extractHost(url) };
	}

	if (url.includes('bitbucket.org')) {
		return { name: 'bitbucket', host: 'bitbucket.org' };
	}

	if (url.includes('dev.azure.com') || url.includes('visualstudio.com') || url.includes('ssh.dev.azure.com')) {
		return { name: 'azure', host: extractHost(url) };
	}

	return null;
}

import type { PullRequestProvider } from '@/components/git-graph/pull-request-provider';

export interface ParsedCollaborationReviewTarget {
	provider: PullRequestProvider;
	repoKey: string | null;
	pullRequestNumber: number;
	filePath?: string;
	side?: 'left' | 'right';
	line?: number;
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

	if (trimmed.startsWith('git@ssh.dev.azure.com:v3/')) {
		const path = trimmed.replace('git@ssh.dev.azure.com:v3/', '');
		const [organization, project, repo] = path.split('/').filter(Boolean);
		if (!organization || !project || !repo) return null;
		return trimGitSuffix(`https://dev.azure.com/${organization}/${project}/_git/${repo}`);
	}

	const defaultSshMatch = trimmed.match(/^git@([^:]+):(.+)$/);
	if (defaultSshMatch?.[1] && defaultSshMatch[2]) {
		return trimGitSuffix(`https://${defaultSshMatch[1]}/${defaultSshMatch[2]}`);
	}

	const scpLikeMatch = trimmed.match(/^ssh:\/\/git@([^/]+)\/(.+)$/);
	if (scpLikeMatch?.[1] && scpLikeMatch[2]) {
		return trimGitSuffix(`https://${scpLikeMatch[1]}/${scpLikeMatch[2]}`);
	}

	return null;
}

function safeDecode(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

export function deriveCollaborationRepoKey(remoteUrl?: string | null): string | null {
	if (!remoteUrl?.trim()) {
		return null;
	}

	const normalizedRemote = toHttpsRemote(remoteUrl);
	if (!normalizedRemote) {
		return null;
	}

	try {
		const parsed = new URL(normalizedRemote);
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();
		if (!path) {
			return null;
		}
		return `${host}/${path}`;
	} catch {
		return null;
	}
}

export function buildCollaborationPullRequestTargetId(input: {
	provider: PullRequestProvider;
	repoKey: string | null;
	pullRequestNumber: number;
}): string {
	if (!input.repoKey) {
		return `${input.provider}:${String(input.pullRequestNumber)}`;
	}
	return `${input.provider}:${encodeURIComponent(input.repoKey)}:${String(input.pullRequestNumber)}`;
}

export function buildCollaborationPullRequestFileTargetId(input: {
	provider: PullRequestProvider;
	repoKey: string | null;
	pullRequestNumber: number;
	filePath: string;
	side?: 'left' | 'right';
	line?: number;
}): string {
	const root = buildCollaborationPullRequestTargetId(input);
	const encodedFilePath = encodeURIComponent(input.filePath);
	if (input.side && input.line) {
		return `${root}:${encodedFilePath}:${input.side}:${String(input.line)}`;
	}
	return `${root}:${encodedFilePath}`;
}

export function parseCollaborationReviewTargetId(targetId: string): ParsedCollaborationReviewTarget | null {
	const segments = targetId.split(':');
	if (segments.length < 2) {
		return null;
	}
	const provider = segments[0] ?? '';
	if (!['github', 'gitlab', 'bitbucket', 'azure'].includes(provider)) {
		return null;
	}

	const looksLikeLegacy = /^\d+$/.test(segments[1] ?? '');
	const repoKeySegment = segments[1] ?? '';
	const repoKey = looksLikeLegacy ? null : safeDecode(repoKeySegment);
	if (!looksLikeLegacy && repoKey === null) {
		return null;
	}
	const pullRequestNumberSegment = looksLikeLegacy ? segments[1] : segments[2];
	const pullRequestNumber = Number.parseInt(pullRequestNumberSegment ?? '', 10);
	if (!Number.isFinite(pullRequestNumber)) {
		return null;
	}

	const fileSegments = looksLikeLegacy ? segments.slice(2) : segments.slice(3);
	if (fileSegments.length === 0) {
		return {
			provider: provider as PullRequestProvider,
			repoKey,
			pullRequestNumber,
		};
	}

	const maybeLine = Number.parseInt(fileSegments.at(-1) ?? '', 10);
	const maybeSide = fileSegments.at(-2);
	if (
		fileSegments.length >= 3 &&
		Number.isFinite(maybeLine) &&
		(maybeSide === 'left' || maybeSide === 'right')
	) {
		const encodedFilePath = fileSegments.slice(0, -2).join(':');
		const filePath = safeDecode(encodedFilePath);
		if (filePath === null) {
			return null;
		}
		return {
			provider: provider as PullRequestProvider,
			repoKey,
			pullRequestNumber,
			filePath,
			side: maybeSide,
			line: maybeLine,
		};
	}

	const decodedFilePath = safeDecode(fileSegments.join(':'));
	if (decodedFilePath === null) {
		return null;
	}

	return {
		provider: provider as PullRequestProvider,
		repoKey,
		pullRequestNumber,
		filePath: decodedFilePath,
	};
}

export function getCollaborationReviewRootTargetId(targetId: string): string {
	const parsed = parseCollaborationReviewTargetId(targetId);
	if (!parsed) {
		return targetId;
	}
	return buildCollaborationPullRequestTargetId({
		provider: parsed.provider,
		repoKey: parsed.repoKey,
		pullRequestNumber: parsed.pullRequestNumber,
	});
}

export function isSameCollaborationReviewTarget(left: string, right: string): boolean {
	const leftParsed = parseCollaborationReviewTargetId(left);
	const rightParsed = parseCollaborationReviewTargetId(right);
	if (!leftParsed || !rightParsed) {
		return left === right;
	}
	if (
		leftParsed.provider !== rightParsed.provider ||
		leftParsed.pullRequestNumber !== rightParsed.pullRequestNumber
	) {
		return false;
	}
	if (leftParsed.repoKey && rightParsed.repoKey && leftParsed.repoKey !== rightParsed.repoKey) {
		return false;
	}
	if ((leftParsed.filePath ?? null) !== (rightParsed.filePath ?? null)) {
		return false;
	}
	if ((leftParsed.side ?? null) !== (rightParsed.side ?? null)) {
		return false;
	}
	if ((leftParsed.line ?? null) !== (rightParsed.line ?? null)) {
		return false;
	}
	return true;
}

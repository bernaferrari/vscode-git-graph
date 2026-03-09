import { z } from 'zod';

import { instanceStore } from '@/app/backend/store';

export const repoPolicySchema = z.object({
	repoPath: z.string().min(1),
	requireSignedCommits: z.boolean().default(false),
	allowedMergeStrategies: z.array(z.enum(['merge', 'rebase', 'squash'])).min(1).default(['merge', 'rebase', 'squash']),
	requireUpToDate: z.boolean().default(false),
	enableStacking: z.boolean().default(false),
	defaultStackBase: z.string().min(1).default('main'),
	customWorkflow: z.string().default(''),
});

export type RepoPolicy = z.infer<typeof repoPolicySchema>;

export function createDefaultRepoPolicy(repoPath: string): RepoPolicy {
	return {
		repoPath,
		requireSignedCommits: false,
		allowedMergeStrategies: ['merge', 'rebase', 'squash'],
		requireUpToDate: false,
		enableStacking: false,
		defaultStackBase: 'main',
		customWorkflow: '',
	};
}

export function getRepoPolicies(): Record<string, RepoPolicy> {
	const current = instanceStore.get('repoPolicies');
	if (!current || typeof current !== 'object') {
		return {};
	}

	return Object.fromEntries(
		Object.entries(current)
			.map(([repoPath, policy]) => {
				const parsed = repoPolicySchema.safeParse(policy);
				return parsed.success ? [repoPath, parsed.data] : null;
			})
			.filter((entry): entry is [string, RepoPolicy] => Boolean(entry))
	);
}

export function getRepoPolicy(repoPath: string): RepoPolicy {
	return getRepoPolicies()[repoPath] ?? createDefaultRepoPolicy(repoPath);
}

export function upsertRepoPolicy(repoPath: string, patch: Partial<RepoPolicy>): RepoPolicy {
	const policies = getRepoPolicies();
	const nextPolicy = repoPolicySchema.parse({
		...createDefaultRepoPolicy(repoPath),
		...(policies[repoPath] ?? {}),
		...patch,
		repoPath,
	});
	instanceStore.set('repoPolicies', {
		...policies,
		[repoPath]: nextPolicy,
	});
	return nextPolicy;
}

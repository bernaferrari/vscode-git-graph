/**
 * App-level router for deep link generation and resolution.
 */

import { z } from 'zod';

import { publicProcedure, router } from '@/app/backend/trpc/init';

const deepLinkTargetSchema = z.object({
	repo: z.string().optional(),
	branch: z.string().optional(),
	commit: z.string().optional(),
	file: z.string().optional(),
	panel: z.enum(['worktree', 'diff', 'blame']).optional(),
});

export function toDeepLink(target: z.infer<typeof deepLinkTargetSchema>): string {
	const url = new URL('gitgraph://open');
	if (target.repo) url.searchParams.set('repo', target.repo);
	if (target.branch) url.searchParams.set('branch', target.branch);
	if (target.commit) url.searchParams.set('commit', target.commit);
	if (target.file) url.searchParams.set('file', target.file);
	if (target.panel) url.searchParams.set('panel', target.panel);
	return url.toString();
}

export function parseDeepLink(raw: string): {
	valid: boolean;
	target: z.infer<typeof deepLinkTargetSchema> | null;
	error: string | null;
} {
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== 'gitgraph:') {
			return {
				valid: false,
				target: null,
				error: 'Unsupported protocol',
			};
		}
		if (parsed.hostname && parsed.hostname !== 'open') {
			return {
				valid: false,
				target: null,
				error: 'Unsupported route',
			};
		}
		const panelValue = parsed.searchParams.get('panel');
		if (panelValue && panelValue !== 'worktree' && panelValue !== 'diff' && panelValue !== 'blame') {
			return {
				valid: false,
				target: null,
				error: `Unsupported panel: ${panelValue}`,
			};
		}

		const target = {
			repo: parsed.searchParams.get('repo') ?? undefined,
			branch: parsed.searchParams.get('branch') ?? undefined,
			commit: parsed.searchParams.get('commit') ?? undefined,
			file: parsed.searchParams.get('file') ?? undefined,
			panel: (() => {
				const value = panelValue;
				if (value === 'worktree' || value === 'diff' || value === 'blame') {
					return value as 'worktree' | 'diff' | 'blame';
				}
				return undefined;
			})(),
		};

		return {
			valid: true,
			target,
			error: null,
		};
	} catch (error) {
		return {
			valid: false,
			target: null,
			error: error instanceof Error ? error.message : 'Invalid deep link',
		};
	}
}

export const appLevelRouter = router({
	deeplink: router({
		create: publicProcedure.input(deepLinkTargetSchema).mutation(({ input }) => {
			return {
				link: toDeepLink(input),
			};
		}),

		resolve: publicProcedure
			.input(
				z.object({
					link: z.string().min(1),
				})
			)
			.query(({ input }) => {
				return parseDeepLink(input.link);
			}),
	}),
});

/**
 * Pull Request tRPC Router
 * Provides PR operations via tRPC
 */

import { z } from 'zod';
import { publicProcedure, router } from '../../init';
import { generateCreatePullRequestUrl, generatePullRequestsUrl, checkBranchPullRequest } from '../../../services/pullRequest';

export const pullRequestRouter = router({
	/**
	 * Generate URL to create a pull request
	 */
	getCreateUrl: publicProcedure
		.input(
			z.object({
				remoteUrl: z.string(),
				sourceBranch: z.string(),
				targetBranch: z.string().optional(),
				title: z.string().optional(),
			})
		)
		.query(({ input }) => {
			const url = generateCreatePullRequestUrl(
				input.remoteUrl,
				input.sourceBranch,
				input.targetBranch ?? 'main',
				input.title
			);
			return { url };
		}),

	/**
	 * Get URL to view pull requests
	 */
	getListUrl: publicProcedure
		.input(z.object({ remoteUrl: z.string() }))
		.query(({ input }) => {
			const url = generatePullRequestsUrl(input.remoteUrl);
			return { url };
		}),

	/**
	 * Check if a branch has an open pull request
	 */
	checkBranch: publicProcedure
		.input(
			z.object({
				remoteUrl: z.string(),
				branchName: z.string(),
			})
		)
		.query(async ({ input }) => {
			const pr = await checkBranchPullRequest(input.remoteUrl, input.branchName);
			return { pr };
		}),

	/**
	 * Open URL in external browser
	 */
	openInBrowser: publicProcedure
		.input(z.object({ url: z.string() }))
		.mutation(async ({ input }) => {
			const { shell } = await import('electron');
			await shell.openExternal(input.url);
			return { success: true };
		}),
});

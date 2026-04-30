/**
 * AI router for production-grade AI assistance features.
 */

import { z } from 'zod';

import { appStore } from '@/app/backend/store';
import { readSecretValue, setSecretValue } from '@/app/backend/store/secret';
import { publicProcedure, router } from '@/app/backend/trpc/init';

type AIFeatureName = 'commitMessage' | 'pullRequest' | 'conflictExplain' | 'explainCommit' | 'reviewDiff';

const runtimeApiKeySecretKey = 'ai.runtimeApiKey';

interface AIConfig {
	enabled: boolean;
	provider: 'openai-compatible' | 'self-host';
	baseUrl: string;
	model: string;
	timeoutMs: number;
	maxTokens: number;
	retries: number;
	redactSensitivePaths: boolean;
	featureToggles: Record<AIFeatureName, boolean>;
}

function getAIConfig(): AIConfig {
	return appStore.get('aiProviderConfig');
}

export function redactSensitiveSegments(text: string): string {
	return text
		.replace(/\/Users\/[^/\s]+/g, '/Users/[redacted]')
		.replace(/\/home\/[^/\s]+/g, '/home/[redacted]')
		.replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\[redacted]');
}

function isFeatureEnabled(feature: AIFeatureName): boolean {
	const config = getAIConfig();
	return config.enabled && config.featureToggles[feature];
}

async function callOpenAICompatible(prompt: string, feature: AIFeatureName): Promise<string> {
    const config = getAIConfig();
	if (!config.baseUrl.trim()) {
		throw new Error('AI baseUrl is not configured');
	}
	const runtimeApiKey = readSecretValue(runtimeApiKeySecretKey);
	if (!runtimeApiKey.trim()) {
		throw new Error('AI runtime API key is not set');
	}

	const redactedPrompt = config.redactSensitivePaths ? redactSensitiveSegments(prompt) : prompt;
	const normalizedBaseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
	const endpoint = `${normalizedBaseUrl}/v1/chat/completions`;

    let lastError: string | null = null;
    for (let attempt = 0; attempt <= config.retries; attempt++) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${runtimeApiKey}`,
                },
                body: JSON.stringify({
                    model: config.model,
                    max_tokens: config.maxTokens,
                    temperature: feature === 'commitMessage' ? 0.3 : 0.2,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a Git assistant. Respond concisely with only useful output.',
                        },
                        {
                            role: 'user',
                            content: redactedPrompt,
                        },
                    ],
                }),
                signal: AbortSignal.timeout(config.timeoutMs),
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`AI provider error ${String(response.status)}: ${body || response.statusText}`);
            }

            const payload = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            return payload.choices?.[0]?.message?.content?.trim() || '';
        } catch (error) {
            lastError = error instanceof Error ? error.message : 'AI request failed';
            if (attempt >= config.retries) {
                break;
            }
        }
    }

    throw new Error(lastError ?? 'AI request failed');
}

function fallbackCommitMessage(diff: string): string {
	const changedFiles = diff
		.split('\n')
		.filter((line) => line.startsWith('+++ b/') || line.startsWith('--- a/'))
		.map((line) => line.slice(6))
		.filter(Boolean);
	const scope = changedFiles[0]?.split('/')[0] ?? 'repo';
	return `chore(${scope}): update ${String(Math.max(1, changedFiles.length))} file(s)`;
}

function fallbackReviewDiff(files: string[], diff: string): {
	summary: string;
	risks: string[];
	suggestions: string[];
	tests: string[];
} {
	const normalizedDiff = diff.toLowerCase();
	const risks: string[] = [];
	const suggestions: string[] = [];
	const tests: string[] = [];
	const hasTestChanges = files.some((file) => /test|spec|__tests__/i.test(file));
	const hasConfigChanges = files.some((file) => /config|settings|env|workflow/i.test(file));
	const hasCriticalPath = files.some((file) => /auth|security|payment|permissions|deploy/i.test(file));

	if (hasCriticalPath) {
		risks.push('Touches a sensitive path; check auth, permissions, or production side effects.');
		tests.push('Run targeted regression checks for auth, permissions, and edge-case failures.');
	}
	if (hasConfigChanges || normalizedDiff.includes('process.env') || normalizedDiff.includes('featureflag')) {
		risks.push('Configuration or environment behavior changed; verify defaults and rollout safety.');
		tests.push('Verify configuration defaults and production-like environment values.');
	}
	if (!hasTestChanges) {
		suggestions.push('Consider adding or updating tests for the changed behavior.');
		tests.push('Exercise the changed flow manually if automated coverage is missing.');
	}
	if (normalizedDiff.includes('async') || normalizedDiff.includes('await ') || normalizedDiff.includes('promise')) {
		risks.push('Async behavior changed; watch for loading-state, retry, and race-condition regressions.');
	}

	if (risks.length === 0) {
		risks.push('Review boundary conditions, empty states, and fallback paths before merging.');
	}
	if (suggestions.length === 0) {
		suggestions.push('Check whether naming, comments, and UX copy still match the behavior change.');
	}
	if (tests.length === 0) {
		tests.push('Run the most relevant unit and integration coverage for the touched files.');
	}

	return {
		summary: `Changed ${String(files.length)} file(s). Review correctness, tests, and rollout safety before merge.`,
		risks,
		suggestions,
		tests,
	};
}

export const aiRouter = router({
	getConfig: publicProcedure.query(() => {
		const config = getAIConfig();
		return {
			...config,
			hasRuntimeKey: Boolean(readSecretValue(runtimeApiKeySecretKey)),
		};
	}),

	setConfig: publicProcedure
		.input(
			z.object({
				enabled: z.boolean().optional(),
				provider: z.enum(['openai-compatible', 'self-host']).optional(),
				baseUrl: z.string().optional(),
				model: z.string().optional(),
				timeoutMs: z.number().int().min(2_000).max(120_000).optional(),
				maxTokens: z.number().int().min(32).max(4096).optional(),
				retries: z.number().int().min(0).max(5).optional(),
				redactSensitivePaths: z.boolean().optional(),
				featureToggles: z
					.object({
						commitMessage: z.boolean().optional(),
						pullRequest: z.boolean().optional(),
						conflictExplain: z.boolean().optional(),
						explainCommit: z.boolean().optional(),
						reviewDiff: z.boolean().optional(),
					})
					.optional(),
			})
		)
		.mutation(({ input }) => {
			const current = getAIConfig();
			appStore.set('aiProviderConfig', {
				...current,
				...input,
				featureToggles: {
					...current.featureToggles,
					...(input.featureToggles ?? {}),
				},
			});
			return { success: true };
		}),

	setRuntimeApiKey: publicProcedure
		.input(
			z.object({
				apiKey: z.string().min(1),
			})
		)
		.mutation(({ input }) => {
			setSecretValue(runtimeApiKeySecretKey, input.apiKey.trim());
			return { success: true };
		}),

	generateCommitMessage: publicProcedure
		.input(
			z.object({
				stagedFiles: z.array(z.string()).max(200),
				diff: z.string().max(1_000_000),
			})
		)
		.mutation(async ({ input }) => {
			if (!isFeatureEnabled('commitMessage')) {
				return { suggestion: null, error: 'AI commit message generation is disabled.' };
			}

			try {
				const prompt = [
					'Generate one concise conventional commit message.',
					`Changed files (${String(input.stagedFiles.length)}):`,
					...input.stagedFiles.slice(0, 40).map((file) => `- ${file}`),
					'Diff excerpt:',
					input.diff.slice(0, 20_000),
				].join('\n');
				const suggestion = await callOpenAICompatible(prompt, 'commitMessage');
				return { suggestion: suggestion || fallbackCommitMessage(input.diff), error: null };
			} catch (error) {
				return {
					suggestion: fallbackCommitMessage(input.diff),
					error: error instanceof Error ? error.message : 'AI request failed',
				};
			}
		}),

	generatePullRequest: publicProcedure
		.input(
			z.object({
				head: z.string(),
				base: z.string(),
				commits: z.array(z.object({ hash: z.string(), subject: z.string(), body: z.string().optional() })),
				diff: z.string().max(2_000_000),
			})
		)
		.mutation(async ({ input }) => {
			if (!isFeatureEnabled('pullRequest')) {
				return { title: null, body: null, error: 'AI pull request generation is disabled.' };
			}

			try {
				const prompt = [
					`Generate PR title and markdown body for branch ${input.head} into ${input.base}.`,
					'Respond as JSON: {"title":"...","body":"..."}',
					'Commits:',
					...input.commits.slice(0, 50).map((commit) => `- ${commit.hash.slice(0, 7)} ${commit.subject}`),
					'Diff excerpt:',
					input.diff.slice(0, 30_000),
				].join('\n');
				const output = await callOpenAICompatible(prompt, 'pullRequest');
				const parsed = JSON.parse(output) as { title?: string; body?: string };
				return {
					title: parsed.title ?? `Update ${input.head}`,
					body: parsed.body ?? 'Automated pull request summary.',
					error: null,
				};
			} catch (error) {
				return {
					title: `Update ${input.head}`,
					body: `Merge ${input.head} into ${input.base}`,
					error: error instanceof Error ? error.message : 'AI request failed',
				};
			}
		}),

	explainConflict: publicProcedure
		.input(
			z.object({
				filePath: z.string(),
				conflictContent: z.string().max(500_000),
			})
		)
		.mutation(async ({ input }) => {
			if (!isFeatureEnabled('conflictExplain')) {
				return { explanation: null, suggestions: [], error: 'AI conflict explanation is disabled.' };
			}

			try {
				const prompt = [
					'Explain this git conflict and propose concrete resolution options.',
					'Respond as JSON: {"explanation":"...","suggestions":["..."]}',
					`File: ${input.filePath}`,
					input.conflictContent.slice(0, 20_000),
				].join('\n');
				const output = await callOpenAICompatible(prompt, 'conflictExplain');
				const parsed = JSON.parse(output) as { explanation?: string; suggestions?: string[] };
				return {
					explanation: parsed.explanation ?? 'Conflict requires manual resolution.',
					suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
					error: null,
				};
			} catch (error) {
				return {
					explanation: 'Conflict requires manual resolution.',
					suggestions: [],
					error: error instanceof Error ? error.message : 'AI request failed',
				};
			}
		}),

	reviewDiff: publicProcedure
		.input(
			z.object({
				title: z.string().optional(),
				files: z.array(z.string()).max(200),
				diff: z.string().max(2_000_000),
			})
		)
		.mutation(async ({ input }) => {
			if (!isFeatureEnabled('reviewDiff')) {
				return {
					summary: null,
					risks: [] as string[],
					suggestions: [] as string[],
					tests: [] as string[],
					error: 'AI review assistance is disabled.',
				};
			}

			try {
				const prompt = [
					'Review this code diff and respond as JSON.',
					'JSON shape: {"summary":"...","risks":["..."],"suggestions":["..."],"tests":["..."]}',
					input.title ? `Context: ${input.title}` : '',
					'Touched files:',
					...input.files.slice(0, 80).map((file) => `- ${file}`),
					'Diff excerpt:',
					input.diff.slice(0, 40_000),
				]
					.filter(Boolean)
					.join('\n');
				const output = await callOpenAICompatible(prompt, 'reviewDiff');
				const parsed = JSON.parse(output) as {
					summary?: string;
					risks?: string[];
					suggestions?: string[];
					tests?: string[];
				};
				const fallback = fallbackReviewDiff(input.files, input.diff);
				return {
					summary: parsed.summary ?? fallback.summary,
					risks: Array.isArray(parsed.risks) && parsed.risks.length > 0 ? parsed.risks : fallback.risks,
					suggestions:
						Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
							? parsed.suggestions
							: fallback.suggestions,
					tests: Array.isArray(parsed.tests) && parsed.tests.length > 0 ? parsed.tests : fallback.tests,
					error: null,
				};
			} catch (error) {
				const fallback = fallbackReviewDiff(input.files, input.diff);
				return {
					...fallback,
					error: error instanceof Error ? error.message : 'AI request failed',
				};
			}
		}),

	explainCommit: publicProcedure
		.input(
			z.object({
				commitHash: z.string(),
				subject: z.string(),
				body: z.string().optional(),
				diff: z.string().max(1_000_000).optional(),
			})
		)
		.mutation(async ({ input }) => {
			if (!isFeatureEnabled('explainCommit')) {
				return { explanation: null, riskAreas: [], error: 'AI commit explanation is disabled.' };
			}

			try {
				const prompt = [
					'Explain this commit in plain language and call out risk areas.',
					'Respond as JSON: {"explanation":"...","riskAreas":["..."]}',
					`Commit: ${input.commitHash}`,
					`Subject: ${input.subject}`,
					input.body ? `Body: ${input.body}` : '',
					input.diff ? `Diff excerpt:\n${input.diff.slice(0, 20_000)}` : '',
				]
					.filter(Boolean)
					.join('\n');
				const output = await callOpenAICompatible(prompt, 'explainCommit');
				const parsed = JSON.parse(output) as { explanation?: string; riskAreas?: string[] };
				return {
					explanation: parsed.explanation ?? 'No explanation available.',
					riskAreas: Array.isArray(parsed.riskAreas) ? parsed.riskAreas : [],
					error: null,
				};
			} catch (error) {
				return {
					explanation: 'No explanation available.',
					riskAreas: [],
					error: error instanceof Error ? error.message : 'AI request failed',
				};
			}
		}),
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const appStoreState: Record<string, unknown> = {};
const fetchMock = vi.fn();
global.fetch = fetchMock as typeof fetch;

vi.mock('@/app/backend/store', () => ({
	appStore: {
		get: (key: string) => appStoreState[key],
		set: (key: string, value: unknown) => {
			appStoreState[key] = value;
		},
		clear: () => {
			for (const key of Object.keys(appStoreState)) delete appStoreState[key];
		},
	},
}));

const { aiRouter } = await import('./index');
const { appStore } = await import('@/app/backend/store');

describe('ai router secret handling', () => {
	const caller = aiRouter.createCaller({ senderId: 0, win: null });

	beforeEach(() => {
		appStore.clear();
		appStore.set('secretVault', { version: 1, entries: {} });
		appStore.set('aiProviderConfig', {
			enabled: false,
			provider: 'openai-compatible',
			baseUrl: '',
			model: 'gpt-4o-mini',
			timeoutMs: 20_000,
			maxTokens: 600,
			retries: 1,
			redactSensitivePaths: true,
			featureToggles: {
				commitMessage: true,
				pullRequest: true,
				conflictExplain: true,
				explainCommit: true,
				reviewDiff: true,
			},
		});
		fetchMock.mockReset();
	});

	it('persists the runtime api key outside the plain store and uses it for requests', async () => {
		await caller.setConfig({
			enabled: true,
			baseUrl: 'https://ai.example.com',
			model: 'gpt-4o-mini',
		});
		await caller.setRuntimeApiKey({ apiKey: 'runtime-secret' });

		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [{ message: { content: 'feat: improve secrets' } }],
			}),
		});

		await expect(
			caller.generateCommitMessage({
				stagedFiles: ['src/app.ts'],
				diff: 'diff --git a/src/app.ts b/src/app.ts',
			})
		).resolves.toEqual({
			suggestion: 'feat: improve secrets',
			error: null,
		});

		expect(appStoreState.secretVault).toEqual(
			expect.objectContaining({
				entries: expect.objectContaining({
					'ai.runtimeApiKey': expect.any(String),
				}),
			})
		);
		expect(appStoreState.aiProviderConfig).toEqual(
			expect.objectContaining({
				enabled: true,
				baseUrl: 'https://ai.example.com',
			})
		);
		expect((appStoreState).runtimeApiKey).toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith(
			'https://ai.example.com/v1/chat/completions',
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer runtime-secret',
				}),
			})
		);
	});
});

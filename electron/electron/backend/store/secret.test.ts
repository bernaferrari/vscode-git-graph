import { beforeEach, describe, expect, it, vi } from 'vitest';

const appStoreState: Record<string, unknown> = {};

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

const { appStore } = await import('@/app/backend/store');
const { deleteSecretValue, getSecretValue, readSecretValue, setSecretValue } = await import('./secret');

describe('secret store', () => {
	beforeEach(() => {
		appStore.clear();
	});

	it('stores encrypted secrets outside plaintext app store values', () => {
		setSecretValue('providerAuth.githubToken', 'token-123');

		const vault = appStoreState.secretVault as { entries?: Record<string, string> } | undefined;
		expect(vault?.entries?.['providerAuth.githubToken']).toBeDefined();
		expect(vault?.entries?.['providerAuth.githubToken']).not.toBe('token-123');
		expect(getSecretValue('providerAuth.githubToken')).toBe('token-123');
	});

	it('migrates legacy plaintext secrets into the vault on read', () => {
		const resolved = readSecretValue('collaborationSyncConfig.authToken', 'legacy-secret');

		expect(resolved).toBe('legacy-secret');
		expect(getSecretValue('collaborationSyncConfig.authToken')).toBe('legacy-secret');
		expect((appStoreState.secretVault as { entries?: Record<string, string> } | undefined)?.entries?.['collaborationSyncConfig.authToken']).not.toBe('legacy-secret');
	});

	it('deletes stored secrets', () => {
		setSecretValue('ai.runtimeApiKey', 'runtime-secret');
		deleteSecretValue('ai.runtimeApiKey');

		expect(getSecretValue('ai.runtimeApiKey')).toBeNull();
		expect((appStoreState.secretVault as { entries?: Record<string, string> } | undefined)?.entries?.['ai.runtimeApiKey']).toBeUndefined();
	});
});

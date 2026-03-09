import { beforeEach, describe, expect, it, vi } from 'vitest';

const instanceStoreState: Record<string, unknown> = {};
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
    instanceStore: {
        get: (key: string) => instanceStoreState[key],
        set: (key: string, value: unknown) => {
            instanceStoreState[key] = value;
        },
        clear: () => {
            for (const key of Object.keys(instanceStoreState)) delete instanceStoreState[key];
        },
    },
}));

const { repoRouter } = await import('./index');
const { instanceStore } = await import('@/app/backend/store');

describe('repo commit filters procedures', () => {
    const caller = repoRouter.createCaller({ senderId: 0, win: null });
    const repo = '/tmp/repo-filters';

    beforeEach(() => {
        instanceStore.clear();
    });

    it('persists and reads commit filters by repo', async () => {
        await caller.setCommitFilters({
            repo,
            author: 'Ada',
            search: 'refactor',
            dateFrom: '2026-03-01T00:00:00.000Z',
        });

        await expect(caller.commitFilters({ repo })).resolves.toEqual({
            filters: {
                author: 'Ada',
                search: 'refactor',
                dateFrom: '2026-03-01T00:00:00.000Z',
            },
        });
    });

    it('drops empty string values when saving filters', async () => {
        await caller.setCommitFilters({
            repo,
            author: '',
            search: 'bugfix',
            filePath: '',
        });

        await expect(caller.commitFilters({ repo })).resolves.toEqual({
            filters: {
                search: 'bugfix',
            },
        });
    });
});

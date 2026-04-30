import { beforeEach, describe, expect, it, vi } from 'vitest';

const configStoreState: Record<string, unknown> = {};
const instanceStoreState: Record<string, unknown> = {};
const fetchMock = vi.fn();
const appStoreState: Record<string, unknown> = {
    customCommands: [],
    notificationCenter: { notifications: [] },
    onboardingState: { gitGraphCompleted: false, lensOnboardingSeen: false },
    secretVault: { version: 1, entries: {} },
    collaborationSyncConfig: {
        enabled: false,
        provider: 'self-host',
        endpointUrl: '',
        projectId: 'default',
        authToken: '',
        memberId: '',
        memberApiKey: '',
        displayName: '',
        email: '',
        role: 'developer',
        permissionLevel: 'member',
        organizationId: '',
        organizationName: '',
        teamId: '',
        teamName: '',
        avatarUrl: '',
        deviceLabel: 'desktop',
        presenceEnabled: true,
        liveSyncEnabled: true,
        realtimeEnabled: true,
        timeoutMs: 15_000,
        autoSyncOnOpen: false,
        lastSyncedAt: null,
        lastSyncStatus: 'idle',
        lastSyncError: null,
    },
};

global.fetch = fetchMock as typeof fetch;

vi.mock('@/app/backend/store', () => ({
    configStore: {
        get: (key: string) => configStoreState[key],
        set: (key: string, value: unknown) => {
            configStoreState[key] = value;
        },
        clear: () => {
            for (const key of Object.keys(configStoreState)) Reflect.deleteProperty(configStoreState, key);
        },
    },
    appStore: {
        get: (key: string) => appStoreState[key],
        set: (key: string, value: unknown) => {
            appStoreState[key] = value;
        },
        clear: () => {
            for (const key of Object.keys(appStoreState)) Reflect.deleteProperty(appStoreState, key);
        },
    },
    instanceStore: {
        get: (key: string) => instanceStoreState[key],
        set: (key: string, value: unknown) => {
            instanceStoreState[key] = value;
        },
        clear: () => {
            for (const key of Object.keys(instanceStoreState)) Reflect.deleteProperty(instanceStoreState, key);
        },
    },
}));

const { configRouter } = await import('./index');
const { appStore, instanceStore, configStore } = await import('@/app/backend/store');

describe('config router persistence procedures', () => {
    const caller = configRouter.createCaller({ senderId: 0, win: null });

    beforeEach(() => {
        configStore.clear();
        appStore.clear();
        instanceStore.clear();
        appStore.set('customCommands', []);
        appStore.set('notificationCenter', { notifications: [] });
        appStore.set('onboardingState', { gitGraphCompleted: false, lensOnboardingSeen: false });
        appStore.set('secretVault', { version: 1, entries: {} });
        appStore.set('issueTrackerConfig', { providers: {}, autoDetect: true, patterns: [] });
        appStore.set('issueLinksByCommit', {});
        appStore.set('collaborationSyncConfig', {
            enabled: false,
            provider: 'self-host',
            endpointUrl: '',
            projectId: 'default',
            authToken: '',
            memberId: '',
            memberApiKey: '',
            displayName: '',
            email: '',
            role: 'developer',
            permissionLevel: 'member',
            organizationId: '',
            organizationName: '',
            teamId: '',
            teamName: '',
            avatarUrl: '',
            deviceLabel: 'desktop',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            timeoutMs: 15_000,
            autoSyncOnOpen: false,
            lastSyncedAt: null,
            lastSyncStatus: 'idle',
            lastSyncError: null,
        });
        instanceStore.set('appShellState', { sidebarOpen: true, repoNavMode: 'sidebar', openedRepos: [] });
        fetchMock.mockReset();
    });

    it('persists custom commands', async () => {
        await caller.setCustomCommands({
            commands: [
                {
                    id: 'clean',
                    name: 'Clean',
                    command: 'clean -n',
                    useCount: 2,
                },
            ],
        });

        await expect(caller.customCommands()).resolves.toEqual({
            commands: [
                {
                    id: 'clean',
                    name: 'Clean',
                    command: 'clean -n',
                    useCount: 2,
                },
            ],
        });
    });

    it('adds and updates notification center records', async () => {
        const added = await caller.addNotification({
            type: 'warning',
            title: 'Fetch failed',
            message: 'origin timed out',
            actionId: 'retry-fetch',
            actionLabel: 'Retry',
        });

        expect(added.notification.title).toBe('Fetch failed');
        expect(added.notification.read).toBe(false);

        await caller.markNotificationRead({ id: added.notification.id });
        const notifications = await caller.notifications();
        expect(notifications.notifications[0]?.read).toBe(true);

        await caller.clearNotifications();
        await expect(caller.notifications()).resolves.toEqual({ notifications: [] });
    });

    it('merges onboarding flags instead of overwriting state', async () => {
        await caller.setOnboardingState({ gitGraphCompleted: true });
        await caller.setOnboardingState({ lensOnboardingSeen: true });

        await expect(caller.onboardingState()).resolves.toEqual({
            state: {
                gitGraphCompleted: true,
                lensOnboardingSeen: true,
            },
        });
    });

    it('persists app shell state', async () => {
        await caller.setAppShellState({
            sidebarOpen: false,
            repoNavMode: 'tabs',
            openedRepos: ['/tmp/repo-a', '/tmp/repo-b'],
        });

        await expect(caller.appShellState()).resolves.toEqual({
            state: {
                sidebarOpen: false,
                repoNavMode: 'tabs',
                openedRepos: ['/tmp/repo-a', '/tmp/repo-b'],
            },
        });
    });

    it('persists collaboration sync config', async () => {
        await caller.setCollaborationSyncConfig({
            enabled: true,
            endpointUrl: 'https://sync.example.com/api/git-graph/collaboration',
            projectId: 'client-app',
            authToken: 'secret',
            memberId: 'ada@example.com',
            memberApiKey: 'member-secret',
            displayName: 'Ada',
            email: 'ada@example.com',
            role: 'lead',
            permissionLevel: 'manager',
            organizationId: 'acme',
            organizationName: 'Acme Engineering',
            teamId: 'platform',
            teamName: 'Platform',
            avatarUrl: 'https://example.com/ada.png',
            deviceLabel: 'Design MacBook',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            autoSyncOnOpen: true,
            timeoutMs: 30_000,
            lastSyncStatus: 'success',
            lastSyncedAt: 123,
            lastSyncError: null,
        });

        await expect(caller.collaborationSyncConfig()).resolves.toEqual({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            config: expect.objectContaining({
                enabled: true,
                endpointUrl: 'https://sync.example.com/api/git-graph/collaboration',
                projectId: 'client-app',
                memberId: 'ada@example.com',
                displayName: 'Ada',
                email: 'ada@example.com',
                role: 'lead',
                permissionLevel: 'manager',
                organizationId: 'acme',
                organizationName: 'Acme Engineering',
                teamId: 'platform',
                teamName: 'Platform',
                avatarUrl: 'https://example.com/ada.png',
                deviceLabel: 'Design MacBook',
                presenceEnabled: true,
                liveSyncEnabled: true,
                realtimeEnabled: true,
                autoSyncOnOpen: true,
                timeoutMs: 30_000,
                lastSyncStatus: 'success',
                lastSyncedAt: 123,
            }),
        });

        expect(appStoreState.collaborationSyncConfig).toEqual(
            expect.objectContaining({
                authToken: '',
                memberApiKey: '',
            })
        );
        expect(appStoreState.secretVault).toEqual(
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                entries: expect.objectContaining({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    'collaborationSyncConfig.authToken': expect.any(String),
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-secrets/no-secrets
                    'collaborationSyncConfig.memberApiKey': expect.any(String),
                }),
            })
        );
    });

    it('searches configured GitHub issues through the backend', async () => {
        appStore.set('issueTrackerConfig', {
            providers: {
                github: {
                    enabled: true,
                    projectKey: 'openai/codex',
                },
            },
            autoDetect: true,
            patterns: [],
        });
        fetchMock.mockResolvedValue({
            ok: true,
			json: () => Promise.resolve({
                items: [
                    {
                        id: 123,
                        number: 42,
                        title: 'Fix graph layout',
                        state: 'open',
                        html_url: 'https://github.com/openai/codex/issues/42',
                        labels: [{ name: 'bug' }],
                        assignees: [{ login: 'ada' }],
                    },
                ],
            }),
        });

        await expect(caller.issueSearch({ query: 'graph' })).resolves.toEqual({
            issues: [
                expect.objectContaining({
                    key: '#42',
                    title: 'Fix graph layout',
                    provider: 'github',
                    status: 'open',
                }),
            ],
            errors: [],
        });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('https://api.github.com/search/issues?'),
            expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                headers: expect.any(Headers),
            })
        );
    });

    it('persists issue links by commit', async () => {
        const linked = await caller.linkIssue({
            commitHash: 'abc123',
            issue: {
                id: 'github-42',
                key: '#42',
                title: 'Fix graph layout',
                status: 'open',
                provider: 'github',
                url: 'https://github.com/openai/codex/issues/42',
                labels: ['bug'],
            },
        });

        await expect(caller.issueLinks({ commitHash: 'abc123' })).resolves.toEqual({
            links: [
                expect.objectContaining({
                    id: linked.link.id,
                    issueKey: '#42',
                    title: 'Fix graph layout',
                }),
            ],
        });

        await caller.unlinkIssue({ commitHash: 'abc123', linkId: linked.link.id });
        await expect(caller.issueLinks({ commitHash: 'abc123' })).resolves.toEqual({ links: [] });
    });
});

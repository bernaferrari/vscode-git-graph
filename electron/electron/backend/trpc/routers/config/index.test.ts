import { beforeEach, describe, expect, it, vi } from 'vitest';

const configStoreState: Record<string, unknown> = {};
const instanceStoreState: Record<string, unknown> = {};
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

vi.mock('@/app/backend/store', () => ({
    configStore: {
        get: (key: string) => configStoreState[key],
        set: (key: string, value: unknown) => {
            configStoreState[key] = value;
        },
        clear: () => {
            for (const key of Object.keys(configStoreState)) delete configStoreState[key];
        },
    },
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
                entries: expect.objectContaining({
                    'collaborationSyncConfig.authToken': expect.any(String),
                    'collaborationSyncConfig.memberApiKey': expect.any(String),
                }),
            })
        );
    });
});

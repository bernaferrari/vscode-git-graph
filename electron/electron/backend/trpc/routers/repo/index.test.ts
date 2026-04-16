import { beforeEach, describe, expect, it, vi } from 'vitest';

const instanceStoreState: Record<string, unknown> = {};
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
const { instanceStore, appStore } = await import('@/app/backend/store');

describe('repo commit filters procedures', () => {
    const caller = repoRouter.createCaller({ senderId: 0, win: null });
    const repo = '/tmp/repo-filters';

    beforeEach(() => {
        instanceStore.clear();
        appStore.clear();
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
        appStore.set('secretVault', { version: 1, entries: {} });
        fetchMock.mockReset();
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

    it('persists undo history by repo', async () => {
        await caller.setUndoHistory({
            repo,
            operations: [
                {
                    id: 'undo-1',
                    type: 'commit',
                    timestamp: 123,
                    description: 'Committed changes',
                    details: {},
                    undoable: true,
                },
            ],
            currentIndex: 0,
        });

        await expect(caller.undoHistory({ repo })).resolves.toEqual({
            history: {
                operations: [
                    {
                        id: 'undo-1',
                        type: 'commit',
                        timestamp: 123,
                        description: 'Committed changes',
                        details: {},
                        undoable: true,
                    },
                ],
                currentIndex: 0,
            },
        });
    });

    it('lists and deletes collaboration shelf items', async () => {
        instanceStore.set('collaborationWorkspaceShares', [
            {
                id: 'share-1',
                workspaceId: 'ws-1',
                name: 'Daily handoff',
                note: '',
                createdAt: 1,
                updatedAt: 1,
                repos: [],
            },
        ]);
        instanceStore.set('collaborationPatchShelf', [
            {
                id: 'patch-1',
                repo,
                name: 'Review patch',
                baseRef: 'main',
                headRef: 'feature',
                summary: '1 file changed',
                patch: 'diff --git a/file b/file',
                fileCount: 1,
                additions: 4,
                deletions: 2,
                createdAt: 1,
            },
        ]);

        await expect(caller.collaboration.list()).resolves.toEqual({
            workspaceShares: [
                expect.objectContaining({
                    id: 'share-1',
                    name: 'Daily handoff',
                }),
            ],
            patchShelf: [
                expect.objectContaining({
                    id: 'patch-1',
                    name: 'Review patch',
                }),
            ],
            comments: [],
            assignments: [],
        });

        await caller.collaboration.deletePatchShare({ id: 'patch-1' });
        await caller.collaboration.deleteWorkspaceShare({ id: 'share-1' });

        await expect(caller.collaboration.list()).resolves.toEqual({
            workspaceShares: [],
            patchShelf: [],
            comments: [],
            assignments: [],
        });
    });

    it('exports and imports collaboration bundles', async () => {
        instanceStore.set('collaborationWorkspaceShares', [
            {
                id: 'share-1',
                workspaceId: 'ws-1',
                name: 'Design handoff',
                note: 'Check the review queue',
                createdAt: 10,
                updatedAt: 10,
                repos: [],
            },
        ]);
        instanceStore.set('collaborationPatchShelf', []);

        const exported = await caller.collaboration.exportBundle();
        expect(exported.bundle.version).toBe(2);
        expect(exported.bundle.workspaceShares).toHaveLength(1);
        expect(exported.bundle.comments).toEqual([]);
        expect(exported.bundle.assignments).toEqual([]);
        await expect(caller.collaboration.activity({ limit: 10 })).resolves.toEqual({
            entries: [expect.objectContaining({ type: 'bundle-export', action: 'exported' })],
        });

        await caller.collaboration.importBundle({
            strategy: 'merge',
            bundle: {
                ...exported.bundle,
                workspaceShares: [
                    ...exported.bundle.workspaceShares,
                    {
                        id: 'share-2',
                        workspaceId: 'ws-2',
                        name: 'QA handoff',
                        note: '',
                        createdAt: 20,
                        updatedAt: 20,
                        repos: [],
                    },
                ],
            },
        });

        await expect(caller.collaboration.list()).resolves.toEqual({
            workspaceShares: [
                expect.objectContaining({ id: 'share-2' }),
                expect.objectContaining({ id: 'share-1' }),
            ],
            patchShelf: [],
            comments: [],
            assignments: [],
        });
        await expect(caller.collaboration.activity({ limit: 10 })).resolves.toEqual({
            entries: expect.arrayContaining([expect.objectContaining({ type: 'bundle-import', action: 'imported' })]),
        });
    });

    it('syncs collaboration state with a configured self-host endpoint', async () => {
        instanceStore.set('collaborationWorkspaceShares', []);
        instanceStore.set('collaborationPatchShelf', []);
        appStore.set('collaborationSyncConfig', {
            enabled: true,
            provider: 'self-host',
            endpointUrl: 'https://sync.example.com/api/git-graph/collaboration',
            projectId: 'desktop-app',
            authToken: 'secret',
            memberId: 'ada@example.com',
            memberApiKey: 'member-secret',
            displayName: 'Ada',
            email: 'ada@example.com',
            role: 'developer',
            permissionLevel: 'member',
            organizationId: '',
            organizationName: '',
            teamId: '',
            teamName: '',
            avatarUrl: '',
            deviceLabel: 'Desktop',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            timeoutMs: 15_000,
            autoSyncOnOpen: false,
            lastSyncedAt: null,
            lastSyncStatus: 'idle',
            lastSyncError: null,
        });
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                bundle: {
                    version: 2,
                    projectId: 'desktop-app',
                    exportedAt: 42,
                    workspaceShares: [
                        {
                            id: 'share-remote',
                            workspaceId: 'remote-ws',
                            name: 'Remote share',
                            note: '',
                            createdAt: 42,
                            updatedAt: 42,
                            repos: [],
                        },
                    ],
                    patchShelf: [],
                    comments: [],
                    assignments: [],
                },
            }),
        });

        const result = await caller.collaboration.syncRemote({ direction: 'pull' });

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await expect(caller.collaboration.list()).resolves.toEqual({
            workspaceShares: [expect.objectContaining({ id: 'share-remote' })],
            patchShelf: [],
            comments: [],
            assignments: [],
        });
        await expect(caller.collaboration.activity({ limit: 10 })).resolves.toEqual({
            entries: [expect.objectContaining({ type: 'remote-sync', action: 'pulled', status: 'success' })],
        });
        expect(appStore.get('collaborationSyncConfig')).toEqual(
            expect.objectContaining({
                lastSyncStatus: 'success',
                lastSyncError: null,
                authToken: '',
                memberApiKey: '',
            })
        );
        expect(appStore.get('secretVault')).toEqual(
            expect.objectContaining({
                entries: expect.objectContaining({
                    'collaborationSyncConfig.authToken': expect.any(String),
                    'collaborationSyncConfig.memberApiKey': expect.any(String),
                }),
            })
        );
    });

    it('probes the configured collaboration endpoint health', async () => {
        appStore.set('collaborationSyncConfig', {
            enabled: true,
            provider: 'self-host',
            endpointUrl: 'https://sync.example.com/health',
            projectId: 'desktop-app',
            authToken: 'secret',
            memberId: 'ada@example.com',
            memberApiKey: 'member-secret',
            displayName: 'Ada',
            email: 'ada@example.com',
            role: 'developer',
            permissionLevel: 'member',
            organizationId: '',
            organizationName: '',
            teamId: '',
            teamName: '',
            avatarUrl: '',
            deviceLabel: 'Desktop',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            timeoutMs: 15_000,
            autoSyncOnOpen: false,
            lastSyncedAt: null,
            lastSyncStatus: 'idle',
            lastSyncError: null,
        });
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                ok: true,
                version: '1.0.0',
                projectCount: 2,
                storagePath: '/tmp/git-graph-collab',
            }),
        });

        await expect(caller.collaboration.probeRemote()).resolves.toEqual({
            success: true,
            error: null,
            health: expect.objectContaining({
                ok: true,
                version: '1.0.0',
                projectCount: 2,
                storagePath: '/tmp/git-graph-collab',
            }),
        });
    });

    it('adds comments to collaboration items', async () => {
        instanceStore.set('collaborationWorkspaceShares', [
            {
                id: 'share-1',
                workspaceId: 'ws-1',
                name: 'Daily handoff',
                note: '',
                createdAt: 1,
                updatedAt: 1,
                repos: [],
            },
        ]);
        appStore.set('collaborationSyncConfig', {
            enabled: false,
            provider: 'self-host',
            endpointUrl: '',
            projectId: 'desktop-app',
            authToken: '',
            memberId: 'ada@example.com',
            memberApiKey: '',
            displayName: 'Ada',
            email: 'ada@example.com',
            role: 'developer',
            permissionLevel: 'member',
            organizationId: '',
            organizationName: '',
            teamId: '',
            teamName: '',
            avatarUrl: '',
            deviceLabel: 'Desktop',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            timeoutMs: 15_000,
            autoSyncOnOpen: false,
            lastSyncedAt: null,
            lastSyncStatus: 'idle',
            lastSyncError: null,
        });

        const result = await caller.collaboration.addComment({
            targetType: 'workspace-share',
            targetId: 'share-1',
            body: 'QA should verify the release notes branch before shipping.',
        });

        expect(result.comment.author).toBe('Ada');
        await expect(caller.collaboration.comments()).resolves.toEqual({
            comments: [
                expect.objectContaining({
                    targetType: 'workspace-share',
                    targetId: 'share-1',
                }),
            ],
        });
    });

    it('builds collaboration review dashboard metrics for pull request review state', async () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
            instanceStore.set('collaborationComments', [
                {
                    id: 'comment-pr',
                    targetType: 'pull-request',
                    targetId: 'github:github.com%2Facme%2Frepo-one:1',
                    author: 'Ada',
                    body: 'Needs one more pass.',
                    createdAt: Date.parse('2026-03-09T08:00:00.000Z'),
                    updatedAt: Date.parse('2026-03-09T08:00:00.000Z'),
                },
                {
                    id: 'comment-file',
                    targetType: 'pull-request-file',
                    targetId: 'github:github.com%2Facme%2Frepo-one:1:src%2Fapp.ts',
                    author: 'Ada',
                    body: 'File-level note.',
                    createdAt: Date.parse('2026-03-09T09:00:00.000Z'),
                    updatedAt: Date.parse('2026-03-09T09:00:00.000Z'),
                },
                {
                    id: 'comment-line',
                    targetType: 'pull-request-file',
                    targetId: 'github:github.com%2Facme%2Frepo-one:1:src%2Fapp.ts:right:42',
                    author: 'Grace',
                    body: 'Line-level note.',
                    createdAt: Date.parse('2026-03-09T10:00:00.000Z'),
                    updatedAt: Date.parse('2026-03-09T10:00:00.000Z'),
                },
            ]);
            instanceStore.set('collaborationAssignments', [
                {
                    id: 'assignment-1',
                    targetType: 'pull-request',
                    targetId: 'github:github.com%2Facme%2Frepo-one:1',
                    assigneeId: 'ada',
                    assigneeName: 'Ada',
                    status: 'open',
                    note: 'Handle review',
                    createdAt: Date.parse('2026-03-09T07:00:00.000Z'),
                    updatedAt: Date.parse('2026-03-09T07:00:00.000Z'),
                    createdBy: 'Lead',
                },
                {
                    id: 'assignment-2',
                    targetType: 'pull-request',
                    targetId: 'gitlab:gitlab.example.com%2Facme%2Frepo-two:2',
                    assigneeId: 'grace',
                    assigneeName: 'Grace',
                    status: 'blocked',
                    note: 'Waiting on CI',
                    createdAt: Date.parse('2026-03-05T07:00:00.000Z'),
                    updatedAt: Date.parse('2026-03-05T07:00:00.000Z'),
                    createdBy: 'Lead',
                },
            ]);

            await expect(caller.collaboration.reviewDashboard()).resolves.toEqual({
                dashboard: expect.objectContaining({
                    summary: expect.objectContaining({
                        totalReviewTargets: 2,
                        openReviewTargets: 2,
                        unassignedReviewTargets: 0,
                        staleReviewTargets: 1,
                        unresolvedThreads: 3,
                        lineThreadCount: 1,
                    }),
                    reviewTargets: expect.arrayContaining([
                        expect.objectContaining({
                            rootTargetId: 'github:github.com%2Facme%2Frepo-one:1',
                            repoKey: 'github.com/acme/repo-one',
                            assignmentCount: 1,
                            commentCount: 3,
                            fileThreadCount: 1,
                            lineThreadCount: 1,
                            unassigned: false,
                        }),
                        expect.objectContaining({
                            rootTargetId: 'gitlab:gitlab.example.com%2Facme%2Frepo-two:2',
                            repoKey: 'gitlab.example.com/acme/repo-two',
                            assignmentCount: 1,
                            stale: true,
                            blockedAssignments: 1,
                        }),
                    ]),
                    repositories: expect.arrayContaining([
                        expect.objectContaining({
                            repoKey: 'github.com/acme/repo-one',
                            reviewTargetCount: 1,
                        }),
                        expect.objectContaining({
                            repoKey: 'gitlab.example.com/acme/repo-two',
                            reviewTargetCount: 1,
                        }),
                    ]),
                    reviewerLoad: expect.arrayContaining([
                        expect.objectContaining({ memberId: 'ada', activeAssignments: 1 }),
                        expect.objectContaining({ memberId: 'grace', blockedAssignments: 1 }),
                    ]),
                }),
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('publishes and reads remote presence and team activity', async () => {
        appStore.set('collaborationSyncConfig', {
            enabled: true,
            provider: 'self-host',
            endpointUrl: 'https://sync.example.com/api/git-graph/collaboration',
            projectId: 'desktop-app',
            authToken: 'secret',
            memberId: 'ada@example.com',
            memberApiKey: 'member-secret',
            displayName: 'Ada',
            email: 'ada@example.com',
            role: 'developer',
            permissionLevel: 'member',
            organizationId: '',
            organizationName: '',
            teamId: '',
            teamName: '',
            avatarUrl: '',
            deviceLabel: 'Desktop',
            presenceEnabled: true,
            liveSyncEnabled: true,
            realtimeEnabled: true,
            timeoutMs: 15_000,
            autoSyncOnOpen: false,
            lastSyncedAt: null,
            lastSyncStatus: 'idle',
            lastSyncError: null,
        });
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    entries: [
                        {
                            id: 'ada::desktop',
                            actor: 'Ada',
                            deviceLabel: 'Desktop',
                            repo,
                            branch: 'main',
                            status: 'Working in repo',
                            lastSeenAt: 123,
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    entries: [
                        {
                            id: 'remote-1',
                            actor: 'Ada',
                            type: 'sync',
                            title: 'Collaboration roundtrip completed',
                            status: 'success',
                            timestamp: 456,
                        },
                    ],
                }),
            });

        await expect(
            caller.collaboration.publishPresence({
                repo,
                branch: 'main',
                status: 'Working in repo',
            })
        ).resolves.toEqual({
            success: true,
            error: null,
            entries: [
                expect.objectContaining({
                    actor: 'Ada',
                    branch: 'main',
                }),
            ],
        });
        await expect(caller.collaboration.remoteActivity({ limit: 10 })).resolves.toEqual({
            success: true,
            error: null,
            entries: [expect.objectContaining({ actor: 'Ada', type: 'sync' })],
        });
    });
});

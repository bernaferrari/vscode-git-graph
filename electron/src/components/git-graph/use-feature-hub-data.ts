import { useMemo } from 'react';

import { trpc } from '@/trpc/client';

interface ReleaseFeatureFlags {
    worktreePro: boolean;
    workflowEngine: boolean;
}

export function useFeatureHubData(activeRepo: string | null, featureFlags: ReleaseFeatureFlags) {
    const worktreeSummaryQuery = trpc.git.worktree.list.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && featureFlags.worktreePro, staleTime: 10_000, refetchOnWindowFocus: false }
    );
    const workflowSummaryQuery = trpc.git.workflow.list.useQuery(undefined, {
        enabled: featureFlags.workflowEngine,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
    });
    const repoPolicySummaryQuery = trpc.repo.policy.get.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo, staleTime: 10_000, refetchOnWindowFocus: false }
    );
    const auditSummaryQuery = trpc.system.audit.list.useQuery(
        { repo: activeRepo ?? null, limit: 8 },
        { enabled: !!activeRepo, staleTime: 8_000, refetchOnWindowFocus: false }
    );
    const diagnosticsSummaryQuery = trpc.system.diagnostics.useQuery(undefined, {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
    });
    const collaborationSummaryQuery = trpc.repo.collaboration.list.useQuery(undefined, {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
    });
    const collaborationConfigQuery = trpc.config.collaborationSyncConfig.useQuery(undefined, {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
    });
    const launchpadSummaryQuery = trpc.repo.launchpad.useQuery(
        { repos: activeRepo ? [activeRepo] : [], includePullRequests: true },
        { enabled: !!activeRepo, staleTime: 12_000, refetchOnWindowFocus: false }
    );

    const worktreeAttentionCount = useMemo(
        () =>
            (worktreeSummaryQuery.data?.worktrees ?? []).filter(
                (entry: { locked?: boolean; prunable?: boolean }) =>
                    Boolean((entry as { locked?: boolean }).locked) || Boolean((entry as { prunable?: boolean }).prunable)
            ).length,
        [worktreeSummaryQuery.data?.worktrees]
    );

    const workflowFailureCount = useMemo(
        () =>
            (workflowSummaryQuery.data?.runs ?? []).filter(
                (run: { status?: string | null }) => run.status === 'failed'
            ).length,
        [workflowSummaryQuery.data?.runs]
    );

    const prSummary = useMemo(() => {
        const repo = launchpadSummaryQuery.data?.repos?.[0];
        return {
            openPullRequests: repo?.openPullRequests ?? 0,
            needsAttention: Boolean(repo?.needsAttention),
            stale: Boolean(repo?.stale),
            statusSignals: repo?.statusSignals ?? [],
        };
    }, [launchpadSummaryQuery.data?.repos]);

    return {
        worktreeCount: worktreeSummaryQuery.data?.worktrees?.length ?? 0,
        worktreeAttentionCount,
        workflowCount: workflowSummaryQuery.data?.definitions?.length ?? 0,
        workflowFailureCount,
        auditCount: auditSummaryQuery.data?.entries?.length ?? 0,
        protocolRegistered: Boolean(diagnosticsSummaryQuery.data?.protocolRegistered),
        collaborationSummary: {
            workspaceShares: collaborationSummaryQuery.data?.workspaceShares?.length ?? 0,
            patchShelf: collaborationSummaryQuery.data?.patchShelf?.length ?? 0,
            syncEnabled: Boolean(collaborationConfigQuery.data?.config?.enabled),
            lastSyncStatus: collaborationConfigQuery.data?.config?.lastSyncStatus ?? 'idle',
        },
        repoPolicy: {
            requireSignedCommits: Boolean(repoPolicySummaryQuery.data?.policy?.requireSignedCommits),
            requireUpToDate: Boolean(repoPolicySummaryQuery.data?.policy?.requireUpToDate),
            enableStacking: Boolean(repoPolicySummaryQuery.data?.policy?.enableStacking),
        },
        prSummary,
    };
}

export default useFeatureHubData;

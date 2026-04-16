import { useCallback, useEffect, useState } from 'react';


import { trpc } from '@/trpc/client';

import type { CommitFilter } from './commit-history-filters';
import type { Dispatch, SetStateAction } from 'react';

interface PersistedCommitFilters {
    author?: string;
    filePath?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}

function deserializeFilters(filters: PersistedCommitFilters | undefined): CommitFilter {
    if (!filters) {
        return {};
    }

    return {
        ...(filters.author ? { author: filters.author } : {}),
        ...(filters.filePath ? { filePath: filters.filePath } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.dateFrom ? { dateFrom: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { dateTo: new Date(filters.dateTo) } : {}),
    };
}

function serializeFilters(filters: CommitFilter): PersistedCommitFilters {
    return {
        ...(filters.author ? { author: filters.author } : {}),
        ...(filters.filePath ? { filePath: filters.filePath } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom.toISOString() } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo.toISOString() } : {}),
    };
}

export function useRepoCommitFilters(activeRepo: string | null) {
    const [commitFilters, setCommitFiltersState] = useState<CommitFilter>({});
    const filtersQuery = trpc.repo.commitFilters.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo, staleTime: 10_000 }
    );
    const utils = trpc.useUtils();
    const setFiltersMutation = trpc.repo.setCommitFilters.useMutation({
        onSuccess: async (_result: unknown, variables: { repo: string }) => {
            await utils.repo.commitFilters.invalidate({ repo: variables.repo });
        },
    });

    useEffect(() => {
        if (!activeRepo) {
            setCommitFiltersState({});
            return;
        }
        setCommitFiltersState(deserializeFilters(filtersQuery.data?.filters));
    }, [activeRepo, filtersQuery.data?.filters]);

    const setCommitFilters = useCallback<Dispatch<SetStateAction<CommitFilter>>>(
        (value) => {
            if (!activeRepo) {
                setCommitFiltersState(typeof value === 'function' ? value({}) : value);
                return;
            }

            setCommitFiltersState((prev) => {
                const next = typeof value === 'function' ? value(prev) : value;
                setFiltersMutation.mutate({
                    repo: activeRepo,
                    ...serializeFilters(next),
                });
                return next;
            });
        },
        [activeRepo, setFiltersMutation]
    );

    return {
        commitFilters,
        setCommitFilters,
        isLoaded: !activeRepo || filtersQuery.isSuccess,
    };
}

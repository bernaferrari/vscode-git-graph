import { useEffect, useRef } from 'react';

import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

export function useAppShellPersistence() {
    const utils = trpc.useUtils();
    const appShellStateQuery = trpc.config.appShellState.useQuery(undefined, { staleTime: 10_000 });
    const setAppShellStateMutation = trpc.config.setAppShellState.useMutation({
        onSuccess: async () => {
            await utils.config.appShellState.invalidate();
        },
    });
    const hydratedRef = useRef(false);
    const lastPersistedRef = useRef<string | null>(null);

    useEffect(() => {
        const state = appShellStateQuery.data?.state;
        if (!state || hydratedRef.current) {
            return;
        }

        useAppStore.setState((current) => ({
            ...current,
            sidebarOpen: state.sidebarOpen,
            repoNavMode: state.repoNavMode,
            openedRepos: state.openedRepos,
        }));
        lastPersistedRef.current = JSON.stringify({
            sidebarOpen: state.sidebarOpen,
            repoNavMode: state.repoNavMode,
            openedRepos: state.openedRepos,
        });
        hydratedRef.current = true;
    }, [appShellStateQuery.data?.state]);

    useEffect(() => {
        const unsubscribe = useAppStore.subscribe((state) => {
            if (!hydratedRef.current) {
                return;
            }

            const nextState = {
                sidebarOpen: state.sidebarOpen,
                repoNavMode: state.repoNavMode,
                openedRepos: state.openedRepos,
            };
            const snapshot = JSON.stringify(nextState);
            if (snapshot === lastPersistedRef.current) {
                return;
            }

            lastPersistedRef.current = snapshot;
            setAppShellStateMutation.mutate(nextState);
        });

        return () => {
            unsubscribe();
        };
    }, [setAppShellStateMutation]);
}

export default useAppShellPersistence;

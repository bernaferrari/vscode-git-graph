import { useEffect, useRef } from 'react';

import { trpc } from '@/trpc/client';

const PULL_DEBOUNCE_MS = 2_000;
const SAFE_SYNC_INTERVAL_MS = 15_000;

export function useCollaborationRealtime() {
	const utils = trpc.useUtils();
	const configQuery = trpc.config.collaborationSyncConfig.useQuery(undefined, { staleTime: 15_000 });
	const syncRemoteMutation = trpc.repo.collaboration.syncRemote.useMutation({
		onSuccess: async () => {
			await Promise.allSettled([
				utils.repo.collaboration.list.invalidate(),
				utils.repo.collaboration.activity.invalidate(),
				utils.repo.collaboration.comments.invalidate(),
				utils.repo.collaboration.assignments.invalidate(),
				utils.repo.collaboration.remotePresence.invalidate(),
				utils.repo.collaboration.remoteMembers.invalidate(),
				utils.repo.collaboration.remoteActivity.invalidate(),
				utils.repo.collaboration.teamInsights.invalidate(),
				utils.config.collaborationSyncConfig.invalidate(),
			]);
		},
	});
	const lastPullAtRef = useRef(0);

	useEffect(() => {
		const config = configQuery.data?.config;
		if (!config || !config.enabled || !config.realtimeEnabled || !config.endpointUrl?.trim()) {
			return;
		}

		const triggerSafePull = () => {
			const now = Date.now();
			if (syncRemoteMutation.isPending || now - lastPullAtRef.current < PULL_DEBOUNCE_MS) {
				return;
			}
			lastPullAtRef.current = now;
			syncRemoteMutation.mutate({ direction: 'pull' });
		};

		triggerSafePull();
		const intervalId = window.setInterval(triggerSafePull, SAFE_SYNC_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [configQuery.data?.config, syncRemoteMutation, utils]);
}

export default useCollaborationRealtime;

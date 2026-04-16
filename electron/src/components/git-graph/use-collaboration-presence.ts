import { useEffect } from 'react';

import { trpc } from '@/trpc/client';

const HEARTBEAT_MS = 45_000;

export function useCollaborationPresence(activeRepo: string | null, currentHead: string | null) {
	const configQuery = trpc.config.collaborationSyncConfig.useQuery(undefined, { staleTime: 15_000 });
	const publishPresenceMutation = trpc.repo.collaboration.publishPresence.useMutation();
	const publishSessionMutation = trpc.repo.collaboration.publishSession.useMutation();

	useEffect(() => {
		const config = configQuery.data?.config;
		if (
			!config ||
			!config.enabled ||
			!config.endpointUrl?.trim() ||
			!config.presenceEnabled ||
			!config.displayName?.trim()
		) {
			return;
		}

		let cancelled = false;
		const status = activeRepo
			? `Working in ${activeRepo.split('/').pop() ?? activeRepo}`
			: 'Browsing Git Graph';

		const publish = async () => {
			if (cancelled || publishPresenceMutation.isPending || publishSessionMutation.isPending) {
				return;
			}
			try {
				await publishSessionMutation.mutateAsync();
				await publishPresenceMutation.mutateAsync({
					repo: activeRepo ?? null,
					branch: currentHead ?? null,
					status,
				});
			} catch {
				// Presence should never block the shell.
			}
		};

		void publish();
		const interval = window.setInterval(() => {
			void publish();
		}, HEARTBEAT_MS);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [activeRepo, configQuery.data?.config, currentHead, publishPresenceMutation, publishSessionMutation]);
}

export default useCollaborationPresence;

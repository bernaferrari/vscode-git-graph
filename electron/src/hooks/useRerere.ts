/**
 * Rerere (Reuse Recorded Resolution) Hook
 * Manages conflict resolution memory
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { useCallback } from 'react';
import { toast } from 'sonner';

interface MutationErrorShape {
	message: string;
}

export function useRerere() {
	const { activeRepo } = useAppStore();

	// Query for rerere status
	const rerereStatus = trpc.git.rerereStatus.useQuery(
		{ repo: activeRepo! },
		{ enabled: !!activeRepo }
	);

	// Query for recorded resolutions
	const rerereList = trpc.git.rerereList.useQuery(
		{ repo: activeRepo! },
		{ enabled: !!activeRepo }
	);

	// Enable rerere
	const enableRerere = trpc.git.rerereEnable.useMutation({
		onSuccess: () => {
			toast.success('Rerere enabled', { description: 'Conflict resolutions will be remembered' });
			rerereStatus.refetch();
		},
		onError: (error: MutationErrorShape) => {
			toast.error('Failed to enable rerere', { description: error.message });
		},
	});

	// Disable rerere
	const disableRerere = trpc.git.rerereDisable.useMutation({
		onSuccess: () => {
			toast.success('Rerere disabled');
			rerereStatus.refetch();
		},
		onError: (error: MutationErrorShape) => {
			toast.error('Failed to disable rerere', { description: error.message });
		},
	});

	// Clear rerere cache
	const clearRerere = trpc.git.rerereClear.useMutation({
		onSuccess: () => {
			toast.success('Rerere cache cleared');
			rerereList.refetch();
		},
		onError: (error: MutationErrorShape) => {
			toast.error('Failed to clear rerere', { description: error.message });
		},
	});

	const toggleRerere = useCallback(async () => {
		if (!activeRepo) return;
		
		if (rerereStatus.data?.enabled) {
			await disableRerere.mutateAsync({ repo: activeRepo });
		} else {
			await enableRerere.mutateAsync({ repo: activeRepo });
		}
	}, [activeRepo, rerereStatus.data?.enabled, enableRerere, disableRerere]);

	return {
		// State
		isEnabled: rerereStatus.data?.enabled ?? false,
		recordings: rerereList.data?.recordings ?? [],
		isLoading: rerereStatus.isLoading || rerereList.isLoading,

		// Actions
		enableRerere: () => activeRepo && enableRerere.mutate({ repo: activeRepo }),
		disableRerere: () => activeRepo && disableRerere.mutate({ repo: activeRepo }),
		clearRerere: () => activeRepo && clearRerere.mutate({ repo: activeRepo }),
		toggleRerere,
	};
}

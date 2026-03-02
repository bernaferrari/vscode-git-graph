/**
 * Lens Mode Hook
 * Provides access to the current lens mode and helpers
 * Now uses standalone zustand store to avoid circular dependencies
 */

import { useLensStore, type LensMode, type LensConfig, LENS_CONFIGS } from '@/lib/lensStore';
import { useMemo, useCallback } from 'react';

export type { LensMode, LensConfig };

export function useLensMode() {
	const { mode, setMode } = useLensStore();

	const config = useMemo(() => LENS_CONFIGS[mode], [mode]);

	const setLensMode = useCallback(
		(newMode: LensMode) => {
			setMode(newMode);
		},
		[setMode]
	);

	const isGuided = mode === 'guided';
	const isCraft = mode === 'craft';
	const isControl = mode === 'control';

	const shouldShow = useCallback(
		(feature: keyof LensConfig): boolean => {
			return config[feature] as boolean;
		},
		[config]
	);

	const getActionLabel = useCallback(
		(action: 'fetch' | 'pull' | 'push' | 'sync' | 'rebase' | 'merge'): string => {
			if (isGuided) {
				switch (action) {
					case 'fetch':
						return 'Check for updates';
					case 'pull':
						return 'Get changes';
					case 'push':
						return 'Share changes';
					case 'sync':
						return 'Sync all';
					case 'rebase':
						return 'Update branch';
					case 'merge':
						return 'Combine branches';
					default:
						return action;
				}
			}
			return action;
		},
		[isGuided]
	);

	return {
		mode,
		config,
		setLensMode,
		isGuided,
		isCraft,
		isControl,
		shouldShow,
		getActionLabel,
		lensOptions: Object.values(LENS_CONFIGS),
	};
}

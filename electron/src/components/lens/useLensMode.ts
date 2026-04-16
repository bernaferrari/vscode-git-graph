/**
 * Lens Mode Hook
 * Provides access to the current lens mode and helpers.
 * Lens selection is persisted through backend-managed settings.
 */

import { useCallback, useMemo } from 'react';

import { useSettings } from '@/components/git-graph/useSettings';
import { LENS_CONFIGS, type LensConfig, type LensMode } from '@/lib/lensStore';

export type { LensMode, LensConfig };

export function useLensMode() {
	const { settings, updateSetting } = useSettings();
	const mode = settings.lensMode;

	const config = useMemo(() => LENS_CONFIGS[mode], [mode]);

	const setLensMode = useCallback(
		(newMode: LensMode) => {
			updateSetting('lensMode', newMode);
		},
		[updateSetting]
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

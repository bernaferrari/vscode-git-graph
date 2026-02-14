/**
 * Lens Mode Hook
 * Provides access to the current lens mode and helpers
 */

import { useSettings } from '../git-graph/settings-dialog';
import { useMemo, useCallback } from 'react';

export type LensMode = 'guided' | 'craft' | 'control';

export interface LensConfig {
	mode: LensMode;
	label: string;
	description: string;
	icon: string;
	showCommitPanel: boolean;
	showStagingPanel: boolean;
	showAdvancedPanels: boolean;
	showKeyboardHints: boolean;
	showGitCommands: boolean;
	showTaskNavigation: boolean;
	buttonSize: 'sm' | 'md' | 'lg';
	confirmDestructive: boolean;
}

const LENS_CONFIGS: Record<LensMode, LensConfig> = {
	guided: {
		mode: 'guided',
		label: 'Guided',
		description: 'Simple and safe - let the app guide you through Git operations',
		icon: 'Compass',
		showCommitPanel: true,
		showStagingPanel: true,
		showAdvancedPanels: false,
		showKeyboardHints: false,
		showGitCommands: false,
		showTaskNavigation: true,
		buttonSize: 'lg',
		confirmDestructive: true,
	},
	craft: {
		mode: 'craft',
		label: 'Craft',
		description: 'Balanced - great for daily development with keyboard shortcuts',
		icon: 'Wand2',
		showCommitPanel: true,
		showStagingPanel: true,
		showAdvancedPanels: true,
		showKeyboardHints: true,
		showGitCommands: false,
		showTaskNavigation: false,
		buttonSize: 'md',
		confirmDestructive: true,
	},
	control: {
		mode: 'control',
		label: 'Control',
		description: 'Full power - see everything Git has to offer',
		icon: 'Terminal',
		showCommitPanel: true,
		showStagingPanel: true,
		showAdvancedPanels: true,
		showKeyboardHints: true,
		showGitCommands: true,
		showTaskNavigation: false,
		buttonSize: 'sm',
		confirmDestructive: false,
	},
};

export function useLensMode() {
	const { settings, updateSetting } = useSettings();

	const currentMode = settings.lensMode as LensMode;
	const config = useMemo(() => LENS_CONFIGS[currentMode], [currentMode]);

	const setLensMode = useCallback(
		(mode: LensMode) => {
			updateSetting('lensMode', mode);
		},
		[updateSetting]
	);

	const isGuided = currentMode === 'guided';
	const isCraft = currentMode === 'craft';
	const isControl = currentMode === 'control';

	// Helper to conditionally render based on lens
	const shouldShow = useCallback(
		(feature: keyof LensConfig): boolean => {
			return config[feature] as boolean;
		},
		[config]
	);

	// Get action label based on lens mode
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
		mode: currentMode,
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

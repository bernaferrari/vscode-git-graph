/**
 * Shared lens metadata.
 * The persisted lens selection now lives in backend-managed Git Graph settings.
 */

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

export const LENS_CONFIGS: Record<LensMode, LensConfig> = {
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

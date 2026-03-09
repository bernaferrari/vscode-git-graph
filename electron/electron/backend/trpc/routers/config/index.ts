/**
 * Configuration tRPC Router
 * Exposes configuration management to the renderer
 */

import { z } from 'zod';

import { configStore, appStore, instanceStore } from '@/app/backend/store';

import { router, publicProcedure } from '../../init';

const commitTemplateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	content: z.string().min(1),
	isDefault: z.boolean().optional(),
});
const diffToolSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	command: z.string().min(1),
	args: z.string().min(1),
	supports3Way: z.boolean(),
	supportsDirDiff: z.boolean(),
	icon: z.string().optional(),
});
const externalDiffConfigSchema = z.object({
	tools: z.array(diffToolSchema),
	selectedTool: z.string().min(1),
	useForMergeConflicts: z.boolean(),
});
const issueTrackerConfigSchema = z.object({
	providers: z.record(
		z.string(),
		z.object({
			enabled: z.boolean(),
			apiKey: z.string().optional(),
			domain: z.string().optional(),
			projectKey: z.string().optional(),
		})
	),
	autoDetect: z.boolean(),
	patterns: z.array(z.string()),
});
const gitGraphSettingsSchema = z.object({
	confirmDestructiveActions: z.boolean(),
	autoFetchInterval: z.number(),
	checkForUpdates: z.boolean(),
	launchAtStartup: z.boolean(),
	lensMode: z.enum(['guided', 'craft', 'control']),
	theme: z.enum(['light', 'dark', 'system']),
	graphTheme: z.enum(['default', 'colorful', 'minimal']),
	commitMessageLength: z.number(),
	showAvatars: z.boolean(),
	showRelativeDates: z.boolean(),
	dateFormat: z.enum(['relative', 'iso', 'locale']),
	enhancedAccessibility: z.boolean(),
	commitTemplate: z.string(),
	autoSignCommits: z.boolean(),
	defaultBranch: z.string(),
	mergeTool: z.string(),
	notifyOnPush: z.boolean(),
	notifyOnPull: z.boolean(),
	notifyOnMerge: z.boolean(),
	soundEnabled: z.boolean(),
	maxCommits: z.number(),
	enableVirtualization: z.boolean(),
	lazyLoadImages: z.boolean(),
	telemetryEnabled: z.boolean(),
	crashReports: z.boolean(),
});

export const configRouter = router({
	/**
	 * Get all configuration.
	 */
	getAll: publicProcedure.query(() => {
		return {
			graph: configStore.get('graph'),
			date: configStore.get('date'),
			repository: configStore.get('repository'),
			dialog: configStore.get('dialog'),
			ui: configStore.get('ui'),
			fileEncoding: configStore.get('fileEncoding'),
		};
	}),

	/**
	 * Get graph configuration.
	 */
	graph: publicProcedure.query(() => {
		return configStore.get('graph');
	}),

	/**
	 * Set graph configuration.
	 */
	setGraph: publicProcedure
		.input(
			z.object({
				colours: z.array(z.string()).optional(),
				style: z.enum(['rounded', 'angular']).optional(),
				uncommittedChanges: z.enum(['openCircleAtUncommittedChanges', 'openCircleAtCheckedOutCommit']).optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('graph');
			configStore.set('graph', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get date configuration.
	 */
	date: publicProcedure.query(() => {
		return configStore.get('date');
	}),

	/**
	 * Set date configuration.
	 */
	setDate: publicProcedure
		.input(
			z.object({
				format: z.enum(['dateAndTime', 'dateOnly', 'relative', 'isoDateAndTime', 'isoDateOnly']).optional(),
				type: z.enum(['author', 'commit']).optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('date');
			configStore.set('date', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get repository configuration.
	 */
	repository: publicProcedure.query(() => {
		return configStore.get('repository');
	}),

	/**
	 * Set repository configuration.
	 */
	setRepository: publicProcedure
		.input(
			z.object({
				initialLoadCommits: z.number().optional(),
				loadMoreCommits: z.number().optional(),
				loadMoreCommitsAutomatically: z.boolean().optional(),
				showRemoteBranches: z.boolean().optional(),
				showStashes: z.boolean().optional(),
				showTags: z.boolean().optional(),
				showUncommittedChanges: z.boolean().optional(),
				showUntrackedFiles: z.boolean().optional(),
				muteMergeCommits: z.boolean().optional(),
				onlyFollowFirstParent: z.boolean().optional(),
				fetchAndPrune: z.boolean().optional(),
				useMailmap: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('repository');
			configStore.set('repository', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get dialog defaults.
	 */
	dialog: publicProcedure.query(() => {
		return configStore.get('dialog');
	}),

	/**
	 * Set dialog defaults.
	 */
	setDialog: publicProcedure
		.input(
			z.object({
				resetCommitMode: z.enum(['soft', 'mixed', 'hard']).optional(),
				resetUncommittedMode: z.enum(['soft', 'mixed', 'hard']).optional(),
				deleteBranchForce: z.boolean().optional(),
				createBranchCheckout: z.boolean().optional(),
				mergeNoFastForward: z.boolean().optional(),
				mergeSquash: z.boolean().optional(),
				rebaseInteractive: z.boolean().optional(),
				addTagPushToRemote: z.boolean().optional(),
				addTagType: z.enum(['annotated', 'lightweight']).optional(),
				stashIncludeUntracked: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('dialog');
			configStore.set('dialog', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get UI configuration.
	 */
	ui: publicProcedure.query(() => {
		return configStore.get('ui');
	}),

	/**
	 * Set UI configuration.
	 */
	setUi: publicProcedure
		.input(
			z.object({
				enhancedAccessibility: z.boolean().optional(),
				markdown: z.boolean().optional(),
				tabIconColourTheme: z.enum(['colour', 'grey']).optional(),
				featureFlags: z
					.object({
						worktreePro: z.boolean().optional(),
						workflowEngine: z.boolean().optional(),
						graphiteInterop: z.boolean().optional(),
						aiProd: z.boolean().optional(),
						deepLinks: z.boolean().optional(),
						branchPinning: z.boolean().optional(),
					})
					.optional(),
			})
		)
			.mutation(({ input }) => {
			const current = configStore.get('ui');
			const nextFeatureFlags = input.featureFlags
				? { ...current.featureFlags, ...input.featureFlags }
				: current.featureFlags;
			configStore.set('ui', {
				...current,
				...input,
				featureFlags: nextFeatureFlags,
			});
			return { success: true };
		}),

	/**
	 * Get global view state.
	 */
	globalViewState: publicProcedure.query(() => {
		return appStore.get('globalViewState');
	}),

	/**
	 * Set global view state.
	 */
	setGlobalViewState: publicProcedure
		.input(
			z.object({
				alwaysAcceptCheckoutCommit: z.boolean().optional(),
				issueLinkingConfig: z
					.object({
						issue: z.string(),
						url: z.string(),
					})
					.nullable()
					.optional(),
				pushTagSkipRemoteCheck: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = appStore.get('globalViewState');
			appStore.set('globalViewState', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Get workspace view state.
	 */
	workspaceViewState: publicProcedure.query(() => {
		return instanceStore.get('workspaceViewState');
	}),

	/**
	 * Set workspace view state.
	 */
	setWorkspaceViewState: publicProcedure
		.input(
			z.object({
				findIsCaseSensitive: z.boolean().optional(),
				findIsRegex: z.boolean().optional(),
				findOpenCommitDetailsView: z.boolean().optional(),
			})
		)
			.mutation(({ input }) => {
			const current = instanceStore.get('workspaceViewState');
			instanceStore.set('workspaceViewState', { ...current, ...input });
			return { success: true };
		}),

	/**
	 * Keybinding overrides.
	 */
	keybindings: publicProcedure.query(() => {
		return {
			overrides: instanceStore.get('keybindingOverrides'),
		};
	}),

	commitTemplates: publicProcedure.query(() => {
		return {
			templates: appStore.get('commitTemplates'),
		};
	}),

	setCommitTemplates: publicProcedure
		.input(
			z.object({
				templates: z.array(commitTemplateSchema),
			})
		)
		.mutation(({ input }) => {
			appStore.set('commitTemplates', input.templates);
			return { success: true };
		}),

	externalDiffConfig: publicProcedure.query(() => {
		return {
			config: appStore.get('externalDiffConfig'),
		};
	}),

	setExternalDiffConfig: publicProcedure
		.input(externalDiffConfigSchema)
		.mutation(({ input }) => {
			appStore.set('externalDiffConfig', input);
			return { success: true };
		}),

	issueTrackerConfig: publicProcedure.query(() => {
		return {
			config: appStore.get('issueTrackerConfig'),
		};
	}),

	setIssueTrackerConfig: publicProcedure
		.input(issueTrackerConfigSchema)
		.mutation(({ input }) => {
			appStore.set('issueTrackerConfig', input);
			return { success: true };
		}),

	settings: publicProcedure.query(() => {
		return {
			settings: appStore.get('gitGraphSettings'),
		};
	}),

	setSettings: publicProcedure
		.input(gitGraphSettingsSchema)
		.mutation(({ input }) => {
			appStore.set('gitGraphSettings', input);
			return { success: true };
		}),

	onboardingState: publicProcedure.query(() => {
		return {
			state: appStore.get('onboardingState'),
		};
	}),

	setOnboardingState: publicProcedure
		.input(
			z.object({
				gitGraphCompleted: z.boolean().optional(),
			})
		)
		.mutation(({ input }) => {
			const current = appStore.get('onboardingState');
			appStore.set('onboardingState', { ...current, ...input });
			return { success: true };
		}),

	setKeybindings: publicProcedure
		.input(
			z.object({
				overrides: z.record(z.string(), z.string()),
			})
		)
		.mutation(({ input }) => {
			instanceStore.set('keybindingOverrides', input.overrides);
			return { success: true };
		}),

	/**
	 * Reset all configuration to defaults.
	 */
	reset: publicProcedure.mutation(() => {
		configStore.clear();
		return { success: true };
	}),
});

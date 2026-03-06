/**
 * Electron Store Configuration
 * Provides persistent storage using electron-store
 */

import Store from 'electron-store';

// Schema for app-wide persistent storage
export const appStore = new Store<{
	// Git executable
	lastKnownGitPath: string | null;

	// Pull request provider authentication
	providerAuth: {
		githubToken: string;
		gitlabToken: string;
		bitbucketToken: string;
		bitbucketUsername: string;
		azureToken: string;
	};

	// Global view state
	globalViewState: {
		alwaysAcceptCheckoutCommit: boolean;
		issueLinkingConfig: {
			issue: string;
			url: string;
		} | null;
		pushTagSkipRemoteCheck: boolean;
	};

	// Avatar cache
	avatarCache: Record<string, {
		url: string;
		cacheKey: string;
		timestamp: number;
	}>;

	// AI provider configuration (non-secret metadata)
	aiProviderConfig: {
		enabled: boolean;
		provider: 'openai-compatible' | 'self-host';
		baseUrl: string;
		model: string;
		timeoutMs: number;
		maxTokens: number;
		retries: number;
		redactSensitivePaths: boolean;
		featureToggles: {
			commitMessage: boolean;
			pullRequest: boolean;
			conflictExplain: boolean;
			explainCommit: boolean;
		};
	};
}>({
	name: 'git-graph-config',
	defaults: {
		lastKnownGitPath: null,
		providerAuth: {
			githubToken: '',
			gitlabToken: '',
			bitbucketToken: '',
			bitbucketUsername: '',
			azureToken: '',
		},
		globalViewState: {
			alwaysAcceptCheckoutCommit: false,
			issueLinkingConfig: null,
			pushTagSkipRemoteCheck: false,
		},
		avatarCache: {},
		aiProviderConfig: {
			enabled: false,
			provider: 'openai-compatible',
			baseUrl: '',
			model: 'gpt-4o-mini',
			timeoutMs: 20_000,
			maxTokens: 600,
			retries: 1,
			redactSensitivePaths: true,
			featureToggles: {
				commitMessage: true,
				pullRequest: true,
				conflictExplain: true,
				explainCommit: true,
			},
		},
	},
});

// Instance store for per-instance data (repos, code reviews, etc.)
export const instanceStore = new Store<{
	// Repository states
	repoStates: Record<string, {
		cdvDivider: number;
		cdvHeight: number;
		columnWidths: number[] | null;
		commitOrdering: string;
		fileViewType: string;
		hideRemotes: string[];
		includeCommitsMentionedByReflogs: string;
		issueLinkingConfig: { issue: string; url: string } | null;
		lastImportAt: number;
		name: string | null;
		onlyFollowFirstParent: string;
		onRepoLoadShowCheckedOutBranch: string;
		onRepoLoadShowSpecificBranches: string[] | null;
		pullRequestConfig: Record<string, unknown> | null;
		showRemoteBranches: boolean;
		showRemoteBranchesV2: string;
		showStashes: string;
		showTags: string;
		workspaceFolderIndex: number | null;
	}>;

	// Ignored repositories
	ignoredRepos: string[];

	// Last active repository
	lastActiveRepo: string | null;

	// Code reviews
	codeReviews: Record<string, Record<string, {
		lastActive: number;
		lastViewedFile: string | null;
		remainingFiles: string[];
	}>>;

	// Workspace view state
	workspaceViewState: {
		findIsCaseSensitive: boolean;
		findIsRegex: boolean;
		findOpenCommitDetailsView: boolean;
	};

	// Recently opened repositories (for quick access)
	recentRepos: string[];

	// User-defined workflow engine definitions and run history
	workflowDefinitions: Array<{
		id: string;
		name: string;
		trigger: 'manual' | 'onBranchChange' | 'onCommit' | 'onPush';
		inputs: Array<{ key: string; label: string; required: boolean; defaultValue?: string }>;
		guards: Array<{ type: string; value?: string }>;
		steps: Array<{ id: string; type: string; params: Record<string, unknown> }>;
		onFailure: 'stop' | 'continue' | 'rollback';
		updatedAt: number;
		createdAt: number;
	}>;
	workflowRuns: Array<{
		id: string;
		workflowId: string;
		startedAt: number;
		finishedAt: number | null;
		status: 'running' | 'success' | 'failed';
		steps: Array<{
			id: string;
			type: string;
			status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
			message?: string;
		}>;
		error?: string;
	}>;

	// Branch pinning and launchpad metadata customization
	pinnedBranches: Record<string, string[]>;
	launchpadStatusMap: Record<string, Record<string, { label: string; severity: 'info' | 'warn' | 'error' }>>;

	// Worktree UX view preferences
	worktreeViewPrefs: {
		showLocked: boolean;
		showPrunable: boolean;
		defaultCreateMode: 'existing' | 'new-branch' | 'detached' | 'ephemeral-review';
		pathPresetRoot: string | null;
		lastSelectedBranch: string | null;
	};

	// Workspace persistence (migrated from renderer localStorage)
	workspaces: Array<{
		id: string;
		name: string;
		color: string;
		repos: Array<{
			path: string;
			name: string;
			lastOpened?: number;
			isFavorite?: boolean;
		}>;
		createdAt: number;
		updatedAt: number;
	}>;

	// User keybinding overrides by action id
	keybindingOverrides: Record<string, string>;
}>({
	name: 'git-graph-instance',
	defaults: {
		repoStates: {},
		ignoredRepos: [],
		lastActiveRepo: null,
		codeReviews: {},
		workspaceViewState: {
			findIsCaseSensitive: false,
			findIsRegex: false,
			findOpenCommitDetailsView: false,
		},
		recentRepos: [],
		workflowDefinitions: [],
		workflowRuns: [],
		pinnedBranches: {},
		launchpadStatusMap: {},
		worktreeViewPrefs: {
			showLocked: true,
			showPrunable: true,
			defaultCreateMode: 'existing',
			pathPresetRoot: null,
			lastSelectedBranch: null,
		},
		workspaces: [],
		keybindingOverrides: {},
	},
});

// Config store for user preferences
export const configStore = new Store<{
	// Graph settings
	graph: {
		colours: string[];
		style: 'rounded' | 'angular';
		uncommittedChanges: 'openCircleAtUncommittedChanges' | 'openCircleAtCheckedOutCommit';
	};

	// Date settings
	date: {
		format: 'dateAndTime' | 'dateOnly' | 'relative' | 'isoDateAndTime' | 'isoDateOnly';
		type: 'author' | 'commit';
	};

	// Repository settings
	repository: {
		initialLoadCommits: number;
		loadMoreCommits: number;
		loadMoreCommitsAutomatically: boolean;
		showRemoteBranches: boolean;
		showStashes: boolean;
		showTags: boolean;
		showUncommittedChanges: boolean;
		showUntrackedFiles: boolean;
		muteMergeCommits: boolean;
		onlyFollowFirstParent: boolean;
		fetchAndPrune: boolean;
		useMailmap: boolean;
	};

	// Dialog defaults
	dialog: {
		resetCommitMode: 'soft' | 'mixed' | 'hard';
		resetUncommittedMode: 'soft' | 'mixed' | 'hard';
		deleteBranchForce: boolean;
		createBranchCheckout: boolean;
		mergeNoFastForward: boolean;
		mergeSquash: boolean;
		rebaseInteractive: boolean;
		addTagPushToRemote: boolean;
		addTagType: 'annotated' | 'lightweight';
		stashIncludeUntracked: boolean;
	};

	// UI settings
	ui: {
		enhancedAccessibility: boolean;
		markdown: boolean;
		tabIconColourTheme: 'colour' | 'grey';
		featureFlags: {
			worktreePro: boolean;
			workflowEngine: boolean;
			graphiteInterop: boolean;
			aiProd: boolean;
			deepLinks: boolean;
			branchPinning: boolean;
		};
	};

	// File encoding
	fileEncoding: string;
}>({
	name: 'git-graph-preferences',
	defaults: {
		graph: {
			colours: ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00'],
			style: 'rounded',
			uncommittedChanges: 'openCircleAtUncommittedChanges',
		},
		date: {
			format: 'dateAndTime',
			type: 'author',
		},
		repository: {
			initialLoadCommits: 300,
			loadMoreCommits: 100,
			loadMoreCommitsAutomatically: true,
			showRemoteBranches: true,
			showStashes: true,
			showTags: true,
			showUncommittedChanges: true,
			showUntrackedFiles: true,
			muteMergeCommits: true,
			onlyFollowFirstParent: false,
			fetchAndPrune: false,
			useMailmap: false,
		},
		dialog: {
			resetCommitMode: 'mixed',
			resetUncommittedMode: 'mixed',
			deleteBranchForce: false,
			createBranchCheckout: false,
			mergeNoFastForward: true,
			mergeSquash: false,
			rebaseInteractive: false,
			addTagPushToRemote: false,
			addTagType: 'annotated',
			stashIncludeUntracked: true,
		},
		ui: {
			enhancedAccessibility: false,
			markdown: true,
			tabIconColourTheme: 'colour',
			featureFlags: {
				worktreePro: true,
				workflowEngine: true,
				graphiteInterop: false,
				aiProd: false,
				deepLinks: true,
				branchPinning: true,
			},
		},
		fileEncoding: 'utf8',
	},
});

export type AppStoreType = typeof appStore;
export type InstanceStoreType = typeof instanceStore;
export type ConfigStoreType = typeof configStore;

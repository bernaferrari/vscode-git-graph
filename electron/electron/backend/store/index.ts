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

	// Encrypted secrets managed outside the plain app store values
	secretVault: {
		version: 1;
		entries: Record<string, string>;
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
			reviewDiff: boolean;
		};
	};

	collaborationSyncConfig: {
		enabled: boolean;
		provider: 'self-host';
		endpointUrl: string;
		projectId: string;
		authToken: string;
		memberId: string;
		memberApiKey: string;
		displayName: string;
		email: string;
		role: 'developer' | 'reviewer' | 'lead' | 'qa';
		permissionLevel: 'owner' | 'manager' | 'member' | 'observer';
		organizationId: string;
		organizationName: string;
		teamId: string;
		teamName: string;
		avatarUrl: string;
		deviceLabel: string;
		presenceEnabled: boolean;
		liveSyncEnabled: boolean;
		realtimeEnabled: boolean;
		timeoutMs: number;
		autoSyncOnOpen: boolean;
		lastSyncedAt: number | null;
		lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
		lastSyncError: string | null;
	};

	commitTemplates: Array<{
		id: string;
		name: string;
		description?: string;
		content: string;
		isDefault?: boolean;
	}>;
	externalDiffConfig: {
		tools: Array<{
			id: string;
			name: string;
			command: string;
			args: string;
			supports3Way: boolean;
			supportsDirDiff: boolean;
			icon?: string;
		}>;
		selectedTool: string;
		useForMergeConflicts: boolean;
	};
	issueTrackerConfig: {
		providers: Record<string, {
			enabled: boolean;
			apiKey?: string;
			domain?: string;
			projectKey?: string;
		}>;
		autoDetect: boolean;
		patterns: string[];
	};
	customCommands: Array<{
		id: string;
		name: string;
		command: string;
		description?: string;
		alias?: string;
		lastUsed?: number;
		useCount: number;
	}>;
	gitGraphSettings: {
		confirmDestructiveActions: boolean;
		autoFetchInterval: number;
		checkForUpdates: boolean;
		launchAtStartup: boolean;
		lensMode: 'guided' | 'craft' | 'control';
		theme: 'light' | 'dark' | 'system';
		graphTheme: 'default' | 'colorful' | 'minimal';
		commitMessageLength: number;
		showAvatars: boolean;
		showRelativeDates: boolean;
		dateFormat: 'relative' | 'iso' | 'locale';
		enhancedAccessibility: boolean;
		commitTemplate: string;
		autoSignCommits: boolean;
		defaultBranch: string;
		mergeTool: string;
		notifyOnPush: boolean;
		notifyOnPull: boolean;
		notifyOnMerge: boolean;
		soundEnabled: boolean;
		maxCommits: number;
		enableVirtualization: boolean;
		lazyLoadImages: boolean;
		telemetryEnabled: boolean;
		crashReports: boolean;
	};
	onboardingState: {
		gitGraphCompleted: boolean;
		lensOnboardingSeen: boolean;
	};
	notificationCenter: {
		notifications: Array<{
			id: string;
			type: 'info' | 'success' | 'warning' | 'error';
			title: string;
			message?: string;
			timestamp: number;
			read: boolean;
			actionId?: string;
			actionLabel?: string;
		}>;
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
		secretVault: {
			version: 1,
			entries: {},
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
				reviewDiff: true,
			},
		},
		collaborationSyncConfig: {
			enabled: false,
			provider: 'self-host',
			endpointUrl: '',
			projectId: 'default',
			authToken: '',
			memberId: '',
			memberApiKey: '',
			displayName: '',
			email: '',
			role: 'developer',
			permissionLevel: 'member',
			organizationId: '',
			organizationName: '',
			teamId: '',
			teamName: '',
			avatarUrl: '',
			deviceLabel: 'desktop',
			presenceEnabled: true,
			liveSyncEnabled: true,
			realtimeEnabled: true,
			timeoutMs: 15_000,
			autoSyncOnOpen: false,
			lastSyncedAt: null,
			lastSyncStatus: 'idle',
			lastSyncError: null,
		},
		commitTemplates: [],
		externalDiffConfig: {
			tools: [],
			selectedTool: 'vscode',
			useForMergeConflicts: false,
		},
		issueTrackerConfig: {
			providers: {},
			autoDetect: true,
			patterns: [],
		},
		customCommands: [],
		gitGraphSettings: {
			confirmDestructiveActions: true,
			autoFetchInterval: 5,
			checkForUpdates: true,
			launchAtStartup: false,
			lensMode: 'craft',
			theme: 'system',
			graphTheme: 'default',
			commitMessageLength: 72,
			showAvatars: true,
			showRelativeDates: true,
			dateFormat: 'relative',
			enhancedAccessibility: false,
			commitTemplate: '',
			autoSignCommits: false,
			defaultBranch: 'main',
			mergeTool: '',
			notifyOnPush: true,
			notifyOnPull: true,
			notifyOnMerge: true,
			soundEnabled: false,
			maxCommits: 1000,
			enableVirtualization: true,
			lazyLoadImages: true,
			telemetryEnabled: false,
			crashReports: true,
		},
		onboardingState: {
			gitGraphCompleted: false,
			lensOnboardingSeen: false,
		},
		notificationCenter: {
			notifications: [],
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

	// Repository policy controls for guardrails and workflow guidance
	repoPolicies: Record<string, {
		repoPath: string;
		requireSignedCommits: boolean;
		allowedMergeStrategies: Array<'merge' | 'rebase' | 'squash'>;
		requireUpToDate: boolean;
		enableStacking: boolean;
		defaultStackBase: string;
		customWorkflow: string;
	}>;

	// Persistent audit timeline for high-risk and collaborative actions
	auditLog: Array<{
		id: string;
		timestamp: number;
		scope: 'git' | 'review' | 'system' | 'policy';
		action: string;
		repo: string | null;
		status: 'success' | 'failed' | 'info';
		summary: string;
		details?: string;
		metadata?: Record<string, unknown>;
	}>;

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
	collaborationWorkspaceShares: Array<{
		id: string;
		workspaceId: string;
		name: string;
		note: string;
		createdAt: number;
		updatedAt: number;
		repos: Array<{
			path: string;
			name: string;
			head: string | null;
			headSha: string | null;
			lastCommitAt: number | null;
			dirtyCount: number;
			openPullRequests: number | null;
			needsAttention: boolean;
			deepLink: string;
		}>;
	}>;
	collaborationPatchShelf: Array<{
		id: string;
		repo: string;
		name: string;
		baseRef: string;
		headRef: string;
		summary: string;
		patch: string;
		fileCount: number;
		additions: number;
		deletions: number;
		createdAt: number;
	}>;
	collaborationComments: Array<{
		id: string;
		targetType: 'workspace-share' | 'patch-share' | 'pull-request' | 'pull-request-file';
		targetId: string;
		author: string;
		body: string;
		createdAt: number;
		updatedAt: number;
		providerSync?: {
			status: 'pending' | 'synced' | 'failed';
			provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
			remoteCommentId?: string;
			remoteThreadId?: string;
			remoteThreadStatus?: 'open' | 'resolved';
			remoteUrl?: string;
			syncedAt?: number;
			error?: string;
		};
	}>;
	collaborationAssignments: Array<{
		id: string;
		targetType: 'workspace-share' | 'patch-share' | 'pull-request' | 'pull-request-file';
		targetId: string;
		assigneeId: string;
		assigneeName: string;
		status: 'open' | 'in-progress' | 'done' | 'blocked';
		note: string;
		createdAt: number;
		updatedAt: number;
		createdBy: string;
		providerSync?: {
			provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
			reviewerId: string;
			reviewerName: string;
			reviewerStatus: 'requested' | 'commented' | 'approved' | 'changes-requested' | 'waiting';
			providerState?: string;
			syncedAt: number;
		};
	}>;
	collaborationActivity: Array<{
		id: string;
		timestamp: number;
		type: 'workspace-share' | 'patch-share' | 'bundle-export' | 'bundle-import' | 'remote-sync' | 'comment' | 'assignment';
		action: 'created' | 'deleted' | 'exported' | 'imported' | 'pushed' | 'pulled' | 'roundtrip' | 'failed' | 'updated';
		status: 'success' | 'failed' | 'info';
		title: string;
		description?: string;
		metadata?: Record<string, unknown>;
		actor?: string;
	}>;
	commitFiltersByRepo: Record<string, {
		author?: string;
		filePath?: string;
		search?: string;
		dateFrom?: string;
		dateTo?: string;
	}>;
	pinnedCommitsByRepo: Record<string, Array<{
		hash: string;
		message: string;
		author: string;
		date: string;
		branch?: string;
		pinnedAt: number;
		note?: string;
	}>>;
	recentRepoDetails: Array<{
		path: string;
		name: string;
		lastOpened: number;
		openCount: number;
		pinned: boolean;
		currentBranch?: string;
	}>;
	appShellState: {
		sidebarOpen: boolean;
		repoNavMode: 'sidebar' | 'tabs';
		openedRepos: string[];
	};
	undoHistoryByRepo: Record<string, {
		operations: Array<{
			id: string;
			type: string;
			timestamp: number;
			description: string;
			details: Record<string, unknown>;
			undoable: boolean;
			undone?: boolean;
			reflogEntry?: string;
		}>;
		currentIndex: number;
	}>;

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
		repoPolicies: {},
		auditLog: [],
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
			collaborationWorkspaceShares: [],
			collaborationPatchShelf: [],
			collaborationComments: [],
			collaborationAssignments: [],
			collaborationActivity: [],
			commitFiltersByRepo: {},
			pinnedCommitsByRepo: {},
		recentRepoDetails: [],
		appShellState: {
			sidebarOpen: true,
			repoNavMode: 'sidebar',
			openedRepos: [],
		},
		undoHistoryByRepo: {},
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

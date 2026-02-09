/**
 * Configuration Types
 * Ported from git-graph/src/types.ts
 */

import { GitResetMode, TagType } from './git';

// ==================== Boolean Override ====================

export enum BooleanOverride {
	Default = 'default',
	Enabled = 'enabled',
	Disabled = 'disabled',
}

// ==================== Date Types ====================

export enum DateFormatType {
	DateAndTime = 'date-time',
	DateOnly = 'date-only',
	Relative = 'relative',
}

export enum DateType {
	Author = 'author',
	Commit = 'commit',
}

export interface DateFormat {
	readonly type: DateFormatType;
	readonly iso: boolean;
}

// ==================== Column Types ====================

export type ColumnWidth = number;

export interface DefaultColumnVisibility {
	readonly date: boolean;
	readonly author: boolean;
	readonly commit: boolean;
}

// ==================== Commit Ordering ====================

export enum CommitOrdering {
	Date = 'date',
	AuthorDate = 'author-date',
	Topological = 'topo',
}

export enum RepoCommitOrdering {
	Default = 'default',
	Date = 'date',
	AuthorDate = 'author-date',
	Topological = 'topo',
}

// ==================== View Types ====================

export enum FileViewType {
	Default = 'default',
	Tree = 'tree',
	List = 'list',
}

export enum CommitDetailsViewLocation {
	Inline = 'inline',
	DockedToBottom = 'docked-to-bottom',
}

export enum RepoDropdownOrder {
	FullPath = 'full-path',
	Name = 'name',
	WorkspaceFullPath = 'workspace-full-path',
}

// ==================== Graph Types ====================

export enum GraphStyle {
	Rounded = 'rounded',
	Angular = 'angular',
}

export enum GraphUncommittedChangesStyle {
	OpenCircleAtTheUncommittedChanges = 'open-circle-uncommitted',
	OpenCircleAtTheCheckedOutCommit = 'open-circle-checked-out',
}

export interface GraphConfig {
	readonly colours: ReadonlyArray<string>;
	readonly style: GraphStyle;
	readonly grid: { x: number; y: number; offsetX: number; offsetY: number; expandY: number };
	readonly uncommittedChanges: GraphUncommittedChangesStyle;
}

export interface MuteCommitsConfig {
	readonly commitsNotAncestorsOfHead: boolean;
	readonly mergeCommits: boolean;
}

// ==================== Reference Labels ====================

export enum RefLabelAlignment {
	Normal = 'normal',
	BranchesOnLeftAndTagsOnRight = 'branches-left-tags-right',
	BranchesAlignedToGraphAndTagsOnRight = 'branches-graph-tags-right',
}

export interface ReferenceLabelsConfig {
	readonly branchLabelsAlignedToGraph: boolean;
	readonly combineLocalAndRemoteBranchLabels: boolean;
	readonly tagLabelsOnRight: boolean;
}

// ==================== Keybindings ====================

export interface KeybindingConfig {
	readonly find: string | null;
	readonly refresh: string | null;
	readonly scrollToHead: string | null;
	readonly scrollToStash: string | null;
}

// ==================== Dialog Defaults ====================

export interface DialogDefaults {
	readonly addTag: {
		readonly pushToRemote: boolean;
		readonly type: TagType;
	};
	readonly applyStash: {
		readonly reinstateIndex: boolean;
	};
	readonly cherryPick: {
		readonly noCommit: boolean;
		readonly recordOrigin: boolean;
	};
	readonly createBranch: {
		readonly checkout: boolean;
	};
	readonly deleteBranch: {
		readonly forceDelete: boolean;
	};
	readonly fetchIntoLocalBranch: {
		readonly forceFetch: boolean;
	};
	readonly fetchRemote: {
		readonly prune: boolean;
		readonly pruneTags: boolean;
	};
	readonly general: {
		readonly referenceInputSpaceSubstitution: string | null;
	};
	readonly merge: {
		readonly noCommit: boolean;
		readonly noFastForward: boolean;
		readonly squash: boolean;
	};
	readonly popStash: {
		readonly reinstateIndex: boolean;
	};
	readonly pullBranch: {
		readonly noFastForward: boolean;
		readonly squash: boolean;
	};
	readonly rebase: {
		readonly ignoreDate: boolean;
		readonly interactive: boolean;
	};
	readonly resetCommit: {
		readonly mode: GitResetMode;
	};
	readonly resetUncommitted: {
		readonly mode: Exclude<GitResetMode, GitResetMode.Soft>;
	};
	readonly stashUncommittedChanges: {
		readonly includeUntracked: boolean;
	};
}

// ==================== Custom Config ====================

export interface CustomBranchGlobPattern {
	readonly name: string;
	readonly glob: string;
}

export interface CustomEmojiShortcodeMapping {
	readonly shortcode: string;
	readonly emoji: string;
}

export interface CustomPullRequestProvider {
	readonly name: string;
	readonly templateUrl: string;
}

// ==================== Context Menu ====================

export interface ContextMenuActionsVisibility {
	readonly branch: {
		readonly checkout: boolean;
		readonly rename: boolean;
		readonly delete: boolean;
		readonly merge: boolean;
		readonly rebase: boolean;
		readonly push: boolean;
		readonly viewIssue: boolean;
		readonly createPullRequest: boolean;
		readonly createArchive: boolean;
		readonly selectInBranchesDropdown: boolean;
		readonly unselectInBranchesDropdown: boolean;
		readonly copyName: boolean;
	};
	readonly commit: {
		readonly addTag: boolean;
		readonly createBranch: boolean;
		readonly checkout: boolean;
		readonly cherrypick: boolean;
		readonly revert: boolean;
		readonly drop: boolean;
		readonly merge: boolean;
		readonly rebase: boolean;
		readonly reset: boolean;
		readonly copyHash: boolean;
		readonly copySubject: boolean;
	};
	readonly commitDetailsViewFile: {
		readonly viewDiff: boolean;
		readonly viewFileAtThisRevision: boolean;
		readonly viewDiffWithWorkingFile: boolean;
		readonly openFile: boolean;
		readonly markAsReviewed: boolean;
		readonly markAsNotReviewed: boolean;
		readonly resetFileToThisRevision: boolean;
		readonly copyAbsoluteFilePath: boolean;
		readonly copyRelativeFilePath: boolean;
	};
	readonly remoteBranch: {
		readonly checkout: boolean;
		readonly delete: boolean;
		readonly fetch: boolean;
		readonly merge: boolean;
		readonly pull: boolean;
		readonly viewIssue: boolean;
		readonly createPullRequest: boolean;
		readonly createArchive: boolean;
		readonly selectInBranchesDropdown: boolean;
		readonly unselectInBranchesDropdown: boolean;
		readonly copyName: boolean;
	};
	readonly stash: {
		readonly apply: boolean;
		readonly createBranch: boolean;
		readonly pop: boolean;
		readonly drop: boolean;
		readonly copyName: boolean;
		readonly copyHash: boolean;
	};
	readonly tag: {
		readonly viewDetails: boolean;
		readonly delete: boolean;
		readonly push: boolean;
		readonly createArchive: boolean;
		readonly copyName: boolean;
	};
	readonly uncommittedChanges: {
		readonly stash: boolean;
		readonly reset: boolean;
		readonly clean: boolean;
		readonly openSourceControlView: boolean;
	};
}

// ==================== Main Config ====================

export interface CommitDetailsViewConfig {
	readonly autoCenter: boolean;
	readonly fileTreeCompactFolders: boolean;
	readonly fileViewType: FileViewType;
	readonly location: CommitDetailsViewLocation;
}

export interface OnRepoLoadConfig {
	readonly scrollToHead: boolean;
	readonly showCheckedOutBranch: boolean;
	readonly showSpecificBranches: ReadonlyArray<string>;
}

export interface GitGraphViewConfig {
	readonly commitDetailsView: CommitDetailsViewConfig;
	readonly commitOrdering: CommitOrdering;
	readonly contextMenuActionsVisibility: ContextMenuActionsVisibility;
	readonly customBranchGlobPatterns: ReadonlyArray<CustomBranchGlobPattern>;
	readonly customEmojiShortcodeMappings: ReadonlyArray<CustomEmojiShortcodeMapping>;
	readonly customPullRequestProviders: ReadonlyArray<CustomPullRequestProvider>;
	readonly dateFormat: DateFormat;
	readonly defaultColumnVisibility: DefaultColumnVisibility;
	readonly dialogDefaults: DialogDefaults;
	readonly enhancedAccessibility: boolean;
	readonly fetchAndPrune: boolean;
	readonly fetchAndPruneTags: boolean;
	readonly fetchAvatars: boolean;
	readonly graph: GraphConfig;
	readonly includeCommitsMentionedByReflogs: boolean;
	readonly initialLoadCommits: number;
	readonly keybindings: KeybindingConfig;
	readonly loadMoreCommits: number;
	readonly loadMoreCommitsAutomatically: boolean;
	readonly markdown: boolean;
	readonly mute: MuteCommitsConfig;
	readonly onlyFollowFirstParent: boolean;
	readonly onRepoLoad: OnRepoLoadConfig;
	readonly referenceLabels: ReferenceLabelsConfig;
	readonly repoDropdownOrder: RepoDropdownOrder;
	readonly showRemoteBranches: boolean;
	readonly showStashes: boolean;
	readonly showTags: boolean;
}

// ==================== Default Config ====================

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
	colours: [
		'#0085d9',
		'#d9008f',
		'#00d90a',
		'#d98500',
		'#a300d9',
		'#ff0000',
		'#00d9cc',
		'#e138e8',
		'#85d900',
		'#dc5b23',
		'#6f24d6',
		'#ffcc00',
	],
	style: GraphStyle.Rounded,
	grid: { x: 10, y: 24, offsetX: 24, offsetY: 24, expandY: 0 },
	uncommittedChanges: GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges,
};

export const DEFAULT_MUTE_CONFIG: MuteCommitsConfig = {
	commitsNotAncestorsOfHead: false,
	mergeCommits: true,
};

export const DEFAULT_DIALOG_DEFAULTS: DialogDefaults = {
	addTag: {
		pushToRemote: false,
		type: TagType.Annotated,
	},
	applyStash: {
		reinstateIndex: false,
	},
	cherryPick: {
		noCommit: false,
		recordOrigin: false,
	},
	createBranch: {
		checkout: false,
	},
	deleteBranch: {
		forceDelete: false,
	},
	fetchIntoLocalBranch: {
		forceFetch: false,
	},
	fetchRemote: {
		prune: false,
		pruneTags: false,
	},
	general: {
		referenceInputSpaceSubstitution: null,
	},
	merge: {
		noCommit: false,
		noFastForward: true,
		squash: false,
	},
	popStash: {
		reinstateIndex: false,
	},
	pullBranch: {
		noFastForward: false,
		squash: false,
	},
	rebase: {
		ignoreDate: true,
		interactive: false,
	},
	resetCommit: {
		mode: GitResetMode.Mixed,
	},
	resetUncommitted: {
		mode: GitResetMode.Mixed,
	},
	stashUncommittedChanges: {
		includeUntracked: true,
	},
};

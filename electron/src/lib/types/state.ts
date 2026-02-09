/**
 * State Management Types
 * Ported from git-graph/src/types.ts
 */

import { BooleanOverride, type ColumnWidth, RepoCommitOrdering, FileViewType } from './config';

// ==================== Code Review ====================

export interface CodeReview {
	id: string;
	lastActive: number;
	lastViewedFile: string | null;
	remainingFiles: string[];
}

export type CodeReviews = Record<string, CodeReview>;

// ==================== Repository State ====================

export interface IssueLinkingConfig {
	readonly issue: string;
	readonly url: string;
}

export enum PullRequestProvider {
	Bitbucket = 'bitbucket',
	Custom = 'custom',
	GitHub = 'github',
	GitLab = 'gitlab',
}

interface PullRequestConfigBase {
	readonly hostRootUrl: string;
	readonly sourceRemote: string;
	readonly sourceOwner: string;
	readonly sourceRepo: string;
	readonly destRemote: string | null;
	readonly destOwner: string;
	readonly destRepo: string;
	readonly destProjectId: string;
	readonly destBranch: string;
}

interface PullRequestConfigBuiltIn extends PullRequestConfigBase {
	readonly provider: Exclude<PullRequestProvider, PullRequestProvider.Custom>;
	readonly custom: null;
}

interface PullRequestConfigCustom extends PullRequestConfigBase {
	readonly provider: PullRequestProvider.Custom;
	readonly custom: {
		readonly name: string;
		readonly templateUrl: string;
	};
}

export type PullRequestConfig = PullRequestConfigBuiltIn | PullRequestConfigCustom;

export interface GitRepoState {
	cdvDivider: number;
	cdvHeight: number;
	columnWidths: ColumnWidth[] | null;
	commitOrdering: RepoCommitOrdering;
	fileViewType: FileViewType;
	hideRemotes: string[];
	includeCommitsMentionedByReflogs: BooleanOverride;
	issueLinkingConfig: IssueLinkingConfig | null;
	lastImportAt: number;
	name: string | null;
	onlyFollowFirstParent: BooleanOverride;
	onRepoLoadShowCheckedOutBranch: BooleanOverride;
	onRepoLoadShowSpecificBranches: string[] | null;
	pullRequestConfig: PullRequestConfig | null;
	showRemoteBranches: boolean;
	showRemoteBranchesV2: BooleanOverride;
	showStashes: BooleanOverride;
	showTags: BooleanOverride;
	workspaceFolderIndex: number | null;
}

export type GitRepoSet = Record<string, GitRepoState>;

// ==================== View State ====================

export interface GitGraphViewGlobalState {
	alwaysAcceptCheckoutCommit: boolean;
	issueLinkingConfig: IssueLinkingConfig | null;
	pushTagSkipRemoteCheck: boolean;
}

export interface GitGraphViewWorkspaceState {
	findIsCaseSensitive: boolean;
	findIsRegex: boolean;
	findOpenCommitDetailsView: boolean;
}

export type LoadGitGraphViewTo = {
	readonly repo: string;
	readonly commitDetails?: {
		readonly commitHash: string;
		readonly compareWithHash: string | null;
	};
	readonly runCommandOnLoad?: 'fetch';
} | null;

// ==================== Repository Info ====================

export interface GitRepo {
	path: string;
	name: string | null;
	showRemoteBranchesV2: BooleanOverride;
	workspaceFolderIndex: number | null;
}

export type GitRepos = Record<string, GitRepo>;

// ==================== Initial State ====================

export interface GitGraphViewInitialState {
	readonly config: import('./config').GitGraphViewConfig;
	readonly lastActiveRepo: string | null;
	readonly loadViewTo: LoadGitGraphViewTo;
	readonly repos: GitRepos;
	readonly loadRepoInfoRefreshId: number;
	readonly loadCommitsRefreshId: number;
}

// ==================== Default State ====================

export const DEFAULT_REPO_STATE: Omit<GitRepoState, 'lastImportAt'> = {
	cdvDivider: 0.5,
	cdvHeight: 200,
	columnWidths: null,
	commitOrdering: RepoCommitOrdering.Default,
	fileViewType: FileViewType.Default,
	hideRemotes: [],
	includeCommitsMentionedByReflogs: BooleanOverride.Default,
	issueLinkingConfig: null,
	name: null,
	onlyFollowFirstParent: BooleanOverride.Default,
	onRepoLoadShowCheckedOutBranch: BooleanOverride.Default,
	onRepoLoadShowSpecificBranches: null,
	pullRequestConfig: null,
	showRemoteBranches: true,
	showRemoteBranchesV2: BooleanOverride.Default,
	showStashes: BooleanOverride.Default,
	showTags: BooleanOverride.Default,
	workspaceFolderIndex: null,
};

export const DEFAULT_GLOBAL_STATE: GitGraphViewGlobalState = {
	alwaysAcceptCheckoutCommit: false,
	issueLinkingConfig: null,
	pushTagSkipRemoteCheck: false,
};

export const DEFAULT_WORKSPACE_STATE: GitGraphViewWorkspaceState = {
	findIsCaseSensitive: false,
	findIsRegex: false,
	findOpenCommitDetailsView: false,
};

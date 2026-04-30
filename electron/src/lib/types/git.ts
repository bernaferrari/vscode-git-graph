/**
 * Core Git Types
 * Ported from git-graph/src/types.ts
 */

// ==================== Commit Types ====================

export interface GitCommit {
	readonly hash: string;
	readonly parents: ReadonlyArray<string>;
	readonly author: string;
	readonly email: string;
	readonly date: number;
	readonly message: string;
	readonly heads: ReadonlyArray<string>;
	readonly tags: ReadonlyArray<GitCommitTag>;
	readonly remotes: ReadonlyArray<GitCommitRemote>;
	readonly stash: GitCommitStash | null;
}

export interface GitCommitTag {
	readonly name: string;
	readonly annotated: boolean;
}

export interface GitCommitRemote {
	readonly name: string;
	readonly remote: string | null;
}

export interface GitCommitStash {
	readonly selector: string;
	readonly baseHash: string;
	readonly untrackedFilesHash: string | null;
}

export interface GitCommitDetails {
	readonly hash: string;
	readonly parents: ReadonlyArray<string>;
	readonly author: string;
	readonly authorEmail: string;
	readonly authorDate: number;
	readonly committer: string;
	readonly committerEmail: string;
	readonly committerDate: number;
	readonly signature: GitSignature | null;
	readonly body: string;
	readonly fileChanges: ReadonlyArray<GitFileChange>;
}

// ==================== Signature Types ====================

export enum GitSignatureStatus {
	GoodAndValid = 'G',
	GoodWithUnknownValidity = 'U',
	GoodButExpired = 'X',
	GoodButMadeByExpiredKey = 'Y',
	GoodButMadeByRevokedKey = 'R',
	CannotBeChecked = 'E',
	Bad = 'B',
}

export interface GitSignature {
	readonly key: string;
	readonly signer: string;
	readonly status: GitSignatureStatus;
}

// ==================== File Change Types ====================

export enum GitFileStatus {
	Added = 'A',
	Modified = 'M',
	Deleted = 'D',
	Renamed = 'R',
	Untracked = 'U',
}

export interface GitFileChange {
	readonly oldFilePath: string;
	readonly newFilePath: string;
	readonly type: GitFileStatus;
	readonly additions: number | null;
	readonly deletions: number | null;
}

// ==================== Stash Types ====================

export interface GitStash {
	readonly hash: string;
	readonly baseHash: string;
	readonly untrackedFilesHash: string | null;
	readonly selector: string;
	readonly author: string;
	readonly email: string;
	readonly date: number;
	readonly message: string;
}

// ==================== Tag Types ====================

export enum TagType {
	Annotated = 'annotated',
	Lightweight = 'lightweight',
}

export interface GitTagDetails {
	readonly hash: string;
	readonly taggerName: string;
	readonly taggerEmail: string;
	readonly taggerDate: number;
	readonly message: string;
	readonly signature: GitSignature | null;
}

// ==================== Branch Types ====================

export enum GitPushBranchMode {
	Normal = '',
	Force = 'force',
	ForceWithLease = 'force-with-lease',
}

// ==================== Repository Types ====================

export enum GitConfigLocation {
	Local = 'local',
	Global = 'global',
	System = 'system',
}

export interface GitRepoConfig {
	readonly branches: GitRepoConfigBranches;
	readonly diffTool: string | null;
	readonly guiDiffTool: string | null;
	readonly pushDefault: string | null;
	readonly remotes: ReadonlyArray<GitRepoSettingsRemote>;
	readonly user: {
		readonly name: {
			readonly local: string | null;
			readonly global: string | null;
		};
		readonly email: {
			readonly local: string | null;
			readonly global: string | null;
		};
	};
}

export type GitRepoConfigBranches = Record<string, GitRepoConfigBranch>;

export interface GitRepoConfigBranch {
	readonly pushRemote: string | null;
	readonly remote: string | null;
}

export interface GitRepoSettingsRemote {
	readonly name: string;
	readonly url: string | null;
	readonly pushUrl: string | null;
}

// ==================== Action Types ====================

export enum GitResetMode {
	Soft = 'soft',
	Mixed = 'mixed',
	Hard = 'hard',
}

export enum MergeActionOn {
	Branch = 'Branch',
	RemoteTrackingBranch = 'Remote-tracking Branch',
	Commit = 'Commit',
}

export enum RebaseActionOn {
	Branch = 'Branch',
	Commit = 'Commit',
}

export enum SquashMessageFormat {
	Default = 'default',
	GitSquashMsg = 'git-squash-msg',
}

// ==================== Constants ====================

export const UNCOMMITTED = 'UNCOMMITTED';

// eslint-disable-next-line no-secrets/no-secrets
export const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

// ==================== Internal Data Types ====================

export interface GitRepoInfo {
	branches: ReadonlyArray<string>;
	head: string | null;
	remotes: ReadonlyArray<string>;
	stashes: ReadonlyArray<GitStash>;
	error: string | null;
}

export interface GitCommitData {
	commits: GitCommit[];
	head: string | null;
	tags: string[];
	moreCommitsAvailable: boolean;
	onlyFollowFirstParent: boolean;
	error: string | null;
}

export interface GitRefData {
	head: string | null;
	heads: string[];
	tags: string[];
	remotes: string[];
}

// ==================== Helper Types ====================

type PrimitiveTypes = string | number | boolean | symbol | bigint | undefined | null;

export type Writeable<T> = { -readonly [K in keyof T]: T[K] };

export type DeepReadonly<T> = T extends PrimitiveTypes
	? T
	: T extends Array<infer U> | ReadonlyArray<infer U>
		? ReadonlyArray<DeepReadonly<U>>
		: { readonly [K in keyof T]: DeepReadonly<T[K]> };

export type DeepWriteable<T> = T extends PrimitiveTypes
	? T
	: T extends Array<infer U> | ReadonlyArray<infer U>
		? Array<DeepWriteable<U>>
		: { -readonly [K in keyof T]: DeepWriteable<T[K]> };

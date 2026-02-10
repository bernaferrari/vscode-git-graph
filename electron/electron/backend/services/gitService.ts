/**
 * Git Service - Core Git Operations
 * Ported from git-graph/src/dataSource.ts
 *
 * This service provides low-level Git operations that can be used by tRPC routers.
 */

import * as cp from 'child_process';
import { decode, encodingExists } from 'iconv-lite';
import type { GitExecutable } from './gitExecutable';
import { doesVersionMeetRequirement, GitVersionRequirement } from './gitExecutable';

// ==================== Constants ====================

export const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';
export const UNCOMMITTED = '*';

const EOL_REGEX = /\r\n|\r|\n/g;
const INVALID_BRANCH_REGEXP = /^\(.* .*\)$/;
const REMOTE_HEAD_BRANCH_REGEXP = /^remotes\/.*\/HEAD$/;

// ==================== Types ====================

export interface GitServiceConfig {
	dateType: 'author' | 'commit';
	showSignatureStatus: boolean;
	useMailmap: boolean;
	fileEncoding: string;
	signCommits: boolean;
	signTags: boolean;
	showUncommittedChanges: boolean;
}

export interface GitBranchData {
	branches: string[];
	head: string | null;
}

export interface GitRefData {
	head: string | null;
	heads: Array<{ hash: string; name: string }>;
	tags: Array<{ hash: string; name: string; annotated: boolean }>;
	remotes: Array<{ hash: string; name: string }>;
}

export interface DiffNameStatusRecord {
	type: string;
	oldFilePath: string;
	newFilePath: string;
}

export interface DiffNumStatRecord {
	filePath: string;
	additions: number;
	deletions: number;
}

// ==================== GPG Status Parsing ====================

// Reserved for future GPG signature parsing
// const GPG_STATUS_CODE_PARSING_DETAILS: Record<string, { status: string; uid: boolean }> = {
// 	GOODSIG: { status: 'G', uid: true },
// 	BADSIG: { status: 'B', uid: true },
// 	ERRSIG: { status: 'E', uid: false },
// 	EXPSIG: { status: 'X', uid: true },
// 	EXPKEYSIG: { status: 'Y', uid: true },
// 	REVKEYSIG: { status: 'R', uid: true },
// };

// ==================== Git Service Class ====================

export class GitService {
	private gitExecutable: GitExecutable | null = null;
	private gitFormatCommitDetails!: string;
	private gitFormatLog!: string;
	private gitFormatStash!: string;

	constructor(
		private readonly config: GitServiceConfig
	) {
		this.updateFormatStrings();
	}

	/**
	 * Set the Git executable to use.
	 */
	setGitExecutable(executable: GitExecutable | null): void {
		this.gitExecutable = executable;
		this.updateFormatStrings();
	}

	/**
	 * Get the current Git executable.
	 */
	getGitExecutable(): GitExecutable | null {
		return this.gitExecutable;
	}

	/**
	 * Check if Git executable is available.
	 */
	isGitAvailable(): boolean {
		return this.gitExecutable !== null;
	}

	/**
	 * Check if GPG info is supported.
	 */
	supportsGpgInfo(): boolean {
		return (
			this.gitExecutable !== null &&
			doesVersionMeetRequirement(this.gitExecutable.version, GitVersionRequirement.GpgInfo)
		);
	}

	/**
	 * Get the root directory of a Git repository.
	 * Returns null if the path is not within a Git repository.
	 */
	async repoRoot(dirPath: string): Promise<string | null> {
		try {
			return await this.spawnGit(
				['rev-parse', '--show-toplevel'],
				dirPath,
				(stdout) => stdout.trim() || null
			);
		} catch {
			return null;
		}
	}

	/**
	 * Update format strings based on config.
	 */
	private updateFormatStrings(): void {
		const dateType = this.config.dateType === 'author' ? '%at' : '%ct';
		const useMailmap = this.config.useMailmap;

		this.gitFormatCommitDetails = [
			'%H',
			'%P', // Hash & Parent Information
			useMailmap ? '%aN' : '%an',
			useMailmap ? '%aE' : '%ae',
			'%at',
			useMailmap ? '%cN' : '%cn',
			useMailmap ? '%cE' : '%ce',
			'%ct', // Author / Commit Information
			...(this.config.showSignatureStatus && this.supportsGpgInfo()
				? ['%G?', '%GS', '%GK']
				: ['', '', '']), // GPG Key Information
			'%B', // Body
		].join(GIT_LOG_SEPARATOR);

		this.gitFormatLog = [
			'%H',
			'%P', // Hash & Parent Information
			useMailmap ? '%aN' : '%an',
			useMailmap ? '%aE' : '%ae',
			dateType, // Author / Commit Information
			'%s', // Subject
		].join(GIT_LOG_SEPARATOR);

		this.gitFormatStash = [
			'%H',
			'%P',
			'%gD', // Hash, Parent & Selector Information
			useMailmap ? '%aN' : '%an',
			useMailmap ? '%aE' : '%ae',
			dateType, // Author / Commit Information
			'%s', // Subject
		].join(GIT_LOG_SEPARATOR);
	}

	// ==================== Core Git Operations ====================

	/**
	 * Spawn a Git command and return the result.
	 */
	async spawnGit<T>(
		args: string[],
		cwd: string,
		parser: (stdout: string) => T
	): Promise<T> {
		if (!this.gitExecutable) {
			throw new Error('Git executable not available');
		}

		return new Promise((resolve, reject) => {
			const cmd = cp.spawn(this.gitExecutable!.path, args, { cwd });

			let stdout = Buffer.alloc(0);
			let stderr = '';

			cmd.stdout.on('data', (data: Buffer) => {
				stdout = Buffer.concat([stdout, data]);
			});

			cmd.stderr.on('data', (data: string) => {
				stderr += data;
			});

			cmd.on('error', (error) => {
				reject(error.message);
			});

			cmd.on('close', (code) => {
				if (code === 0) {
					try {
						const encoding = encodingExists(this.config.fileEncoding)
							? this.config.fileEncoding
							: 'utf8';
						const output = decode(stdout, encoding);
						resolve(parser(output));
					} catch (error) {
						reject(error instanceof Error ? error.message : 'Parse error');
					}
				} else {
					reject(stderr.trim() || `Git exited with code ${code}`);
				}
			});
		});
	}

	/**
	 * Run a Git command and return error info (null = success).
	 */
	async runGitCommand(args: string[], cwd: string): Promise<string | null> {
		if (!this.gitExecutable) {
			return 'Git executable not available';
		}

		return new Promise((resolve) => {
			const cmd = cp.spawn(this.gitExecutable!.path, args, { cwd });

			let stderr = '';

			cmd.stderr.on('data', (data: string) => {
				stderr += data;
			});

			cmd.on('error', (error) => {
				resolve(error.message);
			});

			cmd.on('close', (code) => {
				if (code === 0) {
					resolve(null);
				} else {
					resolve(stderr.trim() || `Git exited with code ${code}`);
				}
			});
		});
	}

	/**
	 * Run a git command and return the stdout output.
	 */
	async runGitCommandWithOutput(args: string[], cwd: string): Promise<string | null> {
		if (!this.gitExecutable) {
			return null;
		}

		return new Promise((resolve) => {
			const cmd = cp.spawn(this.gitExecutable!.path, args, { cwd });

			let stdout = '';
			let stderr = '';

			cmd.stdout.on('data', (data: string) => {
				stdout += data;
			});

			cmd.stderr.on('data', (data: string) => {
				stderr += data;
			});

			cmd.on('error', () => {
				resolve(null);
			});

			cmd.on('close', (code) => {
				if (code === 0) {
					resolve(stdout);
				} else {
					resolve(null);
				}
			});
		});
	}

	// ==================== Repository Information ====================

	/**
	 * Get the root of a repository.
	 */
	async getRepoRoot(path: string): Promise<string | null> {
		try {
			return await this.spawnGit(['rev-parse', '--show-toplevel'], path, (stdout) =>
				stdout.trim()
			);
		} catch {
			return null;
		}
	}

	/**
	 * Get branches in a repository.
	 */
	async getBranches(
		repo: string,
		showRemoteBranches: boolean,
		hideRemotes: string[]
	): Promise<GitBranchData> {
		const args = ['branch'];
		if (showRemoteBranches) args.push('-a');
		args.push('--no-color');

		const hideRemotePatterns = hideRemotes.map((remote) => `remotes/${remote}/`);

		return this.spawnGit(args, repo, (stdout) => {
			const data: GitBranchData = { branches: [], head: null };
			const lines = stdout.split(EOL_REGEX);

			for (let i = 0; i < lines.length - 1; i++) {
				let name = lines[i]!.substring(2).split(' -> ')[0]!;

				if (
					INVALID_BRANCH_REGEXP.test(name) ||
					hideRemotePatterns.some((pattern) => name.startsWith(pattern)) ||
					REMOTE_HEAD_BRANCH_REGEXP.test(name)
				) {
					continue;
				}

				if (lines[i]![0] === '*') {
					data.head = name;
					data.branches.unshift(name);
				} else {
					data.branches.push(name);
				}
			}

			return data;
		});
	}

	/**
	 * Get remotes in a repository.
	 */
	async getRemotes(repo: string): Promise<string[]> {
		return this.spawnGit(['remote'], repo, (stdout) => {
			const remotes = stdout.trim().split(EOL_REGEX);
			return remotes.filter((r) => r !== '');
		});
	}

	/**
	 * Get stashes in a repository.
	 */
	async getStashes(repo: string): Promise<
		Array<{
			hash: string;
			baseHash: string;
			untrackedFilesHash: string | null;
			selector: string;
			author: string;
			email: string;
			date: number;
			message: string;
		}>
	> {
		return this.spawnGit(
			['stash', 'list', '--format=' + this.gitFormatStash],
			repo,
			(stdout) => {
				const stashes: Array<{
					hash: string;
					baseHash: string;
					untrackedFilesHash: string | null;
					selector: string;
					author: string;
					email: string;
					date: number;
					message: string;
				}> = [];

				const lines = stdout.split(EOL_REGEX);
				for (const line of lines) {
					if (!line) continue;

					const parts = line.split(GIT_LOG_SEPARATOR);
					if (parts.length < 7) continue;

					const selector = parts[2]!;
					stashes.push({
						hash: parts[0]!,
						baseHash: parts[1]!.split(' ')[0]!,
						untrackedFilesHash: parts[1]!.split(' ')[1] || null,
						selector,
						author: parts[3]!,
						email: parts[4]!,
						date: parseInt(parts[5]!, 10),
						message: parts[6]!,
					});
				}

				return stashes;
			}
		);
	}

	/**
	 * Get uncommitted changes count.
	 */
	async getUncommittedChanges(repo: string): Promise<number> {
		return this.spawnGit(['status', '--porcelain'], repo, (stdout) => {
			const lines = stdout.trim().split(EOL_REGEX);
			return lines.filter((line) => line !== '').length;
		});
	}

	/**
	 * Get refs (heads, tags, remotes).
	 */
	async getRefs(
		repo: string,
		showRemoteBranches: boolean,
		hideRemotes: string[]
	): Promise<GitRefData> {
		const args = [
			'for-each-ref',
			'--format=%(objectname) %(refname:short) %(refname:short)',
			'--sort=refname:short',
		];

		const hideRemotePatterns = hideRemotes.map((r) => `remotes/${r}/`);

		return this.spawnGit(args, repo, (stdout) => {
			const data: GitRefData = { head: null, heads: [], tags: [], remotes: [] };
			const lines = stdout.split(EOL_REGEX);

			for (const line of lines) {
				if (!line) continue;

				const spaceIndex = line.indexOf(' ');
				if (spaceIndex === -1) continue;

				const hash = line.substring(0, spaceIndex);
				const name = line.substring(spaceIndex + 1);

				if (name.startsWith('refs/heads/')) {
					data.heads.push({ hash, name: name.substring(11) });
				} else if (name.startsWith('refs/tags/')) {
					const tagName = name.substring(10);
					data.tags.push({ hash, name: tagName, annotated: true });
				} else if (showRemoteBranches && name.startsWith('remotes/')) {
					if (!hideRemotePatterns.some((p) => name.startsWith(p))) {
						data.remotes.push({ hash, name });
					}
				}
			}

			return data;
		});
	}

	// ==================== Commit Operations ====================

	/**
	 * Get commit log.
	 */
	async getLog(
		repo: string,
		branches: string[] | null,
		maxCommits: number,
		order: 'date' | 'author-date' | 'topo',
		onlyFollowFirstParent: boolean
	): Promise<
		Array<{
			hash: string;
			parents: string[];
			author: string;
			email: string;
			date: number;
			message: string;
		}>
	> {
		const args = [
			'-c',
			'log.showSignature=false',
			'log',
			`--max-count=${maxCommits}`,
			`--format=${this.gitFormatLog}`,
			`--${order}-order`,
		];

		if (onlyFollowFirstParent) {
			args.push('--first-parent');
		}

		if (branches !== null && branches.length > 0) {
			args.push(...branches);
		} else {
			args.push('--branches', '--tags');
		}

		return this.spawnGit(args, repo, (stdout) => {
			const commits: Array<{
				hash: string;
				parents: string[];
				author: string;
				email: string;
				date: number;
				message: string;
			}> = [];

			const lines = stdout.split(EOL_REGEX);
			for (const line of lines) {
				if (!line) continue;

				const parts = line.split(GIT_LOG_SEPARATOR);
				if (parts.length < 6) continue;

				commits.push({
					hash: parts[0]!,
					parents: parts[1] ? parts[1].split(' ') : [],
					author: parts[2]!,
					email: parts[3]!,
					date: parseInt(parts[4]!, 10),
					message: parts[5]!,
				});
			}

			return commits;
		});
	}

	/**
	 * Get commit details.
	 */
	async getCommitDetails(
		repo: string,
		commitHash: string
	): Promise<{
		hash: string;
		parents: string[];
		author: string;
		authorEmail: string;
		authorDate: number;
		committer: string;
		committerEmail: string;
		committerDate: number;
		signature: { key: string; signer: string; status: string } | null;
		body: string;
	}> {
		return this.spawnGit(
			['-c', 'log.showSignature=false', 'show', '--quiet', commitHash, '--format=' + this.gitFormatCommitDetails],
			repo,
			(stdout) => {
				const parts = stdout.split(GIT_LOG_SEPARATOR);
				return {
					hash: parts[0]!,
					parents: parts[1] ? parts[1].split(' ') : [],
					author: parts[2]!,
					authorEmail: parts[3]!,
					authorDate: parseInt(parts[4]!, 10),
					committer: parts[5]!,
					committerEmail: parts[6]!,
					committerDate: parseInt(parts[7]!, 10),
					signature:
						parts[8] && ['G', 'U', 'X', 'Y', 'R', 'E', 'B'].includes(parts[8])
							? { key: parts[10]?.trim() ?? '', signer: parts[9]?.trim() ?? '', status: parts[8] }
							: null,
					body: parts.slice(11).join(GIT_LOG_SEPARATOR).trim(),
				};
			}
		);
	}

	// ==================== File Operations ====================

	/**
	 * Get file contents at a specific revision.
	 */
	async getFileAtRevision(repo: string, commitHash: string, filePath: string): Promise<string> {
		return this.spawnGit(['show', `${commitHash}:${filePath}`], repo, (stdout) => stdout);
	}

	/**
	 * Get diff name-status.
	 */
	async getDiffNameStatus(
		repo: string,
		fromHash: string,
		toHash: string
	): Promise<DiffNameStatusRecord[]> {
		const args = ['diff', '--name-status', '-M', '-C'];
		if (fromHash && toHash) {
			args.push(fromHash, toHash);
		} else if (fromHash) {
			args.push(fromHash);
		}

		return this.spawnGit(args, repo, (stdout) => {
			const records: DiffNameStatusRecord[] = [];
			const lines = stdout.split(EOL_REGEX);

			for (const line of lines) {
				if (!line) continue;

				const parts = line.split('\t');
				const type = parts[0]?.[0];

				if (type === 'A' || type === 'D' || type === 'M') {
					records.push({
						type,
						oldFilePath: parts[1]!,
						newFilePath: parts[1]!,
					});
				} else if (type === 'R') {
					records.push({
						type,
						oldFilePath: parts[1]!,
						newFilePath: parts[2]!,
					});
				}
			}

			return records;
		});
	}

	/**
	 * Get diff numstat.
	 */
	async getDiffNumStat(
		repo: string,
		fromHash: string,
		toHash: string
	): Promise<DiffNumStatRecord[]> {
		const args = ['diff', '--numstat', '-M', '-C'];
		if (fromHash && toHash) {
			args.push(fromHash, toHash);
		} else if (fromHash) {
			args.push(fromHash);
		}

		return this.spawnGit(args, repo, (stdout) => {
			const records: DiffNumStatRecord[] = [];
			const lines = stdout.split(EOL_REGEX);

			for (const line of lines) {
				if (!line) continue;

				const parts = line.split('\t');
				if (parts.length >= 3) {
					records.push({
						filePath: parts[2]!,
						additions: parts[0] === '-' ? 0 : parseInt(parts[0]!, 10),
						deletions: parts[1] === '-' ? 0 : parseInt(parts[1]!, 10),
					});
				}
			}

			return records;
		});
	}
}

// ==================== Utility Functions ====================

/**
 * Get unique values from an array.
 */
export function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

// ==================== Singleton ====================

let gitServiceInstance: GitService | null = null;

/**
 * Get the GitService singleton instance.
 * Must call setGitService first to initialize.
 */
export function getGitService(): GitService {
	if (!gitServiceInstance) {
		// Create with default config
		gitServiceInstance = new GitService({
			dateType: 'author',
			fileEncoding: 'utf8',
			showSignatureStatus: false,
			useMailmap: false,
			signCommits: false,
			signTags: false,
			showUncommittedChanges: true,
		});
	}
	return gitServiceInstance;
}

/**
 * Set the GitService instance (typically called during initialization).
 */
export function setGitService(service: GitService): void {
	gitServiceInstance = service;
}

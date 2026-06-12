/**
 * Git Service - Core Git Operations
 * Ported from git-graph/src/dataSource.ts
 *
 * This service provides low-level Git operations that can be used by tRPC routers.
 */

import * as cp from 'child_process';
import { decode, encodingExists } from 'iconv-lite';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { doesVersionMeetRequirement, GitVersionRequirement } from './gitExecutable';

import type { GitExecutable } from './gitExecutable';

// ==================== Constants ====================

export const GIT_LOG_SEPARATOR = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb'; // eslint-disable-line no-secrets/no-secrets
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

export interface GitCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    error: string | null;
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
    private refsCache = new Map<string, { value: GitRefData; expiresAt: number }>();
    private refsInflight = new Map<string, Promise<GitRefData>>();
    private tagsCache = new Map<string, { value: string[]; expiresAt: number }>();
    private tagsInflight = new Map<string, Promise<string[]>>();
    private readonly refsCacheTtlMs = 2500;
    private readonly tagsCacheTtlMs = 2500;

    constructor(private readonly config: GitServiceConfig) {
        this.updateFormatStrings();
    }

    /**
     * Set the Git executable to use.
     */
    setGitExecutable(executable: GitExecutable | null): void {
        this.gitExecutable = executable;
        this.updateFormatStrings();
        this.refsCache.clear();
        this.refsInflight.clear();
        this.tagsCache.clear();
        this.tagsInflight.clear();
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
            return await this.spawnGit(['rev-parse', '--show-toplevel'], dirPath, (stdout) => stdout.trim() || null);
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
            ...(this.config.showSignatureStatus && this.supportsGpgInfo() ? ['%G?', '%GS', '%GK'] : ['', '', '']), // GPG Key Information
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

    private toRefsCacheKey(repo: string, showRemoteBranches: boolean, hideRemotes: string[]): string {
        const normalizedRepo = path.resolve(repo);
        const normalizedHidden = [...hideRemotes].sort().join(',');
        return `${normalizedRepo}|${showRemoteBranches ? '1' : '0'}|${normalizedHidden}`;
    }

    private cloneRefsData(data: GitRefData): GitRefData {
        return {
            head: data.head,
            heads: data.heads.map((head) => ({ ...head })),
            tags: data.tags.map((tag) => ({ ...tag })),
            remotes: data.remotes.map((remote) => ({ ...remote })),
        };
    }

    private toTagsCacheKey(repo: string): string {
        return path.resolve(repo);
    }

    // ==================== Core Git Operations ====================

    /**
     * Spawn a Git command and return the result.
     */
    async spawnGit<T>(args: string[], cwd: string, parser: (stdout: string) => T): Promise<T> {
        const gitExecutable = this.gitExecutable;
        if (!gitExecutable) {
            throw new Error('Git executable not available');
        }

        return new Promise((resolve, reject) => {
            const cmd = cp.spawn(gitExecutable.path, args, { cwd });

            const stdoutChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderr = '';

            cmd.stdout.on('data', (data: Buffer | string) => {
                const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
                stdoutChunks.push(chunk);
                stdoutBytes += chunk.length;
            });

            cmd.stderr.on('data', (data: Buffer | string) => {
                stderr += Buffer.isBuffer(data) ? data.toString('utf8') : data;
            });

            cmd.on('error', (error) => {
                reject(error);
            });

            cmd.on('close', (code) => {
                if (code === 0) {
                    try {
                        const encoding = encodingExists(this.config.fileEncoding) ? this.config.fileEncoding : 'utf8';
                        const outputBuffer =
                            stdoutChunks.length === 0
                                ? Buffer.alloc(0)
                                : stdoutChunks.length === 1
                                  ? (stdoutChunks[0] ?? Buffer.alloc(0))
                                  : Buffer.concat(stdoutChunks, stdoutBytes);
                        const output = decode(outputBuffer, encoding);
                        resolve(parser(output));
                    } catch (error) {
                        reject(error instanceof Error ? error : new Error('Parse error'));
                    }
                } else {
                    reject(new Error(stderr.trim() || `Git exited with code ${String(code)}`));
                }
            });
        });
    }

    /**
     * Run a Git command and return error info (null = success).
     */
    async runGitCommand(args: string[], cwd: string, options?: { env?: NodeJS.ProcessEnv }): Promise<string | null> {
        const gitExecutable = this.gitExecutable;
        if (!gitExecutable) {
            return 'Git executable not available';
        }

        return new Promise((resolve) => {
            const cmd = cp.spawn(gitExecutable.path, args, {
                cwd,
                env: options?.env ? { ...process.env, ...options.env } : process.env,
            });

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
                    resolve(stderr.trim() || `Git exited with code ${String(code)}`);
                }
            });
        });
    }

    /**
     * Run a Git command with custom interactive rebase todo content.
     */
    async runGitCommandWithInteractiveTodo(args: string[], cwd: string, todos: string): Promise<string | null> {
        const trimmedTodos = todos.trim();
        const tmpTodoPath = path.join(os.tmpdir(), `git-graph-rebase-todo-${String(Date.now())}.txt`);
        const tmpEditorPath = path.join(
            os.tmpdir(),
            `git-graph-rebase-sequence-editor-${String(Date.now())}${process.platform === 'win32' ? '.cmd' : '.sh'}`
        );
        const normalizedTodos = trimmedTodos === '' ? '# no changes\\n' : `${trimmedTodos}\\n`;
        const isWindows = process.platform === 'win32';

        const editorScript = isWindows
            ? `@echo off\\r\\nif "%GIT_GRAPH_REBASE_TODO%"=="" exit /B 0\\nif "%~1"=="" exit /B 0\\ncopy /Y "%GIT_GRAPH_REBASE_TODO%" "%~1" >nul\\nexit /B 0\\n`
            : `#!/bin/sh\\nset -eu\\nif [ -n "$GIT_GRAPH_REBASE_TODO" ] && [ -n "$1" ]; then\\n  cp "$GIT_GRAPH_REBASE_TODO" "$1"\\nfi\\nexit 0\\n`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.writeFile(tmpTodoPath, normalizedTodos, { encoding: 'utf8' });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.writeFile(tmpEditorPath, editorScript, { encoding: 'utf8' });
        if (!isWindows) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await fs.chmod(tmpEditorPath, 0o755);
        }

        try {
            const error = await this.runGitCommand(args, cwd, {
                env: {
                    GIT_GRAPH_REBASE_TODO: tmpTodoPath,
                    GIT_SEQUENCE_EDITOR: tmpEditorPath,
                },
            });
            return error;
        } finally {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await fs.unlink(tmpTodoPath).catch(() => {});
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            await fs.unlink(tmpEditorPath).catch(() => {});
        }
    }

    /**
     * Run a git command and return the stdout output.
     */
    async runGitCommandWithOutput(args: string[], cwd: string): Promise<string | null> {
        const gitExecutable = this.gitExecutable;
        if (!gitExecutable) {
            return null;
        }

        return new Promise((resolve) => {
            const cmd = cp.spawn(gitExecutable.path, args, { cwd });

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            cmd.stdout.on('data', (data: Buffer | string) => {
                stdoutChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });

            cmd.stderr.on('data', (data: Buffer | string) => {
                stderrChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });

            cmd.on('error', () => {
                resolve(null);
            });

            cmd.on('close', (code) => {
                if (code === 0) {
                    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
                    resolve(stdout);
                } else {
                    // Keep stderr decoding ready for diagnostics without changing public API.
                    void Buffer.concat(stderrChunks).toString('utf8');
                    resolve(null);
                }
            });
        });
    }

    /**
     * Run a Git command and return stdout, stderr, and the exit code.
     *
     * Some read-only Git commands, notably `merge-tree --write-tree`, exit with
     * code 1 to report conflicts while still printing useful preview data.
     */
    async runGitCommandWithResult(args: string[], cwd: string): Promise<GitCommandResult> {
        const gitExecutable = this.gitExecutable;
        if (!gitExecutable) {
            return {
                stdout: '',
                stderr: '',
                exitCode: null,
                error: 'Git executable not available',
            };
        }

        return new Promise((resolve) => {
            const cmd = cp.spawn(gitExecutable.path, args, { cwd });

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            cmd.stdout.on('data', (data: Buffer | string) => {
                stdoutChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });

            cmd.stderr.on('data', (data: Buffer | string) => {
                stderrChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });

            cmd.on('error', (error) => {
                resolve({
                    stdout: '',
                    stderr: '',
                    exitCode: null,
                    error: error.message,
                });
            });

            cmd.on('close', (code) => {
                const stdout = Buffer.concat(stdoutChunks).toString('utf8');
                const stderr = Buffer.concat(stderrChunks).toString('utf8');
                resolve({
                    stdout,
                    stderr,
                    exitCode: code,
                    error: code === 0 || code === 1 ? null : stderr.trim() || `Git exited with code ${String(code)}`,
                });
            });
        });
    }

    // ==================== Repository Information ====================

    /**
     * Get the root of a repository.
     */
    async getRepoRoot(path: string): Promise<string | null> {
        try {
            return await this.spawnGit(['rev-parse', '--show-toplevel'], path, (stdout) => stdout.trim());
        } catch {
            return null;
        }
    }

    /**
     * Get branches in a repository.
     */
    async getBranches(repo: string, showRemoteBranches: boolean, hideRemotes: string[]): Promise<GitBranchData> {
        const args = ['branch'];
        if (showRemoteBranches) args.push('-a');
        args.push('--no-color');

        const hideRemotePatterns = hideRemotes.map((remote) => `remotes/${remote}/`);

        return this.spawnGit(args, repo, (stdout) => {
            const data: GitBranchData = { branches: [], head: null };
            const lines = stdout.split(EOL_REGEX);

            for (let i = 0; i < lines.length - 1; i++) {
                const branchLine = lines[i];
                if (!branchLine || branchLine.length < 2) {
                    continue;
                }
                const name = branchLine.substring(2).split(' -> ')[0] ?? '';

                if (
                    INVALID_BRANCH_REGEXP.test(name) ||
                    hideRemotePatterns.some((pattern) => name.startsWith(pattern)) ||
                    REMOTE_HEAD_BRANCH_REGEXP.test(name)
                ) {
                    continue;
                }

                if (branchLine.charAt(0) === '*') {
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
        return this.spawnGit(['stash', 'list', '--format=' + this.gitFormatStash], repo, (stdout) => {
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

                const parentTokens = (parts[1] ?? '').split(' ');
                const selector = parts[2] ?? '';
                stashes.push({
                    hash: parts[0] ?? '',
                    baseHash: parentTokens[0] ?? '',
                    untrackedFilesHash: parentTokens[1] ?? null,
                    selector,
                    author: parts[3] ?? '',
                    email: parts[4] ?? '',
                    date: parseInt(parts[5] ?? '0', 10),
                    message: parts[6] ?? '',
                });
            }

            return stashes;
        });
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
    async getRefs(repo: string, showRemoteBranches: boolean, hideRemotes: string[]): Promise<GitRefData> {
        const cacheKey = this.toRefsCacheKey(repo, showRemoteBranches, hideRemotes);
        const now = Date.now();
        const cached = this.refsCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return this.cloneRefsData(cached.value);
        }

        const existingInflight = this.refsInflight.get(cacheKey);
        if (existingInflight) {
            return this.cloneRefsData(await existingInflight);
        }

        const args = ['for-each-ref', '--format=%(objectname) %(refname)', '--sort=refname'];

        const hideRemotePatterns = hideRemotes.map((remote) => `refs/remotes/${remote}/`);

        const loadPromise = this.spawnGit(args, repo, (stdout) => {
            const data: GitRefData = { head: null, heads: [], tags: [], remotes: [] };
            const lines = stdout.split(EOL_REGEX);

            for (const line of lines) {
                if (!line) continue;

                const spaceIndex = line.indexOf(' ');
                if (spaceIndex === -1) continue;

                const hash = line.substring(0, spaceIndex);
                const fullName = line.substring(spaceIndex + 1);

                if (fullName.startsWith('refs/heads/')) {
                    data.heads.push({ hash, name: fullName.substring(11) });
                } else if (fullName.startsWith('refs/tags/')) {
                    data.tags.push({ hash, name: fullName.substring(10), annotated: true });
                } else if (showRemoteBranches && fullName.startsWith('refs/remotes/')) {
                    if (!hideRemotePatterns.some((pattern) => fullName.startsWith(pattern))) {
                        data.remotes.push({ hash, name: fullName.substring(5) });
                    }
                }
            }

            return data;
        });

        this.refsInflight.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.refsCache.set(cacheKey, {
                value: result,
                expiresAt: Date.now() + this.refsCacheTtlMs,
            });
            return this.cloneRefsData(result);
        } finally {
            this.refsInflight.delete(cacheKey);
        }
    }

    /**
     * Get tag names in a repository.
     */
    async getTags(repo: string): Promise<string[]> {
        const cacheKey = this.toTagsCacheKey(repo);
        const now = Date.now();
        const cached = this.tagsCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return [...cached.value];
        }

        const existingInflight = this.tagsInflight.get(cacheKey);
        if (existingInflight) {
            return [...(await existingInflight)];
        }

        const loadPromise = this.spawnGit(['tag', '--list', '--sort=refname'], repo, (stdout) =>
            stdout
                .split(EOL_REGEX)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
        );

        this.tagsInflight.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.tagsCache.set(cacheKey, {
                value: result,
                expiresAt: Date.now() + this.tagsCacheTtlMs,
            });
            return [...result];
        } finally {
            this.tagsInflight.delete(cacheKey);
        }
    }

    // ==================== Commit Operations ====================

    private async getParentRevisions(repo: string, commitHash: string): Promise<string[]> {
        const output = await this.runGitCommandWithOutput(['rev-list', '--parents', '-n', '1', commitHash], repo);
        const [, ...parents] = (output ?? '').trim().split(/\s+/).filter(Boolean);
        return parents;
    }

    /**
     * Get commit log.
     */
    async getLog(
        repo: string,
        branches: string[] | null,
        maxCommits: number,
        order: 'date' | 'author-date' | 'topo',
        onlyFollowFirstParent: boolean,
        filters?: {
            author?: string;
            search?: string;
            filePath?: string;
            dateFrom?: string;
            dateTo?: string;
            cursor?: string;
        }
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
        const cursor = filters?.cursor?.trim();
        const cursorParentRevisions = cursor ? await this.getParentRevisions(repo, cursor) : null;
        if (cursor && cursorParentRevisions?.length === 0) {
            return [];
        }

        const args = [
            '-c',
            'log.showSignature=false',
            'log',
            `--max-count=${String(maxCommits)}`,
            `--format=${this.gitFormatLog}`,
            `--${order}-order`,
        ];

        if (onlyFollowFirstParent) {
            args.push('--first-parent');
        }

        const filteredAuthor = filters?.author?.trim();
        if (filteredAuthor) {
            args.push(`--author=${filteredAuthor}`);
        }

        const filteredSearch = filters?.search?.trim();
        if (filteredSearch) {
            args.push(`--grep=${filteredSearch}`);
        }

        const filteredDateFrom = filters?.dateFrom?.trim();
        if (filteredDateFrom) {
            args.push(`--since=${filteredDateFrom}`);
        }

        const filteredDateTo = filters?.dateTo?.trim();
        if (filteredDateTo) {
            args.push(`--until=${filteredDateTo}`);
        }

        if (cursorParentRevisions) {
            args.push(...cursorParentRevisions);
        } else if (branches !== null && branches.length > 0) {
            args.push(...branches);
        } else {
            args.push('--branches', '--tags');
        }

        const filteredFilePath = filters?.filePath?.trim();
        if (filteredFilePath) {
            args.push('--', filteredFilePath);
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
                    hash: parts[0] ?? '',
                    parents: parts[1] ? parts[1].split(' ') : [],
                    author: parts[2] ?? '',
                    email: parts[3] ?? '',
                    date: parseInt(parts[4] ?? '0', 10),
                    message: parts[5] ?? '',
                });
            }

            return commits;
        });
    }

    /**
     * Get commits in range from a starting commit up to HEAD.
     */
    async getCommitsFrom(
        startHash: string,
        repo: string,
        maxCommits: number
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
        if (!startHash.trim() || maxCommits <= 0) {
            return [];
        }

        const args = [
            'log',
            `--max-count=${String(maxCommits)}`,
            `--format=${this.gitFormatLog}`,
            `${startHash}..HEAD`,
        ];

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
                    hash: parts[0] ?? '',
                    parents: parts[1] ? parts[1].split(' ') : [],
                    author: parts[2] ?? '',
                    email: parts[3] ?? '',
                    date: parseInt(parts[4] ?? '0', 10),
                    message: parts[5] ?? '',
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
                    hash: parts[0] ?? '',
                    parents: parts[1] ? parts[1].split(' ') : [],
                    author: parts[2] ?? '',
                    authorEmail: parts[3] ?? '',
                    authorDate: parseInt(parts[4] ?? '0', 10),
                    committer: parts[5] ?? '',
                    committerEmail: parts[6] ?? '',
                    committerDate: parseInt(parts[7] ?? '0', 10),
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
     * Get binary file contents at a specific revision as base64.
     */
    async getFileBinaryAtRevision(repo: string, commitHash: string, filePath: string): Promise<string> {
        const gitExecutable = this.gitExecutable;
        if (!gitExecutable) {
            throw new Error('Git executable not available');
        }

        return new Promise((resolve, reject) => {
            const cmd = cp.spawn(gitExecutable.path, ['show', `${commitHash}:${filePath}`], {
                cwd: repo,
            });
            const stdoutChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderr = '';

            cmd.stdout.on('data', (data: Buffer | string) => {
                const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
                stdoutChunks.push(chunk);
                stdoutBytes += chunk.length;
            });

            cmd.stderr.on('data', (data: Buffer | string) => {
                stderr += Buffer.isBuffer(data) ? data.toString('utf8') : data;
            });

            cmd.on('error', (error) => {
                reject(error);
            });

            cmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(stderr.trim() || `Git exited with code ${String(code)}`));
                    return;
                }

                const outputBuffer =
                    stdoutChunks.length === 0
                        ? Buffer.alloc(0)
                        : stdoutChunks.length === 1
                          ? (stdoutChunks[0] ?? Buffer.alloc(0))
                          : Buffer.concat(stdoutChunks, stdoutBytes);
                resolve(outputBuffer.toString('base64'));
            });
        });
    }

    /**
     * Get diff name-status.
     */
    async getDiffNameStatus(repo: string, fromHash: string, toHash: string): Promise<DiffNameStatusRecord[]> {
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
                        oldFilePath: parts[1] ?? '',
                        newFilePath: parts[1] ?? '',
                    });
                } else if (type === 'R') {
                    records.push({
                        type,
                        oldFilePath: parts[1] ?? '',
                        newFilePath: parts[2] ?? '',
                    });
                }
            }

            return records;
        });
    }

    /**
     * Get diff numstat.
     */
    async getDiffNumStat(repo: string, fromHash: string, toHash: string): Promise<DiffNumStatRecord[]> {
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
                        filePath: parts[2] ?? '',
                        additions: parts[0] === '-' ? 0 : parseInt(parts[0] ?? '0', 10),
                        deletions: parts[1] === '-' ? 0 : parseInt(parts[1] ?? '0', 10),
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

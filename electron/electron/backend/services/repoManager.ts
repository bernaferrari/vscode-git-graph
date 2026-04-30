/**
 * Repository Manager
 * Ported from git-graph/src/repoManager.ts
 * Manages Git repository discovery and state in Electron
 */

import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { RepoFileWatcher } from './fileWatcher';
import { GitService } from './gitService';
import {
	BooleanOverride,
	FileViewType,
	type GitRepoState,
	type GitRepoSet,
	RepoCommitOrdering,
} from '../../../src/lib/types';
import { BufferedQueue } from '../../../src/lib/utils/bufferedQueue';
import { Disposable, toDisposable } from '../../../src/lib/utils/disposable';
import { EventEmitter, type Event } from '../../../src/lib/utils/event';
import { instanceStore } from '../store';
import { notifyRepoChanged } from '../trpc/routers/watcher';

// ==================== Types ====================

export interface RepoChangeEvent {
    readonly repos: GitRepoSet;
    readonly numRepos: number;
    readonly loadRepo: string | null;
}

export interface RegisterRepoResult {
    root: string | null;
    error: string | null;
}

const DEFAULT_REPO_STATE: GitRepoState = {
    cdvDivider: 0.5,
    cdvHeight: 250,
    columnWidths: null,
    commitOrdering: RepoCommitOrdering.Default,
    fileViewType: FileViewType.Default,
    hideRemotes: [],
    includeCommitsMentionedByReflogs: BooleanOverride.Default,
    issueLinkingConfig: null,
    lastImportAt: 0,
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

// ==================== Repo Manager ====================

/**
 * Manages Git repositories in the Electron app.
 */
export class RepoManager extends Disposable {
    private readonly gitService: GitService;
    private readonly repoEventEmitter: EventEmitter<RepoChangeEvent>;
    private readonly fileWatcher: RepoFileWatcher;

    private repos: GitRepoSet;
    private ignoredRepos: string[];
    private maxDepthOfRepoSearch: number;

    private readonly onWatcherCreateQueue: BufferedQueue<string>;
    private readonly onWatcherChangeQueue: BufferedQueue<string>;

    constructor(gitService: GitService) {
        super();

        this.gitService = gitService;
        this.repos = this.loadRepos();
        this.ignoredRepos = instanceStore.get('ignoredRepos');
        this.maxDepthOfRepoSearch = 0; // Could be configurable

        this.repoEventEmitter = new EventEmitter<RepoChangeEvent>();

        // File watcher for the active repository
        this.fileWatcher = new RepoFileWatcher(() => {
            const activeRepo = this.fileWatcher.getRepo();
            if (activeRepo) {
                notifyRepoChanged(activeRepo);
            }
            this.emitRepoChange();
        });

        // Queues for processing file system events
        this.onWatcherCreateQueue = new BufferedQueue<string>(
            this.processOnWatcherCreateEvent.bind(this),
            this.emitRepoChange.bind(this)
        );

        this.onWatcherChangeQueue = new BufferedQueue<string>(
            this.processOnWatcherChangeEvent.bind(this),
            this.emitRepoChange.bind(this)
        );

        this.registerDisposables(
            this.repoEventEmitter,
            this.fileWatcher,
            this.onWatcherCreateQueue,
            this.onWatcherChangeQueue,
            toDisposable(() => {
                this.saveRepos();
            })
        );
    }

    // ==================== Public API ====================

    /**
     * Get the Event that can be used to subscribe to repository changes.
     */
    get onDidChangeRepos(): Event<RepoChangeEvent> {
        return this.repoEventEmitter.subscribe;
    }

    /**
     * Get all known repositories.
     */
    public getRepos(): GitRepoSet {
        return { ...this.repos };
    }

    /**
     * Get the number of known repositories.
     */
    public getNumRepos(): number {
        return Object.keys(this.repos).length;
    }

    /**
     * Check if a repository is known.
     */
    public isKnownRepo(repo: string): boolean {
        return repo in this.repos;
    }

    /**
     * Get the repository containing a file.
     */
    public getRepoContainingFile(filePath: string): string | null {
        const repoPaths = Object.keys(this.repos);
        let repo: string | null = null;

        for (const repoPath of repoPaths) {
            const repoPathSlash = repoPath + '/';
            if (filePath.startsWith(repoPathSlash) && (repo === null || repo.length < repoPath.length)) {
                repo = repoPath;
            }
        }

        return repo;
    }

    /**
     * Open a folder dialog to select a repository.
     */
    public async openRepoDialog(): Promise<string | null> {
        const result = await dialog.showOpenDialog({
            title: 'Open Git Repository',
            properties: ['openDirectory'],
            buttonLabel: 'Open Repository',
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0] ?? null;
    }

    /**
     * Register a new repository.
     */
    public async registerRepo(repoPath: string, loadRepo: boolean = true): Promise<RegisterRepoResult> {
        if (!this.gitService.isGitAvailable()) {
            return {
                root: null,
                error: 'Git executable not available.',
            };
        }

        const root = await this.gitService.repoRoot(repoPath);

        if (root === null) {
            return {
                root: null,
                error: `"${repoPath}" is not a Git repository.`,
            };
        }

        if (root in this.repos) {
            // Opening a known repo (or any subdirectory inside it) should behave like
            // "focus this repo", not an error.
            this.emitRepoChange(loadRepo ? root : null);
            return { root, error: null };
        }

        // Remove from ignored if present
        if (this.ignoredRepos.includes(root)) {
            this.ignoredRepos = this.ignoredRepos.filter((p) => p !== root);
            instanceStore.set('ignoredRepos', this.ignoredRepos);
        }

        this.addRepo(root);
        this.emitRepoChange(loadRepo ? root : null);

        return { root, error: null };
    }

    /**
     * Remove a repository.
     */
    public removeRepo(repo: string): void {
        if (!this.isKnownRepo(repo)) return;

        this.repos = Object.fromEntries(
            Object.entries(this.repos).filter(([repoPath]) => repoPath !== repo)
        ) as GitRepoSet;
        this.saveRepos();

        // Update recent repos
        const recentRepos = instanceStore.get('recentRepos');
        instanceStore.set(
            'recentRepos',
            recentRepos.filter((p: string) => p !== repo)
        );
    }

    /**
     * Ignore a repository.
     */
    public ignoreRepo(repo: string): boolean {
        if (!this.isKnownRepo(repo)) return false;

        if (!this.ignoredRepos.includes(repo)) {
            this.ignoredRepos.push(repo);
            instanceStore.set('ignoredRepos', this.ignoredRepos);
        }

        this.removeRepo(repo);
        this.emitRepoChange();

        return true;
    }

    /**
     * Unignore a repository.
     */
    public unignoreRepo(repo: string): void {
        this.ignoredRepos = this.ignoredRepos.filter((p: string) => p !== repo);
        instanceStore.set('ignoredRepos', this.ignoredRepos);
    }

    /**
     * Set the active repository to watch.
     */
    public setActiveRepo(repo: string | null): void {
        // Manual refresh mode: do not start background filesystem watchers.
        this.fileWatcher.stop();

        if (repo && this.isKnownRepo(repo)) {
            instanceStore.set('lastActiveRepo', repo);

            // Update recent repos
            const recentRepos = instanceStore.get('recentRepos');
            const filtered = recentRepos.filter((p: string) => p !== repo);
            instanceStore.set('recentRepos', [repo, ...filtered].slice(0, 10));
        }
    }

    /**
     * Get the last active repository.
     */
    public getLastActiveRepo(): string | null {
        return instanceStore.get('lastActiveRepo') ?? null;
    }

    /**
     * Get recent repositories.
     */
    public getRecentRepos(): string[] {
        return instanceStore.get('recentRepos');
    }

    /**
     * Set repository state.
     */
    public setRepoState(repo: string, state: GitRepoState): void {
        if (!this.isKnownRepo(repo)) return;
        this.repos[repo] = state;
        this.saveRepos();
    }

    /**
     * Update repository state partially.
     */
    public updateRepoState(repo: string, partial: Partial<GitRepoState>): void {
        if (!this.isKnownRepo(repo)) return;
        this.repos[repo] = { ...this.repos[repo], ...partial } as GitRepoState;
        this.saveRepos();
    }

    /**
     * Mute file watcher (during Git operations).
     */
    public muteWatcher(): void {
        // Manual refresh mode: watcher is disabled.
    }

    /**
     * Unmute file watcher.
     */
    public unmuteWatcher(): void {
        // Manual refresh mode: watcher is disabled.
    }

    /**
     * Search a directory for repositories.
     */
    public async searchDirectoryForRepos(directory: string, maxDepth: number = 0): Promise<boolean> {
        if (this.isDirectoryWithinRepos(directory)) {
            return false;
        }

        const root = await this.gitService.repoRoot(directory);

        if (root !== null) {
            return this.addRepo(root);
        }

        if (maxDepth > 0) {
            const dirs = await this.getSubdirectories(directory);
            const results = await Promise.all(dirs.map((dir) => this.searchDirectoryForRepos(dir, maxDepth - 1)));
            return results.some((r) => r);
        }

        return false;
    }

    // ==================== Private Methods ====================

    private loadRepos(): GitRepoSet {
        const stored = instanceStore.get('repoStates');
        const outputSet: GitRepoSet = {};

        if (typeof stored === 'object') {
            for (const [repo, state] of Object.entries(stored)) {
                outputSet[repo] = {
                    ...DEFAULT_REPO_STATE,
                    ...(state as unknown as Partial<GitRepoState>),
                } as GitRepoState;
            }
        }

        return outputSet;
    }

    private saveRepos(): void {
        instanceStore.set('repoStates', this.repos);
    }

    private addRepo(repo: string): boolean {
        if (this.ignoredRepos.includes(repo)) {
            return false;
        }

        this.repos[repo] = { ...DEFAULT_REPO_STATE };
        this.saveRepos();

        return true;
    }

    private emitRepoChange(loadRepo: string | null = null): void {
        this.repoEventEmitter.emit({
            repos: this.getRepos(),
            numRepos: this.getNumRepos(),
            loadRepo,
        });
    }

    private isDirectoryWithinRepos(dirPath: string): boolean {
        const repoPaths = Object.keys(this.repos);
        for (const repoPath of repoPaths) {
            if (dirPath === repoPath || dirPath.startsWith(repoPath + '/')) {
                return true;
            }
        }
        return false;
    }

    private async getSubdirectories(dirPath: string): Promise<string[]> {
        return new Promise((resolve) => {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
                if (err) {
                    resolve([]);
                    return;
                }

                const dirs = entries
                    .filter((entry) => entry.isDirectory() && entry.name !== '.git')
                    .map((entry) => path.join(dirPath, entry.name));

                resolve(dirs);
            });
        });
    }

    private async processOnWatcherCreateEvent(filePath: string): Promise<boolean> {
        const isDir = await this.isDirectory(filePath);
        if (isDir) {
            return this.searchDirectoryForRepos(filePath, this.maxDepthOfRepoSearch);
        }
        return false;
    }

    private async processOnWatcherChangeEvent(filePath: string): Promise<boolean> {
        const exists = await this.pathExists(filePath);
        if (!exists) {
            // Remove repos within this path
            const repoPaths = Object.keys(this.repos);
            let changed = false;

            for (const repoPath of repoPaths) {
                if (repoPath === filePath || repoPath.startsWith(filePath + '/')) {
                    this.repos = Object.fromEntries(
                        Object.entries(this.repos).filter(([existingRepoPath]) => existingRepoPath !== repoPath)
                    ) as GitRepoSet;
                    changed = true;
                }
            }

            if (changed) {
                this.saveRepos();
            }

            return changed;
        }
        return false;
    }

    private isDirectory(filePath: string): Promise<boolean> {
        return new Promise((resolve) => {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.stat(filePath, (err, stats) => {
                resolve(err ? false : stats.isDirectory());
            });
        });
    }

    private pathExists(filePath: string): Promise<boolean> {
        return new Promise((resolve) => {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.stat(filePath, (err) => {
                resolve(!err);
            });
        });
    }
}

// ==================== Singleton ====================

let repoManagerInstance: RepoManager | null = null;

export function getRepoManager(gitService: GitService): RepoManager {
    if (!repoManagerInstance) {
        repoManagerInstance = new RepoManager(gitService);
    }
    return repoManagerInstance;
}

export function resetRepoManager(): void {
    repoManagerInstance = null;
}

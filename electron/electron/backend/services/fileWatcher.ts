/**
 * Repository File Watcher
 * Ported from git-graph/src/repoFileWatcher.ts
 * Uses chokidar for file system watching in Electron
 */

import * as chokidar from 'chokidar';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';

import { Disposable, toDisposable } from '../../../src/lib/utils/disposable';

// Regex to match files that should trigger a refresh
const FILE_CHANGE_REGEX =
    /(^\.git\/(config|index|HEAD|refs\/stash|refs\/heads\/.*|refs\/remotes\/.*|refs\/tags\/.*)$)|(^(?!\.git).*$)|(^\.git[^/]+$)/;

export interface FileWatcherConfig {
    debounceMs?: number;
    resumeDelayMs?: number;
    pollIntervalMs?: number;
    gitWatchDepth?: number;
}

/**
 * Watches a Git repository for file events.
 */
export class RepoFileWatcher extends Disposable {
    private repo: string | null = null;
    private watcher: chokidar.FSWatcher | null = null;
    private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private muted: boolean = false;
    private resumeAt: number = 0;
    private readonly debounceMs: number;
    private readonly resumeDelayMs: number;
    private readonly pollIntervalMs: number;
    private readonly gitWatchDepth: number;

    /**
     * Creates a RepoFileWatcher.
     */
    constructor(
        private readonly onChangeCallback: () => void,
        config: FileWatcherConfig = {}
    ) {
        super();
        this.debounceMs = config.debounceMs ?? 750;
        this.resumeDelayMs = config.resumeDelayMs ?? 1500;
        this.pollIntervalMs = config.pollIntervalMs ?? 2500;
        this.gitWatchDepth = config.gitWatchDepth ?? 6;
    }

    /**
     * Start watching a repository for file events.
     */
    public start(repo: string): void {
        if (this.repo === repo && this.isWatching()) {
            return;
        }

        if (this.watcher !== null) {
            this.stop();
        }

        this.repo = repo;

        // Watch Git metadata only. Watching entire repos can exceed file-handle
        // limits on large projects (node_modules, build outputs, etc.).
        const watchTargets = this.getGitWatchTargets(repo);
        this.watcher = chokidar.watch(watchTargets, {
            ignoreInitial: true,
            ignored: (path: string) => {
                const normalizedPath = path.replace(/\\/g, '/');
                // Ignore high-churn Git internals for performance.
                if (
                    normalizedPath.includes('/.git/objects/') ||
                    normalizedPath.includes('/.git/logs/') ||
                    normalizedPath.includes('/.git/lfs/objects/')
                ) {
                    return true;
                }
                return false;
            },
            depth: this.gitWatchDepth,
            persistent: true,
            ignorePermissionErrors: true,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100,
            },
        });

        this.watcher.on('add', (path) => { this.refresh(path); });
        this.watcher.on('change', (path) => { this.refresh(path); });
        this.watcher.on('unlink', (path) => { this.refresh(path); });
        this.watcher.on('addDir', (path) => { this.refresh(path); });
        this.watcher.on('unlinkDir', (path) => { this.refresh(path); });
        this.watcher.on('error', (error) => { this.handleWatcherError(error); });

        this.registerDisposable(
            toDisposable(() => {
                this.stop();
            })
        );
    }

    /**
     * Stop watching the repository for file events.
     */
    public stop(): void {
        if (this.watcher !== null) {
            this.watcher.close().catch(console.error);
            this.watcher = null;
        }
        if (this.pollInterval !== null) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.refreshTimeout !== null) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
    }

    /**
     * Mute file events - Used to prevent many file events from being triggered
     * when a Git action is executed.
     */
    public mute(): void {
        this.muted = true;
    }

    /**
     * Unmute file events - Used to resume normal watching after a Git action has completed.
     */
    public unmute(): void {
        this.muted = false;
        this.resumeAt = Date.now() + this.resumeDelayMs;
    }

    /**
     * Get the currently watched repository path.
     */
    public getRepo(): string | null {
        return this.repo;
    }

    /**
     * Check if the watcher is currently watching a repository.
     */
    public isWatching(): boolean {
        return this.watcher !== null || this.pollInterval !== null;
    }

    /**
     * Handle a file event triggered by the file system watcher.
     */
    private refresh(filePath: string): void {
        if (this.muted) return;
        if (!this.repo) return;

        // Get relative path from repo root
        const relativePath = nodePath.relative(this.repo, filePath).replace(/\\/g, '/');

        // Check if this file should trigger a refresh
        if (!relativePath.match(FILE_CHANGE_REGEX)) return;

        // Check if we're still in the resume delay period
        if (Date.now() < this.resumeAt) return;

        // Debounce the refresh callback
        if (this.refreshTimeout !== null) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            this.refreshTimeout = null;
            this.onChangeCallback();
        }, this.debounceMs);
    }

    private handleWatcherError(error: unknown): void {
        const errorCode =
            typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code: unknown }).code)
                : '';
        const message = error instanceof Error ? error.message : String(error);

        if (errorCode === 'EMFILE' || errorCode === 'ENOSPC' || message.includes('EMFILE')) {
            console.warn(
                `[file-watcher] Hit watcher file-descriptor limit (${errorCode || 'EMFILE'}). Falling back to polling mode.`
            );
            this.startPollingFallback();
            return;
        }

        console.error('[file-watcher] Watcher error:', error);
    }

    private startPollingFallback(): void {
        if (this.pollInterval !== null) {
            return;
        }

        if (this.watcher !== null) {
            this.watcher.close().catch(() => {});
            this.watcher = null;
        }

        const poll = () => {
            if (this.muted) return;
            if (Date.now() < this.resumeAt) return;
            this.onChangeCallback();
        };

        this.pollInterval = setInterval(poll, this.pollIntervalMs);
        setTimeout(poll, 0);
    }

    private getGitWatchTargets(repo: string): string[] {
        const dotGitPath = nodePath.join(repo, '.git');
        const targets = [dotGitPath];

        try {
            const dotGitStats = fs.statSync(dotGitPath);
            if (dotGitStats.isFile()) {
                const dotGitContents = fs.readFileSync(dotGitPath, 'utf8').trim();
                const gitDirPrefix = 'gitdir:';
                if (dotGitContents.toLowerCase().startsWith(gitDirPrefix)) {
                    const gitDirRawPath = dotGitContents.slice(gitDirPrefix.length).trim();
                    const resolvedGitDirPath = nodePath.isAbsolute(gitDirRawPath)
                        ? gitDirRawPath
                        : nodePath.resolve(repo, gitDirRawPath);
                    if (resolvedGitDirPath !== dotGitPath) {
                        targets.push(resolvedGitDirPath);
                    }
                }
            }
        } catch {
            // Best-effort only. Fallback to watching .git path directly.
        }

        return targets;
    }
}

/**
 * Create a file watcher for a repository.
 */
export function createFileWatcher(onChange: () => void, config?: FileWatcherConfig): RepoFileWatcher {
    return new RepoFileWatcher(onChange, config);
}

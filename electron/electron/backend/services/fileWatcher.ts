/**
 * Repository File Watcher
 * Ported from git-graph/src/repoFileWatcher.ts
 * Uses chokidar for file system watching in Electron
 */

import * as chokidar from 'chokidar';
import { Disposable, toDisposable } from '../../../src/lib/utils/disposable';

// Regex to match files that should trigger a refresh
const FILE_CHANGE_REGEX =
	/(^\.git\/(config|index|HEAD|refs\/stash|refs\/heads\/.*|refs\/remotes\/.*|refs\/tags\/.*)$)|(^(?!\.git).*$)|(^\.git[^/]+$)/;

export interface FileWatcherConfig {
	debounceMs?: number;
	resumeDelayMs?: number;
}

/**
 * Watches a Git repository for file events.
 */
export class RepoFileWatcher extends Disposable {
	private repo: string | null = null;
	private watcher: chokidar.FSWatcher | null = null;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	private muted: boolean = false;
	private resumeAt: number = 0;
	private readonly debounceMs: number;
	private readonly resumeDelayMs: number;

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
	}

	/**
	 * Start watching a repository for file events.
	 */
	public start(repo: string): void {
		if (this.watcher !== null) {
			this.stop();
		}

		this.repo = repo;

		// Create a file watcher for the repository
		this.watcher = chokidar.watch(repo, {
			ignoreInitial: true,
			ignored: (path: string) => {
				// Ignore .git/objects and .git/logs for performance
				if (path.includes('.git/objects') || path.includes('.git/logs')) {
					return true;
				}
				return false;
			},
			persistent: true,
			ignorePermissionErrors: true,
		});

		this.watcher.on('add', (path) => this.refresh(path));
		this.watcher.on('change', (path) => this.refresh(path));
		this.watcher.on('unlink', (path) => this.refresh(path));
		this.watcher.on('addDir', (path) => this.refresh(path));
		this.watcher.on('unlinkDir', (path) => this.refresh(path));

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
		return this.watcher !== null;
	}

	/**
	 * Handle a file event triggered by the file system watcher.
	 */
	private refresh(filePath: string): void {
		if (this.muted) return;
		if (!this.repo) return;

		// Get relative path from repo root
		const relativePath = filePath.replace(this.repo + '/', '');

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
}

/**
 * Create a file watcher for a repository.
 */
export function createFileWatcher(
	onChange: () => void,
	config?: FileWatcherConfig
): RepoFileWatcher {
	return new RepoFileWatcher(onChange, config);
}

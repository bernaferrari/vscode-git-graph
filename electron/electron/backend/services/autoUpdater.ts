/**
 * Auto-Updater Service
 * Handles automatic application updates using electron-updater
 */

import { BrowserWindow, dialog, Notification } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';

import { getLogger } from './logger';

export interface UpdateStatus {
	checking: boolean;
	downloading: boolean;
	available: boolean;
	progress: number;
	version: string | null;
	releaseNotes: string | null;
	error: string | null;
}

type UpdateCallback = (status: UpdateStatus) => void;

class AutoUpdateManager {
	private logger = getLogger();
	private callbacks: Set<UpdateCallback> = new Set();
	private status: UpdateStatus = {
		checking: false,
		downloading: false,
		available: false,
		progress: 0,
		version: null,
		releaseNotes: null,
		error: null,
	};

	constructor() {
		this.setupAutoUpdater();
	}

	private setupAutoUpdater(): void {
		// Configure auto-updater
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = true;

		// Checking for update
		autoUpdater.on('checking-for-update', () => {
			this.updateStatus({ checking: true, error: null });
			this.logger.log('Checking for updates...');
		});

		// Update available
		autoUpdater.on('update-available', (info: UpdateInfo) => {
			this.updateStatus({
				checking: false,
				available: true,
				version: info.version,
				releaseNotes: typeof info.releaseNotes === 'string'
					? info.releaseNotes
					: info.releaseNotes?.[0]?.note ?? null,
			});
			this.logger.log(`Update available: v${info.version}`);
			this.notifyUpdateAvailable(info);
		});

		// No update available
		autoUpdater.on('update-not-available', () => {
			this.updateStatus({ checking: false, available: false });
			this.logger.log('No updates available');
		});

		// Download progress
		autoUpdater.on('download-progress', (progress) => {
			this.updateStatus({
				downloading: true,
				progress: progress.percent,
			});
			this.logger.log(`Download progress: ${progress.percent.toFixed(1)}%`);
		});

		// Update downloaded
		autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
			this.updateStatus({
				downloading: false,
				progress: 100,
				version: info.version,
			});
			this.logger.log(`Update downloaded: v${info.version}`);
			this.notifyUpdateDownloaded(info);
		});

		// Error
		autoUpdater.on('error', (error) => {
			this.updateStatus({
				checking: false,
				downloading: false,
				error: error.message,
			});
			this.logger.logError(`Update error: ${error.message}`);
		});
	}

	private updateStatus(partial: Partial<UpdateStatus>): void {
		this.status = { ...this.status, ...partial };
		this.callbacks.forEach((callback) => { callback(this.status); });
	}

	private notifyUpdateAvailable(info: UpdateInfo): void {
		const notification = new Notification({
			title: 'Git Graph Update Available',
			body: `Version ${info.version} is available. Click to download.`,
		});

			notification.on('click', () => {
				void this.downloadUpdate();
			});

		notification.show();
	}

	private notifyUpdateDownloaded(info: UpdateInfo): void {
		const notification = new Notification({
			title: 'Git Graph Update Ready',
			body: `Version ${info.version} has been downloaded. Restart to install.`,
		});

		notification.on('click', () => {
			this.quitAndInstall();
		});

		notification.show();
	}

	/**
	 * Subscribe to update status changes
	 */
	public subscribe(callback: UpdateCallback): () => void {
		this.callbacks.add(callback);
		return () => {
			this.callbacks.delete(callback);
		};
	}

	/**
	 * Get current update status
	 */
	public getStatus(): UpdateStatus {
		return this.status;
	}

	/**
	 * Check for updates
	 */
		public async checkForUpdates(): Promise<void> {
			try {
				await autoUpdater.checkForUpdates();
			} catch (error) {
				this.logger.logError(`Failed to check for updates: ${String(error)}`);
			}
		}

	/**
	 * Download the available update
	 */
	public async downloadUpdate(): Promise<void> {
		try {
			this.updateStatus({ downloading: true, progress: 0 });
			await autoUpdater.downloadUpdate();
		} catch (error) {
			this.updateStatus({ downloading: false, error: String(error) });
		}
	}

	/**
	 * Quit and install the update
	 */
	public quitAndInstall(): void {
		autoUpdater.quitAndInstall();
	}

	/**
	 * Show update dialog to user
	 */
	public async showUpdateDialog(window: BrowserWindow, info: UpdateInfo): Promise<void> {
		const result = await dialog.showMessageBox(window, {
			type: 'info',
			title: 'Git Graph Update',
			message: `Version ${info.version} is available`,
			detail: `Release notes:\n${this.status.releaseNotes ?? 'No release notes available.'}`,
			buttons: ['Download', 'Later'],
			defaultId: 0,
			cancelId: 1,
		});

		if (result.response === 0) {
			await this.downloadUpdate();
		}
	}

	/**
	 * Show install dialog to user
	 */
	public async showInstallDialog(window: BrowserWindow, info: UpdateInfo): Promise<void> {
		const result = await dialog.showMessageBox(window, {
			type: 'info',
			title: 'Git Graph Update Ready',
			message: `Version ${info.version} is ready to install`,
			detail: 'Restart the application to install the update.',
			buttons: ['Restart Now', 'Later'],
			defaultId: 0,
			cancelId: 1,
		});

		if (result.response === 0) {
			this.quitAndInstall();
		}
	}
}

// Singleton instance
let autoUpdateInstance: AutoUpdateManager | null = null;

export function getAutoUpdateManager(): AutoUpdateManager {
	if (!autoUpdateInstance) {
		autoUpdateInstance = new AutoUpdateManager();
	}
	return autoUpdateInstance;
}

export function resetAutoUpdateManager(): void {
	autoUpdateInstance = null;
}

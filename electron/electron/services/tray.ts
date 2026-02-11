/**
 * System Tray Manager
 * System tray icon with quick actions
 */

import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron';
import path from 'path';

export interface TrayConfig {
	icon: string;
	tooltip: string;
	onClick?: () => void;
}

export class SystemTrayManager {
	private tray: Tray | null = null;
	private mainWindow: BrowserWindow | null = null;

	constructor() {
		this.setupTray();
	}

	private setupTray() {
		// Wait for app to be ready
		app.whenReady().then(() => {
			this.createTray();
		});
	}

	private createTray() {
		// Create tray icon
		const iconPath = this.getIconPath();
		const icon = nativeImage.createFromPath(iconPath);

		// Resize for tray (typically 16x16 or 22x22 depending on platform)
		const trayIcon = icon.resize({ width: 16, height: 16 });

		this.tray = new Tray(trayIcon);
		this.tray.setToolTip('Git Graph');

		// Set up click handler
		this.tray.on('click', () => {
			this.showWindow();
		});

		// Build context menu
		this.buildMenu();
	}

	private getIconPath(): string {
		const isDev = !app.isPackaged;
		const iconPath = isDev
			? path.join(__dirname, '../../../public/icon.png')
			: path.join(process.resourcesPath, 'icon.png');
		return iconPath;
	}

	private buildMenu() {
		if (!this.tray) return;

		const menu = Menu.buildFromTemplate([
			{
				label: 'Open Git Graph',
				click: () => this.showWindow(),
			},
			{ type: 'separator' },
			{
				label: 'Quick Clone...',
				click: () => this.quickClone(),
			},
			{ type: 'separator' },
			{
				label: 'Recent Repositories',
				submenu: this.buildRecentReposMenu(),
			},
			{ type: 'separator' },
			{
				label: 'Fetch All',
				click: () => this.fetchAll(),
			},
			{
				label: 'Push Current Branch',
				click: () => this.pushCurrent(),
			},
			{ type: 'separator' },
			{
				label: 'Create Branch...',
				accelerator: 'CmdOrCtrl+B',
				click: () => this.showWindow('create-branch'),
			},
			{
				label: 'Create Commit...',
				accelerator: 'CmdOrCtrl+Return',
				click: () => this.showWindow('commit'),
			},
			{ type: 'separator' },
			{
				label: 'Check for Updates',
				click: () => this.checkForUpdates(),
			},
			{
				label: 'Settings',
				accelerator: 'CmdOrCtrl+,',
				click: () => this.showWindow('settings'),
			},
			{ type: 'separator' },
			{
				label: 'Quit Git Graph',
				accelerator: 'CmdOrCtrl+Q',
				click: () => app.quit(),
			},
		]);

		this.tray.setContextMenu(menu);
	}

	private buildRecentReposMenu(): Electron.MenuItem[] {
		// Get recent repos from store
		const recentRepos = this.getRecentRepos();

		if (recentRepos.length === 0) {
			return [
				{
					label: 'No recent repositories',
					enabled: false,
				} as Electron.MenuItem,
			];
		}

		return recentRepos.slice(0, 5).map((repo, index) => ({
			label: repo.name,
			accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
			click: () => this.openRepo(repo.path),
		})) as Electron.MenuItem[];
	}

	private getRecentRepos(): Array<{ name: string; path: string }> {
		// This would be fetched from a store
		return [];
	}

	private showWindow(action?: string) {
		if (!this.mainWindow) {
			this.mainWindow = BrowserWindow.getAllWindows()[0];
		}

		if (this.mainWindow) {
			if (this.mainWindow.isMinimized()) {
				this.mainWindow.restore();
			}
			this.mainWindow.show();
			this.mainWindow.focus();

			if (action) {
				this.mainWindow.webContents.send('tray-action', action);
			}
		}
	}

	private quickClone() {
		this.showWindow('quick-clone');
	}

	private fetchAll() {
		// Send IPC to fetch all remotes
		this.mainWindow?.webContents.send('git-action', 'fetch-all');
	}

	private pushCurrent() {
		this.mainWindow?.webContents.send('git-action', 'push-current');
	}

	private openRepo(repoPath: string) {
		this.showWindow();
		this.mainWindow?.webContents.send('open-repo', repoPath);
	}

	private checkForUpdates() {
		this.mainWindow?.webContents.send('check-updates');
	}

	// Update badge (for notification count)
	updateBadge(count: number) {
		if (!this.tray) return;

		// On macOS, we can set a badge on the dock icon
		if (process.platform === 'darwin') {
			app.dock.setBadge(count > 0 ? String(count) : '');
		}

		// On Windows/Linux, we can update the tray icon with a badge
		if (process.platform === 'win32' || process.platform === 'linux') {
			// Create a new icon with the count overlaid
			// This would require image manipulation
		}
	}

	destroy() {
		if (this.tray) {
			this.tray.destroy();
			this.tray = null;
		}
	}
}

// Singleton
let trayManager: SystemTrayManager | null = null;

export function getTrayManager(): SystemTrayManager {
	if (!trayManager) {
		trayManager = new SystemTrayManager();
	}
	return trayManager;
}

export default SystemTrayManager;

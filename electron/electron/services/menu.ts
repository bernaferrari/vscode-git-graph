/**
 * Application Menu Manager
 * Native menus for macOS, Windows, and Linux
 */

import { app, Menu, BrowserWindow, shell, dialog } from 'electron';

export interface MenuState {
	repoName: string | null;
	currentBranch: string | null;
	hasChanges: boolean;
	canUndo: boolean;
	canRedo: boolean;
}

class MenuManager {
	private mainWindow: BrowserWindow | null = null;
	private state: MenuState = {
		repoName: null,
		currentBranch: null,
		hasChanges: false,
		canUndo: false,
		canRedo: false,
	};

	constructor() {
		void app.whenReady().then(() => {
			this.buildMenu();
		});
	}

	setWindow(window: BrowserWindow) {
		this.mainWindow = window;
	}

	updateState(state: Partial<MenuState>) {
		this.state = { ...this.state, ...state };
		this.buildMenu();
	}

	private buildMenu() {
		const template: Electron.MenuItemConstructorOptions[] = [
			// App menu (macOS only)
			...(process.platform === 'darwin' ? [this.buildAppMenu()] : []),
			
			// File menu
			this.buildFileMenu(),
			
			// Edit menu
			this.buildEditMenu(),
			
			// View menu
			this.buildViewMenu(),
			
			// Repository menu
			this.buildRepositoryMenu(),
			
			// Branch menu
			this.buildBranchMenu(),
			
			// Remote menu
			this.buildRemoteMenu(),
			
			// Tools menu
			this.buildToolsMenu(),
			
			// Help menu
			this.buildHelpMenu(),
		];

		const menu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(menu);
	}

	private buildAppMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: app.getName(),
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				{
					label: 'Preferences...',
					accelerator: 'CmdOrCtrl+,',
					click: () => { this.sendAction('open-settings'); },
				},
				{ type: 'separator' },
				{ role: 'services', submenu: [] },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideOthers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ role: 'quit' },
			],
		};
	}

	private buildFileMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'File',
			submenu: [
					{
						label: 'Open Repository...',
						accelerator: 'CmdOrCtrl+O',
						click: () => {
							void this.openRepository();
						},
					},
				{
					label: 'Clone Repository...',
					accelerator: 'CmdOrCtrl+Shift+O',
					click: () => { this.sendAction('clone-repo'); },
				},
				{
					label: 'Init New Repository...',
					click: () => { this.sendAction('init-repo'); },
				},
				{ type: 'separator' },
				{
					label: 'Recent Repositories',
					submenu: this.buildRecentReposMenu(),
				},
				{ type: 'separator' },
				{
					label: 'Close Repository',
					accelerator: 'CmdOrCtrl+W',
					click: () => { this.sendAction('close-repo'); },
				},
				...(process.platform === 'darwin' ? [] : [
					{ type: 'separator' } as const,
					{ role: 'quit' } as const,
				]),
			],
		};
	}

	private buildEditMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Edit',
			submenu: [
				{ role: 'undo', enabled: this.state.canUndo },
				{ role: 'redo', enabled: this.state.canRedo },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'delete' },
				{ type: 'separator' },
				{ role: 'selectAll' },
				{ type: 'separator' },
				{
					label: 'Find...',
					accelerator: 'CmdOrCtrl+F',
					click: () => { this.sendAction('find'); },
				},
				{
					label: 'Search All Commits...',
					accelerator: 'CmdOrCtrl+Shift+F',
					click: () => { this.sendAction('search-commits'); },
				},
			],
		};
	}

	private buildViewMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'View',
			submenu: [
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click: () => { this.sendAction('refresh'); },
				},
				{ role: 'forceReload' },
				{ type: 'separator' },
				{
					label: 'Toggle Sidebar',
					accelerator: 'CmdOrCtrl+B',
					click: () => { this.sendAction('toggle-sidebar'); },
				},
				{
					label: 'Toggle Commit Details',
					accelerator: 'CmdOrCtrl+D',
					click: () => { this.sendAction('toggle-commit-details'); },
				},
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
				{ type: 'separator' },
				{
					label: 'Toggle Developer Tools',
					accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
					click: () => this.mainWindow?.webContents.toggleDevTools(),
				},
			],
		};
	}

	private buildRepositoryMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Repository',
			submenu: [
				{
					label: 'Commit...',
					accelerator: 'CmdOrCtrl+Return',
					click: () => { this.sendAction('commit'); },
				},
				{
					label: 'Stage All Changes',
					accelerator: 'CmdOrCtrl+Shift+A',
					click: () => { this.sendAction('stage-all'); },
				},
				{
					label: 'Unstage All',
					click: () => { this.sendAction('unstage-all'); },
				},
				{ type: 'separator' },
				{
					label: 'Stash Changes...',
					click: () => { this.sendAction('stash-save'); },
				},
				{
					label: 'Pop Stash',
					click: () => { this.sendAction('stash-pop'); },
				},
				{
					label: 'Manage Stashes...',
					click: () => { this.sendAction('stash-manage'); },
				},
				{ type: 'separator' },
				{
					label: 'Reset to HEAD...',
					click: () => { this.sendAction('reset-head'); },
				},
				{
					label: 'Undo Last Commit',
					click: () => { this.sendAction('undo-commit'); },
				},
				{ type: 'separator' },
				{
					label: 'Statistics',
					click: () => { this.sendAction('statistics'); },
				},
				{
					label: 'Health Check',
					click: () => { this.sendAction('health-check'); },
				},
			],
		};
	}

	private buildBranchMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Branch',
			submenu: [
				{
					label: 'Create Branch...',
					accelerator: 'CmdOrCtrl+N',
					click: () => { this.sendAction('create-branch'); },
				},
				{
					label: 'Delete Branch...',
					click: () => { this.sendAction('delete-branch'); },
				},
				{
					label: 'Rename Branch...',
					click: () => { this.sendAction('rename-branch'); },
				},
				{ type: 'separator' },
				{
					label: 'Checkout...',
					accelerator: 'CmdOrCtrl+Shift+N',
					click: () => { this.sendAction('checkout-branch'); },
				},
				{
					label: 'Compare Branches...',
					click: () => { this.sendAction('compare-branches'); },
				},
				{ type: 'separator' },
				{
					label: 'Merge into Current Branch...',
					accelerator: 'CmdOrCtrl+M',
					click: () => { this.sendAction('merge-branch'); },
				},
				{
					label: 'Rebase Current Branch...',
					click: () => { this.sendAction('rebase-branch'); },
				},
				{ type: 'separator' },
				{
					label: 'Create Tag...',
					click: () => { this.sendAction('create-tag'); },
				},
				{
					label: 'Delete Tag...',
					click: () => { this.sendAction('delete-tag'); },
				},
			],
		};
	}

	private buildRemoteMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Remote',
			submenu: [
				{
					label: 'Fetch',
					accelerator: 'F5',
					click: () => { this.sendAction('fetch'); },
				},
				{
					label: 'Pull',
					accelerator: 'CmdOrCtrl+Shift+P',
					click: () => { this.sendAction('pull'); },
				},
				{
					label: 'Push',
					accelerator: 'CmdOrCtrl+P',
					click: () => { this.sendAction('push'); },
				},
				{ type: 'separator' },
				{
					label: 'Force Push',
					click: () => { this.sendAction('force-push'); },
				},
				{ type: 'separator' },
				{
					label: 'Manage Remotes...',
					click: () => { this.sendAction('manage-remotes'); },
				},
				{ type: 'separator' },
				{
					label: 'Create Pull Request...',
					click: () => { this.sendAction('create-pr'); },
				},
			],
		};
	}

	private buildToolsMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Tools',
			submenu: [
				{
					label: 'Command Palette...',
					accelerator: 'CmdOrCtrl+Shift+P',
					click: () => { this.sendAction('command-palette'); },
				},
				{
					label: 'Git Configuration...',
					click: () => { this.sendAction('git-config'); },
				},
				{
					label: 'Git Ignore Editor...',
					click: () => { this.sendAction('gitignore'); },
				},
				{ type: 'separator' },
				{
					label: 'Terminal',
					click: () => { this.sendAction('terminal'); },
				},
				{
					label: 'Open in Finder',
					click: () => { this.openInFinder(); },
				},
				{ type: 'separator' },
				{
					label: 'Git Flow',
					click: () => { this.sendAction('gitflow'); },
				},
				{
					label: 'Git Bisect',
					click: () => { this.sendAction('bisect'); },
				},
				{ type: 'separator' },
				{
					label: 'Worktrees...',
					click: () => { this.sendAction('worktrees'); },
				},
				{
					label: 'Submodules...',
					click: () => { this.sendAction('submodules'); },
				},
				{
					label: 'LFS Management...',
					click: () => { this.sendAction('lfs'); },
				},
			],
		};
	}

	private buildHelpMenu(): Electron.MenuItemConstructorOptions {
		return {
			label: 'Help',
			submenu: [
				{
					label: 'Keyboard Shortcuts',
					accelerator: '?',
					click: () => { this.sendAction('keyboard-shortcuts'); },
				},
					{
						label: 'Documentation',
						click: () => {
							void shell.openExternal('https://github.com/user/git-graph#readme');
						},
					},
				{ type: 'separator' },
					{
						label: 'Report Issue',
						click: () => {
							void shell.openExternal('https://github.com/user/git-graph/issues');
						},
					},
					{
						label: 'Release Notes',
						click: () => {
							void shell.openExternal('https://github.com/user/git-graph/releases');
						},
					},
				{ type: 'separator' },
				{
					label: 'Check for Updates...',
					click: () => { this.sendAction('check-updates'); },
				},
				...(process.platform === 'darwin' ? [] : [
					{ type: 'separator' } as const,
					{
						label: 'About',
						click: () => { this.showAbout(); },
					} as const,
				]),
			],
		};
	}

	private buildRecentReposMenu(): Electron.MenuItemConstructorOptions[] {
		// Get from store
		const recentRepos: string[] = [];

		if (recentRepos.length === 0) {
			return [{ label: 'No recent repositories', enabled: false }];
		}

		return recentRepos.map((repo, i) => ({
			label: repo,
			accelerator: i < 9 ? `CmdOrCtrl+${String(i + 1)}` : undefined,
			click: () => { this.openRepo(repo); },
		}));
	}

	private sendAction(action: string, data?: unknown) {
		this.mainWindow?.webContents.send('menu-action', { action, data });
	}

	private async openRepository() {
		const window = this.mainWindow ?? BrowserWindow.getAllWindows()[0];
		const result = window
			? await dialog.showOpenDialog(window, {
				properties: ['openDirectory'],
				title: 'Open Repository',
			})
			: await dialog.showOpenDialog({
				properties: ['openDirectory'],
				title: 'Open Repository',
			});

		if (!result.canceled && result.filePaths[0]) {
			this.sendAction('open-repo', result.filePaths[0]);
		}
	}

	private openRepo(path: string) {
		this.sendAction('open-repo', path);
	}

	private openInFinder() {
		this.sendAction('open-in-finder');
	}

	private showAbout() {
		const window = this.mainWindow ?? BrowserWindow.getAllWindows()[0];
		void dialog.showMessageBox(window, {
			type: 'info',
			title: 'About Git Graph',
			message: 'Git Graph',
			detail: `Version: ${app.getVersion()}\n\nA beautiful Git client for everyone.`,
		});
	}
}

// Singleton
let menuManager: MenuManager | null = null;

export function getMenuManager(): MenuManager {
	if (!menuManager) {
		menuManager = new MenuManager();
	}
	return menuManager;
}

export default MenuManager;

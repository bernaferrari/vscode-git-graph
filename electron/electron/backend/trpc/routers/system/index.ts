/**
 * System router for application-level operations.
 * Handles window management and other system tasks.
 */

import { dialog, app, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { z } from 'zod';

import { signalReady } from './signalReady';
import { getAutoUpdateManager } from '../../../services/autoUpdater';

const hasCommand = (command: string): boolean => {
	try {
		const checkCommand = process.platform === 'win32' ? 'where' : 'which';
		const result = spawnSync(checkCommand, [command], { stdio: 'ignore' });
		return result.status === 0;
	} catch {
		return false;
	}
};

const resolvePathInRepo = (repo: string, targetPath: string): string => {
	const candidate = path.isAbsolute(targetPath) ? targetPath : path.join(repo, targetPath);
	const repoPath = path.resolve(repo);
	const resolvedTarget = path.resolve(candidate);

	if (resolvedTarget !== repoPath && !resolvedTarget.startsWith(`${repoPath}${path.sep}`)) {
		throw new Error('Invalid file path');
	}

	return resolvedTarget;
};

const launchTerminal = (repoPath: string): boolean => {
	if (process.platform === 'darwin') {
		try {
			spawn('open', ['-a', 'Terminal', repoPath], {
				detached: true,
				stdio: 'ignore',
			});
			return true;
		} catch {
			return false;
		}
	}

	if (process.platform === 'win32') {
		const windowsTerminals: Array<{ command: string; args: string[]; shell?: boolean }> = [
			{ command: 'wt', args: ['-d', repoPath] },
			{ command: 'powershell', args: [
				'-NoProfile',
				'-NoExit',
				'-Command',
				`Set-Location -LiteralPath ${JSON.stringify(repoPath)}`,
			] },
			{ command: 'cmd', args: ['/c', 'start', '', '/D', repoPath, 'cmd'], shell: true },
		];

		for (const terminal of windowsTerminals) {
			if (terminal.command !== 'cmd' && !hasCommand(terminal.command)) {
				continue;
			}

			try {
				spawn(terminal.command, terminal.args, {
					detached: true,
					stdio: 'ignore',
					shell: terminal.shell,
				}).unref();
				return true;
			} catch {
				continue;
			}
		}

		return false;
	}

	const linuxTerminals: Array<{ command: string; args: string[] }> = [
		{ command: 'x-terminal-emulator', args: ['--working-directory', repoPath] },
		{ command: 'gnome-terminal', args: ['--working-directory', repoPath] },
		{ command: 'konsole', args: ['--workdir', repoPath] },
		{ command: 'mate-terminal', args: ['--working-directory', repoPath] },
		{ command: 'xfce4-terminal', args: ['--working-directory', repoPath] },
		{ command: 'xterm', args: ['-e', process.env.SHELL ?? '/bin/bash', '-lc', `cd ${JSON.stringify(repoPath)} && exec ${process.env.SHELL ?? '/bin/bash'}`] },
	];

	for (const terminal of linuxTerminals) {
		if (!hasCommand(terminal.command)) {
			continue;
		}

		try {
			spawn(terminal.command, terminal.args, {
				detached: true,
				stdio: 'ignore',
			}).unref();
			return true;
		} catch {
			continue;
		}
	}

	return false;
};

const openTerminalProcedure = publicProcedure
	.input(
		z.object({
			path: z.string(),
		})
	)
	.mutation(async ({ input }) => {
		try {
			const launched = launchTerminal(input.path);
			if (!launched) {
				return {
					success: false,
					error: 'No supported terminal emulator found',
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to open terminal',
			};
		}
	});

export const systemRouter = router({
    // Called by renderer when React has rendered, to show the window
    signalReady: publicProcedure.mutation(({ ctx }) => signalReady(ctx.win)),

    // Show open dialog for selecting directories
    showOpenDialog: publicProcedure
        .input(
            z.object({
                title: z.string().optional(),
                properties: z.array(z.enum(['openFile', 'openDirectory', 'multiSelections'])).optional(),
            })
        )
        .mutation(async ({ input }) => {
            const options: Electron.OpenDialogOptions = {
                properties: input.properties ?? ['openDirectory'],
            };
            if (input.title) {
                options.title = input.title;
            }
            const result = await dialog.showOpenDialog(options);
            return {
                canceled: result.canceled,
                filePaths: result.filePaths,
            };
        }),

    // Reveal a repository path in the OS file explorer
    revealInFinder: publicProcedure
        .input(
            z.object({
                path: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                shell.showItemInFolder(input.path);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to reveal path',
                };
            }
        }),

    revealInRepo: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const fullPath = resolvePathInRepo(input.repo, input.path);
                shell.showItemInFolder(fullPath);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to reveal repository file',
                };
            }
        }),

    // Open a repository in OS terminal
    openTerminal: openTerminalProcedure,
    openTerminalInRepo: openTerminalProcedure,

    // Get app version
    getVersion: publicProcedure.query(() => {
        return app.getVersion();
    }),

    // Check for updates
    checkForUpdates: publicProcedure.mutation(async () => {
        const autoUpdate = getAutoUpdateManager();
        await autoUpdate.checkForUpdates();
        return autoUpdate.getStatus();
    }),

    // Get update status
    getUpdateStatus: publicProcedure.query(() => {
        return getAutoUpdateManager().getStatus();
    }),

    // Download update
    downloadUpdate: publicProcedure.mutation(async () => {
        const autoUpdate = getAutoUpdateManager();
        await autoUpdate.downloadUpdate();
        return autoUpdate.getStatus();
    }),

    // Quit and install update
    quitAndInstall: publicProcedure.mutation(() => {
        getAutoUpdateManager().quitAndInstall();
        return { success: true };
    }),
});

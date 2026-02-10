/**
 * System router for application-level operations.
 * Handles window management and other system tasks.
 */

import { dialog, app } from 'electron';
import { publicProcedure, router } from '@/app/backend/trpc/init';
import { z } from 'zod';

import { signalReady } from './signalReady';
import { getAutoUpdateManager } from '../../../services/autoUpdater';

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

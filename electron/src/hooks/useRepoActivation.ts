import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface ActivateRepoOptions {
    ensureRegistered?: boolean;
    showErrorToast?: boolean;
    errorTitle?: string;
}

interface ActivateRepoResult {
    root: string | null;
    error: string | null;
    canceled: boolean;
}

const DEFAULT_REPO_ERROR = 'Repository no longer exists or is not a Git repository.';

export function useRepoActivation() {
    const { setActiveRepo, addRecentRepo, activeRepo, repoLoadPhase, setRepoLoadState, resetRepoLoadState } =
        useAppStore();
    const utils = trpc.useUtils();
    const { mutateAsync: registerRepo } = trpc.repo.register.useMutation();
    const { mutateAsync: showOpenDialog } = trpc.system.showOpenDialog.useMutation();

    const refreshRepoCollections = useCallback(async () => {
        await Promise.allSettled([
            utils.repo.list.invalidate(),
            utils.repo.list.fetch(),
            utils.repo.recent.invalidate(),
            utils.repo.lastActive.invalidate(),
        ]);
    }, [utils.repo.list, utils.repo.recent, utils.repo.lastActive]);

    const activateRepoPath = useCallback(
        async (path: string, options: ActivateRepoOptions = {}): Promise<ActivateRepoResult> => {
            const {
                ensureRegistered = true,
                showErrorToast = true,
                errorTitle = 'Failed to open repository',
            } = options;

            const phase = useAppStore.getState().repoLoadPhase;
            if (phase === 'dialog-open') {
                const error = 'Repository picker is already open.';
                return { root: null, error, canceled: true };
            }
            if (phase === 'validating' || phase === 'loading-graph') {
                const error = 'Another repository is already loading.';
                return { root: null, error, canceled: true };
            }

            setRepoLoadState({
                phase: ensureRegistered ? 'validating' : 'loading-graph',
                message: ensureRegistered ? 'Validating repository…' : 'Loading repository graph…',
                error: null,
                target: path,
            });
            try {
                let root = path;

                if (ensureRegistered) {
                    const registerResult = await registerRepo({ path });
                    if (registerResult.error || !registerResult.root) {
                        const error = registerResult.error ?? DEFAULT_REPO_ERROR;
                        setRepoLoadState({
                            phase: 'error',
                            message: 'Repository validation failed.',
                            error,
                            target: path,
                        });
                        if (showErrorToast) {
                            toast.error(errorTitle, { description: error });
                        }
                        return { root: null, error, canceled: false };
                    }
                    root = registerResult.root;
                }

                setActiveRepo(root);
                addRecentRepo(root);
                setRepoLoadState({
                    phase: 'loading-graph',
                    message: 'Loading repository graph…',
                    error: null,
                    target: root,
                });
                // Refresh repository lists in the background so UI can render immediately.
                void refreshRepoCollections().catch((error) => {
                    console.error('[repo-activation] Failed to refresh repository collections:', error);
                });
                return { root, error: null, canceled: false };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setRepoLoadState({
                    phase: 'error',
                    message: 'Failed to load repository.',
                    error: message,
                    target: path,
                });
                if (showErrorToast) {
                    toast.error(errorTitle, { description: message });
                }
                return { root: null, error: message, canceled: false };
            }
        },
        [addRecentRepo, refreshRepoCollections, registerRepo, setActiveRepo, setRepoLoadState]
    );

    const openRepositoryDialog = useCallback(
        async (title: string = 'Open Repository'): Promise<ActivateRepoResult> => {
            const phase = useAppStore.getState().repoLoadPhase;
            if (phase === 'dialog-open') {
                return { root: null, error: null, canceled: true };
            }
            if (phase === 'validating' || phase === 'loading-graph') {
                return { root: null, error: 'Another repository is already loading.', canceled: true };
            }

            setRepoLoadState({
                phase: 'dialog-open',
                message: 'Waiting for repository selection…',
                error: null,
                target: null,
            });
            try {
                const result = await showOpenDialog({
                    title,
                    properties: ['openDirectory'],
                });

                if (result.canceled || !result.filePaths[0]) {
                    resetRepoLoadState(activeRepo ? 'ready' : 'idle');
                    return { root: null, error: null, canceled: true };
                }

                return await activateRepoPath(result.filePaths[0], {
                    ensureRegistered: true,
                    showErrorToast: true,
                    errorTitle: 'Failed to open repository',
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                setRepoLoadState({
                    phase: 'error',
                    message: 'Repository picker failed.',
                    error: message,
                    target: null,
                });
                toast.error('Failed to open repository', { description: message });
                return { root: null, error: message, canceled: false };
            }
        },
        [activateRepoPath, showOpenDialog, setRepoLoadState, resetRepoLoadState, activeRepo]
    );

    const isRepoLoading = repoLoadPhase === 'validating' || repoLoadPhase === 'loading-graph';
    const isRepoBusy = isRepoLoading || repoLoadPhase === 'dialog-open';

    return {
        activateRepoPath,
        openRepositoryDialog,
        isRepoLoading,
        isRepoBusy,
        repoLoadPhase,
    };
}

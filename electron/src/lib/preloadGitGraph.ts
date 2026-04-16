let gitGraphPreloadPromise: Promise<unknown> | null = null;
let gitGraphPreloadScheduled = false;

type IdleRequestCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

interface IdleWindow {
    requestIdleCallback?: (callback: IdleRequestCallback) => number;
    cancelIdleCallback?: (handle: number) => void;
}

interface SchedulePreloadOptions {
    delayMs?: number;
}

function loadGitGraphModule(): Promise<unknown> {
    if (!gitGraphPreloadPromise) {
        gitGraphPreloadPromise = import('@/components/git-graph').catch((error: unknown) => {
            gitGraphPreloadPromise = null;
            throw error;
        });
    }
    return gitGraphPreloadPromise;
}

export function preloadGitGraph(): Promise<unknown> {
    return loadGitGraphModule();
}

export function scheduleGitGraphPreload(options: SchedulePreloadOptions = {}): () => void {
    if (gitGraphPreloadPromise || gitGraphPreloadScheduled) {
        return () => undefined;
    }

    const delayMs = Math.max(0, options.delayMs ?? 700);
    const idleWindow = window as IdleWindow;
    gitGraphPreloadScheduled = true;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let canceled = false;

    const run = () => {
        if (canceled) {
            return;
        }
        gitGraphPreloadScheduled = false;
        void loadGitGraphModule().catch((error: unknown) => {
            console.warn('[preload] Failed to preload Git Graph module:', error);
        });
    };

    timeoutId = window.setTimeout(() => {
        if (canceled) {
            return;
        }
        if (idleWindow.requestIdleCallback) {
            idleId = idleWindow.requestIdleCallback(() => {
                run();
            });
            return;
        }
        run();
    }, delayMs);

    return () => {
        canceled = true;
        gitGraphPreloadScheduled = false;
        window.clearTimeout(timeoutId);
        if (idleId !== null) {
            idleWindow.cancelIdleCallback?.(idleId);
        }
    };
}

import { useEffect, useMemo, useRef, useState } from 'react';

import { GraphLayoutCalculator, type GraphConfig, type GraphLayout } from '@/lib/graph/layout';

interface LayoutCommit {
    hash: string;
    parents: string[];
    stash?: unknown;
}

interface UseGraphLayoutWorkerOptions {
    commits: LayoutCommit[] | undefined;
    head: string | null;
    commitLookup: Record<string, number>;
    onlyFollowFirstParent: boolean;
    config: GraphConfig;
    muteConfig: {
        mergeCommits: boolean;
        commitsNotAncestorsOfHead: boolean;
    };
}

interface WorkerSuccessMessage {
    id: number;
    layout: GraphLayout;
}

interface WorkerErrorMessage {
    id: number;
    error: string;
}

export function useGraphLayoutWorker({
    commits,
    head,
    commitLookup,
    onlyFollowFirstParent,
    config,
    muteConfig,
}: UseGraphLayoutWorkerOptions): { layout: GraphLayout | null; isCalculating: boolean; error: string | null } {
    const [layout, setLayout] = useState<GraphLayout | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const latestRequestIdRef = useRef(0);

    const stableCommits = useMemo(() => commits ?? [], [commits]);

    useEffect(() => {
        if (stableCommits.length === 0) {
            setLayout(null);
            setError(null);
            setIsCalculating(false);
            return;
        }

        const requestId = ++requestIdRef.current;
        latestRequestIdRef.current = requestId;
        setIsCalculating(true);

        if (typeof Worker !== 'undefined') {
            const worker = new Worker(new URL('../../workers/graph-layout.worker.ts', import.meta.url), {
                type: 'module',
            });

            worker.onmessage = (event: MessageEvent<WorkerSuccessMessage | WorkerErrorMessage>) => {
                const payload = event.data;
                if (payload.id !== latestRequestIdRef.current) {
                    return;
                }

                if ('error' in payload) {
                    setError(payload.error);
                    setIsCalculating(false);
                    return;
                }

                setLayout(payload.layout);
                setError(null);
                setIsCalculating(false);
            };

            worker.onerror = (workerError) => {
                if (latestRequestIdRef.current !== requestId) {
                    return;
                }
                setError(workerError.message || 'Graph worker failed');
                setIsCalculating(false);
            };

            worker.postMessage({
                id: requestId,
                commits: stableCommits,
                head,
                commitLookup,
                onlyFollowFirstParent,
                config,
                muteConfig,
            });

            return () => {
                worker.terminate();
            };
        }

        let timeoutId: number | null = null;
        let idleId: number | null = null;

        const computeInMainThread = () => {
            try {
                const calculator = new GraphLayoutCalculator(config, muteConfig);
                const nextLayout = calculator.calculate(stableCommits, head, commitLookup, onlyFollowFirstParent);
                if (latestRequestIdRef.current !== requestId) {
                    return;
                }
                setLayout(nextLayout);
                setError(null);
            } catch (syncError) {
                if (latestRequestIdRef.current !== requestId) {
                    return;
                }
                setError(syncError instanceof Error ? syncError.message : 'Failed to calculate graph layout');
            } finally {
                if (latestRequestIdRef.current === requestId) {
                    setIsCalculating(false);
                }
            }
        };

        const requestIdleCallbackFn = (
            window as Window & {
                requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
            }
        ).requestIdleCallback;

        if (typeof requestIdleCallbackFn === 'function') {
            idleId = requestIdleCallbackFn(
                () => {
                    computeInMainThread();
                },
                { timeout: 350 }
            );
        } else {
            timeoutId = window.setTimeout(() => {
                computeInMainThread();
            }, 0);
        }

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
            }
        };
    }, [stableCommits, head, commitLookup, onlyFollowFirstParent, config, muteConfig]);

    return { layout, isCalculating, error };
}

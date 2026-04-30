import { useEffect, useMemo, useRef, useState } from 'react';

import type { GraphConfig, GraphLayout } from '@/lib/graph/layout';

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

interface WorkerRequestMessage {
    id: number;
    commits: LayoutCommit[];
    head: string | null;
    commitLookup: Record<string, number>;
    onlyFollowFirstParent: boolean;
    config: GraphConfig;
    muteConfig: {
        mergeCommits: boolean;
        commitsNotAncestorsOfHead: boolean;
    };
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
    const workerRef = useRef<Worker | null>(null);

    const stableCommits = useMemo(() => commits ?? [], [commits]);

    useEffect(() => {
        if (typeof Worker === 'undefined') {
            return;
        }

        try {
            const worker = new Worker(new URL('../../workers/graph-layout.worker.ts', import.meta.url), {
                type: 'module',
            });
            workerRef.current = worker;

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
                setError(workerError.message || 'Graph worker failed');
                setIsCalculating(false);
            };
        } catch {
            workerRef.current = null;
        }

        return () => {
            const worker = workerRef.current;
            workerRef.current = null;
            worker?.terminate();
        };
    }, []);

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

        const worker = workerRef.current;
        if (worker) {
            const request: WorkerRequestMessage = {
                id: requestId,
                commits: stableCommits,
                head,
                commitLookup,
                onlyFollowFirstParent,
                config,
                muteConfig,
            };
            worker.postMessage(request);
            return;
        }

        let timeoutId: number | null = null;
        let idleId: number | null = null;
        let disposed = false;

        const computeInMainThread = async () => {
            try {
                const { GraphLayoutCalculator } = await import('@/lib/graph/layout');
                if (disposed || latestRequestIdRef.current !== requestId) {
                    return;
                }
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
                    void computeInMainThread();
                },
                { timeout: 350 }
            );
        } else {
            timeoutId = window.setTimeout(() => {
                void computeInMainThread();
            }, 0);
        }

        return () => {
            disposed = true;
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

/// <reference lib="webworker" />

import { GraphLayoutCalculator, type GraphConfig, type GraphLayout } from '../lib/graph/layout';

interface WorkerCommit {
    hash: string;
    parents: string[];
    stash?: unknown | null;
}

interface GraphLayoutRequest {
    id: number;
    commits: WorkerCommit[];
    head: string | null;
    commitLookup: Record<string, number>;
    onlyFollowFirstParent: boolean;
    config: GraphConfig;
    muteConfig: {
        mergeCommits: boolean;
        commitsNotAncestorsOfHead: boolean;
    };
}

interface GraphLayoutSuccess {
    id: number;
    layout: GraphLayout;
}

interface GraphLayoutFailure {
    id: number;
    error: string;
}

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<GraphLayoutRequest>) => {
    const request = event.data;

    try {
        const calculator = new GraphLayoutCalculator(request.config, request.muteConfig);
        const layout = calculator.calculate(
            request.commits,
            request.head,
            request.commitLookup,
            request.onlyFollowFirstParent
        );

        const response: GraphLayoutSuccess = {
            id: request.id,
            layout,
        };
        workerScope.postMessage(response);
    } catch (error) {
        const response: GraphLayoutFailure = {
            id: request.id,
            error: error instanceof Error ? error.message : 'Failed to calculate graph layout',
        };
        workerScope.postMessage(response);
    }
};

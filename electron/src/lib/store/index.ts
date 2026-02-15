/**
 * Zustand Store for Git Graph Application State
 * Manages UI state and connects to backend via tRPC
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import type { GitRepoState } from '../types/state';

// ==================== Types ====================

export interface RepoInfo {
    path: string;
    name: string;
    isRepo: boolean;
    head: string | null;
    branches: string[];
}

export type RepoLoadPhase = 'idle' | 'dialog-open' | 'validating' | 'loading-graph' | 'ready' | 'error';

export interface AppState {
    // Repository management
    repos: Record<string, GitRepoState>;
    ignoredRepos: string[];
    recentRepos: string[];
    openedRepos: string[];
    activeRepo: string | null;
    repoLoading: boolean;
    repoLoadingCount: number;
    repoLoadPhase: RepoLoadPhase;
    repoLoadMessage: string | null;
    repoLoadError: string | null;
    repoLoadStartedAt: number | null;
    repoLoadTarget: string | null;

    // UI state
    sidebarOpen: boolean;
    repoNavMode: 'sidebar' | 'tabs';
    commitDetailsOpen: boolean;
    selectedCommit: string | null;
    findWidgetOpen: boolean;
    settingsOpen: boolean;

    // View state
    findIsCaseSensitive: boolean;
    findIsRegex: boolean;
    findOpenCommitDetailsView: boolean;

    // Loading states
    isLoading: boolean;
    operationLoading: boolean;
    operationLoadingCount: number;
    operationLabel: string | null;
    operationQueue: Array<{
        id: string;
        label: string;
        status: 'queued' | 'running';
    }>;
    error: string | null;
}

export interface AppActions {
    // Repository actions
    setRepos: (repos: Record<string, GitRepoState>) => void;
    addRepo: (path: string, state: GitRepoState) => void;
    removeRepo: (path: string) => void;
    setActiveRepo: (path: string | null) => void;
    ignoreRepo: (path: string) => void;
    unignoreRepo: (path: string) => void;
    updateRepoState: (path: string, state: Partial<GitRepoState>) => void;

    // Recent repos
    addRecentRepo: (path: string) => void;
    clearRecentRepos: () => void;
    addOpenedRepo: (path: string) => void;
    removeOpenedRepo: (path: string) => void;
    setRepoNavMode: (mode: 'sidebar' | 'tabs') => void;

    // UI actions
    setSidebarOpen: (open: boolean) => void;
    setCommitDetailsOpen: (open: boolean) => void;
    setSelectedCommit: (hash: string | null) => void;
    setFindWidgetOpen: (open: boolean) => void;
    setSettingsOpen: (open: boolean) => void;

    // View state
    setFindCaseSensitive: (value: boolean) => void;
    setFindRegex: (value: boolean) => void;
    setFindOpenCommitDetailsView: (value: boolean) => void;

    // Loading actions
    setLoading: (loading: boolean) => void;
    beginOperation: (label: string) => void;
    endOperation: () => void;
    enqueueOperation: (id: string, label: string) => void;
    markOperationRunning: (id: string) => void;
    removeOperation: (id: string) => void;
    cancelQueuedOperation: (id: string) => void;
    setError: (error: string | null) => void;
    setRepoLoading: (loading: boolean) => void;
    beginRepoLoading: () => void;
    endRepoLoading: () => void;
    setRepoLoadState: (next: {
        phase: RepoLoadPhase;
        message?: string | null;
        error?: string | null;
        target?: string | null;
    }) => void;
    resetRepoLoadState: (phase?: Extract<RepoLoadPhase, 'idle' | 'ready'>) => void;

    // Reset
    reset: () => void;
}

const initialState: AppState = {
    repos: {},
    ignoredRepos: [],
    recentRepos: [],
    openedRepos: [],
    activeRepo: null,
    repoLoading: false,
    repoLoadingCount: 0,
    repoLoadPhase: 'idle',
    repoLoadMessage: null,
    repoLoadError: null,
    repoLoadStartedAt: null,
    repoLoadTarget: null,

    sidebarOpen: true,
    repoNavMode: 'sidebar',
    commitDetailsOpen: false,
    selectedCommit: null,
    findWidgetOpen: false,
    settingsOpen: false,

    findIsCaseSensitive: false,
    findIsRegex: false,
    findOpenCommitDetailsView: false,

    isLoading: false,
    operationLoading: false,
    operationLoadingCount: 0,
    operationLabel: null,
    operationQueue: [],
    error: null,
};

export const useAppStore = create<AppState & AppActions>()(
    persist(
        subscribeWithSelector((set, _get) => ({
            ...initialState,

            // Repository actions
            setRepos: (repos) => set({ repos }),

            addRepo: (path, state) =>
                set((s) => ({
                    repos: { ...s.repos, [path]: state },
                })),

            removeRepo: (path) =>
                set((s) => {
                    const { [path]: _, ...rest } = s.repos;
                    return {
                        repos: rest,
                        activeRepo: s.activeRepo === path ? null : s.activeRepo,
                    };
                }),

            setActiveRepo: (path) =>
                set((s) => {
                    if (!path) {
                        return { activeRepo: null, selectedCommit: null };
                    }
                    const nextOpened = [path, ...s.openedRepos.filter((p) => p !== path)].slice(0, 20);
                    return { activeRepo: path, selectedCommit: null, openedRepos: nextOpened };
                }),

            ignoreRepo: (path) =>
                set((s) => ({
                    ignoredRepos: [...s.ignoredRepos, path],
                    repos: Object.fromEntries(Object.entries(s.repos).filter(([p]) => p !== path)),
                    activeRepo: s.activeRepo === path ? null : s.activeRepo,
                })),

            unignoreRepo: (path) =>
                set((s) => ({
                    ignoredRepos: s.ignoredRepos.filter((p) => p !== path),
                })),

            updateRepoState: (path, state) =>
                set((s) => ({
                    repos: {
                        ...s.repos,
                        [path]: { ...s.repos[path], ...state } as GitRepoState,
                    },
                })),

            // Recent repos
            addRecentRepo: (path) =>
                set((s) => {
                    const filtered = s.recentRepos.filter((p) => p !== path);
                    return { recentRepos: [path, ...filtered].slice(0, 10) };
                }),

            clearRecentRepos: () => set({ recentRepos: [] }),
            addOpenedRepo: (path) =>
                set((s) => {
                    const filtered = s.openedRepos.filter((p) => p !== path);
                    return { openedRepos: [path, ...filtered].slice(0, 20) };
                }),
            removeOpenedRepo: (path) =>
                set((s) => {
                    const nextOpened = s.openedRepos.filter((p) => p !== path);
                    return {
                        openedRepos: nextOpened,
                        activeRepo: s.activeRepo === path ? (nextOpened[0] ?? null) : s.activeRepo,
                    };
                }),
            setRepoNavMode: (mode) => set({ repoNavMode: mode }),

            // UI actions
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            setCommitDetailsOpen: (open) => set({ commitDetailsOpen: open }),
            setSelectedCommit: (hash) => set({ selectedCommit: hash }),
            setFindWidgetOpen: (open) => set({ findWidgetOpen: open }),
            setSettingsOpen: (open) => set({ settingsOpen: open }),

            // View state
            setFindCaseSensitive: (value) => set({ findIsCaseSensitive: value }),
            setFindRegex: (value) => set({ findIsRegex: value }),
            setFindOpenCommitDetailsView: (value) => set({ findOpenCommitDetailsView: value }),

            // Loading actions
            setLoading: (loading) => set({ isLoading: loading }),
            beginOperation: (label) =>
                set((s) => {
                    const nextCount = s.operationLoadingCount + 1;
                    return {
                        operationLoading: true,
                        operationLoadingCount: nextCount,
                        operationLabel: label,
                    };
                }),
            endOperation: () =>
                set((s) => {
                    const nextCount = Math.max(0, s.operationLoadingCount - 1);
                    return {
                        operationLoading: nextCount > 0,
                        operationLoadingCount: nextCount,
                        operationLabel: nextCount > 0 ? s.operationLabel : null,
                    };
                }),
            enqueueOperation: (id, label) =>
                set((s) => ({
                    operationQueue: [...s.operationQueue, { id, label, status: 'queued' }],
                })),
            markOperationRunning: (id) =>
                set((s) => ({
                    operationQueue: s.operationQueue.map((entry) =>
                        entry.id === id ? { ...entry, status: 'running' } : entry
                    ),
                })),
            removeOperation: (id) =>
                set((s) => ({
                    operationQueue: s.operationQueue.filter((entry) => entry.id !== id),
                })),
            cancelQueuedOperation: (id) =>
                set((s) => ({
                    operationQueue: s.operationQueue.filter((entry) => !(entry.id === id && entry.status === 'queued')),
                })),
            setError: (error) => set({ error }),
            setRepoLoading: (loading) =>
                set((s) => ({
                    repoLoading: loading,
                    repoLoadingCount: loading ? Math.max(1, s.repoLoadingCount) : 0,
                    repoLoadPhase: loading
                        ? s.repoLoadPhase === 'dialog-open'
                            ? 'validating'
                            : s.repoLoadPhase
                        : s.repoLoadPhase,
                    repoLoadStartedAt: loading ? (s.repoLoadStartedAt ?? Date.now()) : s.repoLoadStartedAt,
                })),
            beginRepoLoading: () =>
                set((s) => {
                    const nextCount = s.repoLoadingCount + 1;
                    return {
                        repoLoadingCount: nextCount,
                        repoLoading: true,
                        repoLoadPhase:
                            s.repoLoadPhase === 'dialog-open' || s.repoLoadPhase === 'idle'
                                ? 'validating'
                                : s.repoLoadPhase,
                        repoLoadStartedAt: s.repoLoadStartedAt ?? Date.now(),
                    };
                }),
            endRepoLoading: () =>
                set((s) => {
                    const nextCount = Math.max(0, s.repoLoadingCount - 1);
                    return {
                        repoLoadingCount: nextCount,
                        repoLoading: nextCount > 0,
                    };
                }),
            setRepoLoadState: (next) =>
                set((s) => {
                    const isLoadingPhase = next.phase === 'validating' || next.phase === 'loading-graph';
                    const resolvedMessage = next.message !== undefined ? next.message : s.repoLoadMessage;
                    const resolvedError =
                        next.error !== undefined ? next.error : next.phase === 'error' ? s.repoLoadError : null;
                    const resolvedTarget = next.target !== undefined ? next.target : s.repoLoadTarget;
                    const startedAt = isLoadingPhase ? (s.repoLoadStartedAt ?? Date.now()) : null;

                    return {
                        repoLoadPhase: next.phase,
                        repoLoadMessage: resolvedMessage,
                        repoLoadError: resolvedError,
                        repoLoadTarget: resolvedTarget,
                        repoLoadStartedAt: startedAt,
                        repoLoading: isLoadingPhase,
                        repoLoadingCount: isLoadingPhase ? Math.max(1, s.repoLoadingCount) : 0,
                    };
                }),
            resetRepoLoadState: (phase = 'idle') =>
                set({
                    repoLoadPhase: phase,
                    repoLoadMessage: null,
                    repoLoadError: null,
                    repoLoadStartedAt: null,
                    repoLoadTarget: null,
                    repoLoading: false,
                    repoLoadingCount: 0,
                }),

            // Reset
            reset: () => set(initialState),
        })),
        {
            name: 'git-graph-ui-state',
            version: 2,
            storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
            migrate: (persistedState, version) => {
                if (version < 2 && persistedState && typeof persistedState === 'object') {
                    const state = persistedState as Record<string, unknown>;
                    return {
                        ...state,
                        activeRepo: null,
                    };
                }
                return persistedState as AppState;
            },
            partialize: (state) => ({
                recentRepos: state.recentRepos,
                openedRepos: state.openedRepos,
                sidebarOpen: state.sidebarOpen,
                repoNavMode: state.repoNavMode,
            }),
        }
    )
);

// Selectors
export const selectRepos = (state: AppState) => state.repos;
export const selectActiveRepo = (state: AppState) => state.activeRepo;
export const selectActiveRepoState = (state: AppState) => (state.activeRepo ? state.repos[state.activeRepo] : null);
export const selectIsLoading = (state: AppState) => state.isLoading;
export const selectError = (state: AppState) => state.error;

// Export type
export type AppStore = typeof useAppStore;

/**
 * Zustand Store for Git Graph Application State
 * Manages UI state and connects to backend via tRPC
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GitRepoState } from '../types/state';

// ==================== Types ====================

export interface RepoInfo {
	path: string;
	name: string;
	isRepo: boolean;
	head: string | null;
	branches: string[];
}

export interface AppState {
	// Repository management
	repos: Record<string, GitRepoState>;
	ignoredRepos: string[];
	recentRepos: string[];
	activeRepo: string | null;
	repoLoading: boolean;

	// UI state
	sidebarOpen: boolean;
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
	setError: (error: string | null) => void;
	setRepoLoading: (loading: boolean) => void;

	// Reset
	reset: () => void;
}

const initialState: AppState = {
	repos: {},
	ignoredRepos: [],
	recentRepos: [],
	activeRepo: null,
	repoLoading: false,

	sidebarOpen: true,
	commitDetailsOpen: false,
	selectedCommit: null,
	findWidgetOpen: false,
	settingsOpen: false,

	findIsCaseSensitive: false,
	findIsRegex: false,
	findOpenCommitDetailsView: false,

	isLoading: false,
	error: null,
};

export const useAppStore = create<AppState & AppActions>()(
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

		setActiveRepo: (path) => set({ activeRepo: path, selectedCommit: null }),

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
		setError: (error) => set({ error }),
		setRepoLoading: (loading) => set({ repoLoading: loading }),

		// Reset
		reset: () => set(initialState),
	}))
);

// Selectors
export const selectRepos = (state: AppState) => state.repos;
export const selectActiveRepo = (state: AppState) => state.activeRepo;
export const selectActiveRepoState = (state: AppState) =>
	state.activeRepo ? state.repos[state.activeRepo] : null;
export const selectIsLoading = (state: AppState) => state.isLoading;
export const selectError = (state: AppState) => state.error;

// Export type
export type AppStore = typeof useAppStore;

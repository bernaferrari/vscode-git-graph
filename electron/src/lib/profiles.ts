/**
 * Profiles System
 * Allows switching between different Git configurations (Work/Personal/OSS)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GitProfile {
	id: string;
	name: string;
	icon: string;
	color: string;
	// Git config
	userName: string;
	userEmail: string;
	signingKey: string;
	// Preferences
	defaultRemote: string;
	defaultLensMode: 'guided' | 'craft' | 'control';
	preferredMergeStrategy: 'merge' | 'rebase' | 'squash';
	// Behavior
	autoFetchOnStartup: boolean;
	confirmBeforePush: boolean;
}

export interface RepoPolicy {
	repoPath: string;
	// Branch protection
	requireSignedCommits: boolean;
	allowedMergeStrategies: ('merge' | 'rebase' | 'squash')[];
	requireUpToDate: boolean;
	// Stacking
	enableStacking: boolean;
	defaultStackBase: string;
	// Custom
	customWorkflow: string;
}

const DEFAULT_PROFILES: GitProfile[] = [
	{
		id: 'default',
		name: 'Default',
		icon: 'User',
		color: 'blue',
		userName: '',
		userEmail: '',
		signingKey: '',
		defaultRemote: 'origin',
		defaultLensMode: 'craft',
		preferredMergeStrategy: 'merge',
		autoFetchOnStartup: true,
		confirmBeforePush: false,
	},
];

interface ProfilesState {
	profiles: GitProfile[];
	activeProfileId: string;
	repoPolicies: Record<string, RepoPolicy>;

	// Actions
	addProfile: (profile: Omit<GitProfile, 'id'>) => void;
	updateProfile: (id: string, updates: Partial<GitProfile>) => void;
	deleteProfile: (id: string) => void;
	setActiveProfile: (id: string) => void;

	getActiveProfile: () => GitProfile | undefined;

	// Repo policies
	setRepoPolicy: (repoPath: string, policy: Partial<RepoPolicy>) => void;
	getRepoPolicy: (repoPath: string) => RepoPolicy | undefined;
}

export const useProfiles = create<ProfilesState>()(
	persist(
		(set, get) => ({
			profiles: DEFAULT_PROFILES,
			activeProfileId: 'default',
			repoPolicies: {},

			addProfile: (profile) => {
				const id = `profile-${Date.now()}`;
				set((state) => ({
					profiles: [...state.profiles, { ...profile, id }],
				}));
			},

			updateProfile: (id, updates) => {
				set((state) => ({
					profiles: state.profiles.map((p) =>
						p.id === id ? { ...p, ...updates } : p
					),
				}));
			},

			deleteProfile: (id) => {
				set((state) => {
					const filtered = state.profiles.filter((p) => p.id !== id);
					return {
						profiles: filtered.length > 0 ? filtered : DEFAULT_PROFILES,
						activeProfileId:
							state.activeProfileId === id
								? filtered[0]?.id || 'default'
								: state.activeProfileId,
					};
				});
			},

			setActiveProfile: (id) => {
				set({ activeProfileId: id });
			},

			getActiveProfile: () => {
				const state = get();
				return state.profiles.find((p) => p.id === state.activeProfileId);
			},

			setRepoPolicy: (repoPath, policy) => {
				set((state) => ({
					repoPolicies: {
						...state.repoPolicies,
						[repoPath]: {
							repoPath,
							requireSignedCommits: false,
							allowedMergeStrategies: ['merge', 'rebase', 'squash'],
							enableStacking: false,
							defaultStackBase: 'main',
							customWorkflow: '',
							...state.repoPolicies[repoPath],
							...policy,
						},
					},
				}));
			},

			getRepoPolicy: (repoPath) => {
				return get().repoPolicies[repoPath];
			},
		}),
		{
			name: 'git-graph-profiles',
		}
	)
);

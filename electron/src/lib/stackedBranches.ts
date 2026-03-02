/**
 * Stacked Branches Support
 * Like GitButler/Graphite - manage dependent branches in a stack
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StackedBranch {
	id: string;
	name: string;
	baseBranch: string;
	parentId: string | null; // ID of parent branch in stack
	commitHash: string;
	prUrl?: string;
	status: 'draft' | 'ready' | 'merged' | 'stale';
	lastUpdated: number;
}

interface StackedBranchesState {
	stacks: Record<string, StackedBranch[]>; // keyed by repo path

	// Actions
	addBranch: (repoPath: string, branch: Omit<StackedBranch, 'id' | 'lastUpdated'>) => void;
	updateBranch: (repoPath: string, branchId: string, updates: Partial<StackedBranch>) => void;
	removeBranch: (repoPath: string, branchId: string) => void;
	reorderBranch: (repoPath: string, branchId: string, newParentId: string | null) => void;
	getStack: (repoPath: string) => StackedBranch[];
	getBranch: (repoPath: string, branchName: string) => StackedBranch | undefined;
}

export const useStackedBranches = create<StackedBranchesState>()(
	persist(
		(set, get) => ({
			stacks: {},

			addBranch: (repoPath, branch) => {
				const id = ['stack', String(Date.now()), Math.random().toString(36).slice(2, 11)].join('-');
				set((state) => ({
					stacks: {
						...state.stacks,
						[repoPath]: [
							...(state.stacks[repoPath] || []),
							{ ...branch, id, lastUpdated: Date.now() },
						],
					},
				}));
			},

			updateBranch: (repoPath, branchId, updates) => {
				set((state) => ({
					stacks: {
						...state.stacks,
						[repoPath]: (state.stacks[repoPath] || []).map((b) =>
							b.id === branchId ? { ...b, ...updates, lastUpdated: Date.now() } : b
						),
					},
				}));
			},

			removeBranch: (repoPath, branchId) => {
				set((state) => {
					const stack = state.stacks[repoPath] || [];
					// Also update children to point to new parent
					const branch = stack.find((b) => b.id === branchId);
					const updatedStack = stack
						.filter((b) => b.id !== branchId)
						.map((b) =>
							b.parentId === branchId
								? { ...b, parentId: branch?.parentId || null }
								: b
						);
					return { stacks: { ...state.stacks, [repoPath]: updatedStack } };
				});
			},

			reorderBranch: (repoPath, branchId, newParentId) => {
				set((state) => ({
					stacks: {
						...state.stacks,
						[repoPath]: (state.stacks[repoPath] || []).map((b) =>
							b.id === branchId ? { ...b, parentId: newParentId } : b
						),
					},
				}));
			},

			getStack: (repoPath) => {
				return get().stacks[repoPath] || [];
			},

			getBranch: (repoPath, branchName) => {
				return (get().stacks[repoPath] || []).find((b) => b.name === branchName);
			},
		}),
		{
			name: 'git-graph-stacked-branches',
		}
	)
);

// Helper to get stack order (topological)
export function getStackOrder(stack: StackedBranch[]): StackedBranch[] {
	const sorted: StackedBranch[] = [];
	const visited = new Set<string>();
	const inProgress = new Set<string>();

	function visit(branch: StackedBranch) {
		if (visited.has(branch.id)) return;
		if (inProgress.has(branch.id)) return; // Cycle detected

		inProgress.add(branch.id);

		// Find children (branches that have this as parent)
		const children = stack.filter((b) => b.parentId === branch.id);
		for (const child of children) {
			visit(child);
		}

		inProgress.delete(branch.id);
		visited.add(branch.id);
		sorted.unshift(branch);
	}

	// Start from root branches (no parent)
	const roots = stack.filter((b) => !b.parentId);
	for (const root of roots) {
		visit(root);
	}

	return sorted;
}

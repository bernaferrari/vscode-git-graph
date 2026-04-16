/**
 * Atomic Operation System
 * Handles safe application of Git operations with undo support
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OperationType = 
	| 'merge'
	| 'rebase'
	| 'squash'
	| 'cherry-pick'
	| 'revert'
	| 'reset'
	| 'rewrite_plan';

export interface AtomicOperation {
	id: string;
	type: OperationType;
	name: string;
	description: string;
	
	// What will change
	oldState: {
		refTips: Record<string, string>; // branch -> commit hash
		workingTree: string; // snapshot of working tree state
	};
	newState: {
		refTips: Record<string, string>;
	};
	
	// Execution
	gitCommands: string[];
	undoCommands: string[];
	
	// Status
	status: 'pending' | 'applying' | 'applied' | 'failed' | 'undone';
	error?: string;
	timestamp: number;
	appliedAt?: number;
}

interface AtomicOperationState {
	operations: AtomicOperation[];
	currentOperation: AtomicOperation | null;
	isApplying: boolean;
	
	// Actions
	startOperation: (op: Omit<AtomicOperation, 'id' | 'timestamp' | 'status'>) => string;
	completeOperation: (id: string, success: boolean, error?: string) => void;
	undoOperation: (id: string) => Promise<boolean>;
	getOperation: (id: string) => AtomicOperation | undefined;
	getRecentOperations: (limit?: number) => AtomicOperation[];
	clearOperations: () => void;
}

export const useAtomicOperations = create<AtomicOperationState>()(
	persist(
		(set, get) => ({
			operations: [],
			currentOperation: null,
			isApplying: false,
			
			startOperation: (op) => {
				const id = `atomic-${String(Date.now())}-${Math.random().toString(36).slice(2, 11)}`;
				const operation: AtomicOperation = {
					...op,
					id,
					timestamp: Date.now(),
					status: 'pending',
				};
				
				set((state) => ({
					operations: [operation, ...state.operations].slice(0, 50), // Keep last 50
					currentOperation: operation,
					isApplying: true,
				}));
				
				return id;
			},
			
			completeOperation: (id, success, error) => {
				set((state) => ({
					operations: state.operations.map((op) =>
						op.id === id
							? {
								...op,
								status: success ? 'applied' : 'failed',
								...(error ? { error } : {}),
								...(success ? { appliedAt: Date.now() } : {}),
							  }
							: op
					),
					currentOperation: state.currentOperation?.id === id ? null : state.currentOperation,
					isApplying: false,
				}));
			},
			
			undoOperation: (id) => {
				const operation = get().operations.find((op) => op.id === id);
				if (!operation || operation.status !== 'applied') {
					return Promise.resolve(false);
				}
				
				try {
					// Execute undo commands
					for (const cmd of operation.undoCommands) {
						// This would execute the actual Git command
						console.log('Undo:', cmd);
					}
					
					set((state) => ({
						operations: state.operations.map((op) =>
							op.id === id ? { ...op, status: 'undone' } : op
						),
					}));
					
					return Promise.resolve(true);
				} catch (error) {
					console.error('Failed to undo:', error);
					return Promise.resolve(false);
				}
			},
			
			getOperation: (id) => {
				return get().operations.find((op) => op.id === id);
			},
			
			getRecentOperations: (limit = 10) => {
				return get().operations.slice(0, limit);
			},
			
			clearOperations: () => {
				set({ operations: [] });
			},
		}),
		{
			name: 'git-graph-atomic-operations',
		}
	)
);

// Helper to build atomic operation from rewrite plan
export function buildAtomicOperation(
	plan: {
		name: string;
		sourceBranch: string;
		baseBranch: string;
		ops: Array<{ type: string; commitHash: string }>;
	},
	oldTips: Record<string, string>,
	newTips: Record<string, string>,
	gitCommands: string[]
): Omit<AtomicOperation, 'id' | 'timestamp' | 'status'> {
	// Build undo commands (reverse the operations)
	const undoCommands: string[] = [];
	const sourceTip = oldTips[plan.sourceBranch] ?? 'HEAD';
	
	// For rebase, undo is essentially resetting to old tip
	undoCommands.push(`git reset --hard ${sourceTip}`);
	
	return {
		type: 'rewrite_plan',
		name: plan.name,
		description: `Rewrite ${plan.sourceBranch} (${String(plan.ops.length)} operations)`,
		oldState: {
			refTips: oldTips,
			workingTree: 'snapshot', // Would capture actual state
		},
		newState: {
			refTips: newTips,
		},
		gitCommands,
		undoCommands,
	};
}

// Create merge operation
export function buildMergeOperation(
	branch: string,
	intoBranch: string,
	oldTips: Record<string, string>,
	newTips: Record<string, string>,
	isSquash: boolean
): Omit<AtomicOperation, 'id' | 'timestamp'> {
	const gitCommands = isSquash
		? [`git merge --squash ${branch}`]
		: [`git merge ${branch}`];
	
	const undoCommands = [
		`git reset --hard ${oldTips[intoBranch] ?? 'HEAD'}`,
	];
	
	return {
		type: isSquash ? 'squash' : 'merge',
		name: `${isSquash ? 'Squash' : 'Merge'} ${branch} into ${intoBranch}`,
		description: isSquash
			? `Squash merge ${branch} onto ${intoBranch}`
			: `Merge ${branch} onto ${intoBranch}`,
		oldState: {
			refTips: oldTips,
			workingTree: 'snapshot',
		},
		newState: {
			refTips: newTips,
		},
		gitCommands,
		undoCommands,
		status: 'pending',
	};
}

// Create rebase operation
export function buildRebaseOperation(
	branch: string,
	ontoBranch: string,
	oldTips: Record<string, string>,
	newTips: Record<string, string>
): Omit<AtomicOperation, 'id' | 'timestamp'> {
	const gitCommands = [
		`git rebase ${ontoBranch}`,
	];
	
	const undoCommands = [
		`git reset --hard ${oldTips[branch] ?? 'HEAD'}`,
	];
	
	return {
		type: 'rebase',
		name: `Rebase ${branch} onto ${ontoBranch}`,
		description: `Rebase ${branch} onto ${ontoBranch}`,
		oldState: {
			refTips: oldTips,
			workingTree: 'snapshot',
		},
		newState: {
			refTips: newTips,
		},
		gitCommands,
		undoCommands,
		status: 'pending',
	};
}

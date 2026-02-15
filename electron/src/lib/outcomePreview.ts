/**
 * Outcome Preview System
 * Shows what will happen BEFORE merge/rebase operations
 * Uses git merge-tree and sandbox worktrees for safe previews
 */

import { create } from 'zustand';

export type MergeStrategy = 'merge' | 'rebase' | 'squash';
export type OperationStatus = 'idle' | 'previewing' | 'applying' | 'success' | 'error';

export interface CommitPreview {
	hash: string;
	oldHash: string;
	message: string;
	action: 'unchanged' | 'new' | 'rewritten' | 'dropped' | 'moved';
	status: 'existing' | 'ghost' | 'removed';
}

export interface BranchPreview {
	name: string;
	oldTip: string;
	newTip: string | null;
	willMove: boolean;
	isRemote: boolean;
}

export interface ConflictPreview {
	file: string;
	type: 'both' | 'ours' | 'theirs';
	hunks: number;
}

export interface OperationPlan {
	id: string;
	type: 'merge' | 'rebase' | 'squash' | 'cherry-pick';
	source: string;
	target: string;
	commits: CommitPreview[];
	branches: BranchPreview[];
	conflicts: ConflictPreview[];
	willRewriteHistory: boolean;
	willForcePush: boolean;
	gitCommands: string[];
	estimatedDuration: string;
	riskLevel: 'low' | 'medium' | 'high';
}

export interface OutcomePreview {
	operation: 'merge' | 'rebase' | 'squash';
	sourceRef: string;
	targetRef: string;
	strategy: MergeStrategy;
	
	// Graph visualization data
	commits: CommitPreview[];
	branches: BranchPreview[];
	
	// Impact analysis
	conflicts: ConflictPreview[];
	conflictsCount: number;
	filesChanged: number;
	
	// Risk assessment
	willRewriteHistory: boolean;
	willForcePush: boolean;
	remoteBranchesAffected: string[];
	
	// Git commands that will run
	gitCommands: string[];
	
	// Timing
	estimatedDuration: string;
	riskLevel: 'low' | 'medium' | 'high';
	riskReasons: string[];
}

interface PreviewState {
	currentPreview: OutcomePreview | null;
	previewStatus: OperationStatus;
	isLoading: boolean;
	error: string | null;
	
	// Actions
	setPreview: (preview: OutcomePreview | null) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearPreview: () => void;
}

export const useOutcomePreview = create<PreviewState>((set) => ({
	currentPreview: null,
	previewStatus: 'idle',
	isLoading: false,
	error: null,
	
	setPreview: (preview) => set({ currentPreview: preview, previewStatus: preview ? 'previewing' : 'idle' }),
	setLoading: (isLoading) => set({ isLoading }),
	setError: (error) => set({ error, previewStatus: error ? 'error' : 'idle' }),
	clearPreview: () => set({ currentPreview: null, previewStatus: 'idle', error: null }),
}));

// Helper to analyze risk level
export function analyzeRiskLevel(
	willRewriteHistory: boolean,
	willForcePush: boolean,
	conflictsCount: number,
	remoteBranchesAffected: string[]
): { level: 'low' | 'medium' | 'high'; reasons: string[] } {
	const reasons: string[] = [];
	
	if (willRewriteHistory) {
		reasons.push('This will rewrite local history');
	}
	
	if (willForcePush) {
		reasons.push('Force push required to update remote');
	}
	
	if (remoteBranchesAffected.length > 0) {
		reasons.push(`Shared commits found on: ${remoteBranchesAffected.join(', ')}`);
	}
	
	if (conflictsCount > 5) {
		reasons.push(`${conflictsCount} files have conflicts`);
	} else if (conflictsCount > 0) {
		reasons.push(`${conflictsCount} file(s) will have conflicts`);
	}
	
	let level: 'low' | 'medium' | 'high' = 'low';
	if (willForcePush || willRewriteHistory) {
		level = 'medium';
	}
	if (remoteBranchesAffected.length > 0 || conflictsCount > 10) {
		level = 'high';
	}
	
	return { level, reasons };
}

// Friendly action names mapping
export const FRIENDLY_ACTIONS: Record<string, string> = {
	merge: 'Combine branches',
	rebase: 'Put my work on top of',
	squash: 'Combine commits',
	'cherry-pick': 'Copy change to',
	drop: 'Remove',
	reorder: 'Rearrange',
	fixup: 'Fix up',
	squash_commit: 'Combine',
	reword: 'Change message',
	move: 'Relocate',
	copy: 'Copy',
};

// Get Git terminology helper
export function getGitTerm(friendlyTerm: string): string {
	const terms: Record<string, string> = {
		'Combine branches': 'merge',
		'Put my work on top of': 'rebase',
		'Combine commits': 'squash/fixup',
		'Copy change to': 'cherry-pick',
		'Remove': 'drop',
		'Rearrange': 'reorder',
		'Change message': 'reword',
		'Relocate': 'move (cherry-pick + drop)',
		'Copy': 'cherry-pick',
	};
	return terms[friendlyTerm] || friendlyTerm;
}

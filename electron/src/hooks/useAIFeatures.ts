/**
 * AI Features Hook
 * Provides AI-powered commit message generation
 */

import { useState, useCallback } from 'react';
import { trpc } from '@/trpc/client';

interface AICommitSuggestion {
	message: string;
	description: string;
	confidence: number;
}

interface UseAIFeatures {
	// Commit message generation
	isGeneratingMessage: boolean;
	generateCommitMessage: (stagedFiles: string[], diff: string) => Promise<AICommitSuggestion | null>;
	lastSuggestion: AICommitSuggestion | null;

	// Commit series composition
	isComposingSeries: boolean;
	composeCommitSeries: (changes: Array<{ files: string[]; diff: string }>) => Promise<string[]>;

	// Conflict resolution help
	isAnalyzingConflict: boolean;
	suggestConflictResolution: (conflictContent: string) => Promise<string | null>;

	// General
	isAIEnabled: boolean;
	setAIEnabled: (enabled: boolean) => void;
}

export function useAIFeatures(): UseAIFeatures {
	const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
	const [isComposingSeries, setIsComposingSeries] = useState(false);
	const [isAnalyzingConflict, setIsAnalyzingConflict] = useState(false);
	const [lastSuggestion, setLastSuggestion] = useState<AICommitSuggestion | null>(null);
	const [isAIEnabled, setAIEnabled] = useState(true);

	// This would connect to an actual AI service
	// For now, we'll create a mock implementation that simulates AI
	const generateCommitMessage = useCallback(
		async (stagedFiles: string[], diff: string): Promise<AICommitSuggestion | null> => {
			if (!isAIEnabled) return null;

			setIsGeneratingMessage(true);
			try {
				// Simulate AI delay
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Simple heuristic-based suggestion (in production, this would call an AI API)
				const fileTypes = stagedFiles.map((f) => {
					if (f.endsWith('.ts') || f.endsWith('.tsx')) return 'TypeScript';
					if (f.endsWith('.js') || f.endsWith('.jsx')) return 'JavaScript';
					if (f.endsWith('.css')) return 'Styles';
					if (f.endsWith('.json')) return 'Config';
					if (f.endsWith('.md')) return 'Docs';
					return 'Other';
				});

				const uniqueTypes = [...new Set(fileTypes)];
				const typeCount = fileTypes.length;

				// Generate a contextual message based on diff analysis
				let message = '';
				let description = '';

				if (diff.includes('+') && diff.includes('-')) {
					// Has both additions and deletions - likely a refactor or fix
					if (diff.includes('function') || diff.includes('const ') || diff.includes('let ')) {
						message = 'refactor: optimize and improve code structure';
						description = 'Made improvements to code organization and efficiency';
					} else {
						message = 'feat: update and enhance existing functionality';
						description = 'Made changes to improve user experience';
					}
				} else if (diff.includes('+') && !diff.includes('-')) {
					// Only additions - new feature or fix
					if (uniqueTypes.includes('TypeScript') && uniqueTypes.includes('Styles')) {
						message = 'feat: add new component with styling';
						description = 'Implemented new UI component with full styling';
					} else if (uniqueTypes.includes('Config')) {
						message = 'chore: update configuration';
						description = 'Modified project configuration settings';
					} else {
						message = `feat: add ${typeCount} new file${typeCount > 1 ? 's' : ''}`;
						description = 'Added new functionality to the project';
					}
				} else if (diff.includes('-')) {
					// Only deletions - cleanup or fix
					message = 'fix: remove deprecated code';
					description = 'Cleaned up unused or obsolete code';
				} else {
					message = 'chore: update project files';
					description = 'Made various improvements to the project';
				}

				const suggestion: AICommitSuggestion = {
					message,
					description,
					confidence: 0.85,
				};

				setLastSuggestion(suggestion);
				return suggestion;
			} catch (error) {
				console.error('Failed to generate commit message:', error);
				return null;
			} finally {
				setIsGeneratingMessage(false);
			}
		},
		[isAIEnabled]
	);

	const composeCommitSeries = useCallback(
		async (changes: Array<{ files: string[]; diff: string }>): Promise<string[]> => {
			if (!isAIEnabled) return [];

			setIsComposingSeries(true);
			try {
				// Simulate AI processing
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// In production, this would analyze the changes and suggest a logical series
				return changes.map((change, index) => {
					const fileCount = change.files.length;
					if (change.diff.includes('test') || change.files.some((f) => f.includes('test'))) {
						return `test: add tests for ${change.files[0] || 'module'}`;
					}
					if (change.diff.includes('style') || change.diff.includes('css')) {
						return `style: update styles for ${fileCount} file${fileCount > 1 ? 's' : ''}`;
					}
					if (change.diff.includes('fix') || change.diff.includes('bug')) {
						return `fix: resolve issue in ${change.files[0] || 'module'}`;
					}
					return `feat: update ${fileCount} file${fileCount > 1 ? 's' : ''}`;
				});
			} catch (error) {
				console.error('Failed to compose commit series:', error);
				return [];
			} finally {
				setIsComposingSeries(false);
			}
		},
		[isAIEnabled]
	);

	const suggestConflictResolution = useCallback(
		async (conflictContent: string): Promise<string | null> => {
			if (!isAIEnabled) return null;

			setIsAnalyzingConflict(true);
			try {
				// Simulate AI analysis
				await new Promise((resolve) => setTimeout(resolve, 800));

				// Simple conflict resolution based on common patterns
				// In production, this would use an AI model to understand the context
				const lines = conflictContent.split('\n');
				const hasBothVersions = lines.some((l) => l.startsWith('<<<<<<<')) &&
					lines.some((l) => l.startsWith('======='));

				if (hasBothVersions) {
					// Suggest keeping both if they're complementary, otherwise take the more recent
					return 'analysis: conflict detected - recommend manual resolution based on context';
				}

				return null;
			} catch (error) {
				console.error('Failed to analyze conflict:', error);
				return null;
			} finally {
				setIsAnalyzingConflict(false);
			}
		},
		[isAIEnabled]
	);

	return {
		isGeneratingMessage,
		generateCommitMessage,
		lastSuggestion,
		isComposingSeries,
		composeCommitSeries,
		isAnalyzingConflict,
		suggestConflictResolution,
		isAIEnabled,
		setAIEnabled,
	};
}

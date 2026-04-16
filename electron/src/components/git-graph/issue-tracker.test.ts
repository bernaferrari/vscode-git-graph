/**
 * Issue Tracker Tests
 */

import { describe, it, expect } from 'vitest';
import { detectIssueKeys, PROVIDER_CONFIG, STATUS_CONFIG } from './issue-tracker';

describe('Issue Tracker', () => {
	describe('detectIssueKeys', () => {
		it('should detect Jira-style issue keys', () => {
			const message = 'Fixed PROJ-123 and PROJ-456';
			const patterns = ['[A-Z]{2,10}-[0-9]+'];
			const keys = detectIssueKeys(message, patterns);
			
			expect(keys).toContain('PROJ-123');
			expect(keys).toContain('PROJ-456');
		});

		it('should detect GitHub-style issue references', () => {
			const message = 'Fixes #123 and closes #456';
			const patterns = ['#\\d+'];
			const keys = detectIssueKeys(message, patterns);
			
			expect(keys).toContain('#123');
			expect(keys).toContain('#456');
		});

		it('should detect multiple pattern types in same message', () => {
			const message = 'Fixes PROJ-123 and references #456';
			const patterns = ['[A-Z]{2,10}-[0-9]+', '#\\d+'];
			const keys = detectIssueKeys(message, patterns);
			
			expect(keys).toContain('PROJ-123');
			expect(keys).toContain('#456');
		});

		it('should handle case-insensitive matching', () => {
			const message = 'Fixed proj-123'; // lowercase
			const patterns = ['[A-Z]{2,10}-[0-9]+'];
			const keys = detectIssueKeys(message, patterns);
			
			// The regex should match case-insensitively due to 'gi' flag
			expect(keys.length).toBeGreaterThan(0);
		});

		it('should deduplicate matches', () => {
			const message = 'Fixed PROJ-123 and PROJ-123 again';
			const patterns = ['[A-Z]{2,10}-[0-9]+'];
			const keys = detectIssueKeys(message, patterns);
			
			expect(keys.filter(k => k === 'PROJ-123')).toHaveLength(1);
		});

		it('should return empty array for no matches', () => {
			const message = 'No issue references here';
			const patterns = ['[A-Z]{2,10}-[0-9]+', '#\\d+'];
			const keys = detectIssueKeys(message, patterns);
			
			expect(keys).toEqual([]);
		});

		it('should handle empty message', () => {
			const patterns = ['[A-Z]{2,10}-[0-9]+'];
			const keys = detectIssueKeys('', patterns);
			
			expect(keys).toEqual([]);
		});
	});

	describe('PROVIDER_CONFIG', () => {
		it('should have config for all providers', () => {
			const providers = ['github', 'jira', 'linear', 'asana', 'trello', 'clickup', 'notion'];
			
			providers.forEach(provider => {
				expect(PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG]).toBeDefined();
				expect(PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG].name).toBeDefined();
				expect(PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG].icon).toBeDefined();
				expect(PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG].color).toBeDefined();
			});
		});
	});

	describe('STATUS_CONFIG', () => {
		it('should have config for all statuses', () => {
			const statuses = ['open', 'in_progress', 'closed', 'done'];
			
			statuses.forEach(status => {
				expect(STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]).toBeDefined();
				expect(STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].color).toBeDefined();
				expect(STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].icon).toBeDefined();
			});
		});
	});
});

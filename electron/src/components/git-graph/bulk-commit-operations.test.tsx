/**
 * Bulk Commit Operations Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BulkCommitOperations } from './bulk-commit-operations';
import { useAppStore } from '@/lib/store';

vi.mock('@/hooks/useGitOperations', () => ({
	useGitOperations: () => ({
		cherryPick: vi.fn(async () => ({ error: null })),
		revert: vi.fn(async () => ({ error: null })),
		createBranch: vi.fn(async () => ({ error: null })),
	}),
}));

// Mock commits
const mockCommits = [
	{ hash: 'abc123', message: 'First commit', author: 'John', date: 1000, parents: [] },
	{ hash: 'def456', message: 'Second commit', author: 'Jane', date: 2000, parents: ['abc123'] },
	{ hash: 'ghi789', message: 'Third commit', author: 'Bob', date: 3000, parents: ['def456'] },
];

describe('Bulk Commit Operations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAppStore.setState({ activeRepo: '/tmp/repo-under-test' });
	});

	describe('Component Rendering', () => {
		it('should render the dialog when open', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Bulk Commit Operations')).toBeDefined();
		});

		it('should not render when closed', () => {
			render(
				<BulkCommitOperations
					open={false}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.queryByText('Bulk Commit Operations')).toBeNull();
		});

		it('should display all commits', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('First commit')).toBeDefined();
			expect(screen.getByText('Second commit')).toBeDefined();
			expect(screen.getByText('Third commit')).toBeDefined();
		});

		it('should show commit hashes', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('abc123')).toBeDefined();
		});

		it('should show author names', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('John')).toBeDefined();
			expect(screen.getByText('Jane')).toBeDefined();
			expect(screen.getByText('Bob')).toBeDefined();
		});
	});

	describe('Selection', () => {
		it('should allow selecting commits', async () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			// Click on first commit
			fireEvent.click(screen.getByText('First commit').closest('div')!);

			await waitFor(() => {
				expect(screen.getByText('1 selected')).toBeDefined();
			});
		});

		it('should have Select All button', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Select All')).toBeDefined();
		});

		it('should have Deselect All button', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Deselect All')).toBeDefined();
		});

		it('should select all commits when Select All is clicked', async () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			fireEvent.click(screen.getByText('Select All'));

			await waitFor(() => {
				expect(screen.getByText('3 selected')).toBeDefined();
			});
		});
	});

	describe('Actions', () => {
		it('should have Copy Hashes button', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Copy Hashes')).toBeDefined();
		});

		it('should have Actions dropdown', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Actions')).toBeDefined();
		});

		it('should disable actions when no selection', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText('Copy Hashes')).toBeDisabled();
		});
	});

	describe('Keyboard Shortcuts', () => {
		it('should show hint for Shift+Click range selection', () => {
			render(
				<BulkCommitOperations
					open={true}
					onOpenChange={() => {}}
					commits={mockCommits}
				/>
			);

			expect(screen.getByText(/Shift\+Click/)).toBeDefined();
		});
	});
});

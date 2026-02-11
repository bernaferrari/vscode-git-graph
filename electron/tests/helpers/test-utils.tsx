/**
 * Test Utilities
 * Custom render function with providers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { vi } from 'vitest';

// Mock tRPC client
export const mockTRPC = {
	git: {
		commits: { query: vi.fn() },
		repoInfo: { query: vi.fn() },
		status: { query: vi.fn() },
		branches: { query: vi.fn() },
		branch: { query: vi.fn() },
		log: { query: vi.fn() },
		diff: { query: vi.fn() },
		show: { query: vi.fn() },
		blame: { query: vi.fn() },
		checkout: { mutate: vi.fn() },
		createBranch: { mutate: vi.fn() },
		deleteBranch: { mutate: vi.fn() },
		merge: { mutate: vi.fn() },
		rebase: { mutate: vi.fn() },
		cherryPick: { mutate: vi.fn() },
		revert: { mutate: vi.fn() },
		push: { mutate: vi.fn() },
		pull: { mutate: vi.fn() },
		fetch: { mutate: vi.fn() },
		stash: { query: vi.fn() },
		stashPush: { mutate: vi.fn() },
		stashPop: { mutate: vi.fn() },
		tag: { mutate: vi.fn() },
		tags: { query: vi.fn() },
		remotes: { query: vi.fn() },
		remoteAdd: { mutate: vi.fn() },
		remoteRemove: { mutate: vi.fn() },
		config: { query: vi.fn() },
		configSet: { mutate: vi.fn() },
		configList: { query: vi.fn() },
		commitInfo: { query: vi.fn() },
		showFile: { query: vi.fn() },
		blameFile: { query: vi.fn() },
		fileDiff: { query: vi.fn() },
	},
};

// Create a new query client for each test
const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
				staleTime: 0,
			},
			mutations: {
				retry: false,
			},
		},
	});

// Mock tRPC
vi.mock('@/trpc/client', () => ({
	trpc: mockTRPC,
}));

// All providers wrapper
const AllProviders = ({ children }: { children: React.ReactNode }) => {
	const queryClient = createQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider attribute="class" defaultTheme="system">
				<TooltipProvider>
					{children}
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
};

// Custom render with providers
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
	return render(ui, { wrapper: AllProviders, ...options });
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render };

// Helper to create mock commit data
export const createMockCommit = (overrides = {}) => ({
	hash: 'abc1234567890def',
	parents: ['parent123'],
	author: 'John Doe',
	email: 'john@example.com',
	date: Math.floor(Date.now() / 1000),
	message: 'Test commit message',
	heads: [],
	tags: [],
	remotes: [],
	...overrides,
});

// Helper to create mock repo info
export const createMockRepoInfo = (overrides = {}) => ({
	head: 'main',
	branches: ['main', 'develop', 'feature/test'],
	tags: ['v1.0.0', 'v0.1.0'],
	remotes: [{ name: 'origin', url: 'https://github.com/user/repo.git' }],
	ahead: 0,
	behind: 0,
	staged: 0,
	unstaged: 0,
	untracked: 0,
	stashes: [],
	...overrides,
});

// Helper to create mock diff data
export const createMockDiff = (overrides = {}) => ({
	oldPath: 'test.ts',
	newPath: 'test.ts',
	oldContent: 'old content',
	newContent: 'new content',
	hunks: [],
	...overrides,
});

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock git operations
export const mockGitOperations = {
	checkout: vi.fn(),
	createBranch: vi.fn(),
	deleteBranch: vi.fn(),
	merge: vi.fn(),
	rebase: vi.fn(),
	cherryPick: vi.fn(),
	revert: vi.fn(),
	push: vi.fn(),
	pull: vi.fn(),
	fetch: vi.fn(),
	stash: vi.fn(),
	commit: vi.fn(),
};

// Mock app store
export const mockAppStore = {
	activeRepo: '/path/to/repo',
	selectedCommit: null,
	commitDetailsOpen: false,
	setActiveRepo: vi.fn(),
	setSelectedCommit: vi.fn(),
	setCommitDetailsOpen: vi.fn(),
};

vi.mock('@/lib/store', () => ({
	useAppStore: () => mockAppStore,
}));

/**
 * Git Operations Hook
 * Provides convenient access to Git tRPC mutations
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { useCallback } from 'react';

export function useGitOperations() {
	const { activeRepo } = useAppStore();
	const utils = trpc.useUtils();

	// Mutations
	const createBranch = trpc.git.createBranch.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const deleteBranch = trpc.git.deleteBranch.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const checkout = trpc.git.checkout.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const reset = trpc.git.reset.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const fetch = trpc.git.fetch.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const pull = trpc.git.pull.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const push = trpc.git.push.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const createTag = trpc.git.tag.create.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const deleteTag = trpc.git.tag.delete.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const merge = trpc.git.merge.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const rebase = trpc.git.rebase.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const cherryPick = trpc.git.cherryPick.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const revert = trpc.git.revert.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const copyToClipboard = trpc.git.copyToClipboard.useMutation();

	// Wrapper functions
	const handleCreateBranch = useCallback(
		async (commitHash: string, branchName: string, checkout: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return createBranch.mutateAsync({
				repo: activeRepo,
				commitHash,
				branchName,
				checkout,
			});
		},
		[activeRepo, createBranch]
	);

	const handleDeleteBranch = useCallback(
		async (branchName: string, force: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return deleteBranch.mutateAsync({
				repo: activeRepo,
				branchName,
				force,
			});
		},
		[activeRepo, deleteBranch]
	);

	const handleCheckout = useCallback(
		async (ref: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return checkout.mutateAsync({
				repo: activeRepo,
				ref,
			});
		},
		[activeRepo, checkout]
	);

	const handleReset = useCallback(
		async (commitHash: string, mode: 'soft' | 'mixed' | 'hard') => {
			if (!activeRepo) return { error: 'No active repository' };
			return reset.mutateAsync({
				repo: activeRepo,
				commitHash,
				mode,
			});
		},
		[activeRepo, reset]
	);

	const handleFetch = useCallback(
		async (remote?: string, prune?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return fetch.mutateAsync({
				repo: activeRepo,
				remote: remote ?? null,
				prune: prune ?? false,
			});
		},
		[activeRepo, fetch]
	);

	const handlePull = useCallback(
		async (branchName: string, remote: string, noFastForward: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return pull.mutateAsync({
				repo: activeRepo,
				branchName,
				remote,
				noFastForward,
			});
		},
		[activeRepo, pull]
	);

	const handlePush = useCallback(
		async (branchName: string, remote: string, setUpstream: boolean, force: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return push.mutateAsync({
				repo: activeRepo,
				branchName,
				remote,
				setUpstream,
				force,
			});
		},
		[activeRepo, push]
	);

	const handleCreateTag = useCallback(
		async (commitHash: string, tagName: string, message?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return createTag.mutateAsync({
				repo: activeRepo,
				commitHash,
				tagName,
				message,
			});
		},
		[activeRepo, createTag]
	);

	const handleDeleteTag = useCallback(
		async (tagName: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return deleteTag.mutateAsync({
				repo: activeRepo,
				tagName,
			});
		},
		[activeRepo, deleteTag]
	);

	const handleMerge = useCallback(
		async (branch: string, options?: { noFastForward?: boolean; squash?: boolean; noCommit?: boolean }) => {
			if (!activeRepo) return { error: 'No active repository' };
			return merge.mutateAsync({
				repo: activeRepo,
				branch,
				noFastForward: options?.noFastForward ?? true,
				squash: options?.squash ?? false,
				noCommit: options?.noCommit ?? false,
			});
		},
		[activeRepo, merge]
	);

	const handleRebase = useCallback(
		async (onto: string, interactive?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return rebase.mutateAsync({
				repo: activeRepo,
				onto,
				interactive: interactive ?? false,
			});
		},
		[activeRepo, rebase]
	);

	const handleCherryPick = useCallback(
		async (commitHash: string, noCommit?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return cherryPick.mutateAsync({
				repo: activeRepo,
				commitHash,
				noCommit: noCommit ?? false,
			});
		},
		[activeRepo, cherryPick]
	);

	const handleRevert = useCallback(
		async (commitHash: string, noCommit?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return revert.mutateAsync({
				repo: activeRepo,
				commitHash,
				noCommit: noCommit ?? false,
			});
		},
		[activeRepo, revert]
	);

	const handleCopyToClipboard = useCallback(
		async (text: string) => {
			return copyToClipboard.mutateAsync({ text });
		},
		[copyToClipboard]
	);

	return {
		// State
		activeRepo,
		isLoading:
			createBranch.isPending ||
			deleteBranch.isPending ||
			checkout.isPending ||
			reset.isPending ||
			fetch.isPending ||
			pull.isPending ||
			push.isPending ||
			createTag.isPending ||
			deleteTag.isPending ||
			merge.isPending ||
			rebase.isPending ||
			cherryPick.isPending ||
			revert.isPending,

		// Operations
		createBranch: handleCreateBranch,
		deleteBranch: handleDeleteBranch,
		checkout: handleCheckout,
		reset: handleReset,
		fetch: handleFetch,
		pull: handlePull,
		push: handlePush,
		createTag: handleCreateTag,
		deleteTag: handleDeleteTag,
		merge: handleMerge,
		rebase: handleRebase,
		cherryPick: handleCherryPick,
		revert: handleRevert,
		copyToClipboard: handleCopyToClipboard,
	};
}

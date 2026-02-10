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

	const commit = trpc.git.commit.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const stage = trpc.git.stage.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.workingTreeStatus.invalidate();
		},
	});

	const unstage = trpc.git.unstage.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.workingTreeStatus.invalidate();
		},
	});

	const stashPush = trpc.git.stash.push.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const stashPop = trpc.git.stash.pop.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const stashApply = trpc.git.stash.apply.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const stashDrop = trpc.git.stash.drop.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const undoLastCommit = trpc.git.undoLastCommit.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
			utils.git.workingTreeStatus.invalidate();
		},
	});

	const submoduleAdd = trpc.git.submodule.add.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const submoduleUpdate = trpc.git.submodule.update.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
		},
	});

	const submoduleRemove = trpc.git.submodule.remove.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowFeatureStart = trpc.git.gitflow.feature.start.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowFeatureFinish = trpc.git.gitflow.feature.finish.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowReleaseStart = trpc.git.gitflow.release.start.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowReleaseFinish = trpc.git.gitflow.release.finish.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowHotfixStart = trpc.git.gitflow.hotfix.start.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const gitflowHotfixFinish = trpc.git.gitflow.hotfix.finish.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.commits.invalidate();
		},
	});

	const remoteAdd = trpc.git.remote.add.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.remotes.invalidate();
		},
	});

	const remoteRemove = trpc.git.remote.remove.useMutation({
		onSuccess: () => {
			utils.git.repoInfo.invalidate();
			utils.git.remotes.invalidate();
		},
	});

	const worktreeCreate = trpc.git.worktreeManage.create.useMutation({
		onSuccess: () => {
			utils.git.worktree.list.invalidate();
		},
	});

	const worktreeRemove = trpc.git.worktreeManage.remove.useMutation({
		onSuccess: () => {
			utils.git.worktree.list.invalidate();
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

	const handleCommit = useCallback(
		async (message: string, amend?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return commit.mutateAsync({
				repo: activeRepo,
				message,
				amend: amend ?? false,
			});
		},
		[activeRepo, commit]
	);

	const handleStage = useCallback(
		async (files: string[]) => {
			if (!activeRepo) return { error: 'No active repository' };
			return stage.mutateAsync({
				repo: activeRepo,
				files,
			});
		},
		[activeRepo, stage]
	);

	const handleUnstage = useCallback(
		async (files: string[]) => {
			if (!activeRepo) return { error: 'No active repository' };
			return unstage.mutateAsync({
				repo: activeRepo,
				files,
			});
		},
		[activeRepo, unstage]
	);

	const handleStashPush = useCallback(
		async (message?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return stashPush.mutateAsync({
				repo: activeRepo,
				message,
			});
		},
		[activeRepo, stashPush]
	);

	const handleStashPop = useCallback(
		async (selector: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return stashPop.mutateAsync({
				repo: activeRepo,
				selector,
			});
		},
		[activeRepo, stashPop]
	);

	const handleStashApply = useCallback(
		async (selector: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return stashApply.mutateAsync({
				repo: activeRepo,
				selector,
			});
		},
		[activeRepo, stashApply]
	);

	const handleStashDrop = useCallback(
		async (selector: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return stashDrop.mutateAsync({
				repo: activeRepo,
				selector,
			});
		},
		[activeRepo, stashDrop]
	);

	const handleUndoLastCommit = useCallback(
		async (soft: boolean = true) => {
			if (!activeRepo) return { error: 'No active repository' };
			return undoLastCommit.mutateAsync({
				repo: activeRepo,
				soft,
			});
		},
		[activeRepo, undoLastCommit]
	);

	const handleSubmoduleAdd = useCallback(
		async (url: string, path: string, branch?: string, depth?: number) => {
			if (!activeRepo) return { error: 'No active repository' };
			return submoduleAdd.mutateAsync({
				repo: activeRepo,
				url,
				path,
				branch,
				depth,
			});
		},
		[activeRepo, submoduleAdd]
	);

	const handleSubmoduleUpdate = useCallback(
		async (path?: string, options?: { init?: boolean; recursive?: boolean; remote?: boolean }) => {
			if (!activeRepo) return { error: 'No active repository' };
			return submoduleUpdate.mutateAsync({
				repo: activeRepo,
				path,
				...options,
			});
		},
		[activeRepo, submoduleUpdate]
	);

	const handleSubmoduleRemove = useCallback(
		async (path: string, force?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return submoduleRemove.mutateAsync({
				repo: activeRepo,
				path,
				force,
			});
		},
		[activeRepo, submoduleRemove]
	);

	const handleGitFlowFeatureStart = useCallback(
		async (name: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowFeatureStart.mutateAsync({
				repo: activeRepo,
				name,
			});
		},
		[activeRepo, gitflowFeatureStart]
	);

	const handleGitFlowFeatureFinish = useCallback(
		async (name: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowFeatureFinish.mutateAsync({
				repo: activeRepo,
				name,
			});
		},
		[activeRepo, gitflowFeatureFinish]
	);

	const handleGitFlowReleaseStart = useCallback(
		async (name: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowReleaseStart.mutateAsync({
				repo: activeRepo,
				name,
			});
		},
		[activeRepo, gitflowReleaseStart]
	);

	const handleGitFlowReleaseFinish = useCallback(
		async (name: string, tag?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowReleaseFinish.mutateAsync({
				repo: activeRepo,
				name,
				tag,
			});
		},
		[activeRepo, gitflowReleaseFinish]
	);

	const handleGitFlowHotfixStart = useCallback(
		async (name: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowHotfixStart.mutateAsync({
				repo: activeRepo,
				name,
			});
		},
		[activeRepo, gitflowHotfixStart]
	);

	const handleGitFlowHotfixFinish = useCallback(
		async (name: string, tag?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return gitflowHotfixFinish.mutateAsync({
				repo: activeRepo,
				name,
				tag,
			});
		},
		[activeRepo, gitflowHotfixFinish]
	);

	const handleRemoteAdd = useCallback(
		async (name: string, url: string, pushUrl?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return remoteAdd.mutateAsync({
				repo: activeRepo,
				name,
				url,
				pushUrl,
			});
		},
		[activeRepo, remoteAdd]
	);

	const handleRemoteRemove = useCallback(
		async (name: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return remoteRemove.mutateAsync({
				repo: activeRepo,
				name,
			});
		},
		[activeRepo, remoteRemove]
	);

	const handleWorktreeCreate = useCallback(
		async (path: string, branch?: string, commit?: string) => {
			if (!activeRepo) return { error: 'No active repository' };
			return worktreeCreate.mutateAsync({
				repo: activeRepo,
				path,
				branch,
				commit,
			});
		},
		[activeRepo, worktreeCreate]
	);

	const handleWorktreeRemove = useCallback(
		async (path: string, force?: boolean) => {
			if (!activeRepo) return { error: 'No active repository' };
			return worktreeRemove.mutateAsync({
				repo: activeRepo,
				path,
				force,
			});
		},
		[activeRepo, worktreeRemove]
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
			revert.isPending ||
			commit.isPending ||
			stage.isPending ||
			unstage.isPending ||
			stashPush.isPending ||
			stashPop.isPending ||
			stashApply.isPending ||
			stashDrop.isPending ||
			undoLastCommit.isPending ||
			submoduleAdd.isPending ||
			submoduleUpdate.isPending ||
			submoduleRemove.isPending ||
			gitflowFeatureStart.isPending ||
			gitflowFeatureFinish.isPending ||
			gitflowReleaseStart.isPending ||
			gitflowReleaseFinish.isPending ||
			gitflowHotfixStart.isPending ||
			gitflowHotfixFinish.isPending ||
			remoteAdd.isPending ||
			remoteRemove.isPending ||
			worktreeCreate.isPending ||
			worktreeRemove.isPending,

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
		commit: handleCommit,
		stage: handleStage,
		unstage: handleUnstage,
		stashPush: handleStashPush,
		stashPop: handleStashPop,
		stashApply: handleStashApply,
		stashDrop: handleStashDrop,
		undoLastCommit: handleUndoLastCommit,
		submoduleAdd: handleSubmoduleAdd,
		submoduleUpdate: handleSubmoduleUpdate,
		submoduleRemove: handleSubmoduleRemove,
		gitFlowFeatureStart: handleGitFlowFeatureStart,
		gitFlowFeatureFinish: handleGitFlowFeatureFinish,
		gitFlowReleaseStart: handleGitFlowReleaseStart,
		gitFlowReleaseFinish: handleGitFlowReleaseFinish,
		gitFlowHotfixStart: handleGitFlowHotfixStart,
		gitFlowHotfixFinish: handleGitFlowHotfixFinish,
		remoteAdd: handleRemoteAdd,
		remoteRemove: handleRemoteRemove,
		worktreeCreate: handleWorktreeCreate,
		worktreeRemove: handleWorktreeRemove,
		copyToClipboard: handleCopyToClipboard,
	};
}

/**
 * Pull Request Integration
 * Create, review, merge, and close PRs for supported providers.
 */

import {
    AlertCircle,
    Check,
    ClipboardCheck,
    ExternalLink,
    GitBranch,
    GitPullRequest,
    Globe,
    Loader2,
    MessageSquare,
    Plus,
    RefreshCw,
    Save,
    Send,
    Server,
    Settings,
    Wand2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { CollaborationAssignmentPanel } from '@/components/git-graph/collaboration-center-assignment';
import { CollaborationCommentThread } from '@/components/git-graph/collaboration-comment-thread';
import type { CollaborationAssignment, CollaborationComment, CollaborationMemberProfile } from '@/components/git-graph/collaboration-types';
import { detectPullRequestProvider, type PullRequestProvider } from '@/components/git-graph/pull-request-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { parseDiffWithInlineDiffs } from '@/lib/diff-utils';
import {
    buildCollaborationPullRequestFileTargetId,
    buildCollaborationPullRequestTargetId,
    deriveCollaborationRepoKey,
    getCollaborationReviewRootTargetId,
    parseCollaborationReviewTargetId,
} from '@/lib/collaboration-review-targets';
import { useAppStore } from '@/lib/store';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { trpc } from '@/trpc/client';

type PullRequestStateFilter = 'open' | 'closed' | 'all';

interface PullRequest {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed' | 'merged';
    author: string;
    createdAt: string;
    updatedAt: string;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
    draft: boolean;
    mergeable?: boolean | null;
    webUrl: string;
    reviewPosition?: {
        baseSha?: string;
        startSha?: string;
        headSha?: string;
    };
}

interface PullRequestComment {
    id: string;
    author: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    url: string;
}

interface PullRequestIntegrationProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ReviewSummaryData {
    files: string[];
    progress: {
        lastActive: number;
        lastViewedFile: string | null;
        remainingFiles: string[];
        reviewedCount: number;
        totalFiles: number;
    } | null;
    error?: string | null;
}

interface PullRequestAuthForm {
    githubToken: string;
    gitlabToken: string;
    bitbucketToken: string;
    bitbucketUsername: string;
    azureToken: string;
}

const DEFAULT_AUTH_FORM: PullRequestAuthForm = {
    githubToken: '',
    gitlabToken: '',
    bitbucketToken: '',
    bitbucketUsername: '',
    azureToken: '',
};

interface RemoteEntry {
    name: string;
    url: string;
}

interface RemotesQueryData {
    remotes: RemoteEntry[];
}

interface RepoInfoQueryData {
    branches: string[];
}

interface PullRequestAuthQueryData {
    auth: PullRequestAuthForm;
}

interface PullRequestsQueryData {
    pullRequests: PullRequest[];
    error?: string;
}

interface PullRequestCommentsQueryData {
    comments: PullRequestComment[];
}

interface PullRequestReviewerState {
    id: string;
    name: string;
    username?: string;
    required?: boolean;
    status: 'requested' | 'commented' | 'approved' | 'changes-requested' | 'waiting';
    providerState?: string;
    updatedAt?: string;
}

interface PullRequestReviewStateSummary {
    overall: 'pending' | 'approved' | 'changes-requested';
    reviewers: PullRequestReviewerState[];
    requestedCount: number;
    approvedCount: number;
    commentedCount: number;
    changesRequestedCount: number;
    waitingCount: number;
}

interface PullRequestReviewStateQueryData {
    reviewState: PullRequestReviewStateSummary | null;
    error?: string | null;
}

interface QueryOptions {
    enabled?: boolean;
    staleTime?: number;
}

interface QueryState<TData> {
    data?: TData;
    isFetching: boolean;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
}

interface MutationCallbacks<TResult = unknown> {
    onSuccess?: (result: TResult) => void | Promise<void>;
    onError?: (error: unknown) => void;
}

interface MutationState<TInput> {
    mutate: (input: TInput, callbacks?: MutationCallbacks<unknown>) => void;
    isPending: boolean;
}

interface PullRequestMutationResult {
    error?: string | null;
}

interface CreatePullRequestInput {
    repo: string;
    provider: PullRequestProvider;
    title: string;
    body?: string;
    head: string;
    base: string;
    draft: boolean;
}

interface MergePullRequestInput {
    repo: string;
    provider: PullRequestProvider;
    number: number;
    mergeMethod: 'merge' | 'squash' | 'rebase';
}

interface ClosePullRequestInput {
    repo: string;
    provider: PullRequestProvider;
    number: number;
}

interface AddPullRequestCommentInput {
    repo: string;
    provider: PullRequestProvider;
    number: number;
    body: string;
}

interface AddPullRequestInlineCommentInput extends AddPullRequestCommentInput {
    filePath: string;
    line: number;
    side: 'left' | 'right';
    baseSha?: string;
    startSha?: string;
    headSha?: string;
}

interface TrpcUtilsShape {
    git: {
        getPullRequest: {
            invalidate: () => Promise<unknown>;
        };
    };
    repo: {
        collaboration: {
            list: {
                invalidate: () => Promise<unknown>;
            };
            activity: {
                invalidate: () => Promise<unknown>;
            };
            reviewDashboard: {
                invalidate: () => Promise<unknown>;
            };
        };
    };
}

interface CompareBranchesData {
    commits: Array<{ hash: string; message: string }>;
    files: Array<{ status: string; path: string }>;
    additions: number;
    deletions: number;
    error?: string | null;
}

interface GeneratePullRequestResult {
    title?: string | null;
    body?: string | null;
    error?: string | null;
}

interface TrpcGitShape {
    remotes: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<RemotesQueryData>;
    };
    repoInfo: {
        useQuery: (
            input: {
                repo: string;
                showRemoteBranches: boolean;
                showStashes: boolean;
                hideRemotes: string[];
            },
            options: QueryOptions
        ) => QueryState<RepoInfoQueryData>;
    };
    getPullRequestAuth: {
        useQuery: (input: undefined, options: QueryOptions) => QueryState<PullRequestAuthQueryData>;
    };
    listPullRequests: {
        useQuery: (
            input: { repo: string; provider: PullRequestProvider; state: PullRequestStateFilter },
            options: QueryOptions
        ) => QueryState<PullRequestsQueryData>;
    };
    listPullRequestComments: {
        useQuery: (
            input: { repo: string; provider: PullRequestProvider; number: number },
            options: QueryOptions
        ) => QueryState<PullRequestCommentsQueryData>;
    };
    getPullRequestReviewState: {
        useQuery: (
            input: { repo: string; provider: PullRequestProvider; number: number },
            options: QueryOptions
        ) => QueryState<PullRequestReviewStateQueryData>;
    };
    setPullRequestAuth: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<PullRequestAuthForm>;
    };
    createPullRequest: {
        useMutation: (callbacks: MutationCallbacks<PullRequestMutationResult>) => MutationState<CreatePullRequestInput>;
    };
    mergePullRequest: {
        useMutation: (callbacks: MutationCallbacks<PullRequestMutationResult>) => MutationState<MergePullRequestInput>;
    };
    closePullRequest: {
        useMutation: (callbacks: MutationCallbacks<PullRequestMutationResult>) => MutationState<ClosePullRequestInput>;
    };
    addPullRequestComment: {
        useMutation: (
            callbacks: MutationCallbacks<PullRequestMutationResult>
        ) => MutationState<AddPullRequestCommentInput>;
    };
    addPullRequestInlineComment: {
        useMutation: (
            callbacks: MutationCallbacks<PullRequestMutationResult>
        ) => MutationState<AddPullRequestInlineCommentInput>;
    };
}

interface TrpcClientShape {
    useUtils: () => TrpcUtilsShape;
    git: TrpcGitShape;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function PullRequestIntegration({ open, onOpenChange }: PullRequestIntegrationProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const [activeTab, setActiveTab] = useState<'list' | 'review' | 'create' | 'settings'>('list');
    const [stateFilter, setStateFilter] = useState<PullRequestStateFilter>('open');

    const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
    const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
    const [commentDraft, setCommentDraft] = useState('');
    const [reviewRequestDraft, setReviewRequestDraft] = useState({ assigneeId: '', note: '' });
    const [reviewThreadDraft, setReviewThreadDraft] = useState('');
    const [fileReviewDrafts, setFileReviewDrafts] = useState<Record<string, string>>({});
    const [expandedReviewFiles, setExpandedReviewFiles] = useState<Record<string, boolean>>({});

    const [prTitle, setPrTitle] = useState('');
    const [prBody, setPrBody] = useState('');
    const [prHead, setPrHead] = useState('');
    const [prBase, setPrBase] = useState('main');
    const [prDraft, setPrDraft] = useState(false);

    const [authForm, setAuthForm] = useState<PullRequestAuthForm>(DEFAULT_AUTH_FORM);
    const [didSeedAuthForm, setDidSeedAuthForm] = useState(false);

    const utils = typedTrpc.useUtils();
    const configAllQuery = trpc.config.getAll.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const aiProdEnabled = Boolean(
        (configAllQuery.data?.ui as { featureFlags?: { aiProd?: boolean } } | undefined)?.featureFlags?.aiProd
    );

    const { data: remoteData } = typedTrpc.git.remotes.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && open }
    );
    const { data: repoInfoData } = typedTrpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: false,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo && open }
    );

    const authQuery = typedTrpc.git.getPullRequestAuth.useQuery(undefined, { enabled: open });

    useEffect(() => {
        if (!authQuery.data?.auth || didSeedAuthForm) {
            return;
        }
        setAuthForm(authQuery.data.auth);
        setDidSeedAuthForm(true);
    }, [authQuery.data?.auth, didSeedAuthForm]);

    const detectedProvider = useMemo(
        () => detectPullRequestProvider(remoteData?.remotes.find((remote) => remote.name === 'origin')?.url),
        [remoteData?.remotes]
    );
    const provider = detectedProvider?.name ?? 'github';
    const reviewRepoKey = useMemo(
        () => deriveCollaborationRepoKey(remoteData?.remotes.find((remote) => remote.name === 'origin')?.url),
        [remoteData?.remotes]
    );
    const selectedReviewTargetId = selectedPR
        ? buildCollaborationPullRequestTargetId({
              provider,
              repoKey: reviewRepoKey,
              pullRequestNumber: selectedPR.number,
          })
        : '';

    useEffect(() => {
        setReviewRequestDraft({ assigneeId: '', note: '' });
        setReviewThreadDraft('');
        setFileReviewDrafts({});
        setExpandedReviewFiles({});
    }, [selectedReviewTargetId]);

    const hasRequiredToken = useMemo(() => {
        switch (provider) {
            case 'github':
                return Boolean(authForm.githubToken.trim());
            case 'gitlab':
                return Boolean(authForm.gitlabToken.trim());
            case 'bitbucket':
                return Boolean(authForm.bitbucketToken.trim());
            case 'azure':
                return Boolean(authForm.azureToken.trim());
            default:
                return false;
        }
    }, [authForm.azureToken, authForm.bitbucketToken, authForm.githubToken, authForm.gitlabToken, provider]);

    const pullRequestQuery = typedTrpc.git.listPullRequests.useQuery(
        {
            repo: activeRepo ?? '',
            provider,
            state: stateFilter,
        },
        { enabled: !!activeRepo && open && (activeTab === 'list' || activeTab === 'review') }
    );
    const compareBranchesQuery = trpc.git.compareBranches.useQuery(
        {
            repo: activeRepo ?? '',
            from: prBase || 'main',
            to: prHead || 'HEAD',
        },
        {
            enabled: !!activeRepo && open && activeTab === 'create' && !!prHead.trim() && !!prBase.trim(),
            staleTime: 10_000,
        }
    );
    const commentsQuery = typedTrpc.git.listPullRequestComments.useQuery(
        {
            repo: activeRepo ?? '',
            provider,
            number: selectedPR?.number ?? 0,
        },
        {
            enabled: !!activeRepo && open && activeTab === 'list' && !!selectedPR,
            staleTime: 5_000,
        }
    );
    const reviewStateQuery = typedTrpc.git.getPullRequestReviewState.useQuery(
        {
            repo: activeRepo ?? '',
            provider,
            number: selectedPR?.number ?? 0,
        },
        {
            enabled: !!activeRepo && open && activeTab === 'review' && !!selectedPR,
            staleTime: 10_000,
        }
    );
    const reviewSummaryQuery = trpc.repo.review.summary.useQuery(
        {
            repo: activeRepo ?? '',
            reviewId: selectedReviewTargetId,
            baseRef: selectedPR?.base.ref ?? 'main',
            headRef: selectedPR?.head.ref ?? 'HEAD',
        },
        {
            enabled: !!activeRepo && open && activeTab === 'review' && !!selectedPR,
            staleTime: 5_000,
        }
    );
    const repoPolicyQuery = trpc.repo.policy.get.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && open, staleTime: 10_000 }
    );
    const collaborationMembersQuery = trpc.repo.collaboration.remoteMembers.useQuery(undefined, {
        enabled: !!activeRepo && open && activeTab === 'review',
        staleTime: 20_000,
    });
    const collaborationCommentsQuery = trpc.repo.collaboration.comments.useQuery(
        {
            targetType: 'pull-request',
            targetId: selectedReviewTargetId,
        },
        {
            enabled: !!activeRepo && open && activeTab === 'review' && !!selectedPR,
            staleTime: 5_000,
        }
    );
    const collaborationAssignmentsQuery = trpc.repo.collaboration.assignments.useQuery(
        {
            targetType: 'pull-request',
            targetId: selectedReviewTargetId,
        },
        {
            enabled: !!activeRepo && open && activeTab === 'review' && !!selectedPR,
            staleTime: 5_000,
        }
    );
    const collaborationStateQuery = trpc.repo.collaboration.list.useQuery(undefined, {
        enabled: !!activeRepo && open && activeTab === 'review' && !!selectedPR,
        staleTime: 5_000,
    });
    const reviewUpdateMutation = trpc.repo.review.update.useMutation();
    const reviewResetMutation = trpc.repo.review.reset.useMutation();
    const auditLogMutation = trpc.system.audit.log.useMutation();
    const { notifySuccess, notifyError, notifyWarning } = useAppNotifications();
    const addCollaborationCommentMutation = trpc.repo.collaboration.addComment.useMutation({
        onSuccess: async () => {
            await Promise.all([collaborationCommentsQuery.refetch(), collaborationStateQuery.refetch()]);
        },
    });
    const deleteCollaborationCommentMutation = trpc.repo.collaboration.deleteComment.useMutation({
        onSuccess: async () => {
            await Promise.all([collaborationCommentsQuery.refetch(), collaborationStateQuery.refetch()]);
        },
    });
    const importProviderCommentsMutation = trpc.repo.collaboration.importProviderComments.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationCommentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.list.invalidate(),
                utils.repo.collaboration.activity.invalidate(),
                utils.repo.collaboration.reviewDashboard.invalidate(),
            ]);
        },
    });
    const syncCollaborationCommentMutation = trpc.repo.collaboration.syncCommentToProvider.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationCommentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.list.invalidate(),
                utils.repo.collaboration.activity.invalidate(),
                utils.repo.collaboration.reviewDashboard.invalidate(),
            ]);
        },
    });
    const setProviderThreadResolvedMutation = trpc.repo.collaboration.setProviderThreadResolved.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationCommentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.activity.invalidate(),
                utils.repo.collaboration.reviewDashboard.invalidate(),
            ]);
        },
    });
    const syncProviderReviewAssignmentsMutation = trpc.repo.collaboration.syncProviderReviewAssignments.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationAssignmentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                reviewStateQuery.refetch(),
                utils.repo.collaboration.activity.invalidate(),
                utils.repo.collaboration.reviewDashboard.invalidate(),
            ]);
        },
    });
    const assignReviewMutation = trpc.repo.collaboration.assignItem.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationAssignmentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.activity.invalidate(),
            ]);
        },
    });
    const updateReviewAssignmentMutation = trpc.repo.collaboration.updateAssignment.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationAssignmentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.activity.invalidate(),
            ]);
        },
    });
    const deleteReviewAssignmentMutation = trpc.repo.collaboration.deleteAssignment.useMutation({
        onSuccess: async () => {
            await Promise.all([
                collaborationAssignmentsQuery.refetch(),
                collaborationStateQuery.refetch(),
                utils.repo.collaboration.activity.invalidate(),
            ]);
        },
    });

    const saveAuthMutation = typedTrpc.git.setPullRequestAuth.useMutation({
        onSuccess: () => {
            notifySuccess('Pull request provider authentication updated');
            auditLogMutation.mutate({
                scope: 'system',
                action: 'pr-auth-save',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Updated pull request authentication for ${provider}`,
            });
            void authQuery.refetch();
        },
        onError: (error: unknown) => {
            notifyError('Failed to save provider authentication', {
                description: getErrorMessage(error, 'Unable to save provider authentication'),
            });
        },
    });

    const createPRMutation = typedTrpc.git.createPullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                notifyError('Failed to create pull request', { description: result.error });
                return;
            }
            notifySuccess('Pull request created');
            auditLogMutation.mutate({
                scope: 'review',
                action: 'pr-create',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Created pull request from ${prHead.trim()} to ${prBase.trim()}`,
                metadata: {
                    provider,
                    head: prHead.trim(),
                    base: prBase.trim(),
                },
            });
            resetCreateForm();
            setActiveTab('list');
            await pullRequestQuery.refetch();
        },
        onError: (error: unknown) => {
            notifyError('Failed to create pull request', {
                description: getErrorMessage(error, 'Unable to create pull request'),
            });
        },
    });

    const mergePRMutation = typedTrpc.git.mergePullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                notifyError('Merge failed', { description: result.error });
                return;
            }
            notifySuccess('Pull request merged');
            auditLogMutation.mutate({
                scope: 'review',
                action: 'pr-merge',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Merged pull request #${String(selectedPR?.number ?? '')}`.trim(),
                metadata: {
                    provider,
                    mergeMethod,
                },
            });
            await pullRequestQuery.refetch();
            await utils.git.getPullRequest.invalidate();
            setSelectedPR(null);
        },
        onError: (error: unknown) => {
            notifyError('Merge failed', { description: getErrorMessage(error, 'Unable to merge pull request') });
        },
    });

    const closePRMutation = typedTrpc.git.closePullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                notifyError('Close failed', { description: result.error });
                return;
            }
            notifySuccess('Pull request closed');
            auditLogMutation.mutate({
                scope: 'review',
                action: 'pr-close',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Closed pull request #${String(selectedPR?.number ?? '')}`.trim(),
                metadata: {
                    provider,
                },
            });
            await pullRequestQuery.refetch();
            setSelectedPR(null);
        },
        onError: (error: unknown) => {
            notifyError('Close failed', { description: getErrorMessage(error, 'Unable to close pull request') });
        },
    });
    const addCommentMutation = typedTrpc.git.addPullRequestComment.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                notifyError('Failed to add comment', { description: result.error });
                return;
            }
            setCommentDraft('');
            await commentsQuery.refetch();
            auditLogMutation.mutate({
                scope: 'review',
                action: 'pr-comment',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Commented on pull request #${String(selectedPR?.number ?? '')}`.trim(),
                metadata: {
                    provider,
                },
            });
            notifySuccess('Comment posted');
        },
        onError: (error: unknown) => {
            notifyError('Failed to add comment', { description: getErrorMessage(error, 'Unable to add comment') });
        },
    });
    const generateAIPRMutation = trpc.ai.generatePullRequest.useMutation({
        onSuccess: (result: GeneratePullRequestResult) => {
            if (result.title) {
                setPrTitle(result.title);
            }
            if (result.body) {
                setPrBody(result.body);
            }
            if (result.error) {
                notifyWarning('AI pull request draft used fallback', { description: result.error });
                return;
            }
            notifySuccess('AI pull request draft generated', { persist: false });
        },
        onError: (error: unknown) => {
            notifyError('Unable to generate AI pull request draft', {
                description: getErrorMessage(error, 'AI provider request failed'),
            });
        },
    });

    const resetCreateForm = () => {
        setPrTitle('');
        setPrBody('');
        setPrHead('');
        setPrBase('main');
        setPrDraft(false);
    };

    const handleSaveAuth = () => {
        saveAuthMutation.mutate(authForm);
    };

    const handleCreatePR = () => {
        if (!activeRepo) {
            toast.error('No repository selected');
            return;
        }
        if (!prTitle.trim() || !prHead.trim() || !prBase.trim()) {
            toast.error('Fill in all required pull request fields');
            return;
        }
        const body = prBody.trim();
        createPRMutation.mutate({
            repo: activeRepo,
            provider,
            title: prTitle.trim(),
            head: prHead.trim(),
            base: prBase.trim(),
            draft: prDraft,
            ...(body ? { body } : {}),
        });
    };

    const handleGenerateWithAI = async () => {
        if (!activeRepo) {
            toast.error('No repository selected');
            return;
        }
        if (!prHead.trim() || !prBase.trim()) {
            toast.error('Select source and target branches first');
            return;
        }

        let compareData = compareBranchesQuery.data;
        if (!compareData || compareData.error) {
            const fetched = await compareBranchesQuery.refetch();
            compareData = fetched.data;
        }
        if (!compareData || compareData.error) {
            toast.error(compareData?.error ?? 'Unable to gather branch comparison for AI draft');
            return;
        }

        const compareResult = compareData as CompareBranchesData;

        const commits = compareResult.commits.slice(0, 50).map((commit) => ({
            hash: commit.hash,
            subject: commit.message,
            body: '',
        }));
        const changedFiles = compareResult.files.slice(0, 200).map((file) => `${file.status}\t${file.path}`);
        const diffSummary = [
            `Branch compare: ${prHead.trim()} -> ${prBase.trim()}`,
            `Commits: ${String(compareResult.commits.length)}`,
            `Files changed: ${String(compareResult.files.length)}`,
            `Additions: ${String(compareResult.additions ?? 0)}`,
            `Deletions: ${String(compareResult.deletions ?? 0)}`,
            'Changed files:',
            ...changedFiles,
        ].join('\n');

        generateAIPRMutation.mutate({
            head: prHead.trim(),
            base: prBase.trim(),
            commits,
            diff: diffSummary,
        });
    };

    const handleMergePR = (pr: PullRequest) => {
        if (!activeRepo) return;
        mergePRMutation.mutate({
            repo: activeRepo,
            provider,
            number: pr.number,
            mergeMethod,
        });
    };

    const handleClosePR = (pr: PullRequest) => {
        if (!activeRepo) return;
        closePRMutation.mutate({
            repo: activeRepo,
            provider,
            number: pr.number,
        });
    };

    const branches = repoInfoData?.branches ?? [];
    const pullRequests = pullRequestQuery.data?.pullRequests ?? [];
    const queryError = pullRequestQuery.data?.error;
    const comments = commentsQuery.data?.comments ?? [];
    const collaborationMembers = collaborationMembersQuery.data?.members ?? [];
    const collaborationComments = (collaborationCommentsQuery.data?.comments ?? []) as CollaborationComment[];
    const collaborationAssignments = collaborationAssignmentsQuery.data?.assignments ?? [];
    const collaborationState = collaborationStateQuery.data;
    const reviewSummary = reviewSummaryQuery.data as ReviewSummaryData | undefined;
    const providerReviewState = reviewStateQuery.data?.reviewState ?? null;
    const reviewProgress = reviewSummary?.progress;
    const reviewFiles = reviewSummary?.files ?? [];
	    const fileReviewCommentsByTarget = useMemo(() => {
	        const entries = (collaborationState?.comments ?? []) as CollaborationComment[];
	        return entries.reduce((acc: Record<string, CollaborationComment[]>, comment) => {
            if (comment.targetType !== 'pull-request-file') {
                return acc;
            }
            if (getCollaborationReviewRootTargetId(comment.targetId) !== selectedReviewTargetId) {
                return acc;
            }
            const parsedTarget = parseCollaborationReviewTargetId(comment.targetId);
            if (!parsedTarget?.filePath) {
                return acc;
            }
            const normalizedTargetId = buildCollaborationPullRequestFileTargetId({
                provider,
                repoKey: reviewRepoKey,
                pullRequestNumber: selectedPR?.number ?? parsedTarget.pullRequestNumber,
                filePath: parsedTarget.filePath,
                ...(parsedTarget.side && parsedTarget.line ? { side: parsedTarget.side, line: parsedTarget.line } : {}),
            });
            acc[normalizedTargetId] = [...(acc[normalizedTargetId] ?? []), comment];
            return acc;
        }, {});
    }, [collaborationState?.comments, provider, reviewRepoKey, selectedPR?.number, selectedReviewTargetId]);

    const handleAddComment = () => {
        if (!activeRepo || !selectedPR) return;
        if (!commentDraft.trim()) {
            toast.error('Comment cannot be empty');
            return;
        }
        addCommentMutation.mutate({
            repo: activeRepo,
            provider,
            number: selectedPR.number,
            body: commentDraft.trim(),
        });
    };

    const handleMarkReviewFile = (filePath: string) => {
        if (!activeRepo || !selectedPR || !reviewProgress) return;
        const remainingFiles = reviewProgress.remainingFiles.filter((entry) => entry !== filePath);
        reviewUpdateMutation.mutate(
            {
                repo: activeRepo,
                reviewId: `${provider}:${String(selectedPR.number)}`,
                lastViewedFile: filePath,
                remainingFiles,
            },
            {
                onSuccess: async () => {
                    auditLogMutation.mutate({
                        scope: 'review',
                        action: 'review-file',
                        repo: activeRepo,
                        status: 'success',
                        summary: `Reviewed ${filePath} in PR #${String(selectedPR.number)}`,
                        metadata: {
                            provider,
                        },
                    });
                    await reviewSummaryQuery.refetch();
                },
            }
        );
    };

    const handleResetReview = () => {
        if (!activeRepo || !selectedPR) return;
        reviewResetMutation.mutate(
            {
                repo: activeRepo,
                reviewId: `${provider}:${String(selectedPR.number)}`,
            },
            {
                onSuccess: async () => {
                    auditLogMutation.mutate({
                        scope: 'review',
                        action: 'review-reset',
                        repo: activeRepo,
                        status: 'info',
                        summary: `Reset review progress for PR #${String(selectedPR.number)}`,
                        metadata: {
                            provider,
                        },
                    });
                    await reviewSummaryQuery.refetch();
                },
            }
        );
    };

    const handleMarkAllReviewed = () => {
        if (!activeRepo || !selectedPR) return;
        reviewUpdateMutation.mutate(
            {
                repo: activeRepo,
                reviewId: `${provider}:${String(selectedPR.number)}`,
                lastViewedFile: reviewFiles[reviewFiles.length - 1] ?? null,
                remainingFiles: [],
            },
            {
                onSuccess: async () => {
                    auditLogMutation.mutate({
                        scope: 'review',
                        action: 'review-complete',
                        repo: activeRepo,
                        status: 'success',
                        summary: `Completed review for PR #${String(selectedPR.number)}`,
                        metadata: {
                            provider,
                            files: reviewFiles.length,
                        },
                    });
                    await reviewSummaryQuery.refetch();
                },
            }
        );
    };

    const handleAssignReviewer = () => {
        if (!selectedPR || !selectedReviewTargetId) return;
	        const member = collaborationMembers.find((entry: CollaborationMemberProfile) => entry.id === reviewRequestDraft.assigneeId);
        if (!member) {
            toast.error('Select a reviewer first');
            return;
        }
        assignReviewMutation.mutate(
            {
                targetType: 'pull-request',
                targetId: selectedReviewTargetId,
                assigneeId: member.id,
                assigneeName: member.displayName,
                status: 'open',
                note: reviewRequestDraft.note,
            },
            {
                onSuccess: async () => {
                    notifySuccess(`Review requested from ${member.displayName}`);
                    auditLogMutation.mutate({
                        scope: 'review',
                        action: 'review-request',
                        repo: activeRepo ?? null,
                        status: 'success',
                        summary: `Requested review for PR #${String(selectedPR.number)}`,
                        metadata: {
                            provider,
                            assignee: member.displayName,
                        },
                    });
                    setReviewRequestDraft({ assigneeId: '', note: '' });
                },
                onError: (error: unknown) => {
                    notifyError('Failed to request review', {
                        description: getErrorMessage(error, 'Unable to create a shared review request'),
                    });
                },
            }
        );
    };

    const handleReviewThreadComment = () => {
        if (!selectedPR || !selectedReviewTargetId || !reviewThreadDraft.trim()) return;
        addCollaborationCommentMutation.mutate(
            {
                targetType: 'pull-request',
                targetId: selectedReviewTargetId,
                body: reviewThreadDraft.trim(),
            },
            {
                onSuccess: () => {
                    notifySuccess('Review thread updated', { persist: false });
                    setReviewThreadDraft('');
                },
                onError: (error: unknown) => {
                    notifyError('Failed to add review thread comment', {
                        description: getErrorMessage(error, 'Unable to save review discussion'),
                    });
                },
            }
        );
    };

    const handleFileReviewComment = (targetId: string, successLabel: string) => {
        const draft = fileReviewDrafts[targetId]?.trim();
        if (!selectedPR || !selectedReviewTargetId || !draft) return;
        addCollaborationCommentMutation.mutate(
            {
                targetType: 'pull-request-file',
                targetId,
                body: draft,
            },
            {
                onSuccess: () => {
                    notifySuccess(`Shared review note added for ${successLabel}`, { persist: false });
                    setFileReviewDrafts((current) => ({ ...current, [targetId]: '' }));
                },
                onError: (error: unknown) => {
                    notifyError('Failed to add file review note', {
                        description: getErrorMessage(error, 'Unable to save file-level review discussion'),
                    });
                },
            }
        );
    };

    const handleSyncCollaborationComment = (comment: CollaborationComment) => {
        if (!activeRepo || !selectedPR) return;
        syncCollaborationCommentMutation.mutate(
            {
                id: comment.id,
                repo: activeRepo,
                baseSha: selectedPR.reviewPosition?.baseSha ?? selectedPR.base.sha,
                startSha: selectedPR.reviewPosition?.startSha,
                headSha: selectedPR.reviewPosition?.headSha ?? selectedPR.head.sha,
            },
            {
                onSuccess: (result: unknown) => {
                    const mutationResult = result as { success?: boolean; error?: string | null };
                    if (!mutationResult.success) {
                        notifyError('Provider sync failed', {
                            description: mutationResult.error ?? 'Unable to mirror the collaboration comment to the provider review thread',
                        });
                        return;
                    }
                    notifySuccess('Comment mirrored to provider', { persist: false });
                },
                onError: (error: unknown) => {
                    notifyError('Provider sync failed', {
                        description: getErrorMessage(error, 'Unable to mirror the collaboration comment to the provider review thread'),
                    });
                },
            }
        );
    };

    const handleImportProviderComments = () => {
        if (!activeRepo || !selectedPR) return;
        importProviderCommentsMutation.mutate(
            {
                repo: activeRepo,
                provider,
                number: selectedPR.number,
            },
            {
                onSuccess: (result: unknown) => {
                    const mutationResult = result as { success?: boolean; error?: string | null; imported?: number };
                    if (!mutationResult.success) {
                        notifyError('Provider import failed', {
                            description: mutationResult.error ?? 'Unable to import provider review discussion',
                        });
                        return;
                    }
                    notifySuccess('Provider discussion imported', {
                        description: `${String(mutationResult.imported ?? 0)} provider comment${mutationResult.imported === 1 ? '' : 's'} mirrored into shared collaboration threads.`,
                        persist: false,
                    });
                },
                onError: (error: unknown) => {
                    notifyError('Provider import failed', {
                        description: getErrorMessage(error, 'Unable to import provider review discussion'),
                    });
                },
            }
        );
    };

    const handleSyncProviderReviewAssignments = () => {
        if (!activeRepo || !selectedPR) return;
        syncProviderReviewAssignmentsMutation.mutate(
            {
                repo: activeRepo,
                provider,
                number: selectedPR.number,
            },
            {
                onSuccess: (result: unknown) => {
                    const mutationResult = result as { success?: boolean; error?: string | null; synced?: number; removed?: number };
                    if (!mutationResult.success) {
                        notifyError('Provider reviewer sync failed', {
                            description: mutationResult.error ?? 'Unable to sync provider reviewer state into the shared review queue',
                        });
                        return;
                    }
                    notifySuccess('Provider reviewers synced', {
                        description: `${String(mutationResult.synced ?? 0)} reviewer assignment${mutationResult.synced === 1 ? '' : 's'} synced${(mutationResult.removed ?? 0) > 0 ? `, ${String(mutationResult.removed ?? 0)} removed` : ''}.`,
                        persist: false,
                    });
                },
                onError: (error: unknown) => {
                    notifyError('Provider reviewer sync failed', {
                        description: getErrorMessage(error, 'Unable to sync provider reviewer state into the shared review queue'),
                    });
                },
            }
        );
    };

    const renderProviderSyncBadge = (comment: CollaborationComment) => {
        if (!comment.providerSync) {
            return null;
        }
        if (comment.providerSync.status === 'synced') {
            return (
                <>
                    <Badge variant='outline' className='text-[10px]'>Synced to {comment.providerSync.provider}</Badge>
                    {comment.providerSync.remoteThreadStatus && (
                        <Badge variant='outline' className='text-[10px] capitalize'>
                            Thread {comment.providerSync.remoteThreadStatus}
                        </Badge>
                    )}
                </>
            );
        }
        if (comment.providerSync.status === 'failed') {
            return (
                <Badge variant='outline' className='border-amber-500/35 text-[10px] text-amber-700 dark:text-amber-200'>
                    Sync failed
                </Badge>
            );
        }
        return <Badge variant='outline' className='text-[10px]'>Syncing…</Badge>;
    };

    const renderProviderSyncAction = (comment: CollaborationComment) => (
        <div className='flex items-center gap-1'>
            {!comment.id.startsWith('provider-comment:') && (
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-10 px-2 text-xs'
                    disabled={syncCollaborationCommentMutation.isPending}
                    onClick={() => { handleSyncCollaborationComment(comment); }}>
                    <Send className='mr-1.5 h-3.5 w-3.5' />
                    {comment.providerSync?.status === 'synced' ? 'Resync' : 'Send'}
                </Button>
            )}
            {comment.providerSync?.remoteThreadId && activeRepo && (comment.providerSync.provider === 'gitlab' || comment.providerSync.provider === 'azure') && (
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-10 px-2 text-xs'
                    disabled={setProviderThreadResolvedMutation.isPending}
                    onClick={() => {
                        setProviderThreadResolvedMutation.mutate({
                            id: comment.id,
                            repo: activeRepo,
                            resolved: comment.providerSync?.remoteThreadStatus !== 'resolved',
                        }, {
                            onError: (error: unknown) => {
                                notifyError('Failed to update provider thread', {
                                    description: getErrorMessage(error, 'Unable to update provider thread state'),
                                });
                            },
                        });
                    }}>
                    {comment.providerSync.remoteThreadStatus === 'resolved' ? 'Reopen' : 'Resolve'}
                </Button>
            )}
        </div>
    );

    const renderProviderAssignmentBadge = (assignment: CollaborationAssignment) => {
        const providerSync = assignment.providerSync;
        if (!providerSync) {
            return null;
        }
        const label = providerSync.reviewerStatus === 'changes-requested'
            ? 'Changes Requested'
            : providerSync.reviewerStatus.replace(/-/g, ' ');
        return (
            <Badge variant='outline' className='text-[10px] capitalize'>
                {providerSync.provider} · {label}
            </Badge>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[90vh] max-w-5xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <GitPullRequest className='h-5 w-5' />
                        Pull Requests
                        {detectedProvider ? (
                            <Badge variant='outline' className='ml-2 gap-1'>
                                {getProviderIcon(detectedProvider.name)}
                                <span className='capitalize'>{detectedProvider.name}</span>
                            </Badge>
                        ) : null}
                    </DialogTitle>
                </DialogHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => { setActiveTab(value as 'list' | 'review' | 'create' | 'settings'); }}
                    className='flex min-h-0 flex-1 flex-col'>
                    <TabsList className='grid w-full grid-cols-4'>
                        <TabsTrigger value='list'>Pull Requests</TabsTrigger>
                        <TabsTrigger value='review'>Review</TabsTrigger>
                        <TabsTrigger value='create'>Create</TabsTrigger>
                        <TabsTrigger value='settings'>Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value='list' className='mt-4 flex min-h-0 flex-1 gap-4'>
                        <div className='flex min-h-0 flex-1 flex-col rounded-lg border'>
                            <div className='bg-muted/40 flex items-center justify-between border-b px-3 py-2'>
                                <div className='flex items-center gap-2'>
                                    <select
                                        value={stateFilter}
                                        onChange={(event) => { setStateFilter(event.target.value as PullRequestStateFilter); }}
                                        className='bg-background h-8 rounded-md border px-2 text-xs'>
                                        <option value='open'>Open</option>
                                        <option value='closed'>Closed</option>
                                        <option value='all'>All</option>
                                    </select>
                                    <Badge variant='secondary'>{pullRequests.length}</Badge>
                                </div>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => void pullRequestQuery.refetch()}
                                    disabled={pullRequestQuery.isFetching}>
                                    {pullRequestQuery.isFetching ? (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                    ) : (
                                        <RefreshCw className='h-4 w-4' />
                                    )}
                                </Button>
                            </div>

                            {!detectedProvider ? (
                                <div className='flex flex-1 items-center justify-center p-6 text-center'>
                                    <div>
                                        <AlertCircle className='mx-auto mb-3 h-10 w-10 text-amber-500' />
                                        <p className='font-medium'>No pull request provider detected</p>
                                        <p className='text-muted-foreground mt-1 text-sm'>
                                            Configure an `origin` remote for GitHub, GitLab, Bitbucket, or Azure DevOps.
                                        </p>
                                    </div>
                                </div>
                            ) : !hasRequiredToken ? (
                                <div className='flex flex-1 items-center justify-center p-6 text-center'>
                                    <div>
                                        <AlertCircle className='mx-auto mb-3 h-10 w-10 text-amber-500' />
                                        <p className='font-medium'>Missing provider token</p>
                                        <p className='text-muted-foreground mt-1 text-sm'>
                                            Add a {provider} token in Settings to manage pull requests in-app.
                                        </p>
                                        <Button variant='outline' size='sm' className='mt-4' onClick={() => { setActiveTab('settings'); }}>
                                            <Settings className='mr-2 h-4 w-4' />
                                            Open Settings
                                        </Button>
                                    </div>
                                </div>
                            ) : pullRequestQuery.isLoading ? (
                                <div className='flex flex-1 items-center justify-center'>
                                    <Loader2 className='h-6 w-6 animate-spin' />
                                </div>
                            ) : queryError ? (
                                <div className='flex flex-1 items-center justify-center p-6 text-center'>
                                    <div>
                                        <AlertCircle className='mx-auto mb-3 h-10 w-10 text-red-500' />
                                        <p className='font-medium'>Unable to load pull requests</p>
                                        <p className='text-muted-foreground mt-1 text-sm'>{queryError}</p>
                                    </div>
                                </div>
                            ) : pullRequests.length === 0 ? (
                                <div className='flex flex-1 items-center justify-center p-6 text-center'>
                                    <div>
                                        <GitPullRequest className='text-muted-foreground mx-auto mb-3 h-10 w-10' />
                                        <p className='font-medium'>No pull requests found</p>
                                        <p className='text-muted-foreground mt-1 text-sm'>
                                            Create one from the Create tab.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className='flex-1'>
                                    <div className='space-y-2 p-2'>
                                        {pullRequests.map((pr) => (
                                            <button
                                                key={`${String(pr.id)}-${String(pr.number)}`}
                                                type='button'
                                                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                                    selectedPR?.id === pr.id ? 'bg-accent border-primary/50' : 'hover:bg-accent/50'
                                                }`}
                                                onClick={() => { setSelectedPR(pr); }}>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <div className='min-w-0'>
                                                        <p className='truncate text-sm font-medium'>
                                                            #{pr.number} {pr.title}
                                                        </p>
                                                        <p className='text-muted-foreground mt-1 text-xs'>
                                                            {pr.head.ref} → {pr.base.ref} • {pr.author || 'unknown'}
                                                        </p>
                                                    </div>
                                                    <Badge variant={pr.state === 'open' ? 'secondary' : 'outline'}>
                                                        {pr.draft ? 'draft' : pr.state}
                                                    </Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>

                        <div className='flex w-[320px] flex-col rounded-lg border'>
                            <div className='bg-muted/40 border-b px-3 py-2 text-sm font-medium'>Details</div>
                            {!selectedPR ? (
                                <div className='text-muted-foreground flex flex-1 items-center justify-center px-4 text-center text-sm'>
                                    Select a pull request to view details and actions.
                                </div>
                            ) : (
                                <div className='flex h-full flex-col'>
                                    <div className='space-y-3 px-3 py-3'>
                                        <div>
                                            <p className='text-sm font-semibold'>#{selectedPR.number}</p>
                                            <p className='text-sm'>{selectedPR.title}</p>
                                        </div>
                                        <div className='text-muted-foreground text-xs'>
                                            <p>Author: {selectedPR.author || 'unknown'}</p>
                                            <p>Branch: {selectedPR.head.ref} → {selectedPR.base.ref}</p>
                                            <p>State: {selectedPR.draft ? 'draft' : selectedPR.state}</p>
                                        </div>
                                        {repoPolicyQuery.data?.policy && (
                                            <div className='rounded border border-amber-500/30 bg-amber-500/8 p-2 text-xs'>
                                                <p className='font-medium text-foreground'>Repo policy guidance</p>
                                                <p className='text-muted-foreground mt-1'>
                                                    Allowed merge methods: {repoPolicyQuery.data.policy.allowedMergeStrategies.join(', ')}
                                                </p>
                                                {repoPolicyQuery.data.policy.requireUpToDate && (
                                                    <p className='text-muted-foreground mt-1'>Branch should be up to date before merge.</p>
                                                )}
                                                {repoPolicyQuery.data.policy.requireSignedCommits && (
                                                    <p className='text-muted-foreground mt-1'>Signed commits are expected for this repository.</p>
                                                )}
                                                {repoPolicyQuery.data.policy.customWorkflow && (
                                                    <p className='text-muted-foreground mt-1'>{repoPolicyQuery.data.policy.customWorkflow}</p>
                                                )}
                                            </div>
                                        )}
                                        {selectedPR.state === 'open' && (
                                            <div>
                                                <label className='mb-1 block text-xs font-medium text-muted-foreground'>
                                                    Merge Method
                                                </label>
                                                <select
                                                    value={mergeMethod}
                                                    onChange={(event) =>
                                                        { setMergeMethod(event.target.value as 'merge' | 'squash' | 'rebase'); }
                                                    }
                                                    className='bg-background h-8 w-full rounded-md border px-2 text-xs'>
                                                    <option value='merge'>Merge commit</option>
                                                    <option value='squash'>Squash</option>
                                                    <option value='rebase'>Rebase</option>
                                                </select>
                                                {repoPolicyQuery.data?.policy &&
                                                    !repoPolicyQuery.data.policy.allowedMergeStrategies.includes(mergeMethod) && (
                                                        <p className='mt-1 text-xs text-amber-600'>
                                                            Current merge method is outside repo policy guidance.
                                                        </p>
                                                    )}
                                            </div>
                                        )}
                                        <div className='space-y-2 rounded border p-2'>
                                            <div className='flex items-center gap-1 text-xs font-medium text-muted-foreground'>
                                                <MessageSquare className='h-3.5 w-3.5' />
                                                Comments
                                                <Badge variant='outline' className='ml-auto h-5 px-1.5 text-[10px]'>
                                                    {comments.length}
                                                </Badge>
                                            </div>
                                            <ScrollArea className='h-28'>
                                                <div className='space-y-2 pr-2'>
                                                    {commentsQuery.isFetching ? (
                                                        <p className='text-xs text-muted-foreground'>Loading comments...</p>
                                                    ) : comments.length === 0 ? (
                                                        <p className='text-xs text-muted-foreground'>No comments yet.</p>
                                                    ) : (
                                                        comments.map((comment) => (
                                                            <div key={comment.id} className='rounded border p-1.5'>
                                                                <p className='text-[11px] font-medium'>
                                                                    {comment.author || 'unknown'}
                                                                </p>
                                                                <p className='mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground'>
                                                                    {comment.body}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </ScrollArea>
                                            <Textarea
                                                value={commentDraft}
                                                onChange={(event) => { setCommentDraft(event.target.value); }}
                                                placeholder='Add a comment'
                                                className='min-h-[64px] text-xs'
                                            />
                                            <Button
                                                size='sm'
                                                className='w-full'
                                                onClick={handleAddComment}
                                                disabled={addCommentMutation.isPending || !commentDraft.trim()}>
                                                {addCommentMutation.isPending ? (
                                                    <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
                                                ) : (
                                                    <Send className='mr-2 h-3.5 w-3.5' />
                                                )}
                                                Post Comment
                                            </Button>
                                        </div>
                                    </div>
                                    <div className='mt-auto flex flex-wrap gap-2 border-t p-3'>
                                        <Button
                                            variant='outline'
                                            size='sm'
                                            onClick={() => window.open(selectedPR.webUrl, '_blank')}>
                                            <ExternalLink className='mr-2 h-4 w-4' />
                                            Open
                                        </Button>
                                        {selectedPR.state === 'open' && (
                                            <>
                                                <Button
                                                    size='sm'
                                                    onClick={() => { handleMergePR(selectedPR); }}
                                                    disabled={mergePRMutation.isPending || closePRMutation.isPending}>
                                                    {mergePRMutation.isPending ? (
                                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                    ) : (
                                                        <Check className='mr-2 h-4 w-4' />
                                                    )}
                                                    Merge
                                                </Button>
                                                <Button
                                                    variant='destructive'
                                                    size='sm'
                                                    onClick={() => { handleClosePR(selectedPR); }}
                                                    disabled={mergePRMutation.isPending || closePRMutation.isPending}>
                                                    {closePRMutation.isPending ? (
                                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                    ) : (
                                                        <X className='mr-2 h-4 w-4' />
                                                    )}
                                                    Close
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value='review' className='mt-4 flex min-h-0 flex-1 gap-4'>
                        <div className='flex min-h-0 w-[280px] flex-col rounded-lg border'>
                            <div className='bg-muted/40 flex items-center justify-between border-b px-3 py-2'>
                                <p className='text-sm font-medium'>Open Reviews</p>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => void pullRequestQuery.refetch()}
                                    disabled={pullRequestQuery.isFetching}>
                                    {pullRequestQuery.isFetching ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                                </Button>
                            </div>
                            <ScrollArea className='flex-1'>
                                <div className='space-y-2 p-2'>
                                    {pullRequests
                                        .filter((pr) => pr.state === 'open')
                                        .map((pr) => (
                                            <button
                                                key={`review-${String(pr.id)}-${String(pr.number)}`}
                                                type='button'
                                                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                                    selectedPR?.id === pr.id ? 'bg-accent border-primary/50' : 'hover:bg-accent/50'
                                                }`}
                                                onClick={() => {
                                                    setSelectedPR(pr);
                                                }}>
                                                <p className='truncate text-sm font-medium'>#{pr.number} {pr.title}</p>
                                                <p className='text-muted-foreground mt-1 text-xs'>{pr.head.ref} → {pr.base.ref}</p>
                                            </button>
                                        ))}
                                    {pullRequests.filter((pr) => pr.state === 'open').length === 0 && (
                                        <p className='text-muted-foreground p-3 text-sm'>No open pull requests to review.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <div className='flex min-h-0 flex-1 flex-col rounded-lg border'>
                            {!selectedPR ? (
                                <div className='text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm'>
                                    Select an open pull request to track review progress.
                                </div>
                            ) : reviewSummaryQuery.isFetching ? (
                                <div className='flex flex-1 items-center justify-center'>
                                    <Loader2 className='h-6 w-6 animate-spin' />
                                </div>
                            ) : reviewSummary?.error ? (
                                <div className='text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm'>
                                    {reviewSummary.error}
                                </div>
                            ) : (
                                <div className='flex min-h-0 flex-1 flex-col'>
                                    <div className='border-b px-4 py-3'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <div>
                                                <p className='text-sm font-semibold'>#{selectedPR.number} {selectedPR.title}</p>
                                                <p className='text-muted-foreground text-xs'>{selectedPR.head.ref} → {selectedPR.base.ref}</p>
                                            </div>
                                            <div className='flex gap-2'>
                                                <Button
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={handleImportProviderComments}
                                                    disabled={importProviderCommentsMutation.isPending}>
                                                    {importProviderCommentsMutation.isPending ? (
                                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                    ) : (
                                                        <RefreshCw className='mr-2 h-4 w-4' />
                                                    )}
                                                    Import Provider Comments
                                                </Button>
                                                <Button variant='outline' size='sm' onClick={handleResetReview} disabled={reviewResetMutation.isPending}>
                                                    Reset
                                                </Button>
                                                <Button size='sm' onClick={handleMarkAllReviewed} disabled={reviewUpdateMutation.isPending || reviewFiles.length === 0}>
                                                    Mark All Reviewed
                                                </Button>
                                            </div>
                                        </div>
                                        <div className='mt-3 grid grid-cols-4 gap-2 text-xs'>
                                            <div className='rounded border p-2'>
                                                <p className='text-muted-foreground'>Files</p>
                                                <p className='text-sm font-semibold'>{reviewProgress?.totalFiles ?? reviewFiles.length}</p>
                                            </div>
                                            <div className='rounded border p-2'>
                                                <p className='text-muted-foreground'>Reviewed</p>
                                                <p className='text-sm font-semibold'>{reviewProgress?.reviewedCount ?? 0}</p>
                                            </div>
                                            <div className='rounded border p-2'>
                                                <p className='text-muted-foreground'>Remaining</p>
                                                <p className='text-sm font-semibold'>{reviewProgress?.remainingFiles.length ?? reviewFiles.length}</p>
                                            </div>
                                            <div className='rounded border p-2'>
                                                <p className='text-muted-foreground'>Last Viewed</p>
                                                <p className='truncate text-sm font-semibold'>{reviewProgress?.lastViewedFile ?? 'None'}</p>
                                            </div>
                                        </div>
                                        <div className='mt-4 rounded-xl border border-border/70 bg-background/70 p-3'>
                                            <div className='flex flex-wrap items-center justify-between gap-3'>
                                                <div>
                                                    <p className='text-sm font-medium'>Provider Review State</p>
                                                    <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                                                        Mirror provider reviewer state into the shared queue so team ownership reflects real PR state.
                                                    </p>
                                                </div>
                                                <Button
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={handleSyncProviderReviewAssignments}
                                                    disabled={syncProviderReviewAssignmentsMutation.isPending}>
                                                    {syncProviderReviewAssignmentsMutation.isPending ? (
                                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                    ) : (
                                                        <RefreshCw className='mr-2 h-4 w-4' />
                                                    )}
                                                    Sync Provider Reviewers
                                                </Button>
                                            </div>
                                            {reviewStateQuery.data?.error ? (
                                                <p className='mt-3 text-xs text-amber-700 dark:text-amber-200'>{reviewStateQuery.data.error}</p>
                                            ) : providerReviewState ? (
                                                <>
                                                    <div className='mt-3 grid gap-2 sm:grid-cols-5'>
                                                        <div className='rounded-lg border border-border/60 p-2'>
                                                            <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Overall</p>
                                                            <p className='mt-2 text-sm font-semibold capitalize'>{providerReviewState.overall.replace(/-/g, ' ')}</p>
                                                        </div>
                                                        <div className='rounded-lg border border-border/60 p-2'>
                                                            <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Requested</p>
                                                            <p className='mt-2 text-sm font-semibold tabular-nums'>{providerReviewState.requestedCount}</p>
                                                        </div>
                                                        <div className='rounded-lg border border-border/60 p-2'>
                                                            <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Approved</p>
                                                            <p className='mt-2 text-sm font-semibold tabular-nums'>{providerReviewState.approvedCount}</p>
                                                        </div>
                                                        <div className='rounded-lg border border-border/60 p-2'>
                                                            <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Changes</p>
                                                            <p className='mt-2 text-sm font-semibold tabular-nums'>{providerReviewState.changesRequestedCount}</p>
                                                        </div>
                                                        <div className='rounded-lg border border-border/60 p-2'>
                                                            <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Commented</p>
                                                            <p className='mt-2 text-sm font-semibold tabular-nums'>{providerReviewState.commentedCount}</p>
                                                        </div>
                                                    </div>
                                                    <div className='mt-3 flex flex-wrap gap-2'>
                                                        {providerReviewState.reviewers.length === 0 ? (
                                                            <p className='text-xs text-muted-foreground'>No provider reviewers recorded for this pull request yet.</p>
                                                        ) : (
                                                            providerReviewState.reviewers.map((reviewer) => (
                                                                <div key={reviewer.id} className='min-w-[180px] rounded-lg border border-border/60 bg-muted/20 px-3 py-2'>
                                                                    <div className='flex flex-wrap items-center gap-2'>
                                                                        <p className='text-xs font-medium'>{reviewer.name}</p>
                                                                        <Badge variant='outline' className='text-[10px] capitalize'>
                                                                            {reviewer.status.replace(/-/g, ' ')}
                                                                        </Badge>
                                                                        {reviewer.required && (
                                                                            <Badge variant='secondary' className='text-[10px]'>
                                                                                Required
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {reviewer.updatedAt && (
                                                                        <p className='mt-2 text-[11px] text-muted-foreground'>
                                                                            Updated {new Date(reviewer.updatedAt).toLocaleString()}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className='mt-3 text-xs text-muted-foreground'>Provider review state will load when the review panel is active.</p>
                                            )}
                                        </div>
                                        <div className='mt-4 rounded-xl border border-border/70 bg-muted/20 p-3'>
                                            <div className='flex items-center gap-2'>
                                                <ClipboardCheck className='h-4 w-4 text-muted-foreground' />
                                                <p className='text-sm font-medium'>Shared Review Queue</p>
                                            </div>
                                            <p className='mt-2 text-xs leading-5 text-muted-foreground'>
                                                Turn this pull request into shared team work with explicit reviewer ownership and discussion.
                                            </p>
                                            {collaborationMembers.length === 0 && (
                                                <p className='mt-3 text-xs text-muted-foreground'>
                                                    No shared collaborators available yet. Publish a collaboration session in Collaboration Center first.
                                                </p>
                                            )}
                                            <CollaborationAssignmentPanel
                                                title='Requested Reviewers'
                                                assignments={collaborationAssignments}
                                                members={collaborationMembers}
                                                selectedAssigneeId={reviewRequestDraft.assigneeId}
                                                noteDraft={reviewRequestDraft.note}
                                                pending={
                                                    assignReviewMutation.isPending ||
                                                    updateReviewAssignmentMutation.isPending ||
                                                    deleteReviewAssignmentMutation.isPending
                                                }
                                                onAssigneeChange={(value) => {
                                                    setReviewRequestDraft((current) => ({ ...current, assigneeId: value }));
                                                }}
                                                onNoteChange={(value) => {
                                                    setReviewRequestDraft((current) => ({ ...current, note: value }));
                                                }}
                                                onCreate={handleAssignReviewer}
                                                onStatusChange={(assignmentId, status) => {
                                                    updateReviewAssignmentMutation.mutate(
                                                        { id: assignmentId, status },
                                                        {
                                                            onError: (error: unknown) => {
                                                                notifyError('Failed to update reviewer status', {
                                                                    description: getErrorMessage(error, 'Unable to update review queue item'),
                                                                });
                                                            },
                                                        }
                                                    );
                                                }}
                                                onDelete={(assignmentId) => {
                                                    deleteReviewAssignmentMutation.mutate(
                                                        { id: assignmentId },
                                                        {
                                                            onError: (error: unknown) => {
                                                                notifyError('Failed to remove reviewer', {
                                                                    description: getErrorMessage(error, 'Unable to remove review request'),
                                                                });
                                                            },
                                                        }
                                                    );
                                                }}
                                                renderAssignmentBadges={renderProviderAssignmentBadge}
                                            />
                                            <CollaborationCommentThread
                                                title='Shared Review Thread'
                                                comments={collaborationComments}
                                                draft={reviewThreadDraft}
                                                submitPending={addCollaborationCommentMutation.isPending || deleteCollaborationCommentMutation.isPending}
                                                onDraftChange={setReviewThreadDraft}
                                                onSubmit={handleReviewThreadComment}
                                                onDelete={(commentId) => {
                                                    deleteCollaborationCommentMutation.mutate(
                                                        { id: commentId },
                                                        {
                                                            onError: (error: unknown) => {
                                                                notifyError('Failed to delete review thread comment', {
                                                                    description: getErrorMessage(error, 'Unable to remove review discussion'),
                                                                });
                                                            },
                                                        }
                                                    );
                                                }}
                                                renderCommentBadges={renderProviderSyncBadge}
                                                renderCommentActions={renderProviderSyncAction}
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className='flex-1'>
                                        <div className='space-y-2 p-4'>
                                            {reviewFiles.map((filePath) => {
                                                const reviewed = !(reviewProgress?.remainingFiles ?? reviewFiles).includes(filePath);
                                                const fileTargetId = buildCollaborationPullRequestFileTargetId({
                                                    provider,
                                                    repoKey: reviewRepoKey,
                                                    pullRequestNumber: selectedPR.number,
                                                    filePath,
                                                });
                                                const fileComments = fileReviewCommentsByTarget[fileTargetId] ?? [];
                                                const threadOpen = Boolean(expandedReviewFiles[fileTargetId]);
                                                return (
                                                    <div key={filePath} className='rounded-lg border p-3'>
                                                        <div className='flex items-center justify-between gap-3'>
                                                            <div className='min-w-0'>
                                                                <p className='truncate text-sm font-medium'>{filePath}</p>
                                                                <p className='text-muted-foreground text-xs'>{reviewed ? 'Reviewed' : 'Needs review'}</p>
                                                            </div>
                                                            <div className='flex items-center gap-2'>
                                                                <Button
                                                                    size='sm'
                                                                    variant='outline'
                                                                    onClick={() => {
                                                                        setExpandedReviewFiles((current) => ({
                                                                            ...current,
                                                                            [fileTargetId]: !current[fileTargetId],
                                                                        }));
                                                                    }}>
                                                                    {threadOpen ? 'Hide Discussion' : `Discuss${fileComments.length > 0 ? ` (${String(fileComments.length)})` : ''}`}
                                                                </Button>
                                                                <Button
                                                                    size='sm'
                                                                    variant={reviewed ? 'outline' : 'default'}
                                                                    onClick={() => {
                                                                        handleMarkReviewFile(filePath);
                                                                    }}
                                                                    disabled={reviewed || reviewUpdateMutation.isPending}>
                                                                    {reviewed ? (
                                                                        <>
                                                                            <Check className='mr-2 h-4 w-4' />
                                                                            Reviewed
                                                                        </>
                                                                    ) : (
                                                                        'Mark Reviewed'
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        {threadOpen && (
                                                            <>
                                                                <CollaborationCommentThread
                                                                    title={`File thread · ${filePath}`}
                                                                    comments={fileComments}
                                                                    draft={fileReviewDrafts[fileTargetId] ?? ''}
                                                                    submitPending={addCollaborationCommentMutation.isPending || deleteCollaborationCommentMutation.isPending}
                                                                    onDraftChange={(value) => {
                                                                        setFileReviewDrafts((current) => ({ ...current, [fileTargetId]: value }));
                                                                    }}
                                                                    onSubmit={() => handleFileReviewComment(fileTargetId, filePath)}
                                                                    onDelete={(commentId) => {
                                                                        deleteCollaborationCommentMutation.mutate(
                                                                            { id: commentId },
                                                                            {
                                                                                onError: (error: unknown) => {
                                                                                    notifyError('Failed to delete file review note', {
                                                                                        description: getErrorMessage(error, 'Unable to remove file-level discussion'),
                                                                                    });
                                                                                },
                                                                            }
                                                                        );
                                                                    }}
                                                                    renderCommentBadges={renderProviderSyncBadge}
                                                                    renderCommentActions={renderProviderSyncAction}
                                                                />
                                                                <ReviewDiffThread
                                                                    repo={activeRepo ?? ''}
                                                                    baseRef={selectedPR.base.ref}
                                                                    headRef={selectedPR.head.ref}
                                                                    filePath={filePath}
                                                                    targetPrefix={fileTargetId}
                                                                    commentsByTarget={fileReviewCommentsByTarget}
                                                                    drafts={fileReviewDrafts}
                                                                    expandedTargets={expandedReviewFiles}
                                                                    submitPending={addCollaborationCommentMutation.isPending}
                                                                    deletePending={deleteCollaborationCommentMutation.isPending}
                                                                    onDraftChange={(targetId, value) => {
                                                                        setFileReviewDrafts((current) => ({ ...current, [targetId]: value }));
                                                                    }}
                                                                    onToggleTarget={(targetId) => {
                                                                        setExpandedReviewFiles((current) => ({ ...current, [targetId]: !current[targetId] }));
                                                                    }}
                                                                    onSubmit={(targetId) => handleFileReviewComment(targetId, filePath)}
                                                                    onDelete={(commentId) => {
                                                                        deleteCollaborationCommentMutation.mutate(
                                                                            { id: commentId },
                                                                            {
                                                                                onError: (error: unknown) => {
                                                                                    notifyError('Failed to delete line review note', {
                                                                                        description: getErrorMessage(error, 'Unable to remove line-level discussion'),
                                                                                    });
                                                                                },
                                                                            }
                                                                        );
                                                                    }}
                                                                    renderCommentBadges={renderProviderSyncBadge}
                                                                    renderCommentActions={renderProviderSyncAction}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {reviewFiles.length === 0 && (
                                                <p className='text-muted-foreground text-sm'>No changed files detected for this pull request.</p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value='create' className='mt-4 min-h-0 flex-1'>
                        {!detectedProvider ? (
                            <div className='text-muted-foreground flex h-full items-center justify-center rounded-lg border p-6 text-center text-sm'>
                                Configure an `origin` remote before creating pull requests.
                            </div>
                        ) : (
                            <div className='space-y-4 rounded-lg border p-4'>
                                {aiProdEnabled && (
                                    <div className='flex justify-end'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={() => { void handleGenerateWithAI(); }}
                                            disabled={
                                                !prHead.trim() ||
                                                !prBase.trim() ||
                                                generateAIPRMutation.isPending ||
                                                compareBranchesQuery.isFetching
                                            }>
                                            {generateAIPRMutation.isPending || compareBranchesQuery.isFetching ? (
                                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            ) : (
                                                <Wand2 className='mr-2 h-4 w-4' />
                                            )}
                                            Generate with AI
                                        </Button>
                                    </div>
                                )}
                                <div className='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label className='mb-1.5 block text-sm font-medium'>Source Branch</label>
                                        <select
                                            className='bg-background h-9 w-full rounded-md border px-3 text-sm'
                                            value={prHead}
                                            onChange={(event) => { setPrHead(event.target.value); }}>
                                            <option value=''>Select branch</option>
                                            {branches.map((branchName) => (
                                                <option key={branchName} value={branchName}>
                                                    {branchName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className='mb-1.5 block text-sm font-medium'>Target Branch</label>
                                        <select
                                            className='bg-background h-9 w-full rounded-md border px-3 text-sm'
                                            value={prBase}
                                            onChange={(event) => { setPrBase(event.target.value); }}>
                                            {branches.length > 0 ? (
                                                branches.map((branchName) => (
                                                    <option key={branchName} value={branchName}>
                                                        {branchName}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value='main'>main</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className='mb-1.5 block text-sm font-medium'>Title</label>
                                    <Input
                                        placeholder='Add a title for your pull request'
                                        value={prTitle}
                                        onChange={(event) => { setPrTitle(event.target.value); }}
                                    />
                                </div>

                                <div>
                                    <label className='mb-1.5 block text-sm font-medium'>Description</label>
                                    <Textarea
                                        placeholder='Describe your changes'
                                        value={prBody}
                                        onChange={(event) => { setPrBody(event.target.value); }}
                                        className='min-h-[150px]'
                                    />
                                </div>

                                <label className='flex items-center gap-2 text-sm'>
                                    <input
                                        type='checkbox'
                                        className='rounded'
                                        checked={prDraft}
                                        onChange={(event) => { setPrDraft(event.target.checked); }}
                                    />
                                    Create as draft
                                </label>

                                <div className='flex justify-end gap-2 pt-2'>
                                    <Button variant='outline' onClick={resetCreateForm}>
                                        Clear
                                    </Button>
                                    <Button
                                        onClick={handleCreatePR}
                                        disabled={!prTitle.trim() || !prHead.trim() || createPRMutation.isPending}>
                                        {createPRMutation.isPending ? (
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        ) : (
                                            <Plus className='mr-2 h-4 w-4' />
                                        )}
                                        Create Pull Request
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value='settings' className='mt-4 min-h-0 flex-1'>
                        <div className='space-y-4 rounded-lg border p-4'>
                            <div>
                                <h3 className='text-sm font-semibold'>Provider Authentication</h3>
                                <p className='text-muted-foreground mt-1 text-xs'>
                                    Tokens are stored locally on this machine to enable in-app PR operations.
                                </p>
                            </div>

                            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                                <AuthField
                                    label='GitHub Token'
                                    value={authForm.githubToken}
                                    onChange={(value) => { setAuthForm((current) => ({ ...current, githubToken: value })); }}
                                />
                                <AuthField
                                    label='GitLab Token'
                                    value={authForm.gitlabToken}
                                    onChange={(value) => { setAuthForm((current) => ({ ...current, gitlabToken: value })); }}
                                />
                                <AuthField
                                    label='Bitbucket Token'
                                    value={authForm.bitbucketToken}
                                    onChange={(value) => { setAuthForm((current) => ({ ...current, bitbucketToken: value })); }}
                                />
                                <AuthField
                                    label='Bitbucket Username'
                                    value={authForm.bitbucketUsername}
                                    onChange={(value) =>
                                        { setAuthForm((current) => ({ ...current, bitbucketUsername: value })); }
                                    }
                                />
                                <AuthField
                                    label='Azure DevOps PAT'
                                    value={authForm.azureToken}
                                    onChange={(value) => { setAuthForm((current) => ({ ...current, azureToken: value })); }}
                                />
                            </div>

                            <div className='flex justify-end gap-2'>
                                <Button
                                    variant='outline'
                                    onClick={() => {
                                        setAuthForm(DEFAULT_AUTH_FORM);
                                    }}>
                                    Clear Form
                                </Button>
                                <Button onClick={handleSaveAuth} disabled={saveAuthMutation.isPending}>
                                    {saveAuthMutation.isPending ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Save className='mr-2 h-4 w-4' />
                                    )}
                                    Save
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function AuthField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className='mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground'>{label}</label>
            <Input type='password' value={value} onChange={(event) => { onChange(event.target.value); }} />
        </div>
    );
}

function ReviewDiffThread({
    repo,
    baseRef,
    headRef,
    filePath,
    targetPrefix,
    commentsByTarget,
    drafts,
    expandedTargets,
    submitPending,
    deletePending,
    onDraftChange,
    onToggleTarget,
    onSubmit,
    onDelete,
    renderCommentBadges,
    renderCommentActions,
}: {
    repo: string;
    baseRef: string;
    headRef: string;
    filePath: string;
    targetPrefix: string;
    commentsByTarget: Record<string, CollaborationComment[]>;
    drafts: Record<string, string>;
    expandedTargets: Record<string, boolean>;
    submitPending?: boolean;
    deletePending?: boolean;
    onDraftChange: (targetId: string, value: string) => void;
    onToggleTarget: (targetId: string) => void;
    onSubmit: (targetId: string) => void;
    onDelete: (commentId: string) => void;
    renderCommentBadges?: (comment: CollaborationComment) => ReactNode;
    renderCommentActions?: (comment: CollaborationComment) => ReactNode;
}) {
    const diffQuery = trpc.git.rangeFileDiff.useQuery(
        { repo, baseRef, headRef, filePath },
        { enabled: !!repo && !!baseRef && !!headRef && !!filePath, staleTime: 5_000 }
    );

    const parsed = useMemo(() => {
        if (!diffQuery.data?.diff) {
            return [];
        }
        return parseDiffWithInlineDiffs(diffQuery.data.diff).filter((line) => line.type !== 'context');
    }, [diffQuery.data?.diff]);

    if (diffQuery.isFetching && parsed.length === 0) {
        return <div className='mt-3 rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground'>Loading diff discussion…</div>;
    }

    if (diffQuery.data?.error) {
        return <div className='mt-3 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3 py-4 text-xs text-amber-700 dark:text-amber-200'>{diffQuery.data.error}</div>;
    }

    if (parsed.length === 0) {
        return <div className='mt-3 rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground'>No line-level diff available for this file.</div>;
    }

    return (
        <div className='mt-3 space-y-2'>
            {parsed.slice(0, 40).map((line) => {
                const anchorLine = line.rightLineNum || line.leftLineNum;
                const side = line.rightLineNum ? 'right' : 'left';
                const targetId = `${targetPrefix}:${side}:${String(anchorLine)}`;
                const threadOpen = Boolean(expandedTargets[targetId]);
                const lineText =
                    line.right?.chars.map((entry) => entry.char).join('') ??
                    line.left?.chars.map((entry) => entry.char).join('') ??
                    '';
                return (
                    <div key={targetId} className='rounded-lg border border-border/60 bg-background/70'>
                        <button
                            type='button'
                            className='flex w-full items-start justify-between gap-3 px-3 py-2 text-left'
                            onClick={() => onToggleTarget(targetId)}>
                            <div className='min-w-0'>
                                <p className='font-mono text-xs text-muted-foreground'>
                                    {side === 'right' ? '+' : '-'}{anchorLine}
                                </p>
                                <p className='mt-1 truncate font-mono text-xs text-foreground/90'>{lineText || '(empty line)'}</p>
                            </div>
                            <Badge variant='outline'>
                                {(commentsByTarget[targetId] ?? []).length}
                            </Badge>
                        </button>
                        {threadOpen && (
                            <div className='border-t border-border/60 px-3 pb-3'>
                                <CollaborationCommentThread
                                    title={`Line ${String(anchorLine)} discussion`}
                                    comments={commentsByTarget[targetId] ?? []}
                                    draft={drafts[targetId] ?? ''}
                                    submitPending={submitPending || deletePending}
                                    onDraftChange={(value) => onDraftChange(targetId, value)}
                                    onSubmit={() => onSubmit(targetId)}
                                    onDelete={onDelete}
                                    {...(renderCommentBadges ? { renderCommentBadges } : {})}
                                    {...(renderCommentActions ? { renderCommentActions } : {})}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
            {parsed.length > 40 && (
                <p className='text-xs text-muted-foreground'>
                    Showing the first 40 changed lines for discussion.
                </p>
            )}
        </div>
    );
}

function getProviderIcon(provider: PullRequestProvider) {
    switch (provider) {
        case 'github':
            return <Globe className='h-4 w-4' />;
        case 'gitlab':
            return <Server className='h-4 w-4' />;
        case 'azure':
            return <GitBranch className='h-4 w-4' />;
        default:
            return <GitPullRequest className='h-4 w-4' />;
    }
}

export default PullRequestIntegration;

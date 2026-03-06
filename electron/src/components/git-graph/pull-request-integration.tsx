/**
 * Pull Request Integration
 * Create, review, merge, and close PRs for supported providers.
 */

import {
    AlertCircle,
    Check,
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
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';
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
}

interface PRProvider {
    name: PullRequestProvider;
    host: string;
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
    mutate: (input: TInput) => void;
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

interface TrpcUtilsShape {
    git: {
        getPullRequest: {
            invalidate: () => Promise<unknown>;
        };
    };
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
    const [activeTab, setActiveTab] = useState<'list' | 'create' | 'settings'>('list');
    const [stateFilter, setStateFilter] = useState<PullRequestStateFilter>('open');

    const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
    const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
    const [commentDraft, setCommentDraft] = useState('');

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
        () => detectProvider(remoteData?.remotes.find((remote) => remote.name === 'origin')?.url),
        [remoteData?.remotes]
    );
    const provider = detectedProvider?.name ?? 'github';

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
        { enabled: !!activeRepo && open && activeTab === 'list' }
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

    const saveAuthMutation = typedTrpc.git.setPullRequestAuth.useMutation({
        onSuccess: () => {
            toast.success('Pull request provider authentication updated');
            void authQuery.refetch();
        },
        onError: (error: unknown) => {
            toast.error('Failed to save provider authentication', {
                description: getErrorMessage(error, 'Unable to save provider authentication'),
            });
        },
    });

    const createPRMutation = typedTrpc.git.createPullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Failed to create pull request', { description: result.error });
                return;
            }
            toast.success('Pull request created');
            resetCreateForm();
            setActiveTab('list');
            await pullRequestQuery.refetch();
        },
        onError: (error: unknown) => {
            toast.error('Failed to create pull request', {
                description: getErrorMessage(error, 'Unable to create pull request'),
            });
        },
    });

    const mergePRMutation = typedTrpc.git.mergePullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Merge failed', { description: result.error });
                return;
            }
            toast.success('Pull request merged');
            await pullRequestQuery.refetch();
            await utils.git.getPullRequest.invalidate();
            setSelectedPR(null);
        },
        onError: (error: unknown) => {
            toast.error('Merge failed', { description: getErrorMessage(error, 'Unable to merge pull request') });
        },
    });

    const closePRMutation = typedTrpc.git.closePullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Close failed', { description: result.error });
                return;
            }
            toast.success('Pull request closed');
            await pullRequestQuery.refetch();
            setSelectedPR(null);
        },
        onError: (error: unknown) => {
            toast.error('Close failed', { description: getErrorMessage(error, 'Unable to close pull request') });
        },
    });
    const addCommentMutation = typedTrpc.git.addPullRequestComment.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Failed to add comment', { description: result.error });
                return;
            }
            setCommentDraft('');
            await commentsQuery.refetch();
            toast.success('Comment posted');
        },
        onError: (error: unknown) => {
            toast.error('Failed to add comment', { description: getErrorMessage(error, 'Unable to add comment') });
        },
    });
    const generateAIPRMutation = trpc.ai.generatePullRequest.useMutation({
        onSuccess: (result) => {
            if (result.title) {
                setPrTitle(result.title);
            }
            if (result.body) {
                setPrBody(result.body);
            }
            if (result.error) {
                toast.warning('AI pull request draft used fallback', { description: result.error });
                return;
            }
            toast.success('AI pull request draft generated');
        },
        onError: (error: unknown) => {
            toast.error('Unable to generate AI pull request draft', {
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
        createPRMutation.mutate({
            repo: activeRepo,
            provider,
            title: prTitle.trim(),
            body: prBody.trim() || undefined,
            head: prHead.trim(),
            base: prBase.trim(),
            draft: prDraft,
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

        const commits = (compareData.commits ?? []).slice(0, 50).map((commit) => ({
            hash: commit.hash,
            subject: commit.message,
            body: '',
        }));
        const changedFiles = (compareData.files ?? []).slice(0, 200).map((file) => `${file.status}\t${file.path}`);
        const diffSummary = [
            `Branch compare: ${prHead.trim()} -> ${prBase.trim()}`,
            `Commits: ${String(compareData.commits.length)}`,
            `Files changed: ${String(compareData.files.length)}`,
            `Additions: ${String(compareData.additions ?? 0)}`,
            `Deletions: ${String(compareData.deletions ?? 0)}`,
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
                    onValueChange={(value) => { setActiveTab(value as 'list' | 'create' | 'settings'); }}
                    className='flex min-h-0 flex-1 flex-col'>
                    <TabsList className='grid w-full grid-cols-3'>
                        <TabsTrigger value='list'>Pull Requests</TabsTrigger>
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

function detectProvider(remoteUrl?: string): PRProvider | null {
    if (!remoteUrl) return null;
    const url = remoteUrl.toLowerCase();

    if (url.includes('github.com')) {
        return { name: 'github', host: 'github.com' };
    }

    if (url.includes('gitlab.com') || url.includes('gitlab')) {
        return { name: 'gitlab', host: extractHost(url) };
    }

    if (url.includes('bitbucket.org')) {
        return { name: 'bitbucket', host: 'bitbucket.org' };
    }

    if (url.includes('dev.azure.com') || url.includes('visualstudio.com') || url.includes('ssh.dev.azure.com')) {
        return { name: 'azure', host: extractHost(url) };
    }

    return null;
}

function extractHost(url: string): string {
    const match = url.match(/@([^:]+):|https?:\/\/([^/]+)/);
    return match ? (match[1] || match[2] || '') : '';
}

export default PullRequestIntegration;

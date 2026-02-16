/**
 * Pull Request Integration
 * Create, review, merge, and close PRs for supported providers.
 */

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertCircle,
    Check,
    ExternalLink,
    GitBranch,
    GitPullRequest,
    Gitlab,
    Github,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Settings,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

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

export function PullRequestIntegration({ open, onOpenChange }: PullRequestIntegrationProps) {
    const { activeRepo } = useAppStore();
    const [activeTab, setActiveTab] = useState<'list' | 'create' | 'settings'>('list');
    const [stateFilter, setStateFilter] = useState<PullRequestStateFilter>('open');

    const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);

    const [prTitle, setPrTitle] = useState('');
    const [prBody, setPrBody] = useState('');
    const [prHead, setPrHead] = useState('');
    const [prBase, setPrBase] = useState('main');
    const [prDraft, setPrDraft] = useState(false);

    const [authForm, setAuthForm] = useState<PullRequestAuthForm>(DEFAULT_AUTH_FORM);
    const [didSeedAuthForm, setDidSeedAuthForm] = useState(false);

    const utils = trpc.useUtils();

    const { data: remoteData } = trpc.git.remotes.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: !!activeRepo && open }
    );
    const { data: repoInfoData } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: false,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo && open }
    );

    const authQuery = trpc.git.getPullRequestAuth.useQuery(undefined, { enabled: open });

    useEffect(() => {
        if (!authQuery.data?.auth || didSeedAuthForm) {
            return;
        }
        setAuthForm(authQuery.data.auth);
        setDidSeedAuthForm(true);
    }, [authQuery.data?.auth, didSeedAuthForm]);

    const detectedProvider = useMemo(
        () => detectProvider(remoteData?.remotes?.find((remote) => remote.name === 'origin')?.url),
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

    const pullRequestQuery = trpc.git.listPullRequests.useQuery(
        {
            repo: activeRepo ?? '',
            provider,
            state: stateFilter,
        },
        { enabled: !!activeRepo && open && activeTab === 'list' }
    );

    const saveAuthMutation = trpc.git.setPullRequestAuth.useMutation({
        onSuccess: () => {
            toast.success('Pull request provider authentication updated');
            void authQuery.refetch();
        },
        onError: (error) => {
            toast.error('Failed to save provider authentication', { description: error.message });
        },
    });

    const createPRMutation = trpc.git.createPullRequest.useMutation({
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
        onError: (error) => {
            toast.error('Failed to create pull request', { description: error.message });
        },
    });

    const mergePRMutation = trpc.git.mergePullRequest.useMutation({
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
        onError: (error) => {
            toast.error('Merge failed', { description: error.message });
        },
    });

    const closePRMutation = trpc.git.closePullRequest.useMutation({
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Close failed', { description: result.error });
                return;
            }
            toast.success('Pull request closed');
            await pullRequestQuery.refetch();
            setSelectedPR(null);
        },
        onError: (error) => {
            toast.error('Close failed', { description: error.message });
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

    const handleMergePR = (pr: PullRequest) => {
        if (!activeRepo) return;
        mergePRMutation.mutate({
            repo: activeRepo,
            provider,
            number: pr.number,
            mergeMethod: 'merge',
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

    const branches = (repoInfoData?.branches ?? []) as string[];
    const pullRequests = pullRequestQuery.data?.pullRequests ?? [];
    const queryError = pullRequestQuery.data?.error;

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
                    onValueChange={(value) => setActiveTab(value as 'list' | 'create' | 'settings')}
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
                                        onChange={(event) => setStateFilter(event.target.value as PullRequestStateFilter)}
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
                                        <Button variant='outline' size='sm' className='mt-4' onClick={() => setActiveTab('settings')}>
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
                                                key={`${pr.id}-${pr.number}`}
                                                type='button'
                                                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                                                    selectedPR?.id === pr.id ? 'bg-accent border-primary/50' : 'hover:bg-accent/50'
                                                }`}
                                                onClick={() => setSelectedPR(pr)}>
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
                                                    onClick={() => handleMergePR(selectedPR)}
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
                                                    onClick={() => handleClosePR(selectedPR)}
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
                                <div className='grid grid-cols-2 gap-4'>
                                    <div>
                                        <label className='mb-1.5 block text-sm font-medium'>Source Branch</label>
                                        <select
                                            className='bg-background h-9 w-full rounded-md border px-3 text-sm'
                                            value={prHead}
                                            onChange={(event) => setPrHead(event.target.value)}>
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
                                            onChange={(event) => setPrBase(event.target.value)}>
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
                                        onChange={(event) => setPrTitle(event.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className='mb-1.5 block text-sm font-medium'>Description</label>
                                    <Textarea
                                        placeholder='Describe your changes'
                                        value={prBody}
                                        onChange={(event) => setPrBody(event.target.value)}
                                        className='min-h-[150px]'
                                    />
                                </div>

                                <label className='flex items-center gap-2 text-sm'>
                                    <input
                                        type='checkbox'
                                        className='rounded'
                                        checked={prDraft}
                                        onChange={(event) => setPrDraft(event.target.checked)}
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
                                    onChange={(value) => setAuthForm((current) => ({ ...current, githubToken: value }))}
                                />
                                <AuthField
                                    label='GitLab Token'
                                    value={authForm.gitlabToken}
                                    onChange={(value) => setAuthForm((current) => ({ ...current, gitlabToken: value }))}
                                />
                                <AuthField
                                    label='Bitbucket Token'
                                    value={authForm.bitbucketToken}
                                    onChange={(value) => setAuthForm((current) => ({ ...current, bitbucketToken: value }))}
                                />
                                <AuthField
                                    label='Bitbucket Username'
                                    value={authForm.bitbucketUsername}
                                    onChange={(value) =>
                                        setAuthForm((current) => ({ ...current, bitbucketUsername: value }))
                                    }
                                />
                                <AuthField
                                    label='Azure DevOps PAT'
                                    value={authForm.azureToken}
                                    onChange={(value) => setAuthForm((current) => ({ ...current, azureToken: value }))}
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
            <Input type='password' value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function getProviderIcon(provider: PullRequestProvider) {
    switch (provider) {
        case 'github':
            return <Github className='h-4 w-4' />;
        case 'gitlab':
            return <Gitlab className='h-4 w-4' />;
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

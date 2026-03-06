/**
 * Clone Repository Dialog
 * Supports cloning by URL or selecting from authenticated provider accounts.
 */

import {
    Download,
    FolderOpen,
    GitPullRequest,
    Globe,
    Loader2,
    Server,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc/client';

type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';

type CloneDialogTab = 'url' | 'account';

interface CloneRepositoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloned?: (path: string) => Promise<void> | void;
}

interface PullRequestAuthForm {
    githubToken: string;
    gitlabToken: string;
    bitbucketToken: string;
    bitbucketUsername: string;
    azureToken: string;
}

interface PullRequestAuthPayload {
    auth: PullRequestAuthForm;
}

interface QueryOptions {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
}

interface QueryState<TData> {
    data?: TData;
    isFetching: boolean;
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

interface AsyncMutationState<TInput, TResult> {
    mutateAsync: (input: TInput) => Promise<TResult>;
}

interface RemoteRepository {
    provider: RepoProvider;
    fullName: string;
    description?: string;
    cloneUrl?: string;
    sshUrl?: string;
    webUrl: string;
    name: string;
    defaultBranch?: string;
    private: boolean;
}

interface ListRemoteRepositoriesPayload {
    repositories: RemoteRepository[];
    error?: string;
}

interface CloneResult {
    error?: string;
    root?: string;
}

interface OpenDialogResult {
    canceled: boolean;
    filePaths: string[];
}

interface TrpcGitShape {
    getPullRequestAuth: {
        useQuery: (input: undefined, options: QueryOptions) => QueryState<PullRequestAuthPayload>;
    };
    setPullRequestAuth: {
        useMutation: (
            callbacks: MutationCallbacks
        ) => MutationState<Partial<PullRequestAuthForm>>;
    };
}

interface TrpcRepoShape {
    listRemoteRepositories: {
        useQuery: (
            input: { provider: RepoProvider },
            options: QueryOptions
        ) => QueryState<ListRemoteRepositoriesPayload>;
    };
    clone: {
        useMutation: (callbacks: MutationCallbacks<CloneResult>) => MutationState<{
            url: string;
            destination: string;
            branch?: string;
            depth?: number;
        }>;
    };
}

interface TrpcSystemShape {
    showOpenDialog: {
        useMutation: () => AsyncMutationState<{
            title: string;
            properties: string[];
        }, OpenDialogResult>;
    };
}

interface TrpcClientShape {
    git: TrpcGitShape;
    repo: TrpcRepoShape;
    system: TrpcSystemShape;
}

function inferRepoNameFromUrl(url: string): string {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) {
        return 'repository';
    }
    const lastSlash = trimmed.lastIndexOf('/');
    const slug = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
    return slug.replace(/\.git$/i, '') || 'repository';
}

function joinPath(base: string, child: string): string {
    const normalizedBase = base.trim();
    const normalizedChild = child.trim();
    if (!normalizedBase) {
        return normalizedChild;
    }
    if (!normalizedChild) {
        return normalizedBase;
    }
    const separator = normalizedBase.includes('\\') ? '\\' : '/';
    return `${normalizedBase.replace(/[\\/]$/, '')}${separator}${normalizedChild}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getProviderIcon(provider: RepoProvider) {
    if (provider === 'github') {
        return <Globe className='mr-1 h-3.5 w-3.5' />;
    }
    if (provider === 'gitlab') {
        return <Server className='mr-1 h-3.5 w-3.5' />;
    }
    return <GitPullRequest className='mr-1 h-3.5 w-3.5' />;
}

export function CloneRepositoryDialog({ open, onOpenChange, onCloned }: CloneRepositoryDialogProps) {
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const [activeTab, setActiveTab] = useState<CloneDialogTab>('url');
    const [provider, setProvider] = useState<RepoProvider>('github');
    const [url, setUrl] = useState('');
    const [search, setSearch] = useState('');
    const [destinationParent, setDestinationParent] = useState('');
    const [directoryName, setDirectoryName] = useState('');
    const [cloneBranch, setCloneBranch] = useState('');
    const [cloneDepth, setCloneDepth] = useState('');
    const [authDraft, setAuthDraft] = useState<PullRequestAuthForm>({
        githubToken: '',
        gitlabToken: '',
        bitbucketToken: '',
        bitbucketUsername: '',
        azureToken: '',
    });

    const authQuery = typedTrpc.git.getPullRequestAuth.useQuery(undefined, { enabled: open });

    useEffect(() => {
        if (!authQuery.data?.auth) {
            return;
        }
        setAuthDraft(authQuery.data.auth);
    }, [authQuery.data?.auth]);

    const listRepositoriesQuery = typedTrpc.repo.listRemoteRepositories.useQuery(
        { provider },
        {
            enabled: open && activeTab === 'account',
            staleTime: 20_000,
            refetchOnWindowFocus: false,
        }
    );

    const saveAuthMutation = typedTrpc.git.setPullRequestAuth.useMutation({
        onSuccess: () => {
            toast.success('Provider credentials updated');
            void authQuery.refetch();
            void listRepositoriesQuery.refetch();
        },
        onError: (error: unknown) => {
            toast.error('Failed to save provider credentials', {
                description: getErrorMessage(error, 'Unable to save provider credentials'),
            });
        },
    });

    const cloneMutation = typedTrpc.repo.clone.useMutation({
        onSuccess: async (result) => {
            if (result.error || !result.root) {
                toast.error('Clone failed', { description: result.error ?? 'Unknown error' });
                return;
            }
            toast.success(`Repository cloned to ${result.root}`);
            if (onCloned) {
                await Promise.resolve(onCloned(result.root));
            }
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast.error('Clone failed', { description: getErrorMessage(error, 'Unable to clone repository') });
        },
    });

    const showOpenDialog = typedTrpc.system.showOpenDialog.useMutation();
    const repositories = listRepositoriesQuery.data?.repositories ?? [];

    const filteredRepositories = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return repositories;
        }
        return repositories.filter((repository) => {
            const haystack = `${repository.fullName} ${repository.description ?? ''}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [repositories, search]);

    const cloneUrl = url.trim();
    const inferredDirectoryName = directoryName.trim() || inferRepoNameFromUrl(cloneUrl);
    const destinationPath = destinationParent ? joinPath(destinationParent, inferredDirectoryName) : '';

    const chooseDestinationParent = async () => {
        const result = await showOpenDialog.mutateAsync({
            title: 'Choose Clone Destination',
            properties: ['openDirectory'],
        });

        if (!result.canceled && result.filePaths.length > 0 && result.filePaths[0]) {
            setDestinationParent(result.filePaths[0]);
        }
    };

    const handleClone = () => {
        if (!cloneUrl) {
            toast.error('Repository URL is required');
            return;
        }
        if (!destinationParent) {
            toast.error('Select a destination folder');
            return;
        }
        if (!inferredDirectoryName) {
            toast.error('Repository folder name is required');
            return;
        }

        const parsedDepth = cloneDepth.trim() ? parseInt(cloneDepth.trim(), 10) : null;
        if (parsedDepth !== null && (!Number.isFinite(parsedDepth) || parsedDepth < 1)) {
            toast.error('Clone depth must be a positive integer');
            return;
        }

        cloneMutation.mutate({
            url: cloneUrl,
            destination: destinationPath,
            branch: cloneBranch.trim() || undefined,
            depth: parsedDepth ?? undefined,
        });
    };

    const saveProviderCredential = () => {
        if (provider === 'github') {
            saveAuthMutation.mutate({ githubToken: authDraft.githubToken });
            return;
        }
        if (provider === 'gitlab') {
            saveAuthMutation.mutate({ gitlabToken: authDraft.gitlabToken });
            return;
        }
        if (provider === 'bitbucket') {
            saveAuthMutation.mutate({
                bitbucketToken: authDraft.bitbucketToken,
                bitbucketUsername: authDraft.bitbucketUsername,
            });
            return;
        }
        saveAuthMutation.mutate({ azureToken: authDraft.azureToken });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-4xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Download className='h-5 w-5' />
                        Clone Repository
                    </DialogTitle>
                </DialogHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                        setActiveTab(value as CloneDialogTab);
                    }}
                    className='flex min-h-0 flex-1 flex-col'>
                    <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value='url'>From URL</TabsTrigger>
                        <TabsTrigger value='account'>From Account</TabsTrigger>
                    </TabsList>

                    <TabsContent value='url' className='mt-4 space-y-4'>
                        <div>
                            <label className='mb-1.5 block text-sm font-medium'>Repository URL</label>
                            <Input
                                placeholder='https://github.com/org/repo.git'
                                value={url}
                                onChange={(event) => {
                                    setUrl(event.target.value);
                                }}
                            />
                        </div>
                        <div className='grid gap-4 md:grid-cols-2'>
                            <div>
                                <label className='mb-1.5 block text-sm font-medium'>Branch (optional)</label>
                                <Input
                                    placeholder='main'
                                    value={cloneBranch}
                                    onChange={(event) => {
                                        setCloneBranch(event.target.value);
                                    }}
                                />
                            </div>
                            <div>
                                <label className='mb-1.5 block text-sm font-medium'>Depth (optional)</label>
                                <Input
                                    type='number'
                                    min={1}
                                    placeholder='1'
                                    value={cloneDepth}
                                    onChange={(event) => {
                                        setCloneDepth(event.target.value);
                                    }}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value='account' className='mt-4 flex min-h-0 flex-1 flex-col gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <select
                                className='bg-background h-9 rounded-md border px-2 text-sm'
                                value={provider}
                                onChange={(event) => {
                                    setProvider(event.target.value as RepoProvider);
                                }}>
                                <option value='github'>GitHub</option>
                                <option value='gitlab'>GitLab</option>
                                <option value='bitbucket'>Bitbucket</option>
                                <option value='azure'>Azure DevOps</option>
                            </select>
                            <Input
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                }}
                                placeholder='Search repositories'
                                className='max-w-xs'
                            />
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    void listRepositoriesQuery.refetch();
                                }}
                                disabled={listRepositoriesQuery.isFetching}>
                                {listRepositoriesQuery.isFetching ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    'Refresh'
                                )}
                            </Button>
                        </div>

                        <div className='rounded border p-3'>
                            <p className='mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                                Account Credential
                            </p>
                            {provider === 'github' ? (
                                <Input
                                    type='password'
                                    placeholder='GitHub token'
                                    value={authDraft.githubToken}
                                    onChange={(event) => {
                                        setAuthDraft((current) => ({ ...current, githubToken: event.target.value }));
                                    }}
                                />
                            ) : null}
                            {provider === 'gitlab' ? (
                                <Input
                                    type='password'
                                    placeholder='GitLab token'
                                    value={authDraft.gitlabToken}
                                    onChange={(event) => {
                                        setAuthDraft((current) => ({ ...current, gitlabToken: event.target.value }));
                                    }}
                                />
                            ) : null}
                            {provider === 'bitbucket' ? (
                                <div className='grid gap-2 md:grid-cols-2'>
                                    <Input
                                        type='text'
                                        placeholder='Bitbucket username'
                                        value={authDraft.bitbucketUsername}
                                        onChange={(event) => {
                                            setAuthDraft((current) => ({
                                                ...current,
                                                bitbucketUsername: event.target.value,
                                            }));
                                        }}
                                    />
                                    <Input
                                        type='password'
                                        placeholder='Bitbucket token / app password'
                                        value={authDraft.bitbucketToken}
                                        onChange={(event) => {
                                            setAuthDraft((current) => ({
                                                ...current,
                                                bitbucketToken: event.target.value,
                                            }));
                                        }}
                                    />
                                </div>
                            ) : null}
                            {provider === 'azure' ? (
                                <Input
                                    type='password'
                                    placeholder='Azure DevOps PAT'
                                    value={authDraft.azureToken}
                                    onChange={(event) => {
                                        setAuthDraft((current) => ({ ...current, azureToken: event.target.value }));
                                    }}
                                />
                            ) : null}
                            <div className='mt-2 flex justify-end'>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={saveProviderCredential}
                                    disabled={saveAuthMutation.isPending}>
                                    {saveAuthMutation.isPending ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : null}
                                    Save Credential
                                </Button>
                            </div>
                        </div>

                        {listRepositoriesQuery.data?.error ? (
                            <div className='rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700'>
                                {listRepositoriesQuery.data.error}
                            </div>
                        ) : null}

                        <div className='min-h-0 flex-1 rounded border'>
                            <ScrollArea className='h-full'>
                                <div className='space-y-1 p-2'>
                                    {filteredRepositories.map((repository) => (
                                        <button
                                            key={`${repository.provider}-${repository.fullName}`}
                                            type='button'
                                            className='hover:bg-accent flex w-full items-start justify-between rounded-md border px-3 py-2 text-left'
                                            onClick={() => {
                                                setUrl(repository.cloneUrl || repository.sshUrl || repository.webUrl);
                                                setDirectoryName(repository.name);
                                                setCloneBranch(repository.defaultBranch || '');
                                                setCloneDepth('');
                                                setActiveTab('url');
                                            }}>
                                            <div>
                                                <p className='text-sm font-medium'>{repository.fullName}</p>
                                                <p className='text-muted-foreground text-xs'>
                                                    {repository.description || 'No description'}
                                                </p>
                                            </div>
                                            <Badge variant='outline' className='ml-2 capitalize'>
                                                {getProviderIcon(provider)}
                                                {repository.private ? 'private' : 'public'}
                                            </Badge>
                                        </button>
                                    ))}
                                    {filteredRepositories.length === 0 ? (
                                        <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                                            No repositories found for this account.
                                        </p>
                                    ) : null}
                                </div>
                            </ScrollArea>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className='mt-2 space-y-3 border-t pt-3'>
                    <div>
                        <label className='mb-1.5 block text-sm font-medium'>Destination Folder</label>
                        <div className='flex items-center gap-2'>
                            <Input
                                value={destinationParent}
                                onChange={(event) => {
                                    setDestinationParent(event.target.value);
                                }}
                                placeholder='/path/to/projects'
                            />
                            <Button
                                variant='outline'
                                onClick={() => {
                                    void chooseDestinationParent();
                                }}>
                                <FolderOpen className='mr-2 h-4 w-4' />
                                Browse
                            </Button>
                        </div>
                    </div>

                    <div>
                        <label className='mb-1.5 block text-sm font-medium'>Folder Name</label>
                        <Input
                            value={directoryName}
                            onChange={(event) => {
                                setDirectoryName(event.target.value);
                            }}
                            placeholder='repository-name'
                        />
                        {destinationPath ? (
                            <p className='text-muted-foreground mt-1 text-xs'>Will clone to: {destinationPath}</p>
                        ) : null}
                    </div>

                    <div className='flex justify-end gap-2'>
                        <Button
                            variant='outline'
                            onClick={() => {
                                onOpenChange(false);
                            }}>
                            Cancel
                        </Button>
                        <Button onClick={handleClone} disabled={cloneMutation.isPending}>
                            {cloneMutation.isPending ? (
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                            ) : (
                                <Download className='mr-2 h-4 w-4' />
                            )}
                            Clone Repository
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default CloneRepositoryDialog;

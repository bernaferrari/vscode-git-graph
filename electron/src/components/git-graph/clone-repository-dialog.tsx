/**
 * Clone Repository Dialog
 * Supports cloning by URL or selecting from authenticated provider accounts.
 */

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Github, Gitlab, GitPullRequest, Loader2, FolderOpen, Download } from 'lucide-react';
import { toast } from 'sonner';

type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';

interface CloneRepositoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloned?: (path: string) => Promise<void> | void;
}

function inferRepoNameFromUrl(url: string): string {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) return 'repository';
    const lastSlash = trimmed.lastIndexOf('/');
    const slug = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
    return slug.replace(/\.git$/i, '') || 'repository';
}

function joinPath(base: string, child: string): string {
    const normalizedBase = base.trim();
    const normalizedChild = child.trim();
    if (!normalizedBase) return normalizedChild;
    if (!normalizedChild) return normalizedBase;
    const separator = normalizedBase.includes('\\') ? '\\' : '/';
    return `${normalizedBase.replace(/[\\/]$/, '')}${separator}${normalizedChild}`;
}

export function CloneRepositoryDialog({ open, onOpenChange, onCloned }: CloneRepositoryDialogProps) {
    const [activeTab, setActiveTab] = useState<'url' | 'account'>('url');
    const [provider, setProvider] = useState<RepoProvider>('github');
    const [url, setUrl] = useState('');
    const [search, setSearch] = useState('');
    const [destinationParent, setDestinationParent] = useState('');
    const [directoryName, setDirectoryName] = useState('');
    const [authDraft, setAuthDraft] = useState({
        githubToken: '',
        gitlabToken: '',
        bitbucketToken: '',
        bitbucketUsername: '',
        azureToken: '',
    });

    const authQuery = trpc.git.getPullRequestAuth.useQuery(undefined, { enabled: open });
    const saveAuthMutation = trpc.git.setPullRequestAuth.useMutation({
        onSuccess: () => {
            toast.success('Provider credentials updated');
            void authQuery.refetch();
            void listRepositoriesQuery.refetch();
        },
        onError: (error) => {
            toast.error('Failed to save provider credentials', { description: error.message });
        },
    });

    useEffect(() => {
        if (!authQuery.data?.auth) {
            return;
        }
        setAuthDraft(authQuery.data.auth);
    }, [authQuery.data?.auth]);

    const listRepositoriesQuery = trpc.repo.listRemoteRepositories.useQuery(
        { provider },
        {
            enabled: open && activeTab === 'account',
            staleTime: 20_000,
            refetchOnWindowFocus: false,
        }
    );

    const cloneMutation = trpc.repo.clone.useMutation({
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
        onError: (error) => {
            toast.error('Clone failed', { description: error.message });
        },
    });

    const showOpenDialog = trpc.system.showOpenDialog.useMutation();
    const repositories = listRepositoriesQuery.data?.repositories ?? [];
    const filteredRepositories = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return repositories;
        return repositories.filter((repository) => {
            const haystack = `${repository.fullName} ${repository.description}`.toLowerCase();
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

        cloneMutation.mutate({
            url: cloneUrl,
            destination: destinationPath,
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
                    onValueChange={(value) => setActiveTab(value as 'url' | 'account')}
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
                                onChange={(event) => setUrl(event.target.value)}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value='account' className='mt-4 flex min-h-0 flex-1 flex-col gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <select
                                className='bg-background h-9 rounded-md border px-2 text-sm'
                                value={provider}
                                onChange={(event) => setProvider(event.target.value as RepoProvider)}>
                                <option value='github'>GitHub</option>
                                <option value='gitlab'>GitLab</option>
                                <option value='bitbucket'>Bitbucket</option>
                                <option value='azure'>Azure DevOps</option>
                            </select>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder='Search repositories'
                                className='max-w-xs'
                            />
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => void listRepositoriesQuery.refetch()}
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
                            {provider === 'github' && (
                                <Input
                                    type='password'
                                    placeholder='GitHub token'
                                    value={authDraft.githubToken}
                                    onChange={(event) =>
                                        setAuthDraft((current) => ({ ...current, githubToken: event.target.value }))
                                    }
                                />
                            )}
                            {provider === 'gitlab' && (
                                <Input
                                    type='password'
                                    placeholder='GitLab token'
                                    value={authDraft.gitlabToken}
                                    onChange={(event) =>
                                        setAuthDraft((current) => ({ ...current, gitlabToken: event.target.value }))
                                    }
                                />
                            )}
                            {provider === 'bitbucket' && (
                                <div className='grid gap-2 md:grid-cols-2'>
                                    <Input
                                        type='text'
                                        placeholder='Bitbucket username'
                                        value={authDraft.bitbucketUsername}
                                        onChange={(event) =>
                                            setAuthDraft((current) => ({
                                                ...current,
                                                bitbucketUsername: event.target.value,
                                            }))
                                        }
                                    />
                                    <Input
                                        type='password'
                                        placeholder='Bitbucket token / app password'
                                        value={authDraft.bitbucketToken}
                                        onChange={(event) =>
                                            setAuthDraft((current) => ({
                                                ...current,
                                                bitbucketToken: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            )}
                            {provider === 'azure' && (
                                <Input
                                    type='password'
                                    placeholder='Azure DevOps PAT'
                                    value={authDraft.azureToken}
                                    onChange={(event) =>
                                        setAuthDraft((current) => ({ ...current, azureToken: event.target.value }))
                                    }
                                />
                            )}
                            <div className='mt-2 flex justify-end'>
                                <Button variant='outline' size='sm' onClick={saveProviderCredential} disabled={saveAuthMutation.isPending}>
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
                                                setActiveTab('url');
                                            }}>
                                            <div>
                                                <p className='text-sm font-medium'>{repository.fullName}</p>
                                                <p className='text-muted-foreground text-xs'>{repository.description || 'No description'}</p>
                                            </div>
                                            <Badge variant='outline' className='ml-2 capitalize'>
                                                {provider === 'github' ? (
                                                    <Github className='mr-1 h-3.5 w-3.5' />
                                                ) : provider === 'gitlab' ? (
                                                    <Gitlab className='mr-1 h-3.5 w-3.5' />
                                                ) : (
                                                    <GitPullRequest className='mr-1 h-3.5 w-3.5' />
                                                )}
                                                {repository.private ? 'private' : 'public'}
                                            </Badge>
                                        </button>
                                    ))}
                                    {filteredRepositories.length === 0 && (
                                        <p className='text-muted-foreground px-2 py-6 text-center text-sm'>
                                            No repositories found for this account.
                                        </p>
                                    )}
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
                                onChange={(event) => setDestinationParent(event.target.value)}
                                placeholder='/path/to/projects'
                            />
                            <Button variant='outline' onClick={() => void chooseDestinationParent()}>
                                <FolderOpen className='mr-2 h-4 w-4' />
                                Browse
                            </Button>
                        </div>
                    </div>

                    <div>
                        <label className='mb-1.5 block text-sm font-medium'>Folder Name</label>
                        <Input value={directoryName} onChange={(event) => setDirectoryName(event.target.value)} placeholder='repository-name' />
                        {destinationPath ? (
                            <p className='text-muted-foreground mt-1 text-xs'>Will clone to: {destinationPath}</p>
                        ) : null}
                    </div>

                    <div className='flex justify-end gap-2'>
                        <Button variant='outline' onClick={() => onOpenChange(false)}>
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

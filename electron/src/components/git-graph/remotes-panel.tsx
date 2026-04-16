/**
 * Remote Management Panel
 */

import { useState } from 'react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface Remote {
    name: string;
    url: string;
    pushUrl?: string;
}

interface RemotesQueryData {
    remotes: Remote[];
}

interface QueryOptions {
    enabled: boolean;
}

interface QueryState<TData> {
    data?: TData;
}

interface MutationCallbacks {
    onSuccess?: () => void;
}

interface MutationState<TInput> {
    mutate: (input: TInput) => void;
    isPending: boolean;
}

interface InvalidateTarget {
    invalidate: () => Promise<unknown>;
}

interface TrpcUtilsShape {
    git: {
        remotes: InvalidateTarget;
        repoInfo: InvalidateTarget;
    };
}

interface TrpcGitShape {
    remotes: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<RemotesQueryData>;
    };
    remote: {
        add: {
            useMutation: (callbacks: MutationCallbacks) => MutationState<{
                repo: string;
                name: string;
                url: string;
                pushUrl?: string;
            }>;
        };
        remove: {
            useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; name: string }>;
        };
        update: {
            useMutation: (callbacks: MutationCallbacks) => MutationState<{
                repo: string;
                name: string;
                url: string;
                pushUrl?: string;
            }>;
        };
    };
}

interface TrpcClientShape {
    useUtils: () => TrpcUtilsShape;
    git: TrpcGitShape;
}

interface RemotesPanelProps {
    repo: string;
}

export function RemotesPanel({ repo }: RemotesPanelProps) {
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const utils = typedTrpc.useUtils();
    const { data: remotes } = typedTrpc.git.remotes.useQuery({ repo }, { enabled: Boolean(repo) });

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newPushUrl, setNewPushUrl] = useState('');

    const [editingRemote, setEditingRemote] = useState<Remote | null>(null);
    const [editUrl, setEditUrl] = useState('');
    const [editPushUrl, setEditPushUrl] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const addMutation = typedTrpc.git.remote.add.useMutation({
        onSuccess: () => {
            void utils.git.remotes.invalidate();
            void utils.git.repoInfo.invalidate();
            setShowAddDialog(false);
            setNewName('');
            setNewUrl('');
            setNewPushUrl('');
        },
    });

    const removeMutation = typedTrpc.git.remote.remove.useMutation({
        onSuccess: () => {
            void utils.git.remotes.invalidate();
            void utils.git.repoInfo.invalidate();
            setDeleteConfirm(null);
        },
    });

    const updateMutation = typedTrpc.git.remote.update.useMutation({
        onSuccess: () => {
            void utils.git.remotes.invalidate();
            void utils.git.repoInfo.invalidate();
            setEditingRemote(null);
        },
    });

    const remoteList = remotes?.remotes ?? [];

    const handleAdd = () => {
        if (!newName.trim() || !newUrl.trim()) {
            return;
        }
        addMutation.mutate({
            repo,
            name: newName,
            url: newUrl,
            ...(newPushUrl ? { pushUrl: newPushUrl } : {}),
        });
    };

    const handleEdit = (remote: Remote) => {
        setEditingRemote(remote);
        setEditUrl(remote.url);
        setEditPushUrl(remote.pushUrl ?? '');
    };

    const handleSaveEdit = () => {
        if (!editingRemote) {
            return;
        }
        updateMutation.mutate({
            repo,
            name: editingRemote.name,
            url: editUrl,
            ...(editPushUrl ? { pushUrl: editPushUrl } : {}),
        });
    };

    const handleDelete = (name: string) => {
        removeMutation.mutate({ repo, name });
    };

    return (
        <>
            <Card className='h-full'>
                <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center justify-between text-sm'>
                        <span>Remotes</span>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                                setShowAddDialog(true);
                            }}>
                            Add Remote
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className='h-64'>
                        <div className='space-y-2'>
                            {remoteList.map((remote) => (
                                <div key={remote.name} className='flex items-start justify-between rounded border p-3'>
                                    <div className='min-w-0 flex-1'>
                                        <div className='mb-1 flex items-center gap-2'>
                                            <span className='font-medium'>{remote.name}</span>
                                            {remote.name === 'origin' ? (
                                                <Badge variant='secondary' className='text-xs'>
                                                    default
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <div className='space-y-1 text-xs text-muted-foreground'>
                                            <p className='truncate'>
                                                <span className='font-medium'>Fetch:</span> {remote.url}
                                            </p>
                                            {remote.pushUrl && remote.pushUrl !== remote.url ? (
                                                <p className='truncate'>
                                                    <span className='font-medium'>Push:</span> {remote.pushUrl}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className='ml-2 flex gap-1'>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-7 px-2'
                                            onClick={() => {
                                                handleEdit(remote);
                                            }}>
                                            Edit
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-7 px-2 text-destructive'
                                            onClick={() => {
                                                setDeleteConfirm(remote.name);
                                            }}>
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {remoteList.length === 0 ? (
                                <div className='py-8 text-center text-sm text-muted-foreground'>
                                    No remotes configured
                                </div>
                            ) : null}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className='ui-surface'>
                    <DialogHeader>
                        <DialogTitle>Add Remote</DialogTitle>
                    </DialogHeader>
                    <div className='space-y-4 py-4'>
                        <div className='space-y-2'>
                            <Label>Name</Label>
                            <Input
                                value={newName}
                                onChange={(event) => {
                                    setNewName(event.target.value);
                                }}
                                placeholder='e.g., upstream'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>URL</Label>
                            <Input
                                value={newUrl}
                                onChange={(event) => {
                                    setNewUrl(event.target.value);
                                }}
                                placeholder='https://github.com/user/repo.git'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>Push URL (optional)</Label>
                            <Input
                                value={newPushUrl}
                                onChange={(event) => {
                                    setNewPushUrl(event.target.value);
                                }}
                                placeholder='Leave empty to use fetch URL'
                            />
                        </div>
                    </div>
                    <DialogFooter className='ui-toolbar'>
                        <Button
                            variant='outline'
                            onClick={() => {
                                setShowAddDialog(false);
                            }}>
                            Cancel
                        </Button>
                        <Button onClick={handleAdd} disabled={!newName || !newUrl || addMutation.isPending}>
                            Add Remote
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editingRemote !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setEditingRemote(null);
                    }
                }}>
                <DialogContent className='ui-surface'>
                    <DialogHeader>
                        <DialogTitle>Edit Remote: {editingRemote?.name}</DialogTitle>
                    </DialogHeader>
                    <div className='space-y-4 py-4'>
                        <div className='space-y-2'>
                            <Label>URL</Label>
                            <Input
                                value={editUrl}
                                onChange={(event) => {
                                    setEditUrl(event.target.value);
                                }}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>Push URL (optional)</Label>
                            <Input
                                value={editPushUrl}
                                onChange={(event) => {
                                    setEditPushUrl(event.target.value);
                                }}
                                placeholder='Leave empty to use fetch URL'
                            />
                        </div>
                    </div>
                    <DialogFooter className='ui-toolbar'>
                        <Button
                            variant='outline'
                            onClick={() => {
                                setEditingRemote(null);
                            }}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={!editUrl || updateMutation.isPending}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={deleteConfirm !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setDeleteConfirm(null);
                    }
                }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Remote</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfirm
                                ? `Are you sure you want to delete the remote "${deleteConfirm}"? This action cannot be undone.`
                                : 'Delete remote?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteConfirm) {
                                    handleDelete(deleteConfirm);
                                }
                            }}
                            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

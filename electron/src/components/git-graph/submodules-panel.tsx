/**
 * Submodules Panel
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface SubmodulesPanelProps {
    repo: string;
}

type SubmoduleStatus = 'clean' | 'modified' | 'uninitialized';

interface SubmoduleEntry {
    path: string;
    branch?: string;
    currentCommit?: string;
    status: SubmoduleStatus;
}

interface SubmoduleListData {
    submodules: SubmoduleEntry[];
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
}

interface InvalidateTarget {
    invalidate: () => Promise<unknown>;
}

interface TrpcUtilsShape {
    git: {
        submodule: {
            list: InvalidateTarget;
        };
    };
}

interface TrpcSubmoduleShape {
    list: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<SubmoduleListData>;
    };
    add: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; url: string; path: string }>;
    };
    update: {
        useMutation: () => MutationState<{ repo: string; path: string; init?: boolean }>;
    };
    remove: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; path: string }>;
    };
}

interface TrpcClientShape {
    useUtils: () => TrpcUtilsShape;
    git: {
        submodule: TrpcSubmoduleShape;
    };
}

function normalizeStatus(status: string): SubmoduleStatus {
    if (status === 'modified' || status === 'uninitialized') {
        return status;
    }
    return 'clean';
}

export function SubmodulesPanel({ repo }: SubmodulesPanelProps) {
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const utils = typedTrpc.useUtils();
    const { data: submodules } = typedTrpc.git.submodule.list.useQuery({ repo }, { enabled: Boolean(repo) });

    const addMutation = typedTrpc.git.submodule.add.useMutation({
        onSuccess: () => {
            void utils.git.submodule.list.invalidate();
        },
    });

    const updateMutation = typedTrpc.git.submodule.update.useMutation();
    const removeMutation = typedTrpc.git.submodule.remove.useMutation({
        onSuccess: () => {
            void utils.git.submodule.list.invalidate();
        },
    });

    const [url, setUrl] = useState('');
    const [path, setPath] = useState('');

    const handleAdd = () => {
        if (!url.trim() || !path.trim()) {
            return;
        }
        addMutation.mutate({ repo, url, path });
        setUrl('');
        setPath('');
    };

    const handleUpdate = (submodulePath: string, init?: boolean) => {
        if (typeof init === 'boolean') {
            updateMutation.mutate({ repo, path: submodulePath, init });
            return;
        }
        updateMutation.mutate({ repo, path: submodulePath });
    };

    const handleRemove = (submodulePath: string) => {
        removeMutation.mutate({ repo, path: submodulePath });
    };

    const submoduleList = (submodules?.submodules ?? []).map((entry) => ({
        path: entry.path,
        branch: entry.branch,
        currentCommit: entry.currentCommit,
        status: normalizeStatus(entry.status),
    }));

    return (
        <Card className='h-full'>
            <CardHeader className='pb-2'>
                <CardTitle className='flex items-center justify-between text-sm'>
                    <span>Submodules</span>
                    <Badge variant='secondary'>{submoduleList.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                <div className='space-y-2'>
                    <Input
                        value={url}
                        onChange={(event) => {
                            setUrl(event.target.value);
                        }}
                        placeholder='Repository URL...'
                        className='h-8'
                    />
                    <div className='flex gap-2'>
                        <Input
                            value={path}
                            onChange={(event) => {
                                setPath(event.target.value);
                            }}
                            placeholder='Local path...'
                            className='h-8 flex-1'
                        />
                        <Button size='sm' onClick={handleAdd} disabled={!url || !path}>
                            Add
                        </Button>
                    </div>
                </div>

                <ScrollArea className='h-48'>
                    <div className='space-y-1'>
                        {submoduleList.map((submodule) => (
                            <div
                                key={submodule.path}
                                className='flex items-center justify-between rounded p-2 text-sm hover:bg-accent'>
                                <div className='min-w-0 flex-1'>
                                    <div className='flex items-center gap-2'>
                                        <span className='truncate font-medium'>{submodule.path}</span>
                                        <Badge
                                            variant={
                                                submodule.status === 'clean'
                                                    ? 'secondary'
                                                    : submodule.status === 'modified'
                                                      ? 'default'
                                                      : 'destructive'
                                            }
                                            className='text-xs'>
                                            {submodule.status}
                                        </Badge>
                                    </div>
                                    <p className='truncate text-xs text-muted-foreground'>
                                        {submodule.currentCommit?.slice(0, 7) ?? ''}
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <Button variant='ghost' size='sm' className='h-6 px-2'>
                                                Actions
                                            </Button>
                                        }
                                    />
                                    <DropdownMenuContent align='end'>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleUpdate(submodule.path);
                                            }}>
                                            Update
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleUpdate(submodule.path, true);
                                            }}>
                                            Initialize &amp; Update
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleRemove(submodule.path);
                                            }}
                                            className='text-destructive'>
                                            Remove
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                        {submoduleList.length === 0 ? (
                            <div className='py-4 text-center text-sm text-muted-foreground'>No submodules</div>
                        ) : null}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

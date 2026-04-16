/**
 * Stash Management UI
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface StashPanelProps {
    repo: string;
}

interface StashEntry {
    selector: string;
    message: string;
    branchName?: string;
    date: number;
}

interface StashListData {
    stashes: StashEntry[];
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
        stash: {
            list: InvalidateTarget;
        };
    };
}

interface TrpcStashShape {
    list: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<StashListData>;
    };
    push: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{
            repo: string;
            message?: string;
            includeUntracked: boolean;
        }>;
    };
    pop: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; selector: string }>;
    };
    applyStash: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; selector: string }>;
    };
    drop: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; selector: string }>;
    };
}

interface TrpcClientShape {
    useUtils: () => TrpcUtilsShape;
    git: {
        stash: TrpcStashShape;
    };
}

export function StashPanel({ repo }: StashPanelProps) {
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const utils = typedTrpc.useUtils();
    const { data: stashes } = typedTrpc.git.stash.list.useQuery({ repo }, { enabled: Boolean(repo) });

    const pushMutation = typedTrpc.git.stash.push.useMutation({
        onSuccess: () => {
            void utils.git.stash.list.invalidate();
        },
    });

    const popMutation = typedTrpc.git.stash.pop.useMutation({
        onSuccess: () => {
            void utils.git.stash.list.invalidate();
        },
    });

    const applyMutation = typedTrpc.git.stash.applyStash.useMutation({
        onSuccess: () => {
            void utils.git.stash.list.invalidate();
        },
    });

    const dropMutation = typedTrpc.git.stash.drop.useMutation({
        onSuccess: () => {
            void utils.git.stash.list.invalidate();
        },
    });

    const [message, setMessage] = useState('');
    const [includeUntracked, setIncludeUntracked] = useState(true);

    const handleStash = () => {
        if (message.trim()) {
            pushMutation.mutate({ repo, message, includeUntracked });
            setMessage('');
            return;
        }
        pushMutation.mutate({ repo, includeUntracked });
        setMessage('');
    };

    const handleApply = (selector: string, pop: boolean) => {
        if (pop) {
            popMutation.mutate({ repo, selector });
            return;
        }
        applyMutation.mutate({ repo, selector });
    };

    const handleDrop = (selector: string) => {
        dropMutation.mutate({ repo, selector });
    };

    const stashList = stashes?.stashes ?? [];

    return (
        <Card className='h-full'>
            <CardHeader className='pb-2'>
                <CardTitle className='flex items-center justify-between text-sm'>
                    <span>Stashes</span>
                    <Badge variant='secondary'>{stashList.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
                <div className='space-y-2'>
                    <div className='flex gap-2'>
                        <Input
                            value={message}
                            onChange={(event) => {
                                setMessage(event.target.value);
                            }}
                            placeholder='Stash message (optional)...'
                            className='h-8'
                        />
                        <Button size='sm' onClick={handleStash} disabled={pushMutation.isPending}>
                            Stash
                        </Button>
                    </div>
                    <div className='flex items-center gap-2'>
                        <input
                            type='checkbox'
                            id='include-untracked'
                            checked={includeUntracked}
                            onChange={(event) => {
                                setIncludeUntracked(event.target.checked);
                            }}
                            className='h-3 w-3'
                        />
                        <Label htmlFor='include-untracked' className='cursor-pointer text-xs'>
                            Include untracked files
                        </Label>
                    </div>
                </div>

                <ScrollArea className='h-48'>
                    <div className='space-y-1'>
                        {stashList.map((stash) => (
                            <div
                                key={stash.selector}
                                className='flex items-center justify-between rounded p-2 text-sm hover:bg-accent'>
                                <div className='min-w-0 flex-1'>
                                    <div className='flex items-center gap-2'>
                                        <span className='font-mono text-xs text-muted-foreground'>{stash.selector}</span>
                                        {stash.branchName ? (
                                            <Badge variant='outline' className='text-xs'>
                                                {stash.branchName}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className='truncate text-xs'>{stash.message}</p>
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
                                                handleApply(stash.selector, false);
                                            }}>
                                            Apply
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleApply(stash.selector, true);
                                            }}>
                                            Pop
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleDrop(stash.selector);
                                            }}
                                            className='text-destructive'>
                                            Drop
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                        {stashList.length === 0 ? (
                            <div className='py-4 text-center text-sm text-muted-foreground'>No stashes</div>
                        ) : null}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

/**
 * Git Flow Automation
 * Automate Git Flow workflows
 */

import { AlertTriangle, GitBranch, GitMerge, Loader2, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

type FlowBranchType = 'feature' | 'release' | 'hotfix';

interface BranchInfo {
    name: string;
}

interface BranchesQueryData {
    branches: BranchInfo[];
}

interface StatusQueryData {
    branch: string;
}

interface QueryOptions {
    enabled: boolean;
}

interface QueryState<TData> {
    data?: TData;
    refetch: () => Promise<unknown>;
}

interface MutationCallbacks {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
}

interface MutationState<TInput> {
    mutate: (input: TInput) => void;
}

interface TrpcGitShape {
    branches: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<BranchesQueryData>;
    };
    status: {
        useQuery: (input: { repo: string }, options: QueryOptions) => QueryState<StatusQueryData>;
    };
    createBranch: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{
            repo: string;
            name: string;
            commitHash: string;
            checkout: boolean;
        }>;
    };
    checkout: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; branch: string }>;
    };
    merge: {
        useMutation: (
            callbacks: MutationCallbacks
        ) => MutationState<{ repo: string; sourceBranch: string; targetBranch: string }>;
    };
    deleteBranch: {
        useMutation: (callbacks: MutationCallbacks) => MutationState<{ repo: string; branch: string }>;
    };
}

interface TrpcClientShape {
    git: TrpcGitShape;
}

interface GitFlowAutomationProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getBaseBranch(type: FlowBranchType): string {
    if (type === 'hotfix') {
        return 'main';
    }
    return 'develop';
}

function getTargetBranch(branchName: string): string {
    if (branchName.startsWith('feature/')) {
        return 'develop';
    }
    return 'main';
}

export function GitFlowAutomation({ open, onOpenChange }: GitFlowAutomationProps) {
    const { activeRepo } = useAppStore();
    const typedTrpc = trpc as unknown as TrpcClientShape;
    const [activeTab, setActiveTab] = useState<FlowBranchType>('feature');
    const [newBranchName, setNewBranchName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isFinishing, setIsFinishing] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const repo = activeRepo ?? '';

    const { data: branchData, refetch: refetchBranches } = typedTrpc.git.branches.useQuery(
        { repo },
        { enabled: Boolean(activeRepo) && open }
    );

    const { data: statusData } = typedTrpc.git.status.useQuery(
        { repo },
        { enabled: Boolean(activeRepo) && open }
    );

    const branches = branchData?.branches ?? [];
    const currentBranch = statusData?.branch ?? '';

    const featureBranches = useMemo(
        () => branches.filter((branch) => branch.name.startsWith('feature/')),
        [branches]
    );
    const releaseBranches = useMemo(
        () => branches.filter((branch) => branch.name.startsWith('release/')),
        [branches]
    );
    const hotfixBranches = useMemo(
        () => branches.filter((branch) => branch.name.startsWith('hotfix/')),
        [branches]
    );

    const createBranchMutation = typedTrpc.git.createBranch.useMutation({
        onSuccess: () => {
            toast.success(`Created ${activeTab} branch`);
            setNewBranchName('');
            setIsCreating(false);
            void refetchBranches();
        },
        onError: (error: unknown) => {
            toast.error('Failed to create branch', {
                description: getErrorMessage(error, 'Unable to create branch'),
            });
            setIsCreating(false);
        },
    });

    const checkoutMutation = typedTrpc.git.checkout.useMutation({
        onSuccess: () => {
            toast.success('Branch checked out');
            void refetchBranches();
        },
        onError: (error: unknown) => {
            toast.error('Failed to checkout', {
                description: getErrorMessage(error, 'Unable to checkout branch'),
            });
        },
    });

    const mergeMutation = typedTrpc.git.merge.useMutation({
        onSuccess: () => {
            toast.success('Branch merged');
            setIsFinishing(null);
            void refetchBranches();
        },
        onError: (error: unknown) => {
            toast.error('Failed to merge', {
                description: getErrorMessage(error, 'Unable to merge branch'),
            });
            setIsFinishing(null);
        },
    });

    const deleteBranchMutation = typedTrpc.git.deleteBranch.useMutation({
        onSuccess: () => {
            toast.success('Branch deleted');
            setDeleteTarget(null);
            void refetchBranches();
        },
        onError: (error: unknown) => {
            toast.error('Failed to delete branch', {
                description: getErrorMessage(error, 'Unable to delete branch'),
            });
            setDeleteTarget(null);
        },
    });

    const handleCreate = () => {
        if (!newBranchName.trim()) {
            toast.error('Please enter a branch name');
            return;
        }

        setIsCreating(true);
        const fullBranchName = `${activeTab}/${newBranchName.trim()}`;

        createBranchMutation.mutate({
            repo,
            name: fullBranchName,
            commitHash: '',
            checkout: true,
        });
    };

    const handleStart = (branchName: string) => {
        checkoutMutation.mutate({ repo, branch: branchName });
    };

    const handleFinish = (branchName: string) => {
        setIsFinishing(branchName);
        mergeMutation.mutate({
            repo,
            sourceBranch: branchName,
            targetBranch: getTargetBranch(branchName),
        });
    };

    const handleDeleteConfirmed = () => {
        if (!deleteTarget) {
            return;
        }
        deleteBranchMutation.mutate({ repo, branch: deleteTarget });
    };

    const renderBranchList = (type: FlowBranchType, branchList: BranchInfo[]) => {
        if (branchList.length === 0) {
            return (
                <div className='py-8 text-center text-muted-foreground'>
                    <GitBranch className='mx-auto mb-2 h-8 w-8 opacity-50' />
                    <p>No {type} branches</p>
                </div>
            );
        }

        return (
            <div className='space-y-2'>
                {branchList.map((branch) => (
                    <div
                        key={branch.name}
                        className={`flex items-center gap-3 rounded-lg border p-3 ${
                            branch.name === currentBranch
                                ? 'border-primary bg-accent/50'
                                : 'hover:bg-accent/30'
                        }`}>
                        <GitBranch className='h-4 w-4 text-muted-foreground' />
                        <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-2'>
                                <span className='truncate font-mono text-sm'>
                                    {branch.name.replace(`${type}/`, '')}
                                </span>
                                {branch.name === currentBranch ? (
                                    <Badge variant='outline' className='text-xs'>
                                        Current
                                    </Badge>
                                ) : null}
                            </div>
                            <span className='text-xs text-muted-foreground'>{branch.name}</span>
                        </div>
                        <div className='flex items-center gap-1'>
                            {branch.name !== currentBranch ? (
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={() => {
                                        handleStart(branch.name);
                                    }}>
                                    Start
                                </Button>
                            ) : null}
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    handleFinish(branch.name);
                                }}
                                disabled={isFinishing === branch.name}>
                                {isFinishing === branch.name ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <GitMerge className='h-4 w-4' />
                                )}
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='text-destructive'
                                onClick={() => {
                                    setDeleteTarget(branch.name);
                                }}>
                                <X className='h-4 w-4' />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                    <DialogHeader>
                        <DialogTitle className='flex items-center gap-2'>
                            <GitBranch className='h-5 w-5' />
                            Git Flow
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => {
                            setActiveTab(value as FlowBranchType);
                        }}
                        className='flex flex-1 flex-col'>
                        <TabsList className='grid w-full grid-cols-3'>
                            <TabsTrigger value='feature'>
                                Feature
                                {featureBranches.length > 0 ? (
                                    <Badge variant='secondary' className='ml-2'>
                                        {featureBranches.length}
                                    </Badge>
                                ) : null}
                            </TabsTrigger>
                            <TabsTrigger value='release'>
                                Release
                                {releaseBranches.length > 0 ? (
                                    <Badge variant='secondary' className='ml-2'>
                                        {releaseBranches.length}
                                    </Badge>
                                ) : null}
                            </TabsTrigger>
                            <TabsTrigger value='hotfix'>
                                Hotfix
                                {hotfixBranches.length > 0 ? (
                                    <Badge variant='secondary' className='ml-2'>
                                        {hotfixBranches.length}
                                    </Badge>
                                ) : null}
                            </TabsTrigger>
                        </TabsList>

                        <div className='py-4'>
                            <div className='mb-4 flex items-center gap-2'>
                                <Input
                                    placeholder={`New ${activeTab} name...`}
                                    value={newBranchName}
                                    onChange={(event) => {
                                        setNewBranchName(event.target.value);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleCreate();
                                        }
                                    }}
                                    className='flex-1'
                                />
                                <Button onClick={handleCreate} disabled={isCreating || !newBranchName.trim()}>
                                    {isCreating ? (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                    ) : (
                                        <Plus className='h-4 w-4' />
                                    )}
                                </Button>
                            </div>

                            <div className='mb-4 text-xs text-muted-foreground'>
                                Base branch:{' '}
                                <code className='rounded bg-muted px-1'>{getBaseBranch(activeTab)}</code>
                            </div>

                            <ScrollArea className='flex-1'>
                                <TabsContent value='feature' className='m-0'>
                                    {renderBranchList('feature', featureBranches)}
                                </TabsContent>
                                <TabsContent value='release' className='m-0'>
                                    {renderBranchList('release', releaseBranches)}
                                </TabsContent>
                                <TabsContent value='hotfix' className='m-0'>
                                    {renderBranchList('hotfix', hotfixBranches)}
                                </TabsContent>
                            </ScrollArea>
                        </div>
                    </Tabs>

                    <div className='flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground'>
                        <AlertTriangle className='h-3 w-3' />
                        <span>
                            Finish merges to{' '}
                            {activeTab === 'hotfix' ? 'main (then develop)' : activeTab === 'release' ? 'main' : 'develop'}
                        </span>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setDeleteTarget(null);
                    }
                }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget
                                ? `Delete branch ${deleteTarget}? This action cannot be undone.`
                                : 'Delete selected branch?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirmed}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default GitFlowAutomation;

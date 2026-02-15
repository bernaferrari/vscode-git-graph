/**
 * Branch Comparison View
 * Compare two branches side by side
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GitBranch, ArrowRight, Plus, Minus, RefreshCw, Loader2, FileCode, FileText, Image } from 'lucide-react';

interface BranchComparisonProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialBase?: string;
    initialCompare?: string;
}

export function BranchComparison({ open, onOpenChange, initialBase, initialCompare }: BranchComparisonProps) {
    const { activeRepo } = useAppStore();
    const [baseBranch, setBaseBranch] = useState(initialBase || 'main');
    const [compareBranch, setCompareBranch] = useState(initialCompare || '');

    // Get branches
    const { data: repoInfo } = trpc.git.repoInfo.useQuery(
        {
            repo: activeRepo ?? '',
            showRemoteBranches: false,
            showStashes: false,
            hideRemotes: [],
        },
        { enabled: !!activeRepo && open }
    );

    // Compare branches
    const {
        data: compareData,
        isLoading,
        refetch,
    } = trpc.git.compareBranches.useQuery(
        {
            repo: activeRepo ?? '',
            from: baseBranch,
            to: compareBranch,
        },
        { enabled: !!activeRepo && !!baseBranch && !!compareBranch }
    );

    const { data: reverseCompareData } = trpc.git.compareBranches.useQuery(
        {
            repo: activeRepo ?? '',
            from: compareBranch,
            to: baseBranch,
        },
        { enabled: !!activeRepo && !!baseBranch && !!compareBranch }
    );

    const branches = (repoInfo?.branches ?? []).filter((b) => !b.startsWith('remotes/'));
    const ahead = compareData?.commits?.length ?? 0;
    const behind = reverseCompareData?.commits?.length ?? 0;
    const files = compareData?.files ?? [];

    const totalChanges = files.length;
    const additions = compareData?.additions ?? 0;
    const deletions = compareData?.deletions ?? 0;

    const getFileIcon = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext ?? '')) {
            return <Image className='h-4 w-4 text-purple-500' />;
        }
        if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs'].includes(ext ?? '')) {
            return <FileCode className='h-4 w-4 text-blue-500' />;
        }
        return <FileText className='h-4 w-4 text-amber-500' />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[90vh] max-w-3xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <GitBranch className='h-5 w-5' />
                        Compare Branches
                    </DialogTitle>
                </DialogHeader>

                {/* Branch selectors */}
                <div className='flex items-center gap-4 py-4'>
                    <div className='flex-1'>
                        <label className='text-muted-foreground mb-1 block text-xs'>Base</label>
                        <select
                            className='h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm'
                            value={baseBranch}
                            onChange={(e) => setBaseBranch(e.target.value)}>
                            <option value=''>Select base branch...</option>
                            {branches.map((b) => (
                                <option key={b} value={b}>
                                    {b}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ArrowRight className='text-muted-foreground mt-4 h-4 w-4' />
                    <div className='flex-1'>
                        <label className='text-muted-foreground mb-1 block text-xs'>Compare</label>
                        <select
                            className='h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm'
                            value={compareBranch}
                            onChange={(e) => setCompareBranch(e.target.value)}>
                            <option value=''>Select branch to compare...</option>
                            {branches
                                .filter((b) => b !== baseBranch)
                                .map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='mt-4'
                        onClick={() => refetch()}
                        disabled={!baseBranch || !compareBranch}>
                        <RefreshCw className='h-4 w-4' />
                    </Button>
                </div>

                {/* Summary */}
                {compareBranch && baseBranch && (
                    <div className='flex items-center gap-4 border-b py-2 text-sm'>
                        <Badge variant='outline'>{ahead} ahead</Badge>
                        <Badge variant='outline'>{behind} behind</Badge>
                        <span className='text-muted-foreground'>•</span>
                        <span>{totalChanges} files changed</span>
                        <span className='flex items-center text-green-600'>
                            <Plus className='mr-1 h-3 w-3' />
                            {additions}
                        </span>
                        <span className='flex items-center text-red-600'>
                            <Minus className='mr-1 h-3 w-3' />
                            {deletions}
                        </span>
                    </div>
                )}

                <ScrollArea className='flex-1'>
                    {isLoading ? (
                        <div className='flex items-center justify-center py-8'>
                            <Loader2 className='h-6 w-6 animate-spin' />
                        </div>
                    ) : !baseBranch || !compareBranch ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <GitBranch className='mx-auto mb-4 h-12 w-12 opacity-50' />
                            <p>Select two branches to compare</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className='text-muted-foreground py-8 text-center'>
                            <GitBranch className='mx-auto mb-4 h-12 w-12 opacity-50' />
                            <p>No differences between branches</p>
                        </div>
                    ) : (
                        <div className='space-y-1'>
                            {files.map((file: { status: string; path: string }, index: number) => (
                                <div
                                    key={index}
                                    className='hover:bg-accent/50 flex items-center gap-3 rounded px-3 py-2'>
                                    {getFileIcon(file.path)}
                                    <span className='flex-1 truncate text-sm'>{file.path}</span>
                                    <span
                                        className={`font-mono text-xs ${
                                            file.status === 'A'
                                                ? 'text-green-600'
                                                : file.status === 'D'
                                                  ? 'text-red-600'
                                                  : 'text-amber-600'
                                        }`}>
                                        {file.status?.toUpperCase() || 'M'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className='flex justify-end border-t pt-4'>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default BranchComparison;

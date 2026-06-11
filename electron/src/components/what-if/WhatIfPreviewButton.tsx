/**
 * What-If Preview Button
 * Quick preview for merge/rebase operations in the toolbar
 */

import { GitBranch, Merge, RotateCcw, Eye, ArrowRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

import { useLensMode } from '@/components/lens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WhatIfPreviewButtonProps {
    branch?: string;
    onPreviewMerge?: () => void;
    onPreviewRebase?: () => void;
    onPreviewSquash?: () => void;
    className?: string;
}

export function WhatIfPreviewButton({
    onPreviewMerge,
    onPreviewRebase,
    onPreviewSquash,
    className,
}: WhatIfPreviewButtonProps) {
    const { isGuided } = useLensMode();

    // In Guided mode, show a simple "Preview" button
    // In Craft/Control, show options
    if (isGuided) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant='outline' size='sm' className={cn('gap-1.5', className)} onClick={onPreviewMerge}>
                        <Eye className='h-4 w-4' />
                        <span>Preview</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>See what will happen before making changes</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className={cn('gap-1.5', className)}>
                    <Eye className='h-4 w-4' />
                    <span>Preview</span>
                    <ArrowRight className='h-3 w-3 opacity-50' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-60'>
                <div className='text-muted-foreground/85 px-2 py-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase'>
                    Preview operation
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    {...(onPreviewMerge ? { onClick: onPreviewMerge } : {})}
                    className='items-start gap-2 px-2 py-1.5'>
                    <Merge className='mt-0.5 h-4 w-4 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]' />
                    <div className='flex flex-col leading-snug'>
                        <span className='text-[0.8125rem] font-medium'>Merge</span>
                        <span className='text-muted-foreground/85 text-[11px]'>Combine branches, keep history.</span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                    {...(onPreviewRebase ? { onClick: onPreviewRebase } : {})}
                    className='items-start gap-2 px-2 py-1.5'>
                    <RotateCcw className='mt-0.5 h-4 w-4 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]' />
                    <div className='flex flex-col leading-snug'>
                        <span className='text-[0.8125rem] font-medium'>Rebase</span>
                        <span className='text-muted-foreground/85 text-[11px]'>
                            Replay your work on top, rewrites SHAs.
                        </span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                    {...(onPreviewSquash ? { onClick: onPreviewSquash } : {})}
                    className='items-start gap-2 px-2 py-1.5'>
                    <GitBranch className='mt-0.5 h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
                    <div className='flex flex-col leading-snug'>
                        <span className='text-[0.8125rem] font-medium'>Squash</span>
                        <span className='text-muted-foreground/85 text-[11px]'>Combine commits into one.</span>
                    </div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Compact inline preview indicator
export function PreviewIndicator({
    status,
    conflicts,
    willRewrite,
}: {
    status: 'idle' | 'previewing' | 'ready' | 'error';
    conflicts?: number;
    willRewrite?: boolean;
}) {
    if (status === 'idle') {
        return (
            <div className='text-muted-foreground/85 flex items-center gap-1.5 text-[0.8125rem]'>
                <Eye className='h-3.5 w-3.5' />
                <span>Click Preview to see results</span>
            </div>
        );
    }

    if (status === 'previewing') {
        return (
            <div className='flex items-center gap-1.5 text-[0.8125rem] text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]'>
                <Clock className='h-3.5 w-3.5 animate-pulse' />
                <span>Generating preview…</span>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className='text-destructive flex items-center gap-1.5 text-[0.8125rem]'>
                <AlertTriangle className='h-3.5 w-3.5' />
                <span>Preview failed</span>
            </div>
        );
    }

    // Ready state
    return (
        <div className='flex flex-wrap items-center gap-2'>
            <div className='flex items-center gap-1.5 text-[0.8125rem] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>
                <CheckCircle2 className='h-3.5 w-3.5' />
                <span>Ready to apply</span>
            </div>
            {conflicts !== undefined && conflicts > 0 && (
                <Badge variant='warning' className='gap-1'>
                    <AlertTriangle className='h-3 w-3' />
                    {conflicts} conflict{conflicts !== 1 ? 's' : ''}
                </Badge>
            )}
            {willRewrite && (
                <Badge variant='info' className='gap-1'>
                    <RotateCcw className='h-3 w-3' />
                    Rewrites history
                </Badge>
            )}
        </div>
    );
}

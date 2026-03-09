import { lazy, Suspense } from 'react';
import { Filter } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { CommitFilter } from './commit-history-filters';

const CommitHistoryFilters = lazy(() =>
    import('./commit-history-filters').then((mod) => ({ default: mod.CommitHistoryFilters }))
);

function DialogLoadingFallback() {
    return <div className='text-muted-foreground px-4 py-3 text-sm'>Loading filters...</div>;
}

export function CommitFiltersDialog({
    open,
    onOpenChange,
    filters,
    onChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: CommitFilter;
    onChange: (filters: CommitFilter) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Filter className='h-5 w-5' />
                        Filter Commits
                    </DialogTitle>
                </DialogHeader>
                <div className='space-y-4 py-4'>
                    {open && (
                        <Suspense fallback={<DialogLoadingFallback />}>
                            <CommitHistoryFilters filters={filters} onChange={onChange} />
                        </Suspense>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

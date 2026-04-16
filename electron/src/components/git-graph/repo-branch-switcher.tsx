import { ChevronDown, GitBranch, Globe } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface RepoBranchSwitcherProps {
    repoLabel: string;
    currentHead: string;
    branchMenuOpen: boolean;
    onBranchMenuOpenChange: (open: boolean) => void;
    branchSearch: string;
    onBranchSearchChange: (value: string) => void;
    onBranchSearchSubmit: () => void;
    filteredLocalBranches: string[];
    filteredRemoteBranches: string[];
    branchResultsEmpty: boolean;
    onCheckoutBranch: (branch: string) => void;
}

export function RepoBranchSwitcher({
    repoLabel,
    currentHead,
    branchMenuOpen,
    onBranchMenuOpenChange,
    branchSearch,
    onBranchSearchChange,
    onBranchSearchSubmit,
    filteredLocalBranches,
    filteredRemoteBranches,
    branchResultsEmpty,
    onCheckoutBranch,
}: RepoBranchSwitcherProps) {
    return (
        <div className='mr-2 flex shrink-0 items-center gap-2'>
            <div className='from-background/80 to-muted/40 border-border/70 inline-flex items-center gap-1.5 rounded-md border bg-gradient-to-b px-2.5 py-1'>
                <GitBranch className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                <span className='max-w-44 truncate text-sm font-semibold tracking-tight'>{repoLabel}</span>
            </div>
            <DropdownMenu open={branchMenuOpen} onOpenChange={onBranchMenuOpenChange}>
                <DropdownMenuTrigger className='bg-primary/10 text-primary border-primary/30 hover:bg-primary/15 focus-visible:ring-primary/40 inline-flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-xs font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                    <GitBranch className='h-3.5 w-3.5' />
                    {currentHead}
                    <ChevronDown className='h-3 w-3' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' className='max-h-96 w-72 overflow-y-auto p-0'>
                    <div className='bg-popover sticky top-0 z-10 border-b p-2'>
                        <Input
                            value={branchSearch}
                            onChange={(event) => {
                                onBranchSearchChange(event.target.value);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onBranchSearchSubmit();
                                }
                            }}
                            placeholder='Checkout branch...'
                            className='border-border/70 bg-background/80 h-8 text-sm focus-visible:ring-2 focus-visible:ring-primary/30'
                        />
                    </div>
                    <div className='text-muted-foreground bg-popover sticky top-[49px] px-2 py-1.5 text-xs font-medium'>
                        Local Branches ({filteredLocalBranches.length})
                    </div>
                    {filteredLocalBranches.map((branch) => (
                        <DropdownMenuItem
                            key={branch}
                            className={branch === currentHead ? 'bg-accent font-medium' : ''}
                            onClick={() => {
                                onCheckoutBranch(branch);
                            }}>
                            <GitBranch
                                className={`mr-2 h-4 w-4 ${branch === currentHead ? 'text-primary' : 'text-muted-foreground'}`}
                            />
                            <span className='flex-1'>{branch}</span>
                            {branch === currentHead && <span className='text-primary text-xs font-medium'>current</span>}
                        </DropdownMenuItem>
                    ))}
                    {filteredLocalBranches.length === 0 && (
                        <div className='text-muted-foreground px-3 py-2 text-sm'>No local branches found</div>
                    )}
                    {filteredRemoteBranches.length > 0 && (
                        <>
                            <div className='text-muted-foreground bg-popover sticky top-[49px] mt-1 border-t px-2 py-1.5 text-xs font-medium'>
                                Remote Branches ({filteredRemoteBranches.length})
                            </div>
                            {filteredRemoteBranches.map((branch) => (
                                <DropdownMenuItem
                                    key={branch}
                                    onClick={() => {
                                        onCheckoutBranch(branch);
                                    }}>
                                    <Globe className='text-muted-foreground mr-2 h-4 w-4' />
                                    <span className='flex-1'>{branch.replace('remotes/', '')}</span>
                                </DropdownMenuItem>
                            ))}
                        </>
                    )}
                    {branchResultsEmpty && (
                        <div className='text-muted-foreground px-3 py-3 text-center text-sm'>
                            No branches match "{branchSearch}"
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export default RepoBranchSwitcher;

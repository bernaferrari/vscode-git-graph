import {
    Archive,
    ChevronDown,
    Download,
    Filter,
    FolderGit2,
    GitBranch,
    PanelLeft,
    Pin,
    Plus,
    RefreshCw,
    Search,
    Tag,
    Upload,
    X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { ElementType, ReactNode } from 'react';

function ToolbarButton({
    icon: Icon,
    label,
    shortcut,
    onClick,
    variant = 'ghost',
    disabled,
}: {
    icon: ElementType;
    label: string;
    shortcut?: string;
    onClick: () => void;
    variant?: 'ghost' | 'default' | 'outline';
    disabled?: boolean;
}) {
    const title = shortcut ? `${label} (${shortcut})` : label;
    const sharedControlClass =
        'rounded-md border border-transparent px-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-150 hover:border-border/70 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] disabled:opacity-40';

    return (
        <Button
            variant={variant}
            size='sm'
            className={`h-8 gap-1.5 ${sharedControlClass}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={label}>
            <Icon className='h-4 w-4' />
            <span className='hidden sm:inline'>{label}</span>
        </Button>
    );
}

interface GitGraphToolbarProps {
    isGuided: boolean;
    hasFilters: boolean;
    pinnedCommitCount: number;
    leftSlots?: ReactNode;
    branchFilter: ReactNode;
    lensSwitcher: ReactNode;
    profileSwitcher: ReactNode;
    operationTimeline: ReactNode;
    stackedBranches: ReactNode;
    overflowMenu: ReactNode;
    onSync: () => void | Promise<void>;
    onFetch: () => void;
    onPush: () => void;
    onForcePush: () => void;
    onPull: () => void;
    onPullFfOnly: () => void;
    onCreateBranch: () => void;
    onCreateTag: () => void;
    onStash: () => void;
    onOpenWorkspaces: () => void;
    onClearFilters: () => void;
    onFind: () => void;
    onRefresh: () => void;
    onToggleSidePanel: () => void;
    onOpenPinnedCommits: () => void;
    notifications?: ReactNode;
}

export function GitGraphToolbar({
    isGuided,
    hasFilters,
    pinnedCommitCount,
    leftSlots,
    branchFilter,
    lensSwitcher,
    profileSwitcher,
    operationTimeline,
    stackedBranches,
    overflowMenu,
    onSync,
    onFetch,
    onPush,
    onForcePush,
    onPull,
    onPullFfOnly,
    onCreateBranch,
    onCreateTag,
    onStash,
    onOpenWorkspaces,
    onClearFilters,
    onFind,
    onRefresh,
    onToggleSidePanel,
    onOpenPinnedCommits,
    notifications,
}: GitGraphToolbarProps) {
    return (
        <div className='ui-toolbar flex items-center gap-2 px-2 py-1.5'>
            {leftSlots}

            <div className='bg-border mx-1 h-5 w-px shrink-0' />

            {isGuided ? (
                <ToolbarButton icon={RefreshCw} label='Sync' onClick={() => void onSync()} />
            ) : (
                <>
                    <ToolbarButton icon={Download} label='Fetch' onClick={onFetch} />
                    <DropdownMenu>
                        <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                            <Upload className='h-4 w-4' />
                            <span className='hidden sm:inline'>Push</span>
                            <ChevronDown className='h-3 w-3' />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                            <DropdownMenuItem onClick={onPush}>
                                <Upload className='mr-2 h-4 w-4' />
                                Push
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onForcePush}>
                                <Upload className='mr-2 h-4 w-4 text-amber-600' />
                                Force Push
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                            <Download className='h-4 w-4' />
                            <span className='hidden sm:inline'>Pull</span>
                            <ChevronDown className='h-3 w-3' />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                            <DropdownMenuItem onClick={onPull}>
                                <Download className='mr-2 h-4 w-4' />
                                Pull
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onPullFfOnly}>
                                <Download className='mr-2 h-4 w-4 text-emerald-600' />
                                Pull (Fast-forward only)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            <div className='bg-border mx-1 h-5 w-px shrink-0' />

            <DropdownMenu>
                <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[12px] font-medium transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                    <Plus className='h-4 w-4' />
                    <span className='hidden sm:inline'>New</span>
                    <ChevronDown className='h-3 w-3' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                    <DropdownMenuItem onClick={onCreateBranch}>
                        <GitBranch className='mr-2 h-4 w-4' />
                        Branch...
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onCreateTag}>
                        <Tag className='mr-2 h-4 w-4' />
                        Tag...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onStash}>
                        <Archive className='mr-2 h-4 w-4' />
                        Stash
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className='ml-1 w-44 shrink-0'>{branchFilter}</div>
            <div className='ml-1 shrink-0'>{lensSwitcher}</div>
            <div className='ml-1 shrink-0'>{profileSwitcher}</div>
            <div className='ml-1 shrink-0'>{operationTimeline}</div>
            <div className='ml-1 shrink-0'>{stackedBranches}</div>
            <div className='ml-1 shrink-0'>
                <ToolbarButton icon={FolderGit2} label='Workspaces' onClick={onOpenWorkspaces} />
            </div>

            {hasFilters && (
                <Badge variant='secondary' className='ml-2 shrink-0 gap-1'>
                    <Filter className='h-3 w-3' />
                    <span className='text-xs'>Filtered</span>
                    <Button variant='ghost' size='sm' className='ml-1 h-4 w-4 p-0' onClick={onClearFilters}>
                        <X className='h-3 w-3' />
                    </Button>
                </Badge>
            )}

            <div className='flex-1 shrink-0' />

            <ToolbarButton icon={Search} label='Find' shortcut='⌘F' onClick={onFind} />
            <ToolbarButton icon={RefreshCw} label='Refresh' shortcut='⌘R' onClick={onRefresh} />
            <ToolbarButton icon={PanelLeft} label='Toggle Panel' onClick={onToggleSidePanel} />
            {notifications}

            <Button
                variant='ghost'
                size='sm'
                className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 relative h-8 w-8 rounded-md border border-transparent p-0 transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'
                onClick={onOpenPinnedCommits}
                title='Pinned Commits'>
                <Pin className='h-4 w-4' />
                {pinnedCommitCount > 0 && (
                    <span className='bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]'>
                        {pinnedCommitCount}
                    </span>
                )}
            </Button>

            {overflowMenu}
        </div>
    );
}

export default GitGraphToolbar;

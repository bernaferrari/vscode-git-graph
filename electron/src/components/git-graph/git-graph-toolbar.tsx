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

const TOOLBAR_CONTROL_CHROME =
    'rounded-md border border-transparent text-[12px] font-medium text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 active:translate-y-[0.5px] disabled:opacity-40';
const TOOLBAR_DROPDOWN_TRIGGER_CLASS = `inline-flex h-7 items-center gap-1.5 px-2 ${TOOLBAR_CONTROL_CHROME}`;

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

    return (
        <Button
            variant={variant}
            size='sm'
            className={`h-7 gap-1.5 px-2 ${TOOLBAR_CONTROL_CHROME}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={label}>
            <Icon className='h-3.5 w-3.5' />
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
        <div className='ui-toolbar flex items-center gap-1 px-2 py-1'>
            {leftSlots}

            <div className='bg-border/70 mx-1.5 h-4 w-px shrink-0' />

            {isGuided ? (
                <ToolbarButton icon={RefreshCw} label='Sync' onClick={() => void onSync()} />
            ) : (
                <>
                    <ToolbarButton icon={Download} label='Fetch' onClick={onFetch} />
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={TOOLBAR_DROPDOWN_TRIGGER_CLASS}
                            title='Push options'
                            aria-label='Push options'>
                            <Upload className='h-3.5 w-3.5' />
                            <span className='hidden sm:inline'>Push</span>
                            <ChevronDown className='h-3 w-3 opacity-60' />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                            <DropdownMenuItem onClick={onPush}>
                                <Upload />
                                Push
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onForcePush}>
                                <Upload className='!text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]' />
                                Force Push
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={TOOLBAR_DROPDOWN_TRIGGER_CLASS}
                            title='Pull options'
                            aria-label='Pull options'>
                            <Download className='h-3.5 w-3.5' />
                            <span className='hidden sm:inline'>Pull</span>
                            <ChevronDown className='h-3 w-3 opacity-60' />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                            <DropdownMenuItem onClick={onPull}>
                                <Download />
                                Pull
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onPullFfOnly}>
                                <Download className='!text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]' />
                                Pull (Fast-forward only)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            <div className='bg-border/70 mx-1.5 h-4 w-px shrink-0' />

            <DropdownMenu>
                <DropdownMenuTrigger className={TOOLBAR_DROPDOWN_TRIGGER_CLASS} title='New ref or stash' aria-label='New'>
                    <Plus className='h-3.5 w-3.5' />
                    <span className='hidden sm:inline'>New</span>
                    <ChevronDown className='h-3 w-3 opacity-60' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                    <DropdownMenuItem onClick={onCreateBranch}>
                        <GitBranch />
                        Branch…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onCreateTag}>
                        <Tag />
                        Tag…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onStash}>
                        <Archive />
                        Stash
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className='ml-1 hidden w-40 shrink-0 lg:block'>{branchFilter}</div>
            <div className='ml-1 shrink-0'>{lensSwitcher}</div>
            <div className='ml-1 shrink-0'>{profileSwitcher}</div>
            <div className='ml-1 hidden shrink-0 xl:block'>{operationTimeline}</div>
            <div className='ml-1 hidden shrink-0 xl:block'>{stackedBranches}</div>
            <div className='ml-1 hidden shrink-0 lg:block'>
                <ToolbarButton icon={FolderGit2} label='Workspaces' onClick={onOpenWorkspaces} />
            </div>

            {hasFilters && (
                <Badge variant='info' className='ml-1.5 shrink-0 gap-1 h-6'>
                    <Filter className='h-2.5 w-2.5' />
                    <span>Filtered</span>
                    <Button variant='ghost' size='icon-xs' className='ml-0.5 -mr-1' onClick={onClearFilters}>
                        <X className='h-2.5 w-2.5' />
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
                className={`relative h-7 w-7 p-0 ${TOOLBAR_CONTROL_CHROME}`}
                onClick={onOpenPinnedCommits}
                title='Pinned Commits'
                aria-label='Pinned Commits'>
                <Pin className='h-3.5 w-3.5' />
                {pinnedCommitCount > 0 && (
                    <span className='bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold ring-2 ring-background tabular-nums'>
                        {pinnedCommitCount}
                    </span>
                )}
            </Button>

            {overflowMenu}
        </div>
    );
}

export default GitGraphToolbar;

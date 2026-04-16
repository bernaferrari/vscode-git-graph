import {
    Activity,
    Archive,
    BarChart3,
    Bug,
    Download,
    FileCode,
    FileText,
    Filter,
    FolderGit2,
    GitBranch,
    GitCommit,
    GitPullRequest,
    Globe,
    History,
    Info,
    Key,
    Keyboard,
    ListPlus,
    MoreHorizontal,
    Package,
    Search,
    Settings,
    Terminal,
    Undo,
    User,
} from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OverflowMenuProps {
    featureFlags: {
        worktreePro: boolean;
        workflowEngine: boolean;
    };
    inlineBlameEnabled: boolean;
    onOpenInTerminal: () => void;
    onOpenInFinder: () => void;
    onClone: () => void;
    onQuickSwitch: () => void;
    onFilterCommits: () => void;
    onLineStaging: () => void;
    onToggleTerminal: () => void;
    onStatistics: () => void;
    onManageRemotes: () => void;
    onCompareBranches: () => void;
    onHooks: () => void;
    onCommitSigning: () => void;
    onReflog: () => void;
    onTemplates: () => void;
    onGitignore: () => void;
    onCustomCommands: () => void;
    onSearchCommits: () => void;
    onLfs: () => void;
    onToggleInlineBlame: () => void;
    onPullRequests: () => void;
    onWorktrees: () => void;
    onWorkflows: () => void;
    onSubmodules: () => void;
    onRecentRepos: () => void;
    onWorkspaces: () => void;
    onKeyboardHelp: () => void;
    onRestartOnboarding: () => void;
    onStashes: () => void;
    onGraphLegend: () => void;
    onGitFlow: () => void;
    onHealthCheck: () => void;
    onBisect: () => void;
    onUndoStack: () => void;
    onConfigEditor: () => void;
    onExternalDiff: () => void;
    onIssueTracker: () => void;
    onBulkOps: () => void;
    onFileAnnotations: () => void;
    onActivityHeatmap: () => void;
    onSettings: () => void;
    onDiagnostics: () => void;
    onCommandPalette: () => void;
    onUndoLastCommit: () => void;
}

const isMacPlatform = () => {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return /mac/i.test(navigator.userAgent) || /mac/i.test(navigator.platform ?? '');
};

const shortcutLabels = {
    quickSwitch: isMacPlatform() ? '⌘K' : 'Ctrl+K',
    toggleTerminal: isMacPlatform() ? '⌘P' : 'Ctrl+P',
    searchCommits: isMacPlatform() ? '⌘⇧F' : 'Ctrl+Shift+F',
    undoHistory: isMacPlatform() ? '⌘Z' : 'Ctrl+Z',
    settings: isMacPlatform() ? '⌘,' : 'Ctrl+,',
    commandPalette: isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P',
};

export function OverflowMenu({
    featureFlags,
    inlineBlameEnabled,
    onOpenInTerminal,
    onOpenInFinder,
    onClone,
    onQuickSwitch,
    onFilterCommits,
    onLineStaging,
    onToggleTerminal,
    onStatistics,
    onManageRemotes,
    onCompareBranches,
    onHooks,
    onCommitSigning,
    onReflog,
    onTemplates,
    onGitignore,
    onCustomCommands,
    onSearchCommits,
    onLfs,
    onToggleInlineBlame,
    onPullRequests,
    onWorktrees,
    onWorkflows,
    onSubmodules,
    onRecentRepos,
    onWorkspaces,
    onKeyboardHelp,
    onRestartOnboarding,
    onStashes,
    onGraphLegend,
    onGitFlow,
    onHealthCheck,
    onBisect,
    onUndoStack,
    onConfigEditor,
    onExternalDiff,
    onIssueTracker,
    onBulkOps,
    onFileAnnotations,
    onActivityHeatmap,
    onSettings,
    onDiagnostics,
    onCommandPalette,
    onUndoLastCommit,
}: OverflowMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'>
                <MoreHorizontal className='h-4 w-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={onOpenInTerminal}>
                    <Terminal className='mr-2 h-4 w-4' />
                    Open in Terminal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenInFinder}>
                    <FileCode className='mr-2 h-4 w-4' />
                    Reveal in File Manager
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onClone}>
                    <Download className='mr-2 h-4 w-4' />
                    Clone Repository
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onQuickSwitch}>
                    <Search className='mr-2 h-4 w-4' />
                    Quick Switch...
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.quickSwitch}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onFilterCommits}>
                    <Filter className='mr-2 h-4 w-4' />
                    Filter Commits...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLineStaging}>
                    <ListPlus className='mr-2 h-4 w-4' />
                    Line Staging...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleTerminal}>
                    <Terminal className='mr-2 h-4 w-4' />
                    Toggle Terminal
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.toggleTerminal}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onStatistics}>
                    <BarChart3 className='mr-2 h-4 w-4' />
                    Statistics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageRemotes}>
                    <Globe className='mr-2 h-4 w-4' />
                    Manage Remotes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCompareBranches}>
                    <GitBranch className='mr-2 h-4 w-4' />
                    Compare Branches
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onHooks}>
                    <Settings className='mr-2 h-4 w-4' />
                    Hooks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCommitSigning}>
                    <Key className='mr-2 h-4 w-4' />
                    Commit Signing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReflog}>
                    <History className='mr-2 h-4 w-4' />
                    Reflog
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTemplates}>
                    <FileText className='mr-2 h-4 w-4' />
                    Commit Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onGitignore}>
                    <FileText className='mr-2 h-4 w-4' />
                    Edit .gitignore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCustomCommands}>
                    <Terminal className='mr-2 h-4 w-4' />
                    Custom Commands
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSearchCommits}>
                    <Search className='mr-2 h-4 w-4' />
                    Search Commits
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.searchCommits}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLfs}>
                    <Package className='mr-2 h-4 w-4' />
                    LFS Management
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleInlineBlame}>
                    <User className='mr-2 h-4 w-4' />
                    {inlineBlameEnabled ? 'Disable' : 'Enable'} Inline Blame
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onPullRequests}>
                    <GitPullRequest className='mr-2 h-4 w-4' />
                    Pull Requests
                </DropdownMenuItem>
                {featureFlags.worktreePro && (
                    <DropdownMenuItem onClick={onWorktrees}>
                        <FolderGit2 className='mr-2 h-4 w-4' />
                        Worktrees
                    </DropdownMenuItem>
                )}
                {featureFlags.workflowEngine && (
                    <DropdownMenuItem onClick={onWorkflows}>
                        <Activity className='mr-2 h-4 w-4' />
                        Workflow Engine
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onSubmodules}>
                    <Package className='mr-2 h-4 w-4' />
                    Submodules
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRecentRepos}>
                    <FolderGit2 className='mr-2 h-4 w-4' />
                    Recent Repositories
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onWorkspaces}>
                    <FolderGit2 className='mr-2 h-4 w-4' />
                    Workspaces Launchpad
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onKeyboardHelp}>
                    <Keyboard className='mr-2 h-4 w-4' />
                    Keyboard Shortcuts
                    <span className='text-muted-foreground ml-auto text-xs'>?</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRestartOnboarding}>
                    <Info className='mr-2 h-4 w-4' />
                    Start Onboarding Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onStashes}>
                    <Archive className='mr-2 h-4 w-4' />
                    Manage Stashes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onGraphLegend}>
                    <Info className='mr-2 h-4 w-4' />
                    Graph Legend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onGitFlow}>
                    <GitBranch className='mr-2 h-4 w-4' />
                    Git Flow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onHealthCheck}>
                    <Activity className='mr-2 h-4 w-4' />
                    Health Check
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBisect}>
                    <Bug className='mr-2 h-4 w-4' />
                    Git Bisect
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onUndoStack}>
                    <History className='mr-2 h-4 w-4' />
                    Undo History
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.undoHistory}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onConfigEditor}>
                    <Settings className='mr-2 h-4 w-4' />
                    Git Configuration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExternalDiff}>
                    <FileCode className='mr-2 h-4 w-4' />
                    External Diff Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onIssueTracker}>
                    <GitPullRequest className='mr-2 h-4 w-4' />
                    Issue Tracker Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBulkOps}>
                    <GitCommit className='mr-2 h-4 w-4' />
                    Bulk Operations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onFileAnnotations}>
                    <FileCode className='mr-2 h-4 w-4' />
                    File Annotations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onActivityHeatmap}>
                    <BarChart3 className='mr-2 h-4 w-4' />
                    Activity Heatmap
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSettings}>
                    <Settings className='mr-2 h-4 w-4' />
                    Settings
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.settings}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDiagnostics}>
                    <Activity className='mr-2 h-4 w-4' />
                    Diagnostics & Integrations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCommandPalette}>
                    <Search className='mr-2 h-4 w-4' />
                    Command Palette
                    <span className='text-muted-foreground ml-auto text-xs'>{shortcutLabels.commandPalette}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onUndoLastCommit}>
                    <Undo className='mr-2 h-4 w-4' />
                    Undo Last Commit
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default OverflowMenu;

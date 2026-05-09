export interface AheadBehindEntry {
    branch: string;
    ahead: number;
    behind: number;
    upstream: string | null;
}

export interface SmartBranchEntry {
    name: string;
    pinned: boolean;
    current: boolean;
    ahead: number;
    behind: number;
    score: number;
}

export interface WorktreeEntry {
    path: string;
    branch?: string;
    isMain?: boolean;
    isCurrent?: boolean;
    isLocked?: boolean;
    isPrunable?: boolean;
    dirtyCount?: number;
    head?: string | null;
}

export interface SubmoduleEntry {
    path: string;
    status: string;
}

export interface StashEntry {
    message?: string;
}

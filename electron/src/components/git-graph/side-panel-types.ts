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
}

export interface SubmoduleEntry {
    path: string;
    status: string;
}

export interface StashEntry {
    message?: string;
}

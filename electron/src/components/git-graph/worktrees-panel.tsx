/**
 * Backward-compatible embedded worktrees panel.
 */

import { WorktreeCenter } from './worktree-center';

interface WorktreesPanelProps {
    repo: string;
}

export function WorktreesPanel({ repo }: WorktreesPanelProps) {
    return <WorktreeCenter open={true} onOpenChange={() => undefined} repo={repo} embedded={true} />;
}

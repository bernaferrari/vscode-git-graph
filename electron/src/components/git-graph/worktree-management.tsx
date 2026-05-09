/**
 * Backward-compatible Worktree management wrapper.
 * Delegates to the consolidated Worktree Center.
 */

import { WorktreeCenter } from './worktree-center';

interface WorktreeManagementProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialBranch?: string | null;
}

export function WorktreeManagement({ open, onOpenChange, initialBranch }: WorktreeManagementProps) {
    return (
        <WorktreeCenter
            open={open}
            onOpenChange={onOpenChange}
            {...(initialBranch ? { initialBranch } : {})}
        />
    );
}

export default WorktreeManagement;

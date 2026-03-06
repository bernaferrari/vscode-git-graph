/**
 * Backward-compatible Worktree management wrapper.
 * Delegates to the consolidated Worktree Center.
 */

import { WorktreeCenter } from './worktree-center';

interface WorktreeManagementProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorktreeManagement({ open, onOpenChange }: WorktreeManagementProps) {
    return <WorktreeCenter open={open} onOpenChange={onOpenChange} />;
}

export default WorktreeManagement;

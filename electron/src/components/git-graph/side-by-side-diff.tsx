/**
 * Side-by-Side Diff Viewer (wrapper)
 * Kept for API compatibility while using the lighter in-house viewer.
 */

import { EnhancedDiffViewer } from './enhanced-diff-viewer';

interface SideBySideDiffProps {
    file: {
        path: string;
        from?: string;
        status: string;
    };
    commitHash?: string;
    onAcceptOurs?: () => void;
    onAcceptTheirs?: () => void;
}

export function SideBySideDiff(props: SideBySideDiffProps) {
    return <EnhancedDiffViewer {...props} />;
}

export default SideBySideDiff;

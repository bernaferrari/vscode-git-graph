/**
 * Git Graph Route
 * Main route for the Git Graph view
 */

import { createFileRoute } from '@tanstack/react-router';
import { GitGraph } from '@/components/git-graph';

export const Route = createFileRoute('/git-graph')({
	component: GitGraphPage,
});

function GitGraphPage() {
	return <GitGraph />;
}

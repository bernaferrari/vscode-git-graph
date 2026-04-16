/**
 * Git Graph Route
 * Main route for the Git Graph view
 */

import { createFileRoute } from '@tanstack/react-router';

import { GitGraphPage } from '@/pages/GitGraphPage';

export const Route = createFileRoute('/git-graph')({
    component: GitGraphPage,
});

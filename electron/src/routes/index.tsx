/*
 * Home route - redirects to Git Graph
 */

import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: () => <Navigate to="/git-graph" />,
});

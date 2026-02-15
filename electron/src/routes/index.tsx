/*
 * Home route
 */

import { createFileRoute } from '@tanstack/react-router';
import { GitGraphPage } from '@/pages/GitGraphPage';

export const Route = createFileRoute('/')({
    component: GitGraphPage,
});

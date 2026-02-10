/**
 * Root tRPC router.
 * Mounts all domain routers here; AppRouter type is exported for client inference.
 */

import { router } from '@/app/backend/trpc/init';
import { systemRouter } from '@/app/backend/trpc/routers/system';
import { gitRouter } from '@/app/backend/trpc/routers/git';
import { repoRouter } from '@/app/backend/trpc/routers/repo';
import { configRouter } from '@/app/backend/trpc/routers/config';
import { watcherRouter } from '@/app/backend/trpc/routers/watcher';
import { pullRequestRouter } from '@/app/backend/trpc/routers/pr';

export const appRouter = router({
    system: systemRouter,
    git: gitRouter,
    repo: repoRouter,
    config: configRouter,
    watcher: watcherRouter,
    pr: pullRequestRouter,
});

export type AppRouter = typeof appRouter;

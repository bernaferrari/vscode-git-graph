/**
 * Root tRPC router.
 * Mounts all domain routers here; AppRouter type is exported for client inference.
 */

import { router } from '@/app/backend/trpc/init';
import { appLevelRouter } from '@/app/backend/trpc/routers/app';
import { aiRouter } from '@/app/backend/trpc/routers/ai';
import { configRouter } from '@/app/backend/trpc/routers/config';
import { gitRouter } from '@/app/backend/trpc/routers/git';
import { pullRequestRouter } from '@/app/backend/trpc/routers/pr';
import { repoRouter } from '@/app/backend/trpc/routers/repo';
import { systemRouter } from '@/app/backend/trpc/routers/system';
import { watcherRouter } from '@/app/backend/trpc/routers/watcher';

export const appRouter = router({
    app: appLevelRouter,
    ai: aiRouter,
    system: systemRouter,
    git: gitRouter,
    repo: repoRouter,
    config: configRouter,
    watcher: watcherRouter,
    pr: pullRequestRouter,
});

export type AppRouter = typeof appRouter;

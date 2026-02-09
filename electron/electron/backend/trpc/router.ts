/**
 * Root tRPC router.
 * Mounts all domain routers here; AppRouter type is exported for client inference.
 */

import { router } from '@/app/backend/trpc/init';
import { systemRouter } from '@/app/backend/trpc/routers/system';
import { gitRouter } from '@/app/backend/trpc/routers/git';
import { repoRouter } from '@/app/backend/trpc/routers/repo';
import { configRouter } from '@/app/backend/trpc/routers/config';

export const appRouter = router({
    system: systemRouter,
    git: gitRouter,
    repo: repoRouter,
    config: configRouter,
});

export type AppRouter = typeof appRouter;

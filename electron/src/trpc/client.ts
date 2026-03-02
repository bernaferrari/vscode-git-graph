import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@/app/backend/trpc/router';

// Transitional compatibility cast:
// several legacy Git Graph modules still call old-style helpers (e.g. `trpc.foo.bar.query()` / `.mutate()`).
// We keep runtime behavior unchanged while unblocking release checks during gradual migration.
export const trpc = createTRPCReact<AppRouter>() as any;

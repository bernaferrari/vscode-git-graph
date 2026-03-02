# Release Surface (Electron Git Graph)

This document defines the production release surface used by release-gate checks.

## In Scope

- `electron/backend/**` (tRPC routers, services, store)
- `src/components/git-graph/**`
- `src/hooks/useGitOperations.ts`
- `src/lib/store.ts`
- `src/lib/operationLog.ts`
- `src/trpc/**`

## Out of Scope (Quarantined / Experimental)

- `src/components/ai/**`
- `src/components/lens/**`
- `src/components/plan-editor/**`
- `src/components/what-if/**`
- `src/components/commit-series/**`
- `src/components/component-example.tsx`

These modules may continue evolving, but do not block release-gate checks until they are promoted.

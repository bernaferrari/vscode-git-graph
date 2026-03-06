# Single-Release Hardening Checklist

Use this checklist before enabling the new Worktree Pro, Workflow Engine, Graphite interop, AI production features, deep links, and branch pinning by default.

## Automated Gates

Run:

1. `pnpm run release:hardening`

Expected:

1. `typecheck:release` passes.
2. `test` passes.
3. `test:release` passes.
4. `build` passes.

## Feature Flag Defaults

Verify `config.ui.featureFlags` start in a safe state:

1. `worktreePro` enabled only when backend/UI migration is complete.
2. `workflowEngine` enabled only when workflow routes and UI load without fallback errors.
3. `graphiteInterop` optional and tolerant of missing Graphite CLI.
4. `aiProd` configurable and allowed to stay default-off for GA patch 1.
5. `deepLinks` and `branchPinning` enabled once parser + persistence checks pass.

## Regression Scenarios

1. Worktree create/open/lock/unlock/remove + cleanup runs without UI desync.
2. Workflow dry-run and execute both report step-level status.
3. Deep-link open resolves repo/branch/commit/file/panel safely and rejects invalid routes.
4. AI commit generation works when provider is enabled and degrades cleanly when unavailable.
5. Launchpad pinned branches persist after restart and smart ranking stays stable.

## Compatibility Checks

1. Deprecated `git.worktreeManage.*` routes are removed from callers.
2. Legacy UI wrappers route to `WorktreeCenter` without navigation breakage.
3. Existing core git operations (fetch/pull/push/checkout/rebase/merge/stash) still pass smoke checks.

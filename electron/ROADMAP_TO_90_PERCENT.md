# Git Graph → 90% Competitor Readiness Plan

## Current readiness snapshot (v1)

- **Estimated overall parity with GitKraken / Tower / Sublime Merge: ~72-78%**
  - Strong baseline already exists: graph, branching, commit/rebase/cherry-pick flows, merge conflict resolution UI, diff viewers, PR/issue integrations, stash/undo, worktrees, remote actions.
  - Remaining work is mostly **workflow polish, missing pro workflows, and reliability edge-cases** rather than core command support.

## What is likely preventing ““90%+” feel” today

1. **Workflow friction**
   - Conflicts and rebase/cherry-pick error states need faster in-place actions.
   - Some actions still feel modal-heavy (multi-step confirmations, duplicated conflict UIs).
2. **Missing enterprise/professional surfaces**
   - Deep review workflows (PR review, patch queueing, advanced commit templates/hook orchestration).
   - Full remote mgmt parity, and richer integration management.
3. **Missing quality-of-life defaults**
   - Better onboarding + discoverability in every flow.
   - Consistent shortcut/documentation for all advanced panes.
   - More robust state handling for edge cases (binary conflicts, large files, long conflict runs).

## 90% implementation plan

### Phase 1 — Finish UX completeness for critical flows (highest impact, 2–3 weeks)
- Merge conflict UX
  - Add global conflict toolbar actions (file list context + file panel).
  - Improve conflict markers diagnostics + progress/status messaging.
  - Add safer close behavior when unresolved/manual edits exist.
- Rebase/cherry-pick/revert error recovery
  - Faster “what’s blocked” hints in operation bar.
  - Auto-refresh state and stronger “next action” affordances.
- Keyboard + discoverability
  - Surface conflict/editor shortcuts everywhere (help + tooltips + quick labels).
  - Add in-product first-time flow for power actions.
- Diff quality
  - Continue side-by-side parity (especially long-file and whitespace-sensitive views).

### Phase 2 — Professional workflows (2–4 weeks)
- Commit/message automation: commit templates, hook pipeline visibility, bulk commit workflows.
- Remote/protected branch workflow polish: add/edit/remove remotes, refspec UX, pull request branch actions.
- Advanced visual review:
  - better commit list filtering, annotations, and file-level conflict context.
  - stronger saved state for search/filters in UI.

### Phase 3 — Reliability and polish to differentiate (2–4 weeks)
- Edge-case hardening
  - Binary file handling.
  - Large repo perf optimization, debounced operations, cancellation + progress states.
- Accessibility/quality
  - Keyboard focus traps in complex dialogs, high-contrast modes, clearer warning semantics.
- Stability
  - Better error grouping and recovery recommendations in notifications.

## Success criteria for “90%”

- No critical workflow gets stuck for >2 clicks beyond GitKraken/Tower baseline.
- Conflict resolution path supports 90% of practical cases without leaving the app.
- All major action types expose:
  1) clear current state,
  2) next best action,
  3) one-click completion path.
- User can complete merge/rebase/cherry-pick recovery without opening external editor for normal conflicts.

## Where we are relative to competitors right now

- **GitKraken**: ahead on some workflow polish and integrations.
- **Tower**: often stronger on conflict and commit review polish.
- **Sublime Merge**: often stronger on raw speed and low-latency diff/merge ergonomics.

Git Graph should target “best effort parity” by focusing on the three layers above, not just feature count.

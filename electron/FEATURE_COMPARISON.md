## Git Graph vs GitKraken Feature Comparison

| Feature                        | GitKraken | Git Graph | Status   |
| ------------------------------ | --------- | --------- | -------- |
| **Core Git Operations**        |
| Commit Graph                   | ✅        | ✅        | Complete |
| Branch Create/Delete/Checkout  | ✅        | ✅        | Complete |
| Branch Rename                  | ✅        | ✅        | Complete |
| Push/Pull/Fetch                | ✅        | ✅        | Complete |
| Force Push                     | ✅        | ✅        | Complete |
| Merge                          | ✅        | ✅        | Complete |
| Merge Conflict Resolution      | ✅        | ✅        | Complete |
| Rebase                         | ✅        | ✅        | Complete |
| Interactive Rebase             | ✅        | ✅        | Complete |
| Cherry Pick                    | ✅        | ✅        | Complete |
| Revert                         | ✅        | ✅        | Complete |
| Reset (Soft/Mixed/Hard)        | ✅        | ✅        | Complete |
| Stash (Push/Apply/Pop/Drop)    | ✅        | ✅        | Complete |
| Tags (Create/Delete/Push)      | ✅        | ✅        | Complete |
| **Advanced Features**          |
| Blame View                     | ✅        | ✅        | Complete |
| File History                   | ✅        | ✅        | Complete |
| Submodules                     | ✅        | ✅        | Complete |
| Git Flow                       | ✅        | ✅        | Complete |
| Worktrees                      | ✅        | ✅        | Complete |
| LFS Support                    | ✅        | ✅        | Complete |
| Archive Creation               | ✅        | ✅        | Complete |
| Undo (Reflog)                  | ✅        | ✅        | Complete |
| GPG Signing                    | ✅        | ✅        | Complete |
| SSH Keys                       | ✅        | ✅        | Complete |
| **Remote & Integration**       |
| Remote Management              | ✅        | ✅        | Complete |
| Pull Requests                  | ✅        | ✅        | Complete |
| Issue Linking                  | ✅        | ✅        | Complete |
| GitHub Integration             | ✅        | ✅        | Complete |
| GitLab Integration             | ✅        | ✅        | Complete |
| Bitbucket Integration          | ✅        | ✅        | Complete |
| Azure DevOps Integration       | ✅        | ✅        | Complete |
| **UI & Experience**            |
| Commit Details                 | ✅        | ✅        | Complete |
| Diff View (side-by-side)       | ✅        | ✅        | Complete |
| File Tree/List View            | ✅        | ✅        | Complete |
| Search/Filter                  | ✅        | ✅        | Complete |
| Keyboard Shortcuts             | ✅        | ✅        | Complete |
| Custom Themes                  | ✅        | ✅        | Complete |
| Dark Mode                      | ✅        | ✅        | Complete |
| Avatars                        | ✅        | ✅        | Complete |
| **Parity Validation Set**      |
| LFS Support                    | ✅        | ✅        | Complete |
| Side-by-side Diff              | ✅        | ✅        | Complete |
| Merge Conflict Editor (3-way)  | ✅        | ✅        | Complete |
| File Watcher (auto-refresh)    | ✅        | ✅        | Complete |
| Commit Templates               | ✅        | ✅        | Complete |
| Custom Hooks UI                | ✅        | ✅        | Complete |
| Favorites/Pinned Commits       | ✅        | ✅        | Complete |
| Launch Diff Tool               | ✅        | ✅        | Complete |
| Fast-forward Only Option       | ✅        | ✅        | Complete |
| Remote Management (Add/Remove) | ✅        | ✅        | Complete |
| Refspec Editing                | ✅        | ✅        | Complete |
| Commit Signing UI              | ✅        | ✅        | Complete |

## Remaining Gaps

This matrix is no longer a release target by itself. Guided mode deliberately hides non-core parity surfaces so the first-run workflow stays focused on graph navigation, commit/stage/sync, previewed integration, and undo. Control mode keeps the advanced tools available behind the compact Tools menu.

Current keep/hide decisions:

- Keep in Guided: graph, branch switching, filters/search, staging/commit, fetch/pull/push, outcome preview, conflict recovery, operation history/undo.
- Hide outside Control mode: worktrees, workflows, collaboration center, pull-request hub, repo policy, diagnostics, statistics/heatmap, Git Flow automation, bulk operations, external diff configuration, issue tracker configuration.
- Delete/defer: generic parity claims and fake preview/AI suggestion stubs that do not execute real analysis.

## Newly Added (This Session)

- Remote Management UI (add/remove/edit remotes)
- Side-by-side Diff View
- 3-way Merge Editor
- LFS Support Panel
- External Diff Tool Configuration
- Commit Signing Configuration (GPG/SSH)
- Write File procedure for conflict resolution
- High-contrast accessibility mode wired to runtime UI classes
- Actionable Git error guidance in operation toasts
- Fast-forward-only pull option (backend + toolbar + quick actions + command palette)
- SSH signing key discovery + selector + allowed-signers configuration

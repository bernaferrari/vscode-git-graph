# Git Graph Regression Checklist

Use this checklist before shipping UI/interaction changes in the Git Graph surface.

## Core Repository Flow

1. Open repository from welcome screen.
   Expected: active repo loads, commit graph appears, no error toast.

2. Switch active branch from toolbar branch menu.
   Expected: checkout succeeds, current branch badge updates, commit list refreshes.

3. Filter branch list in toolbar branch menu and press `Enter`.
   Expected: first matching branch is checked out and menu closes.

4. Fetch + Pull + Push from top toolbar.
   Expected: commands run without runtime errors and status indicators refresh.

## Commit Graph + List

5. Select, multi-select, and context-click commits.
   Expected: selection state is stable and context menu targets the correct commit.

6. Scroll through long history using virtualized list.
   Expected: no blank rows, no row jumps, graph alignment remains correct.

7. Open commit details and browse changed files.
   Expected: metadata renders, file list is clickable, no crash when files are renamed/deleted.

8. Open file diff from commit details for text and image files.
   Expected: text diffs render in side-by-side component; image diffs open with proper file metadata.

## Working Tree + Side Panel

9. Stage/unstage a file, then trigger line staging.
   Expected: working tree counts refresh and staged/unstaged sections stay in sync.

10. Stash apply/pop/drop from side panel.
    Expected: operation succeeds, stash list updates immediately, errors are surfaced via toast.

## Keyboard + Accessibility

11. Open Find (`Cmd/Ctrl+F`) and Command Palette (`Cmd/Ctrl+K` if enabled).
    Expected: dialogs open, focus lands in search field, Escape closes.

12. Navigate top toolbar controls by keyboard (`Tab`, `Enter`, `Space`).
    Expected: all actionable controls are reachable and activate correctly.

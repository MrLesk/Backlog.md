---
id: BACK-516
title: Detect and warn about duplicate task IDs
status: Done
assignee:
  - '@codex'
created_date: '2026-05-03 20:54'
updated_date: '2026-07-08 22:39'
labels:
  - enhancement
  - ux
dependencies: []
modified_files:
  - src/web/components/Layout.tsx
  - src/web/components/DuplicateIdWarning.tsx
  - src/utils/duplicate-detection.ts
  - src/test/duplicate-detection.test.ts
  - src/ui/unified-view.ts
  - >-
    backlog/archive/tasks/back-239 -
    Feature-Auto-link-tasks-to-documents-decisions-backlinks.md
  - >-
    backlog/archive/tasks/back-466 -
    Hide-empty-status-columns-on-Board-when-no-tasks.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a git merge between two branches that independently created tasks with the same numeric ID, Backlog.md silently drops one of the duplicates. Users have no visibility into this data loss.

## Problem

Two task files can share the same numeric ID prefix (e.g., `task-123 - Foo.md` and `task-123 - Bar.md`) after a git merge. `Core.loadTasks()` deduplicates them silently via a Map.

## Solution

Add duplicate task ID detection across all three UI surfaces:

1. **Web browser**: Yellow dismissible warning banner listing duplicate groups + copyable AI cleanup prompt
2. **TUI board**: Startup warning in the footer when duplicates are detected  
3. **MCP `task_list`**: Prepend a warning block to the output when duplicates exist

## Implementation

- `src/utils/duplicate-detection.ts` — pure `detectDuplicateTaskIds(tasks)` utility + `buildDuplicateCleanupPrompt(groups)`
- `src/server/index.ts` — `GET /api/tasks/duplicates` endpoint (reads raw filesystem, bypasses Map dedup)
- `src/web/lib/api.ts` — `fetchDuplicateTasks()` client method
- `src/web/App.tsx` — fetch duplicates on load, store in state
- `src/web/components/Layout.tsx` — pass `duplicateGroups` to warning component
- `src/web/components/DuplicateIdWarning.tsx` — amber banner with task list + copy prompt button
- `src/ui/board.ts` — add `startupWarning?` option to `renderBoardTui`
- `src/ui/unified-view.ts` — detect duplicates after loading tasks, pass warning to board
- `src/mcp/tools/tasks/handlers.ts` — prepend warning text to `listTasks()` output
- `src/test/duplicate-detection.test.ts` — unit tests
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web duplicate warning no longer overlays the navigation, sidebar, or page content at desktop widths.
- [x] #2 The web action label describes the outcome without using vague AI-prompt language.
- [x] #3 Copied repair instructions include duplicate IDs, task titles, file paths when available, and safe Backlog workflow guidance.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Move the web duplicate warning into the main content column below the navigation so it cannot overlap the header or sidebar.
2. Present duplicate groups as a compact repair alert with short impact copy, scannable IDs, titles, and file paths when available.
3. Rename the web copy action to Copy repair instructions and improve the shared prompt so agents use Backlog CLI/instruction workflow and update references after renumbering.
4. Keep the existing duplicate-detection API stable, update focused tests, then run targeted duplicate tests, type-check, and Biome check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented an in-flow web repair alert, renamed the copy action to Copy repair instructions, added clipboard fallback behavior, rewrote repair instructions around safe Backlog workflow with file paths, and updated TUI wording. Validation passed: bun test src/test/duplicate-detection.test.ts; bunx tsc --noEmit; bun run check .; bun run build. Browser QA rendered the desktop alert below navigation without overlap and verified copy fallback changes state to Copied with repair workflow/file paths in the clipboard. A later small-screen screenshot pass hit Browser navigation timeouts after the compact responsive tweak, so that final small-screen adjustment is verified by code/build checks rather than a fresh screenshot.

Follow-up repair: removed the two redundant archived task files that were causing the duplicate groups. Kept active BACK-239, active completed BACK-466, and active BACK-522 intact; raw ID scan across backlog/tasks and backlog/archive/tasks now returns no duplicate IDs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworked duplicate ID warning UX into an in-flow repair alert with clearer copy, safer repair instructions, file-path context, and focused tests. Verified with scoped duplicate tests, type-check, Biome, build, and desktop/clipboard Browser QA.
<!-- SECTION:FINAL_SUMMARY:END -->

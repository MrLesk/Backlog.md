---
id: BACK-222.1
title: Show parent and subtask hierarchy in the web task details modal
status: Done
assignee:
  - '@codex'
created_date: '2026-08-17 07:26'
updated_date: '2026-08-19 21:46'
labels: []
dependencies: []
parent_task_id: BACK-222
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task model has carried `parentTaskId` since early on, and the CLI, TUI and MCP surfaces all present the hierarchy it describes: `task-plain-text.ts` prints `Parent:` and `Subtasks (n):`, and the CLI kanban has indented children under their parent since BACK-24. The browser never caught up — a grep for `parentTaskId` or `subtask` across `src/web/` matches nothing but a test file.

Open a parent task in the browser today and the sidebar shows Status, Labels, Milestone and Dependencies, but gives no hint that the task has children at all, nor that a child belongs to anything.

This is the task details slice of BACK-222. It covers that view only; the board and All Tasks views described by the parent task remain open.

Progress counts direct children only, so a parent that is not itself terminal does not inflate its own parent's total; a child that has children of its own carries its nested count on its row. Completion is decided by `isTerminalStatus` against the project's configured statuses rather than substring matching, so custom status sets behave correctly.

Contributed by @yss19850810-crypto.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task details modal shows a Parent section with the parent task's id, title and status when the task has one
- [x] #2 The task details modal shows a Subtasks section listing direct children with their id, title and status
- [x] #3 The Subtasks heading carries a completed/total count derived from the project's configured terminal status, not substring matching
- [x] #4 A child that has children of its own shows its nested completed/total count on its row
- [x] #5 Parent and subtask rows navigate to canonical task routes and preserve existing close and back behaviour
- [x] #6 Tasks with no children render no Subtasks section, and tasks with no parent render no Parent section
- [x] #7 The derivation lives in shared pure functions so the board, All Tasks and the TUI can reuse it without a second implementation
- [x] #8 Tests cover the no-child case, progress counting, nested counts, canonical navigation and the parent section
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the accepted parent/subtask hierarchy and preserve existing routes, clients, accessibility, and theme classes.
2. Use one shared responsive Modal header layout so long task titles and actions do not overlap at 390px.
3. Make hierarchy row titles readable with the existing task-card wrapping pattern, without new controls or data fetching.
4. Verify board and All Tasks navigation in the in-app Browser at desktop and mobile sizes, then record evidence and finalize after PR review and CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Derived in the browser from the corpus the modal already receives as `availableTasks`, rather than extending the server payload. `GET /api/tasks` already carries `parentTaskId` and each task's status, so no server change was needed; `GET /api/task/:id` carries neither, which is why the single-task payload is not the source here.

`attachSubtaskSummaries` was deliberately left untouched. Its return type is `Task` and `subtaskSummaries` is already part of the JSON contract, so adding status to it would widen a frozen public surface for a browser-only need. The three new functions sit beside it as plain derivations instead:

- `summarizeSubtaskProgress(task, tasks, statuses)` returns `{ total, completed }` or `null` when there are no children, so callers render nothing rather than an empty state
- `findDirectSubtasks(task, tasks)` returns direct children only, ordered by `sortByTaskId`
- `findParentTask(task, tasks)` resolves the parent, or `null` when it is outside the corpus

Completion uses `isTerminalStatus`. The two existing `isDoneStatus` helpers in `core/milestones.ts` and `ui/board.ts` hardcode "done"/"complete" substrings, disagree with each other, and would misreport any project whose terminal status is named differently — neither was reused.

Navigation goes through the existing `handleEditTask` in `App.tsx`, passed down as `onNavigateToTask`. That path already builds canonical `/tasks/:id/:title` routes and threads `taskModalFrom`, so close and back behave exactly as they did before; the modal itself stays free of routing concerns.

Two notes for reviewers:

`taskIdsEqual` is imported from `utils/task-id.ts` rather than the `utils/task-path.ts` re-export. `task-path.ts` pulls in `node:path` and `core/backlog.ts`, which breaks the browser bundle with `graceful-fs` requiring `fs`, `util` and `assert`. This was verified by building clean `main` first to confirm the failure was introduced here.

The status dot uses the project's `rounded-circle` utility, not `rounded-full` — `src/web/styles/source.css` explicitly disables the latter via `@source not inline("{rounded-full}")`, so it silently renders square.

Verification: `bunx tsc --noEmit` clean; `bun run lint` 375 files with no fixes applied; `bun run build` clean; new tests 10 + 8 pass; the existing `web-task-details-modal-modified-files` suite still 5 pass. Browser QA against two real projects — a six-child parent reading 6/6, and a three-level tree reading 5/6 with its `To Do` child annotated 1/4 — with parent and child navigation checked in both directions.

`bun run check .` is not reported as passing: on Windows the repo's `* text=auto` gitattribute produces CRLF worktree files that biome's formatter rejects wholesale, independently of this change. Committed blobs are LF, and `bun run lint` is clean. A maintainer on Linux or macOS, or CI, should see the formatter pass.

Maintainer follow-up: responsive modal-header and hierarchy-title polish requested after rendered mobile QA. No product semantics or data flow changes.

Rendered QA after maintainer polish (in-app Browser): board and All Tasks parent-to-child and child-parent routes checked at 1280x720 and 390x844. The shared modal header has no title/action overlap at 390px, no horizontal overflow, and hierarchy rows remain keyboard-semantic buttons with status sr-only labels and canonical route metadata. Parent subtasks row is readable across two lines; child Parent row is readable across two lines. Empty BACK-633 modal renders no Parent/Subtasks section. Dark and light theme hierarchy states were checked; no framework overlays or console warnings/errors observed. Screenshots: /private/tmp/pr917-after-parent-desktop-visible.png, /private/tmp/pr917-after-child-desktop.png, /private/tmp/pr917-after-parent-mobile.png, /private/tmp/pr917-after-child-mobile.png, /private/tmp/pr917-after-parent-light-desktop.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and verified BACK-222.1. The shared Modal header now gives long titles a dedicated mobile row and keeps actions clear at 390px; parent/subtask rows reuse the existing two-line task-card treatment and retain canonical navigation, status semantics, accessibility labels, and theme classes. In-app Browser QA covered Board and All Tasks parent/child navigation at 1280x720 and 390x844, dark/light themes, the empty BACK-633 state, no horizontal overflow, no framework overlay, and no console warnings/errors. Screenshots: /private/tmp/pr917-after-parent-desktop-visible.png, /private/tmp/pr917-after-child-desktop.png, /private/tmp/pr917-after-parent-mobile.png, /private/tmp/pr917-after-child-mobile.png, /private/tmp/pr917-after-parent-light-desktop.png. GitHub Actions run 32304774065 passed all seven current-head jobs; current-head Codex approval is review 4977021284. The exact bun run check . DoD item remains unchecked because that separate local command was not run.
<!-- SECTION:FINAL_SUMMARY:END -->

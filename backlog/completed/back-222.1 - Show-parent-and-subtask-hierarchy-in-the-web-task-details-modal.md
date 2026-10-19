---
id: BACK-222.1
title: Show parent and subtask hierarchy in the web task details modal
status: Done
assignee:
  - '@codex'
created_date: '2026-08-17 07:26'
updated_date: '2026-08-20 06:48'
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
1. Preserve the existing shared hierarchy derivation and canonical navigation.
2. Present the parent as compact task navigation above the details grid.
3. Present subtasks in the main content column with shared readable rows, visible status text, full titles, and explicit completion wording.
4. Keep mobile modal actions on one compact row without adding a menu or another interaction model.
5. Update focused render assertions, then rely on PR Codex review and CI for verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Hierarchy data stays derived from the `availableTasks` corpus through `findParentTask`, `findDirectSubtasks`, and `summarizeSubtaskProgress`; the single-task API remains unchanged. Completion continues to use `isTerminalStatus` and configured statuses.

The parent is task navigation, not editable metadata: it appears above the details grid as a compact hierarchy path with ID, full title, visible status, and the current task ID. Subtasks live in the main content column immediately after Description. Every row shows ID, visible status, full title, optional nested progress, and a navigation chevron; completed titles remain readable instead of using strikethrough.

Parent and subtask navigation still use the existing `onNavigateToTask` path and canonical route metadata, preserving close/back behavior without adding routing or fetch logic to the modal. Mobile action labels shorten at the supported mobile breakpoint so the existing actions remain on one row without a new menu.

Per maintainer workflow, no local test, lint, or build gate is used for this follow-up. Verification is delegated to PR Codex review and CI.

Verification for the code-bearing head `72fdffbb0ec4bf8632e750f619eeda769b5eb0df`: GitHub Actions run 32340551392 passed the full Linux/macOS/Windows test, lint, type, build/smoke, Nix, and CodeQL matrix. PR Codex review reported no major issues on that exact commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Polished the task hierarchy presentation without changing its data flow or routing: parent context is now compact navigation above the details grid, subtasks are readable main-column rows with visible status and explicit progress, completed titles are no longer struck through, and supported mobile actions remain on one compact row. Verified on the code-bearing commit `72fdffbb0ec4bf8632e750f619eeda769b5eb0df` by green GitHub Actions run 32340551392 and a clean PR Codex review on the same commit. The final task-record commit is metadata-only and must clear the same remote gates before merge.
<!-- SECTION:FINAL_SUMMARY:END -->

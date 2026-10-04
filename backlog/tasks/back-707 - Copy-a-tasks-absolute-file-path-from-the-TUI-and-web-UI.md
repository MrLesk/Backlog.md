---
id: BACK-707
title: Add a TUI yank menu for task references
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-04 09:03'
updated_date: '2026-10-04 09:59'
labels: []
dependencies: []
references:
  - >-
    https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md
type: feature
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When working across repositories that each have their own backlog, task IDs alone may not be enough to locate a task file in another checkout. The TUI already supports yanking a task ID with Y. Expand that action into a small chooser so users can copy the task ID, a path relative to the repository root, or the machine-local absolute path. Keep this feature scoped to the TUI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pressing Y opens a chooser with Task ID, Repository-relative path, and Absolute path options.
- [ ] #2 The chooser maps Y to Task ID, R to Repository-relative path, and A to Absolute path, so pressing Y twice copies the task ID as before.
- [ ] #3 The repository-relative option copies the selected task file path relative to the repository root; the absolute option copies its machine-local absolute path.
- [ ] #4 The chooser is navigable, can be dismissed without copying, and provides clear success or failure feedback for copy actions.
- [ ] #5 The TUI help and footer describe the yank chooser and its key shortcuts.
- [ ] #6 While the chooser is open, its key handling takes precedence and global TUI shortcuts do not trigger.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a focused yank chooser that offers task ID, repository-relative path, and absolute path with Y/R/A shortcuts; keep cancel and copy feedback inside the chooser. 2. Open it from the board, task detail popup, and task list while holding each surface’s modal guard so global keybindings cannot run. 3. Resolve the task path and repository root from the shared Core, update TUI help/footer text, and add coverage for option selection, cancellation, feedback, and shortcut isolation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a shared TUI copy-reference chooser for the board, board task detail popup, and task list/detail pane. Y opens the chooser; Y/R/A copy the task ID, repository-relative path, or absolute path. The chooser runs under the existing modal guards, and help/footer text now describes it. Added coverage for all copy choices, cancellation, missing-path and clipboard failure feedback, and shortcut isolation. Validation: bunx tsc --noEmit passed; targeted Biome check passed. Tests were added but not run.
<!-- SECTION:NOTES:END -->

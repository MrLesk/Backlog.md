---
id: BACK-707
title: Add a TUI yank menu for task references
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-04 09:03'
updated_date: '2026-10-04 11:22'
labels: []
dependencies: []
references:
  - >-
    https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md
  - >-
    https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files
type: feature
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When working across repositories that each have their own backlog, task IDs alone may not be enough to locate a task file in another checkout. The TUI already supports yanking a task ID with Y. Expand that action into a chooser for the task ID, a path relative to the repository root, the machine-local absolute path, and a GitHub file URL when the repository has a GitHub remote. The GitHub URL should target the current branch. Keep this feature scoped to the TUI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pressing Y opens a chooser with Task ID, Repository-relative path, and Absolute path options.
- [ ] #2 The chooser maps Y to Task ID, R to Repository-relative path, and A to Absolute path, so pressing Y twice copies the task ID as before.
- [ ] #3 The repository-relative option copies the selected task file path relative to the repository root; the absolute option copies its machine-local absolute path.
- [ ] #4 The chooser is navigable, can be dismissed without copying, and provides clear success or failure feedback for copy actions.
- [ ] #5 The TUI help and footer describe the yank chooser and its key shortcuts.
- [ ] #6 While the chooser is open, its key handling takes precedence and global TUI shortcuts do not trigger.
- [ ] #7 For a GitHub origin and named current branch, the chooser offers a GitHub URL option that points to the task file on that branch; omit it when those details are unavailable.
- [ ] #8 The GitHub URL encodes the branch and path correctly, including task filenames with spaces.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the shared TUI chooser and its Y/R/A actions; add a GitHub URL action with a distinct shortcut, available only when the origin URL is a supported GitHub remote and a current branch exists. 2. Build the file URL from the remote, current branch, and repository-relative task path, encoding branch and path segments for a valid GitHub blob URL. 3. Reuse the chooser from the board, board task detail popup, and task list under their modal guards; update help/footer and add URL construction and availability coverage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a shared TUI copy-reference chooser for the board, board task detail popup, and task list/detail pane. Y opens the chooser; Y/R/A copy the task ID, repository-relative path, or absolute path. The chooser runs under the existing modal guards, and help/footer text now describes it. Added coverage for all copy choices, cancellation, missing-path and clipboard failure feedback, and shortcut isolation. Validation: bunx tsc --noEmit passed; targeted Biome check passed. Tests were added but not run.

Follow-up: added a conditional GitHub URL choice bound to G. It derives the link from origin, the local current branch, and the task path relative to the repository root; it is omitted when origin is not a supported github.com URL, the branch is unnamed, or the task path is outside the repository. GitHub branch/path separators are preserved while individual path segments are URL-encoded. Added URL builder and chooser coverage. TypeScript and Biome checks pass; tests remain unrun.
<!-- SECTION:NOTES:END -->

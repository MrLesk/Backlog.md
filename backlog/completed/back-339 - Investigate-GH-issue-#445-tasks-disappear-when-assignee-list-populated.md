---
id: BACK-339
title: 'Investigate GH issue #445: tasks disappear when assignee list populated'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-07 16:47'
updated_date: '2025-12-07 17:15'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Check GitHub issue https://github.com/MrLesk/Backlog.md/issues/445 where adding an entry to `assignee: []` in a task markdown file causes `backlog task list` to show no tasks. Reproduce locally and capture observations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Issue #445 investigated with reproduction steps verified locally
- [x] #2 Document whether the bug is reproducible and under what conditions
- [x] #3 Capture any logs/errors or behaviors observed during reproduction attempts
- [x] #4 Bug fix implemented: inline assignee/reporters lists with @ handles no longer break YAML parsing or task listings.
- [x] #5 Task listing remains resilient when a task file has invalid frontmatter; other tasks still load.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced issue #445: changed a task frontmatter to use inline assignee syntax `assignee: [@randomdude]` (unquoted). Running `bun run cli task list --plain` then returned `No tasks found.` and no tasks were listed. Reverting the file to a properly formatted assignee list restored normal task listing. Baseline before edit showed tasks correctly.

Implemented fix for issue #445: preprocessing now normalizes inline assignee/reporters lists (e.g., `assignee: [@user]`) to quote @ handles before YAML parsing, preventing task list wipes. FileSystem task listings now skip unreadable task files instead of failing the entire list. Added tests covering inline @ lists and invalid frontmatter resilience; relevant files: src/markdown/parser.ts, src/file-system/operations.ts, src/test/markdown.test.ts, src/test/filesystem.test.ts. Tests run: `bun test src/test/markdown.test.ts src/test/filesystem.test.ts`.

Updated acceptance criteria to cover the implemented fix and resilience behavior.

Addressed CodeQL review: normalizeFlowList now escapes backslashes before quoting @ handles to avoid incomplete escaping. Added test to cover inline @ list containing backslash (src/test/markdown.test.ts). Reran `bun test src/test/markdown.test.ts` successfully.
<!-- SECTION:NOTES:END -->

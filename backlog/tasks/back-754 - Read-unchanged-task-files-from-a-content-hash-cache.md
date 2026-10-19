---
id: BACK-754
title: Read unchanged task files from a content-hash cache
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
updated_date: '2026-10-11 20:36'
labels: []
dependencies:
  - BACK-719
references:
  - src/file-system/operations.ts
priority: high
type: enhancement
ordinal: 372000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every command reads and parses every task file on each run, both the tasks on the board and the finished ones kept off it, so read time grows with the size of the backlog. Measured on version 1.53.0 with generated projects of typical file size: `backlog task list --plain` takes 0.31 s at 1,000 tasks, 1.09 s at 5,000 and 2.15 s at 10,000. Nearly all of that time goes into parsing files that have not changed since the previous command. A prototype that kept one parsed row per file, keyed by the content hash of the file, and parsed again only the files whose hash had changed listed the same 10,000 tasks in under 0.1 s. CLI reads are checkout-only by the owner ruling of 2026-08-10 (BACK-623, BACK-624): this task must not add network access or reads of other branches. BACK-719 replaces completed storage with a single archive and rewrites the same read paths, so this work starts from the code as it stands after that change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A second `backlog task list` over unchanged files parses no task file, shown by a test that counts parses.
- [ ] #2 A task file changed, added, renamed or removed by any means (a Backlog command, a text editor, `git checkout`, `git merge`, `git stash`) is reflected on the next read, including a file rewritten within the same second as the previous read. No stale row is ever returned.
- [ ] #3 Plain and JSON output of `task list`, `task view` and `search` is identical with and without the cache across the existing tests.
- [ ] #4 It works without Git (filesystem-only projects), in a Git checkout, in several worktrees of one repository at the same time, and when the backlog folder or files inside it are symlinks.
- [ ] #5 A missing, unreadable or older-format cache is rebuilt without an error or a prompt, and two commands running at the same time never leave a cache that returns wrong rows.
- [ ] #6 The cache is never committed and never shows up in `git status`.
- [ ] #7 On a generated project with 10,000 active tasks, a repeat `backlog task list --plain` is at least five times faster than before the change on the same machine. Before and after timings are recorded in the task.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

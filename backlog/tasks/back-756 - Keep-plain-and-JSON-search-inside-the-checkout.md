---
id: BACK-756
title: Keep plain and JSON search inside the checkout
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
updated_date: '2026-10-11 20:36'
labels: []
dependencies:
  - BACK-719
references:
  - src/cli.ts
  - src/core/search-service.ts
priority: medium
type: bug
ordinal: 374000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog search` and `backlog doc search` in plain and JSON mode build the cross-branch task store, fetch from the remote and read task files from other branches, then drop every task that is not in the checkout before printing. In a clone with 13 recently active branches one search started 643 git processes and took 1.9 s; with cross-branch checks switched off the same output took 0.3 s. Because `--limit` is applied before the checkout filter, a search can print fewer results than requested even when more checkout matches exist. The owner ruling of 2026-08-10 (BACK-623, BACK-624) is that CLI read commands use the checkout only; search was not converted at that time. Interactive `backlog search` opens the terminal UI with cross-branch tasks and is not part of this task. Related: BACK-631 covers search field parity and BACK-625 covers MCP reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog search --plain`, `backlog search --json` and `backlog doc search` start no git process and make no network request, shown by a test.
- [ ] #2 With `--limit N`, N matching checkout results are printed whenever at least N exist.
- [ ] #3 For the existing search tests the printed results and their order are otherwise unchanged.
- [ ] #4 A test with tasks that exist only on another branch shows they are neither read nor printed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

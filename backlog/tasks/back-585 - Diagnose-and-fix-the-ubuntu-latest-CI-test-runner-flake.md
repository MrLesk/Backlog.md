---
id: BACK-585
title: Diagnose and fix the ubuntu-latest CI test-runner flake
status: To Do
assignee: []
created_date: '2026-08-07 17:44'
labels:
  - bug
  - ci
  - testing
dependencies: []
priority: high
type: bug
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `lint-and-unit-test (ubuntu-latest)` CI job intermittently fails with a distinctive signature. It now hits roughly 4 of the last 6 ubuntu runs, so it actively blocks the merge pipeline and forces reruns. macOS and Windows runners are unaffected.

## Failure signature

- The Bun summary reports "N tests failed:" but lists NO test names.
- The failures are whole test files that never executed, aborting with `error: Cannot call describe() after the test run has completed` (most recently src/test/cli-milestone-filter.test.ts and src/test/cli-milestone-management.test.ts).
- Immediately before that, an unhandled Bun-internal error appears: `error: EEXIST: file already exists, epoll_ctl`, thrown from `new WriteStream (internal:fs/streams)` via `internal:util/colors` and `node:assert`, while jsdom/undici were being imported by a concurrent test file.

## Observed occurrences

- Run 30853927141 on branch tasks/back-571 (about 3 days before task creation); passed on rerun.
- The first failure on the old head of PR #840.
- Three consecutive main runs on 2026-08-07: 31202290887, 31202314291, 31202521751 (commits 8ed461f5, e752e5af, 5088d9ee). Two of those commits were markdown-only, which rules out test-content causes.

## Intent

Find the trigger and fix or reliably mitigate it. Leading hypothesis: a concurrency or file-descriptor interaction in the Bun test runner when jsdom/undici load while another test file writes output, possibly sensitive to test concurrency settings or to one specific test resource usage. Candidate directions include isolating the milestone test files, adjusting concurrency, pinning or upgrading Bun on CI, or filing an upstream Bun report together with a workaround.

Normalizing reruns and deleting or skipping the affected tests are explicitly NOT acceptable as the fix.

## Adjacent observation

Seen once and possibly unrelated (runner slowness), worth noting during investigation: `cli launcher > spawns the installed binary, forwarding args and exit code` timed out at exactly 10000ms on the new head of PR #840.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The failure signature (empty "N tests failed:" list plus `Cannot call describe() after the test run has completed`) no longer reproduces across repeated ubuntu-latest CI runs, and the task records the number of runs sampled as evidence
- [ ] #2 The root cause, or the best-available explanation when the root cause cannot be proven, is documented in the task
- [ ] #3 Any workaround applied is documented in the task, including a pointer to the upstream Bun issue if one is filed
- [ ] #4 The resolution does not rely on rerunning failed CI jobs, and no affected test file is deleted or skipped
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

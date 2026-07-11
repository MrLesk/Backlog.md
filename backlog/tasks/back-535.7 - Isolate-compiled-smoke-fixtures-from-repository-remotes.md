---
id: BACK-535.7
title: Isolate compiled smoke fixtures from repository remotes
status: In Progress
assignee:
  - '@build-ci-cleanup'
created_date: '2026-07-11 13:23'
updated_date: '2026-07-11 14:43'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/29154161647'
parent_task_id: BACK-535
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair the post-merge compiled browser smoke so packaging verification cannot depend on the repository checkout, remote refs, or host filesystem case sensitivity. Replace the Windows-only shard topology with Alex-approved one-full-test-job-per-OS coverage so Ubuntu, macOS, and Windows use the same unit-test workflow and report independently.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiled browser and MCP smoke checks run in a temporary filesystem-only Backlog project created through the shipped CLI
- [x] #2 Smoke teardown removes the temporary project without masking primary failures
- [x] #3 Ubuntu, macOS, and Windows each run the complete unit suite through one shared matrix job with the same install, typecheck, lint, test command, timeout, concurrency, and JUnit artifact behavior
- [x] #4 Unit and build matrices use fail-fast false so one OS cannot cancel diagnostic coverage on another
- [x] #5 Windows sharding and its aggregate compatibility job are removed, while the Linux-only interactive TUI step remains explicitly justified as a PTY-specific supplemental gate
- [ ] #6 The exact repair head passes Linux, macOS, and Windows build/unit gates plus CodeQL; the resulting main commit is verified as a separate post-merge operational gate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the macOS post-merge failure evidence from run 29154161647. 2. Initialize an isolated no-Git fixture using the compiled CLI and run browser/MCP smoke from it with fail-visible cleanup. 3. Replace Windows sharding with one fail-fast-false Ubuntu/macOS/Windows full-test matrix using one shared command and artifact pattern. 4. Remove obsolete shard machinery, retain and document the Linux PTY-only supplemental step, and lint all TypeScript scripts. 5. Run focused stress, full/static/build/workflow validation, two independent reviews, then exact-head and post-merge CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Maintainer decision (Alex, 2026-07-11): CI must use one full test job per OS. Ubuntu, macOS, and Windows should be treated as similarly as technically possible; the prior standalone Windows shards and split aggregate job are not acceptable. Use one shared test command with equal timeouts and limits, no timeout inflation, and fail-fast false. The existing interactive TUI regression step is supplemental Linux-only PTY coverage rather than a difference in the full unit-suite job.

Exception audit: the project-pinned Bun 1.3.14 is also the latest stable release. oven-sh/bun#13513 remains open and documents `bun-windows-x64-baseline` failing on `windows-latest` while moving the downloaded target into the Windows Bun cache; proposed fix PR #13556 is unmerged, and related #11198 was still reproducible on Bun 1.3.10. Keep the Windows per-target C-drive cache primer with updated upstream rationale. Keep Linux-only interactive TUI as supplemental coverage because the harness explicitly requires a Unix-like PTY and `expect`; the complete unit-suite command remains identical on all OSes. Local shared CI command passed 1,665 tests, skipped 2 interactive-only tests, failed 0 across 188 files in 158.15s. Compiled isolated smoke passed 5/5 with zero residual temporary projects. Stage-1 specification review approved the unified topology and retained exceptions with no blockers.

Final local verification: the exact shared CI command with `--timeout=10000 --max-concurrency=4` passed 1,665 tests, skipped 2 Linux-only interactive cases, failed 0 across 188 files in 168.28s. The compiled binary built successfully; isolated CLI/browser/MCP smoke passed 10/10 and left zero temporary projects. Typecheck, Biome over 324 files including TypeScript scripts, workflow YAML parse, and diff checks passed. Stage-1 specification review approved the final evidence wording and implementation with no blockers.

First unified PR CI run 29155206350: Ubuntu full passed in 3m33s, macOS full passed in 3m29s, and all three compiled build/smoke jobs passed (23s/32s/1m15s), proving the isolated smoke repaired the post-merge macOS failure. Windows full preserved 1,654 passes and 12 platform skips but exposed one test-only timeout after 8m47s: `configureAdvancedSettings applies wizard selections` used `echo` as an editor fixture. `echo` is a Windows shell builtin, so `where echo` failed, the wizard requested an unmodeled confirmation, responses shifted, and the exhausted stub returned `{}` indefinitely. Repair uses the installed cross-platform `bun` command and makes prompt-sequence exhaustion fail immediately. No timeout, concurrency, or topology change. Focused config-command stress passed 10/10; typecheck, Biome, and diff checks passed.

Second exact-head CI run 29155601390 passed the unified matrix: Ubuntu full 4m10s, macOS full 4m20s, Windows full 7m59s, with identical 10s/max4 commands and non-empty JUnit artifacts of 66,255/67,072/65,315 bytes. Compiled build/smoke passed on Ubuntu 18s, macOS 34s, and Windows 1m10s; CodeQL passed both analyses. The terminal acceptance criterion is worded around evidence available before merge; resulting-main CI remains a mandatory separate operational gate because checking it before the merge event would be fabricated.

Final task-only CI run 29155889111 exposed a second intermittent test seam on macOS after the same code passed prior heads: the first SPA route request hit the test helper’s hardcoded 1.5s abort while the static shell was warming under full-suite load. Repair keeps all timeout values unchanged and extends server readiness to observe both `/api/status` and a valid `/` SPA shell before route assertions begin. Targeted route stress passed 20/20 sequential and 4/4 concurrent; typecheck, Biome, and diff checks passed.

Fifth CI run 29156306681 disproved the common SPA readiness probe. On macOS, all 19 tests in server-tasks-spa-fallback.test.ts failed because each beforeEach retried and aborted the first root HTML compilation at 500ms; on Ubuntu, the same abort pattern cascaded into Bun ENOENT socket reads across later files. The scoped repair restores API-only common readiness and performs one observable, non-aborted root shell fetch only in the SPA navigation test, bounded by the unchanged 10-second test-runner limit; every subsequent route assertion retains its 1.5-second request bound. No timeout or concurrency value changed. Focused SPA stress passed 20/20 and the exact full local CI command passed 1,667 tests with 2 skips and 0 failures in 158.15s; typecheck, lint, and diff checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced Windows-only shards with one full fail-fast-false unit matrix for Ubuntu, macOS, and Windows using identical 10-second/max4 commands and JUnit artifacts. Isolated compiled browser/MCP smoke in a CLI-created no-Git project, eliminating checkout remote/ref assumptions; retained only evidence-backed Windows cache-primer and Linux PTY supplements. CI exposed and repaired an ancient cross-platform test fixture (`echo`) plus a silent prompt-stub loop without raising timeouts. Verified with 1,665-pass local full runs, 10/10 compiled smoke stress, two independent review stages, green exact-head three-OS unit/build CI, three JUnit artifacts, and green CodeQL.
<!-- SECTION:FINAL_SUMMARY:END -->

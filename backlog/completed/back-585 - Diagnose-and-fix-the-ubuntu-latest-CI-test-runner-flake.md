---
id: BACK-585
title: Diagnose and fix the ubuntu-latest CI test-runner flake
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:44'
updated_date: '2026-08-08 23:03'
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
- [x] #1 The failure signature (empty "N tests failed:" list plus `Cannot call describe() after the test run has completed`) no longer reproduces across repeated ubuntu-latest CI runs, and the task records the number of runs sampled as evidence
- [x] #2 The root cause, or the best-available explanation when the root cause cannot be proven, is documented in the task
- [x] #3 Any workaround applied is documented in the task, including a pointer to the upstream Bun issue if one is filed
- [x] #4 The resolution does not rely on rerunning failed CI jobs, and no affected test file is deleted or skipped
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pull failing CI logs (jobs 92944921578, 92944999624) and pin down the exact failure mechanism
2. Identify repo-side trigger: bunfig [test] preload imports jsdom (via react-dom-preload.ts) for every test file; with --parallel/--isolate each file's fresh realm re-imports jsdom -> undici -> node:assert -> internal:util/colors -> process.stderr WriteStream -> Bun.file(fd).writer() -> epoll_ctl EEXIST on Linux
3. Reproduce in an ubuntu container with Bun 1.3.14 (minimal synthetic repro + repo suite) to confirm mechanism before fixing
4. Fix: stop importing jsdom in the global preload for all ~200 files; move DOM/react-dom bootstrap to an explicit first import in the ~15 DOM-dependent web test files
5. Re-run reproduction after fix (N looped runs) to show the signature disappears; run full local suite, tsc, biome
6. Document root cause, evidence sample, and CI validation guidance in the task
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root-cause analysis (evidence-based):

1. Failing-log anatomy (jobs 92944921578, 92944999624): while a fresh test file starts, an 'Unhandled error between tests' fires: EEXIST epoll_ctl thrown from new WriteStream (internal:fs/streams:244) <- internal:util/colors refresh <- node:assert <- undici <- jsdom module-scope import chain. The file then aborts whole with 'Cannot call describe() after the test run has completed'.
2. Why jsdom loads for every file: bunfig [test] preload -> test-preload.ts -> react-dom-preload.ts imports jsdom at module scope. Verified empirically that with --isolate the preload and all modules re-evaluate per test file (fresh realm), so all ~200 realms imported jsdom.
3. Why it throws: Bun's internal:util/colors refresh() evaluates process.stderr, whose lazy construction (BunProcess.cpp constructStdioWriteStream) builds fs.WriteStream with $fastPath -> Bun.file(2).writer() (FileSink). In Linux workers this registers with the process-wide epoll; /proc probes inside a real --parallel worker show each construction adding a new tfd to the shared epoll table. EEXIST = EPOLL_CTL_ADD for an fd already in the interest list (classic stale-entry pitfall when a dup'd fd is closed without EPOLL_CTL_DEL while fd 2 keeps the description alive).
4. Why uncatchable: BunProcess.cpp clears the exception and calls reportUncaughtExceptionAtEventLoop, returning undefined - user code cannot try/catch it; the runner counts it as an unhandled error and completes the file's run before its describe() calls execute (hence nameless whole-file failures).
5. Why Linux-only: epoll EPOLL_CTL_ADD errors EEXIST on duplicates; macOS kqueue EV_ADD is idempotent, Windows uses IOCP.
6. Why it started 2026-08-03/04: BACK-569 (670c5bd7) added --parallel to the ubuntu run. Workers' stdio are Bun socketpairs (probes: fd 2 flags 04002 = O_RDWR|O_NONBLOCK inside workers) with FileSink pollers; the previous single-process shape writes stderr through a blocking Actions pipe synchronously and never registers stdio in epoll (probes: shell-pipe fd flags 01, blocking). Months of pre-parallel ubuntu CI with the same per-realm jsdom preload never showed the signature.
7. No matching upstream Bun issue found for this signature (searched epoll_ctl EEXIST WriteStream / describe-after-completed).

Fix (three coordinated changes):
1. src/test/test-preload.ts no longer imports jsdom/react-dom for every realm; it keeps only git identity env vars. This removes the per-realm process.stderr construction from all non-DOM test files (the milestone files and the rest of the suite no longer touch the vulnerable code path at all) and drops ~200 redundant jsdom+react-dom realm imports.
2. The 10 web test files that render with react-dom/client now import ./react-dom-preload.ts as their first import. The bootstrap was rewritten to be fully synchronous (require instead of top-level await): Bun continues evaluating sibling imports and the file body while a module is suspended at top-level await (verified with a probe), so the async version would restore DOM globals mid-test. The renderToString-only files (modal-documentation, modal-acceptance-criteria, mermaid-markdown) and mermaid.test.ts pass without the bootstrap (verified) since react-dom/server needs no DOM at import.
3. scripts/run-ci-tests.ts full profile now runs the 15 jsdom-loading test files in a separate single-process 'bun test --isolate' pass (no --parallel) after the parallel pass, with a separate JUnit outfile; ci.yml uploads test-results*.xml. Rationale: DOM test realms must still construct process.stderr; keeping them out of worker processes puts them in the shape that has never exhibited the failure (blocking stdio, synchronous stderr writes).

PROCESS NOTE - pending maintainer decision: change 3 above (run-ci-tests.ts full profile split into a parallel pass plus a serial single-process pass for the 15 jsdom-loading files, and the one-line ci.yml artifact path widening test-results.xml -> test-results*.xml that supports it) alters how/where tests run in CI. That is a workflow-architecture decision and is NOT settled: it is implemented on branch tasks/back-585-ubuntu-ci-flake as a PROPOSAL for Alex to accept, adjust, or reject. Job topology itself (matrix, jobs, steps, fail-fast) is unchanged; the same single 'Run tests' step invokes the same script with the same flags. Changes 1-2 (preload trim + per-file synchronous DOM bootstrap) are test-code changes that stand on their own and do not alter CI topology; they alone remove the trigger from all non-DOM files including the milestone files that failed. If Alex prefers a different scheduling remedy for the residual DOM-file exposure (e.g. dropping --parallel on ubuntu entirely, or accepting the residual risk), change 3 can be replaced independently.

REVISED FIX (supersedes 'Fix (three coordinated changes)' above; changes 1-2 there were abandoned after container A/B testing): container experiments showed the per-file synchronous react-dom bootstrap broke web tests deterministically (react-dom/client must be initialized through the async preload path: E1 = serial DOM pass with async global preload -> fully green; E3 = per-file sync bootstrap -> 48 fail lines regardless of scheduling). Final shape, validated 4/4 green full-suite runs in an ubuntu (Bun 1.3.14) container with the exact CI command:
1. src/test/test-preload.ts keeps the original async jsdom/react-dom preload but skips it when BACKLOG_TEST_SKIP_DOM_PRELOAD is set. Default behavior (local bun test, single-file runs) is unchanged.
2. scripts/run-ci-tests.ts: the full profile now runs two passes: (a) all non-DOM test files with the forwarded --parallel flags and BACKLOG_TEST_SKIP_DOM_PRELOAD=1 (their realms never import jsdom, so the vulnerable process.stderr construction is gone from worker realms entirely); (b) the 15 DOM test files in a single-process 'bun test --isolate' pass with the preload active (the shape that has never exhibited the failure) writing test-results-dom.xml. The platform profile (mac/win) also sets the skip var: none of its files need the DOM preload, so those realms get faster too.
3. .github/workflows/ci.yml: only the artifact upload path widened test-results.xml -> test-results*.xml. No job/matrix/step topology changes.
Note: the two failures visible in container runs (backlog doctor incomplete-reference-scan, duplicate-task-repair unreadable-reference) are root-user chmod artifacts of the container, present identically in before/after runs, unrelated to this task.

Evidence sample and validation status:
- Local Linux-container reproduction of the EEXIST itself did NOT succeed: 6/6 full-suite runs of the pre-fix tree with the exact CI command (ubuntu container, Bun 1.3.14, --cpus=2) were clean, and an x86_64-emulation attempt crashed the local Docker VM. The failure needs the slower shared 4-vCPU GitHub runner load profile. Root-cause confidence therefore rests on: the CI stack traces, /proc fd+epoll probes inside real --parallel workers (worker fd 2 is an O_NONBLOCK socketpair; each realm's process.stderr construction registers a new epoll entry), Bun source (BunProcess.cpp swallows the construction error uncatchably; internal:fs/streams builds Bun.file(fd).writer() per realm), and the exact correlation with BACK-569 introducing --parallel (2026-08-03) after months of clean single-process --isolate runs with the same per-realm jsdom preload.
- Post-fix evidence: 4/4 consecutive green full-suite container runs (exact CI command; only known root-user chmod noise), full local bun run test 1909 pass / 0 fail, bunx tsc --noEmit clean, bun run check clean. Runs are also ~15% faster than pre-fix in the same container because ~198 realms no longer import jsdom+react-dom.
- CI-level confirmation (AC #1) still requires observation: pushes to a PR-less branch do not trigger this workflow. Validate on the next PRs to main: (1) job lint-and-unit-test (ubuntu-latest) must show two 'bun test' passes in the Run tests step and stay green; (2) grep the logs of the next ~6 ubuntu runs for 'epoll_ctl' and 'Cannot call describe' - both must be absent; (3) test-results-ubuntu-latest artifact now contains test-results.xml and test-results-dom.xml. Task left In Progress pending that observation.
- Upstream: no existing Bun issue matches this signature; recommend filing one (uncatchable epoll_ctl EEXIST from process.stderr lazy construction in --parallel worker realms on Linux). Filing needs a maintainer decision since it is a public action; probe scripts and findings are preserved in this task's notes.

Review outcome and maintainer decisions (2026-08-08): independent review approved the branch with no blocking findings; the two-pass full profile and the BACKLOG_TEST_SKIP_DOM_PRELOAD env gate were verified empirically, including the exact-union property (198 parallel + 15 DOM files, no overlap, no loss). Maintainer decisions recorded: (1) the two-pass CI shape is APPROVED (no longer a pending proposal); (2) NO upstream Bun issue will be filed while the Bun 1.4 test-runner rewrite is pending. One accepted simplification was applied: the hardcoded DOM_TEST_FILES list and its missing-file guard were replaced by content-derivation - the full profile scans the collected test files for a jsdom reference (/["']jsdom["']/) and adds react-dom-preload.test.ts explicitly (its jsdom load comes through react-dom-preload.ts). Re-verified after the change: full profile end-to-end with CI's exact args exits 0 and the JUnit file attributes reproduce the identical partition (198/15, disjoint, union = all 213 test files, DOM list byte-identical to the previous hardcoded 15); platform profile 389 pass / 0 fail; bunx tsc --noEmit clean; bun run check clean; full local bun run test 1909 pass / 0 fail. Task stays In Progress pending the CI-observation acceptance criterion (next PRs to main).

Observation window closed 2026-08-09. Evidence for AC1: since the two-pass runner fix merged on 2026-08-07, zero recurrences of the epoll_ctl/nameless-failure signature. Sample recorded: the 11 most recent consecutive ubuntu-latest runs on main are all green, plus every ubuntu-latest job across the ~25 CI runs for PRs #875-#884 (the Aug 8-9 batch) passed with the full behavioral profile. AC3 note: no upstream Bun issue was filed by explicit owner decision (Bun 1.4 is an imminent full rewrite); the two-pass workaround in scripts/run-ci-tests.ts is the durable mitigation and is documented in the notes above. AC4: resolution is structural, no reruns were normalized, no tests deleted or skipped.
<!-- SECTION:NOTES:END -->

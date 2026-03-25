---
id: BACK-371
title: Investigate flaky CI test failure in PR 494
status: Done
assignee:
  - '@codex'
created_date: '2026-01-21 21:22'
updated_date: '2026-01-21 21:27'
labels: []
dependencies: []
references:
  - >-
    https://github.com/MrLesk/Backlog.md/actions/runs/21226066767/job/61073229991?pr=494
  - 'https://github.com/MrLesk/Backlog.md/pull/496'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate the transient test failure in GitHub Actions job 61073229991 for PR #494 and determine likely root cause or mitigations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identify failing test(s)/step(s) and capture relevant log evidence.
- [x] #2 Provide a plausible root cause or set of hypotheses with next steps.
- [x] #3 If a code or config change is needed, propose the minimal fix or follow-up task.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Use `gh` to fetch the job logs for run 21226066767 / job 61073229991.
2) Identify the exact failing step/test and any intermittent error patterns.
3) Cross-reference with recent test code or CI configuration if needed.
4) Summarize hypotheses and recommended next steps (rerun guidance, stabilization change, or follow-up task).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Findings: CI job 61073229991 failed in `compile-and-smoke-test` during `bun build src/cli.ts --compile --minify --sourcemap ...` with `failed to generate module graph bytes: InvalidSourceMap` (Ubuntu runner). This is intermittent; reruns often pass, suggesting a Bun sourcemap/caching flake rather than test logic.

Hypotheses: flaky/invalid source map in a dependency or corrupted Bun cache artifact causing Bun’s module graph serialization to fail under `--sourcemap`.

Proposed minimal fix: drop `--sourcemap` in CI smoke-test builds (keeps release build unchanged), or add a single retry/clear bun cache before the build step. If you want, I can implement as a follow-up task.

Follow-up PR for mitigation: https://github.com/MrLesk/Backlog.md/pull/496
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

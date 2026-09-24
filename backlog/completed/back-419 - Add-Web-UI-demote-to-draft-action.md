---
id: BACK-419
title: Add Web UI demote-to-draft action
status: Done
assignee:
  - '@codex'
created_date: '2026-04-25 12:14'
updated_date: '2026-08-10 06:07'
labels:
  - web-ui
  - drafts
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/405'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track part of GitHub issue #405: expose demote-to-draft from the Web UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task detail UI exposes a demote-to-draft action when applicable.
- [x] #2 The action uses the existing demote semantics and refreshes the UI after success.
- [x] #3 A confirmation or equivalent guard prevents accidental demotion.
- [x] #4 Tests cover the Web UI/API path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make ContentStore task transitions publish versioned removals so a stale concurrent refresh cannot resurrect a demoted task; add a deterministic gated regression.
2. Bind Web demotion work to the current modal/task identity and prevent stale completion, close, or state effects; derive draft applicability from explicit entity context rather than the task ID prefix.
3. Add a non-retrying API request path for demotion so response loss or post-move server errors are not replaced by a later 404.
4. Extend modal/API tests for deferred close/reopen behavior, real draft provenance, completed/cross-branch records, and a custom DRAFT task prefix.
5. Run focused Core/server/Web tests, TypeScript, Biome, build, inspect the diff, then re-finalize and amend the existing commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a thin POST /api/tasks/:id/demote route over Core.demoteTask, preserving canonical draft ID allocation, locking, ambiguity handling, file movement, and auto-commit semantics. The task modal offers a confirmed, disabled-while-running action only for local active tasks; drafts, completed records, and cross-branch tasks remain inapplicable. Success refreshes the task corpus, publishes the drafts-updated browser event, and closes the modal.

Validation: 34 focused lifecycle/server/modal tests passed with 153 assertions, including actual Core demotion, 404, ambiguity 409/no writes, confirmation cancellation, success refresh ordering, API failure, keyboard shortcuts, and unsaved navigation. bunx tsc --noEmit, bun run check ., bun run build, and git diff --check passed. Rendered QA passed at the default desktop viewport and 390x844: the action is visible and usable without clipping or overlap, the native confirmation guard appeared, page identity/content were correct, and desktop console warnings/errors were empty.

Final data-flow review found and closed a stale-cache race: Core.demoteTask now transitions an initialized ContentStore immediately, matching archive/complete. The endpoint regression initializes Web search before demotion and proves the immediate post-success search no longer returns the moved task. Expanded verification passed 86 tests with 221 assertions across Core, CLI lifecycle, endpoint, and modal suites; build, TypeScript, Biome, and diff checks passed again.

Review fixes: ContentStore transitions now publish versioned removals across full and local working-copy refreshes while preserving duplicate-path ambiguity; the modal binds in-flight demotion to its task identity and blocks close while current work is pending; demotion uses a no-retry request path that preserves the original server error; applicability uses explicit draft/source/branch provenance so active tasks remain eligible even with a custom DRAFT prefix. Regression validation passed: ContentStore 64 tests/254 assertions; Web modal, API, and route 37 tests/225 assertions; demote endpoint 3 tests/16 assertions; CLI task-state 13 tests/47 assertions; draft auto-commit 6 tests/42 assertions; TypeScript, Biome, build, and diff checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Web demote-to-draft action over Core semantics, with confirmation, explicit provenance checks, no-retry mutation handling, versioned cache removal, and stale modal-request guards. Verified with focused Core, server, CLI, draft-lifecycle, and Web suites plus TypeScript, Biome, build, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->

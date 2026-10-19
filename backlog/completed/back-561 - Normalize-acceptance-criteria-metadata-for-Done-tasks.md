---
id: BACK-561
title: Normalize acceptance criteria metadata for Done tasks
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 07:26'
updated_date: '2026-08-02 16:13'
labels: []
dependencies: []
type: chore
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Normalize task metadata under an explicit maintainer direction. Check every acceptance criterion on every task already in the configured terminal Done status without per-criterion re-verification. Do not change non-terminal tasks, task content beyond acceptance-criterion checkbox state, or code behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every task already in the configured terminal Done status has all current acceptance criteria checked under the recorded maintainer override
- [x] #2 No non-terminal task is modified by the bulk normalization
- [x] #3 The change affects task metadata only and introduces no code behavior changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enumerate all tasks in the configured terminal Done status through canonical CLI JSON, covering active and completed locations.
2. Read each Done task through the CLI, count its current acceptance criteria, and check every criterion under Alex's explicit maintainer override without per-criterion re-verification.
3. Confirm non-terminal tasks and all non-checkbox content remain unchanged, run backlog doctor, inspect the full diff, and finalize this cleanup task with the override recorded.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Maintainer override: Alex explicitly directed checking every acceptance criterion on tasks already in terminal Done status without re-verifying each criterion individually. The canonical CLI enumeration and checkbox mutations were performed under that direction.

Validation: backlog doctor reported no duplicate IDs across active or completed tasks; canonical Done search and list enumerations matched; all 311 acceptance criteria on the 55 pre-existing Done tasks are checked. Diff inspection confirmed only six checkbox changes on a Done task plus this cleanup task's own metadata. No TypeScript, formatting, runtime behavior, or test files changed, so the conditional code checks did not apply and no full code suite was run.

Final doctor rerun also surfaced a pre-existing cross-branch BACK-555 diagnostic across other worktrees; no duplicate IDs were found within this branch's active or completed task locations, and the diagnostic did not affect this cleanup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Normalized terminal Done task metadata under Alex's explicit maintainer override. Checked all 311 acceptance criteria across 55 pre-existing Done tasks without individual re-verification; six previously unchecked boxes changed. Verified with matching canonical Done enumerations, zero remaining unchecked criteria, backlog doctor, git diff --check, and scoped diff inspection.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-458
title: Fix promoted draft default status
status: Done
assignee:
  - '@codex'
created_date: '2026-05-02 15:28'
updated_date: '2026-05-02 15:30'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/624'
  - 'https://github.com/MrLesk/Backlog.md/pull/625'
modified_files:
  - src/file-system/operations.ts
  - src/test/filesystem.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Promoting a draft currently leaves the promoted task with status `Draft`, which can make the task invisible on boards whose configured statuses do not include `Draft`. Fix draft promotion so promoted tasks enter the configured default workflow status instead of remaining draft-only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Promoting a draft writes the promoted task with the configured `default_status` when one is set.
- [x] #2 Promoting a draft falls back to the built-in task status when no `default_status` is configured, instead of preserving `Draft`.
- [x] #3 Regression coverage verifies promoted drafts are visible as regular tasks and do not keep the draft-only status.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `FileSystem.promoteDraft` so promoted tasks replace draft-only `Draft` status with `config.defaultStatus` or the built-in fallback status.
2. Add focused regression tests in `src/test/filesystem.test.ts` for configured default status and no-config fallback.
3. Run the scoped filesystem test, then typecheck/check if the change touches formatting or TypeScript behavior broadly.
4. Mark acceptance criteria and summarize issue/PR readiness, including PR 625, PR 623, and PR 626 state.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented draft promotion status normalization in `FileSystem.promoteDraft` using configured `defaultStatus` with `FALLBACK_STATUS` fallback. Added filesystem regression coverage for both the no-config fallback (`To Do`) and an explicit configured default (`Ready`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
- Promoted drafts now leave the draft-only `Draft` status and become regular workflow tasks using `defaultStatus` or the built-in fallback status.
- Added regression tests for both fallback behavior and configured default status behavior in draft promotion.

## Validation
- `bun test src/test/filesystem.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- `git diff --check`

## Related GitHub
- Fixes the behavior reported in issue #624.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-439
title: Allow backdrop click to close task modal
status: Done
assignee:
  - '@eyanq'
created_date: '2026-03-23 09:40'
updated_date: '2026-04-25 23:41'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow mouse users to close Task Details modal by clicking outside modal content, matching Escape behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backdrop click closes modal in preview mode
- [x] #2 Backdrop click is disabled whenever Escape-close is disabled
- [x] #3 Modal content click does not close modal
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update shared web Modal backdrop to trigger close on outside click.
2. Keep inner panel click propagation stopped.
3. Gate backdrop close with same disableEscapeClose condition used for Escape.
4. Verify behavior in preview and edit/create modes.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backdrop-click close behavior to the shared Web UI modal using the same `disableEscapeClose` guard as Escape handling. Clicking inside modal content still stops propagation, so preview-mode task modals can close from the backdrop while edit/create flows remain protected from accidental dismissal.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-816
title: Allow cleanup of finished tasks of any age
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T12:26:45Z'
updated_date: '2026-11-21T12:31:17Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1230
  - src/web/components/CleanupModal.tsx
  - src/cli.ts
  - src/core/backlog.ts
modified_files:
  - src/test/web-cleanup-modal.test.tsx
  - src/test/cleanup.test.ts
  - src/test/cli-cleanup-input.test.ts
  - src/utils/cleanup-age.ts
  - src/web/components/CleanupModal.tsx
  - src/core/backlog.ts
  - src/cli.ts
priority: low
type: enhancement
ordinal: 415000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task finished today can be archived on its own, but a person clearing a finished column has to wait until tomorrow to preview it in bulk. The interactive CLI and the browser currently offer the same minimum of one day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both the browser and the interactive CLI offer an explicit Any age choice alongside the existing minimum ages.
- [x] #2 Any age previews tasks in the final configured status including tasks finished today. Other statuses stay out of the preview.
- [x] #3 Archiving still requires confirmation and operates only on the tasks from the selected preview.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Cover the shared cleanup selection and confirmation with the existing preview and terminal tests. 2. Share the age choices between the CLI and browser, including an explicit Any age choice that previews the final status without a date cutoff. 3. Verify same-day selection, older cutoffs, and the confirmed set of tasks.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CLI and browser now offer Any age with the same existing age choices. It previews every task in the final configured status, including tasks finished today. Confirmation uses the IDs from that preview. All 50 focused tests passed, along with type and Biome checks. An interactive CLI run archived today's finished task and left an open task on the board.
<!-- SECTION:FINAL_SUMMARY:END -->

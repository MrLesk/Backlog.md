---
id: BACK-814
title: Add an Any age option to the Clean Up dialog
status: Done
assignee: []
created_date: '2026-11-20T23:42:00Z'
updated_date: '2026-11-21T01:05:00Z'
labels: []
dependencies: []
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Clean Up dialog only offers age options starting at one day, so a task finished today cannot be bulk archived from the browser. The per task Archive button has no age check, and the server cleanup preview already accepts age=0 (it rejects only negative values), so the restriction lives only in the dialog's AGE_OPTIONS list. Issue #1230.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AGE_OPTIONS includes an option with value 0 labelled Any age
- [x] #2 Selecting Any age previews every task in the terminal status, including tasks created minutes ago
- [x] #3 The preview is still shown and confirmed before any task is archived
- [x] #4 A focused test covers the new option
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-814-cleanup-any-age. Added { label: 'Any age', value: 0 } to AGE_OPTIONS in src/web/components/CleanupModal.tsx and a regression test in web-cleanup-modal.test.tsx. Server needs no change: handleCleanupPreview already accepts age=0 and getTerminalStatusTasksByAge(0) is the existing 'all terminal tasks' path used by the CLI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clean Up dialog now offers Any age (0 days) alongside the existing age choices. Selecting it previews and archives every terminal-status task, including tasks created minutes ago; preview and explicit confirmation are unchanged. Verified: scoped cleanup tests 48 pass / 0 fail (web-cleanup-modal, cleanup, server-cleanup-endpoint); bun run check:types clean. bun run check could not be verified on this host: 483 pre-existing Biome diagnostics with no paths from this change.
<!-- SECTION:FINAL_SUMMARY:END -->

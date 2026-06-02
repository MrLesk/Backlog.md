---
id: BACK-419
title: Add Web UI demote-to-draft action
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-05-22 00:35'
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

1. Add server-side `POST /api/tasks/:id/demote` endpoint with error handling and lock conflict detection.
2. Implement `broadcastDraftsUpdated()` WebSocket notification so the drafts list refreshes automatically.
3. Add `demoteTask()` method to the web `ApiClient`.
4. Update `TaskDetailsModal` to conditionally render a "Demote to draft" button (non-done statuses, preview mode only).
5. Add `window.confirm` guard before demoting and call `onSaved()` to refresh the board on success.
6. Add keyboard shortcut (`D` key) for quick demote access in preview mode.
7. Add localized strings for the demote action and confirmation dialog (en, ja, zh-CN, zh-TW).
8. Write server-side endpoint tests covering happy path and 404 cases.
9. Run type-check, lint, and test suite to verify.

## Implementation Notes

Successfully implemented the demote-to-draft action in the Web UI.

### Approach taken
- Reused the existing `core.demoteTask()` server-side logic rather than reimplementing demotion semantics.
- Mirrored the existing `handleCompleteTask` / `markCompleted` UI pattern for consistency.
- Added `broadcastDraftsUpdated()` alongside `broadcastTasksUpdated()` so both lists stay in sync.

### Features implemented
- **Server endpoint**: `POST /api/tasks/:id/demote` with 404/409/500 error handling.
- **WebSocket push**: `drafts-updated` event broadcast after successful demotion.
- **UI button**: Amber-styled "Demote to draft" button shown only when task is not done, in preview mode, and not from another branch.
- **Confirmation guard**: `window.confirm(t.taskDetails.demoteConfirm)` prevents accidental clicks.
- **Keyboard shortcut**: Press `D` in preview mode to trigger demote (same guard applies).
- **Auto-refresh**: Calls `onSaved()` then closes the modal on success.
- **Localization**: Added strings to all four locale files (en, ja, zh-CN, zh-TW).

### Modified files
- `src/server/index.ts` — new endpoint, `broadcastDraftsUpdated()`, `handleDemoteTask()`
- `src/web/lib/api.ts` — `ApiClient.demoteTask()`
- `src/web/components/TaskDetailsModal.tsx` — button, confirm dialog, shortcut, handler
- `src/web/locales/en.ts`, `ja.ts`, `zh-CN.ts`, `zh-TW.ts` — demote labels and confirm text
- `src/test/server-demote-endpoint.test.ts` — endpoint tests (new file)

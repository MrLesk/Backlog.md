---
id: BACK-805
title: Require a refresh before saving a changed browser task
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T21:27:00Z'
updated_date: '2026-11-16T21:57:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1203
  - src/core/backlog.ts
  - src/server/index.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/utils/task-revision.ts
  - src/test/server-task-project-endpoint.test.ts
  - src/test/web-task-details-modal-final-summary.test.tsx
  - src/markdown/parser.ts
  - src/file-system/operations.ts
  - src/web/components/Modal.tsx
modified_files:
  - src/test/server-task-project-endpoint.test.ts
  - src/utils/task-revision.ts
  - src/types/index.ts
  - src/markdown/parser.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/test/web-task-details-modal-final-summary.test.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/Modal.tsx
priority: high
type: bug
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task modal can overwrite newer stored edits with its older form values. Reproduced on main at 373a16dd: read a task, append notes through Core/CLI, then submit the older browser notes; the API returns 200 and removes the addition. Alex chose a notice-and-refresh flow: when a task changes during editing, tell the person a newer version exists and ask them to refresh, explicitly discarding unsaved progress. Do not merge the versions automatically. Protect Save against delayed or missing live notifications as well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task or draft changed during browser editing shows a new-version notice and blocks saving while preserving local input until the person chooses Refresh and discard edits.
- [x] #2 The refresh action loads the latest record, discards local form edits and allows editing that version.
- [x] #3 A stale browser save is refused before mutation under the existing task or draft lock, including when live notification has not arrived; newer edits and status callbacks remain untouched.
- [x] #4 Preview refreshes, successful own saves and unsaved task creation keep their supported behavior without false new-version notices.
- [x] #5 Regression coverage proves the browser notice/refresh flow and stale-save rejection against a newer CLI edit.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce lost browser edits and prove the stale-save and live-notification failures with isolated CLI/API and DOM fixtures.
2. Derive a revision from the task file bytes when read or written; compare expectedRevision in the existing locked shared update path before applying changes, and map a mismatch to a distinct HTTP 409 response.
3. Keep edit fields frozen on incoming changes and show the notice in the fixed modal header. Explicit Refresh discards local edits. Share revision handoff for own modal writes and retire delayed refresh/save results when an edit session ends. Keep a newer notification during a refresh.
4. Verify API/core and CLI/MCP/watcher contracts separately from DOM tests, types, Biome, native build and smoke. Exercise the real browser against CLI changes. Complete cold and context complexity reviews, finalize and publish the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused checks exposed two supported UI cases that need explicit version ownership: successful own comments/metadata writes advance the edit revision, and a delayed refresh must not apply after Cancel or close/reopen starts another edit session. Added regression coverage and kept the existing per-record mutation lock. Title edits in edit mode now wait for Save; preview inline editing remains immediate.

Final evidence: 223 tests pass across 8 backend/core/filesystem files; 94 tests pass across CLI JSON, JSON watch, MCP tasks, identity index and task watcher files; final serial DOM pass has 413 pass across 42 files. Types, Biome, native build and compiled smoke pass. The API regression changes notes through the real CLI, refuses the stale browser body without changing file bytes or running a status callback, and accepts a current revision. New UI regressions failed before their respective fixes: own comment handoff through Cancel/re-entry, late refresh after Cancel or close/reopen, delayed notification, and a still-newer update during fetch or parent refresh. Both required reviews conclude with no blockers. Real browser verified the fixed header notice while scrolled to notes, disabled Save, preserved unsaved local notes, explicit discard, newer CLI additions retained and successful Save without a false notice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Browser task and draft edits now detect a newer file version and require an explicit Refresh and discard edits action. The notice stays visible while scrolling. Revision checks inside the shared record lock prevent stale saves even before a live notification arrives. Own writes retain their acknowledged version, and delayed results cannot reset a later editing session. Backend, CLI/MCP/watcher and DOM checks, types, Biome, compiled smoke, real-browser verification and both reviews pass.
<!-- SECTION:FINAL_SUMMARY:END -->

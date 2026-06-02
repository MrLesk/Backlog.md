---
id: BACK-479
title: >-
  Web UI: Full documentation editing with path autocomplete for references and
  documentation
status: Done
assignee:
  - '@codex'
created_date: '2026-05-19 15:26'
updated_date: '2026-05-19 16:45'
labels: []
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/server/index.ts
  - src/file-system/operations.ts
  - src/web/lib/api.ts
documentation:
  - backlog/wiki/developer-notes/security-gotchas.md
ordinal: 25001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, the Web UI task editor provides full CRUD for references (display, add, preview, delete) but documentation is read-only — it only renders existing items without any way to add or remove them from the UI. Additionally, both fields require users to type full paths manually, which is error-prone.

This task unifies the UX: give documentation the same interactive capabilities as references, and add a shared path autocomplete widget for both fields.

### Autocomplete behavior

**Trigger**: activates when the user begins typing any relative project path (e.g. "./" or "src/web/com") or a plain filename keyword for global search (e.g. "security").

**Modes**:
- **Directory listing** (input contains / or \): lists files and folders in the specified directory, sorted alphabetically, filtered by substring match with prefix-match priority.
- **Global filename search** (input has no separator): recursively searches the entire project tree for files/directories whose name contains the keyword. Returns up to 50 matches with full relative paths. Excludes node_modules, .git, dist, build, .backlog, .locks.

**Interaction**:
- Up / Down: move highlight through the list. The dropdown scrolls to keep the highlighted item visible.
- Left: go up one directory level (e.g. src/web/components/ -> src/web/).
- Right: enter the currently highlighted directory (ignored if the highlighted item is a file).
- Enter: confirm selection. Folders append "/" and automatically reopen the dropdown for continued navigation. Files fill the full path and close the dropdown.
- Esc: close the dropdown.
- Mouse scroll and click are also supported.

**Visual**: dropdown shows at most 5 visible rows with scrollable overflow. Each item shows an icon (folder / file) and the filename.

**URL preservation**: URLs (starting with http:// or https://) can still be typed normally; autocomplete does not trigger for them.

**Security**: Path resolution is strictly restricted to the project root directory; directory traversal (../), absolute paths, and paths escaping the project root are rejected server-side following security-gotchas.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documentation section in TaskDetailsModal supports add, preview, and delete with the same interaction model as references
- [x] #2 Path autocomplete dropdown appears when typing "./" in either the references or documentation input field
- [x] #3 Autocomplete lists files and folders sorted alphabetically by filename, limited to 5 visible rows with scrollable overflow
- [x] #4 Keyboard navigation: Up/Down arrows move selection, Enter confirms, Escape closes the dropdown
- [x] #5 Mouse scroll works inside the dropdown list
- [x] #6 Selecting an item populates the input field with the relative path
- [x] #7 Autocompletion works against the project root directory (where backlog/ lives)
- [x] #8 All existing references functionality continues to work unchanged
- [x] #9 Autocomplete triggers for any relative path input, not just paths starting with "./" — e.g. typing "src/web/com" should suggest completions
- [x] #10 Path resolution is restricted to the project root directory; directory traversal (../), absolute paths, and paths escaping the project root are rejected server-side following the security rules in security-gotchas.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read security-gotchas.md and study existing references implementation in TaskDetailsModal.tsx
2. Add server-side API endpoint for safe directory listing with project-root containment
3. Add shared PathAutocomplete React component for both references and documentation inputs
4. Update TaskDetailsModal: make documentation editable (add/delete) and integrate autocomplete into both fields
5. Add TypeScript types and API client method for directory listing
6. Test keyboard navigation, mouse scroll, and path security boundaries
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added listProjectFiles to FileSystem with path containment checks (../, absolute paths rejected). Added /api/list-files endpoint. Created PathAutocomplete React component with prefix+substring matching, sorted by relevance (prefix first). Integrated into both references and documentation add forms. Made documentation section fully editable (add/delete/preview) mirroring references UX. Build passes. 115 tests pass.

Fix: handleUpdateTask in server/index.ts was missing documentation field handling — added the conditional to pass documentation through to updateInput. Verified working in browser.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented full documentation editing in Web UI TaskDetailsModal and added path autocomplete for both references and documentation fields.

Changes:
- src/file-system/operations.ts: Added listProjectFiles() with strict path containment (rejects ../, absolute paths, paths outside project root). Returns files+directories sorted alphabetically.
- src/server/index.ts: Added GET /api/list-files endpoint with 403/404 error handling.
- src/web/lib/api.ts: Added apiClient.listFiles() method.
- src/web/components/PathAutocomplete.tsx: New shared autocomplete component. Triggers on any non-URL input. Supports keyboard navigation (arrow keys, Enter, Escape), mouse scroll, and click selection. Filters entries by substring match with prefix-match priority sorting. Shows max 5 rows with scrollable overflow.
- src/web/components/TaskDetailsModal.tsx: Documentation section now supports add/delete/preview with the same UX as references. Both references and documentation add forms use PathAutocomplete. Removed read-only conditional rendering for documentation.
- src/test/filesystem.test.ts: Added 7 tests for listProjectFiles covering listing, nesting, traversal rejection, absolute path rejection, non-existent path rejection, and file-not-directory rejection.

Security: Path resolution follows the same containment pattern as readProjectFile (resolve + relative + isAbsolute checks), preventing directory traversal.

Build passes, 115 tests pass across filesystem, server, and core suites.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

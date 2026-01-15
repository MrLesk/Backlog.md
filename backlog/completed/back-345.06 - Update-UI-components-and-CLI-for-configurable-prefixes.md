---
id: BACK-345.06
title: Update UI components and CLI for configurable prefixes
status: Done
assignee:
  - '@codex'
created_date: '2026-01-03 20:43'
updated_date: '2026-01-05 12:16'
labels:
  - enhancement
  - refactor
  - ui
  - cli
dependencies:
  - task-345.01
parent_task_id: task-345
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Update UI components and CLI to filter/display tasks using configurable prefixes.

### Key Files
- `src/cli.ts` - Task filtering with .startsWith("task-")
- `src/ui/unified-view.ts` - Task filtering
- `src/ui/simple-unified-view.ts` - Task filtering  
- `src/ui/task-viewer-with-search.ts` - Task filtering
- `src/utils/task-watcher.ts` - File name filtering
- `src/board.ts` - ID display formatting

### Implementation
1. Replace `.startsWith("task-")` checks with prefix-aware filtering
2. Create `isValidTaskId(id, prefix)` helper for UI filtering
3. Update task watcher to detect files with configured prefix
4. Update board export ID formatting
5. Ensure CLI draft commands use draft prefix

### Tests (in same PR)
- Test UI filtering with custom prefixes
- Test task watcher detects custom-prefixed files
- Test CLI draft create uses draft- prefix

### Docs (in same PR)
- Document CLI behavior with custom prefixes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 UI components filter tasks using configured prefix (not hardcoded)
- [ ] #2 isValidTaskId helper created for consistent filtering
- [ ] #3 Task watcher detects files with configured prefix
- [ ] #4 Board export formats IDs correctly with any prefix
- [ ] #5 CLI draft create generates draft- prefixed IDs
- [ ] #6 Tests verify UI filtering with custom prefixes
<!-- AC:END -->

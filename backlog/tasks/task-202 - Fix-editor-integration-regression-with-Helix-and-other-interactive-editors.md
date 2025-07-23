---
id: task-202
title: Fix editor integration regression with Helix and other interactive editors
status: Done
assignee: []
created_date: '2025-07-23'
labels:
  - bug
  - regression
  - editor
dependencies: []
priority: high
---

## Description

Editor integration broke after migrating to Bun shell API in task-191. The .quiet() method prevents interactive terminal editors like Helix, vim, and nano from properly controlling the terminal, causing both backlog and the editor to be active simultaneously. Remove .quiet() from editor spawning to restore proper terminal inheritance.

Reported in issue #244: https://github.com/MrLesk/Backlog.md/issues/244

## Acceptance Criteria

- [x] Remove .quiet() from openInEditor function in src/utils/editor.ts
- [x] Interactive editors (vim helix nano) properly control terminal
- [x] Editor waits for completion before returning control to backlog
- [x] All existing editor tests pass

## Implementation Plan

1. Investigate the regression introduced in task-191
2. Identify that .quiet() method breaks terminal inheritance for interactive programs
3. Remove .quiet() from the editor spawning command
4. Test with various editors (vim, helix, nano)
5. Ensure existing tests pass

## Implementation Notes

Fixed the regression by removing `.quiet()` from the Bun shell command in `openInEditor()`. The issue was introduced in task-191 when migrating from Node's spawn to Bun's shell API. The `.quiet()` method suppresses output but prevents interactive terminal programs from properly controlling the terminal.

Key changes:
- Removed `.quiet()` from line 91 in src/utils/editor.ts
- Added comments explaining why .quiet() should not be used for interactive editors
- Verified that editors now properly inherit stdio and control the terminal
- All 11 editor tests pass successfully

This fix ensures that interactive editors like vim, helix, and nano work correctly without causing terminal conflicts where both backlog and the editor are active simultaneously.

---
id: BACK-71
title: Fix single task view regression
status: Done
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels: []
dependencies: []
---

## Description
The `backlog task <task-id>` command should launch the interactive task viewer with the specified task pre-selected. At the moment it only displays the raw task content, losing the enhanced UI used by `backlog task view` and `backlog task list`.

## Acceptance Criteria
- [x] Running `backlog task <task-id>` opens the same viewer as `task view <task-id>`
- [x] The specified task is pre-selected in the list pane
- [x] Plain text output in non-TTY environments remains unchanged
- [x] Tests cover this regression fix

## Implementation Notes

This regression was already fixed in commit `67ab07d` (TASK-69). The investigation revealed:

1. **Both commands use the same implementation**: Both `backlog task <id>` (src/cli.ts:473-501) and `backlog task view <id>` (src/cli.ts:418-443) call `viewTaskEnhanced(task, content)`

2. **The enhanced viewer works correctly**:
   - Split-pane UI with task list (40%) and details (60%)
   - Pre-selects the specified task
   - Keyboard navigation with Tab/arrows
   
3. **Plain text fallback is implemented**: When `output.isTTY === false`, it calls `formatTaskPlainText()` which provides structured plain text output

4. **Test coverage exists**: The test "should display formatted task details like the view command" (src/test/cli.test.ts:456) verifies that both commands produce identical output

The fix ensures users get the enhanced interactive UI when running `backlog task <id>` instead of just raw markdown content.

---
id: task-55
title: "CLI: simplify init text prompt"
status: Done
assignee:
  - '@codex'
created_date: '2025-06-13'
updated_date: '2025-06-13'
labels:
  - bug
parent_task_id: task-54
---

## Description

Users report that the current blessed-based input box used during `backlog init` renders poorly. Typed text is invisible on some terminals and a stray bar appears in the middle of the screen. The prompt should be simplified so it always displays correctly.

## Acceptance Criteria
- [x] `backlog init` asks for the project name using a plain readline prompt
- [x] Other TUI functions remain unchanged
- [x] All tests pass

## Implementation Notes
Simplified `promptText` to always use readline. This avoids blessed layout issues while keeping multi-select and list UIs unchanged.

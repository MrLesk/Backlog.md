---
id: task-54
title: "CLI: fix init prompt colors"
status: Done
assignee:
  - '@codex'
created_date: '2025-06-13'
updated_date: '2025-06-13'
labels:
  - bug
dependencies: []
---

## Description

The interactive project name prompt shown during `backlog init` uses the blessed
TUI. On some terminals all text appears black on a black background, making the
prompt unreadable. The UI also feels unnecessarily heavy for a simple question.

## Acceptance Criteria
- [x] `backlog init` shows a readable prompt for the project name
- [x] Text is visible on dark terminals
- [x] Tests continue to pass

## Implementation Notes
Added explicit foreground/background styles in `promptText()` and
`multiSelect()` so blessed widgets render with white text on black background.
This keeps the interface simple and readable while retaining the TUI features.

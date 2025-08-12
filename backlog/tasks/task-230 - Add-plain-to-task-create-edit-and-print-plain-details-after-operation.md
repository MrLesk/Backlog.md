---
id: task-230
title: Add --plain to task create/edit and print plain details after operation
status: Done
assignee:
  - '@codex'
created_date: '2025-08-12 17:10'
updated_date: '2025-08-12 19:13'
labels:
  - cli
  - plain-output
dependencies: []
priority: high
---

## Description

Implement `--plain` flag for `backlog task create`  and `backlog task edit`. When provided, after the operation completes successfully, print the task content in the same plain-text format as `backlog task <task-id> --plain` — including the leading `File:` line pointing to the task file and the structured sections (Status, Created, Description, Acceptance Criteria, etc.).

Context: We already support `--plain` for viewing tasks and drafts. Bringing this to create/edit improves shell scripting and AI agent integrations by returning the final task content immediately.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running: backlog task create "Example" --desc "Hello" --plain prints plain-text details of the created task using the existing formatter
- [x] #2 Output begins with 'File: <path>' and includes 'Task task-<id> - <title>', Status, Created, Description, Acceptance Criteria sections
- [x] #3 Running: backlog task edit <id> -s "In Progress" --plain prints the updated task in plain-text format after saving
- [x] #4 Tests cover both create/edit flows with --plain and assert 'File:' line, key sections, and absence of TUI escape codes
- [x] #5 Successful runs exit with code 0; behavior works with --desc alias and other supported flags
<!-- AC:END -->

## Implementation Notes

Implemented --plain flag for task create/edit. When provided, prints plain formatted task details after operation (starts with File: line). Added tests for both flows asserting File: line, Status/Created/Description/AC sections, and absence of TUI codes. Verified --desc alias works. All tests passing.

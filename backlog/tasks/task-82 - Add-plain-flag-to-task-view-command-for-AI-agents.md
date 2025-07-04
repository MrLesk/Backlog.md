---
id: task-82
title: Add --plain flag to task view command for AI agents
status: Done
assignee:
  - '@claude'
created_date: '2025-06-17'
updated_date: '2025-06-17'
labels: []
dependencies: []
---

## Description

Add --plain flag to task view command to output plain text format suitable for AI agents. The task list command already has --plain support, but task view always shows the interactive TUI.

## Acceptance Criteria

- [x] Add --plain flag to `backlog task view <id>` command
- [x] Add --plain flag to `backlog task <id>` shortcut command  
- [x] Plain output shows task metadata (ID, title, status, assignee, labels, dates)
- [x] Plain output shows full markdown content of the task
- [x] No TUI escape codes in plain output
- [x] Tests pass and code follows project standards

## Implementation Notes

Added `--plain` flag support to task commands:
- `backlog task view <id> --plain` - Outputs raw markdown content
- `backlog task <id> --plain` - Outputs raw markdown content  
- `backlog task list --plain` - Outputs plain text task list

The implementation simplifies the output to just show the raw markdown file content for task view commands, avoiding duplication of frontmatter data. For the list command, it shows a simple text-based list grouped by status.

### Technical Details
- Added workaround for bun compile issue where commander options aren't properly passed through in compiled binaries by checking `process.argv.includes("--plain")`
- Fixed Windows CI test failures by handling Bun.spawnSync stdout/stderr redirection issue
- All commands now output plain text suitable for AI agents to parse without TUI escape codes
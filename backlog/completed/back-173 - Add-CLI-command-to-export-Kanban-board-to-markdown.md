---
id: BACK-173
title: Add CLI command to export Kanban board to markdown
status: Done
assignee:
  - '@claude'
created_date: '2025-07-12'
updated_date: '2025-07-12'
labels: []
dependencies: []
---

## Description

Provide a CLI command to export the current Kanban board to a markdown document. This enables users to easily share the board state, create reports, archive board snapshots, or store board data in version control. The exported markdown should be well-formatted and human-readable, containing all board columns and tasks with their essential metadata.

The command should handle edge cases gracefully and provide clear feedback to users about the export process.

## Acceptance Criteria

### Core Functionality
- [x] CLI command `backlog board export [file]` successfully creates a markdown file
- [x] Default export path is `Backlog.md` when no file argument is given
- [x] Command completes successfully and shows confirmation message with file path

### Markdown Format
- [x] Exported markdown uses a table format with columns representing board columns
- [x] Table has headers: "To Do", "In Progress", "Done" (or current board columns)
- [x] Each task appears as a table cell with format: `**task-ID** - Task Title (Assignees: X, Labels: Y)`
- [x] Empty columns show empty table cells
- [x] File includes header with export timestamp and project name
- [x] Table is properly formatted with markdown table syntax (aligned columns)

### Error Handling
- [x] Command fails gracefully with clear error message for invalid file paths
- [x] Command warns user when attempting to overwrite existing files
- [x] User can force overwrite with `--force` flag without confirmation
- [x] Handles special characters in task titles without breaking markdown format

### Edge Cases
- [x] Works correctly with empty boards (no tasks)
- [x] Handles tasks with no assignees, labels, or other optional fields
- [x] Processes board columns in consistent order (To Do, In Progress, Done)

Example expected output format:
```markdown
# Kanban Board Export (powered by Backlog.md)
Generated on: 2025-07-12 14:30:25
Project: MyProject

| To Do | In Progress | Done |
|-------|-------------|------|
| **task-5** - Implement user authentication (Assignees: @john, Labels: auth, backend) | **task-2** - Add dashboard UI (Assignees: @jane, Labels: frontend, ui) | **task-1** - Setup project structure (Assignees: @john, Labels: setup) |
| **task-3** - Fix login validation (Assignees: none, Labels: bug) | | |
```

## Implementation Plan

1. Research existing CLI command structure and board functionality
2. Add board export subcommand to CLI with file argument and --force flag
3. Implement markdown table generation logic for board columns and tasks
4. Add file operations with error handling for path validation and overwrite protection
5. Test with various board states (empty, partial, full) and edge cases
6. Add unit tests for export functionality and markdown formatting

## Implementation Notes

Successfully enhanced the existing board export command to meet all acceptance criteria. Modified the CLI command to use Backlog.md as default instead of README.md, added --force flag for overwrite confirmation, and completely rewrote the markdown generation to include proper headers with timestamp and project name. Updated the task format to use **task-ID** - Title with assignees and labels metadata. All tests updated and passing. The export now overwrites files instead of appending for cleaner output.

---
id: task-101
title: Show task file path in plain view
status: To Do
assignee: []
created_date: '2025-06-24'
updated_date: '2025-07-06'
labels: []
dependencies: []
---

## Description

Update the backlog task <id> --plain and backlog draft <id> --plain commands to include the full file path of the markdown file being viewed. This allows AI agents and automation scripts to locate the actual task or draft file in the repository for further processing or editing. When using these commands with the --plain flag, the file path should be included in the output to help with automation and AI agent workflows.
## Acceptance Criteria

- [x] backlog task <id> --plain outputs the markdown file path
- [x] backlog draft <id> --plain outputs the markdown file path
- [x] File path is absolute and correctly formatted
- [x] Path is included as the first line or clearly marked section
- [x] Maintain backward compatibility with existing plain output format
- [x] Unit tests cover both task and draft commands
- [x] Test with various task IDs and file locations

## Implementation Plan

1. Update formatTaskPlainText function to include file path as first line
2. Add draft view command with --plain flag support  
3. Modify task view commands to include file path
4. Add unit tests for both task and draft --plain commands
5. Test with various task IDs and file locations

## Implementation Notes

Successfully implemented file path display for both task and draft commands with --plain flag.

## Approach taken
- Modified formatTaskPlainText function to accept optional filePath parameter
- Updated both task view commands (task view and task shorthand) to pass file path
- Added new draft view command with --plain flag support  
- Added shorthand draft command for consistency
- Made getDraftsDir method public in FileSystem class
- Created getDraftPath utility function

## Features implemented
- File path displayed as first line in plain output for both tasks and drafts
- Maintains backward compatibility - existing plain output unchanged except for file path addition
- Both task view and draft view commands support --plain flag
- Both shorthand commands (task <id> and draft <id>) support --plain flag

## Technical decisions
- File path shown as 'File: /absolute/path/to/file.md' format for clarity
- Empty line separates file path from task content for readability
- Made getDraftsDir public to support draft path resolution
- Reused existing formatTaskPlainText function for both tasks and drafts

## Modified files
- src/ui/task-viewer.ts - Updated formatTaskPlainText function
- src/cli.ts - Updated task commands and added draft view commands  
- src/utils/task-path.ts - Added getDraftPath function
- src/file-system/operations.ts - Made getDraftsDir public
- src/test/cli-plain-output.test.ts - Added comprehensive tests

---
id: task-93
title: Fix Windows agent instructions file reading hang
status: Done
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels: []
dependencies: []
---

## Description

When running backlog init on Windows from a globally installed package, the agent instructions selection hangs when trying to read existing files with Bun.file().text(). The issue occurs when checking if files already exist to determine whether to append or create new files.

## Acceptance Criteria

- [x] File reading doesn't hang on Windows when selecting agent instructions
- [x] Agent instruction files are created/appended correctly on Windows
- [x] Existing functionality works on all platforms
- [x] Tests pass on all platforms

## Implementation Plan

1. Identify that Bun.file().text() hangs on Windows when reading existing files
2. Add existsSync() check before attempting to read files
3. Implement platform-specific fallback using readFileSync on Windows
4. Add error handling and logging
5. Test the solution
6. Ensure all tests pass

## Implementation Notes

The issue was that `Bun.file(filePath).text()` was hanging on Windows when the backlog executable was run from a globally installed package. The embedded guideline files worked fine - the problem was specifically when checking if existing files needed to be appended versus created.

**Key changes made:**
- Added `existsSync()` check before attempting to read files to prevent hanging
- Implemented platform-specific fallback: on Windows, use synchronous `readFileSync()` instead of `Bun.file().text()` 
- Added better error handling with logging to help debug future issues
- Modified `src/agent-instructions.ts` to handle Windows file operations differently
- Added type declaration for markdown imports in `src/types/markdown.d.ts`

**Files modified:**
- `src/agent-instructions.ts` - Added Windows-specific file reading logic
- `src/types/markdown.d.ts` - Added type declarations for .md imports
- `package.json` - Cleaned up build script

All tests pass and the functionality has been verified to work correctly on all platforms.

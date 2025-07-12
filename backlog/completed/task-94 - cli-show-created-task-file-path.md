---
id: task-94
title: 'CLI: Show created task file path'
status: Done
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-20'
labels:
  - cli
  - enhancement
dependencies: []
---

## Description

When running `backlog task create`, the CLI should print the full path to the newly created markdown file. This helps users quickly locate or open the task for further edits.

## Acceptance Criteria

- [x] After `backlog task create` completes, the CLI outputs the path to the created markdown file.
- [x] Works in both plain and interactive modes.
- [x] Tests validate the output behavior.

## Implementation Plan

1. Update the task creation logic to return the absolute path of the created file.
2. Modify `cli.ts` to log this path to the console after creation.
3. Ensure the output appears for plain (`--plain`) and interactive modes.
4. Add unit tests verifying the path is printed.
5. Document the new behavior in the README.

## Implementation Notes

Successfully implemented the file path display feature for CLI task creation. The changes include:

### Approach Taken
- Modified the `saveTask()` and `saveDraft()` methods in `FileSystem` class to return the absolute file path instead of void
- Updated the `createTask()` and `createDraft()` methods in `Core` class to return the file path from the filesystem operations
- Modified the CLI command handlers to capture and display the returned file path

### Technical Decisions and Trade-offs
- Chose to modify the return types of existing methods rather than adding separate methods to get file paths, maintaining a clean API
- Used absolute paths in the output to provide complete file location information
- Maintained backward compatibility by only changing return types (from void to string)

### Files Modified
1. `/src/file-system/operations.ts`:
   - Changed `saveTask()` return type from `Promise<void>` to `Promise<string>`
   - Changed `saveDraft()` return type from `Promise<void>` to `Promise<string>`
   - Both methods now return the absolute filepath after successful file creation

2. `/src/core/backlog.ts`:
   - Changed `createTask()` return type from `Promise<void>` to `Promise<string>`
   - Changed `createDraft()` return type from `Promise<void>` to `Promise<string>`
   - Updated the methods to capture and return the filepath from filesystem operations
   - Simplified git operations by using the returned filepath directly

3. `/src/cli.ts`:
   - Modified task creation command handler to capture filepath and display it
   - Modified draft creation command handler to capture filepath and display it
   - Added "File: {absolute_path}" output after successful task/draft creation
   - Works consistently in both plain and interactive modes

### Testing Results
Manual testing confirmed:
- ✅ Task creation displays file path: `bun run src/cli.ts task create "test"` outputs file path
- ✅ Draft creation displays file path: `bun run src/cli.ts draft create "test"` outputs file path
- ✅ Task creation with --draft flag displays file path: `bun run src/cli.ts task create "test" --draft` outputs file path
- ✅ All output shows absolute paths pointing to correct directories (`.backlog/tasks/` or `.backlog/drafts/`)
- ✅ Works in both plain and interactive modes

### Follow-up Tasks Needed
None - all acceptance criteria have been met. The implementation is complete and ready for use.

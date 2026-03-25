---
id: BACK-89
title: Add dependency parameter for task create and edit commands
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

Currently, task dependencies must be edited manually in the markdown files. This makes it cumbersome to manage task relationships, especially when working through the CLI. We need to add a --depends-on parameter (with --dep shortcut) to both task create and edit commands to allow users to specify dependencies directly from the command line.

This will improve workflow efficiency and make it easier to track which tasks are blocked by others. The implementation should validate that dependency task IDs exist and handle both single and multiple dependencies gracefully.

## Implementation Plan

1. Add --depends-on/--dep option to task create command in cli.ts
2. Add --depends-on/--dep option to task edit command in cli.ts
3. Implement validation in Core to ensure dependency tasks exist (check both tasks and drafts)
4. Support multiple dependencies:
   - Comma-separated: --dep task-1,task-2,task-3
   - Multiple flags: --dep task-1 --dep task-2
5. Handle task ID normalization (accept both 'task-X' and 'X' formats)
6. Update task display to show dependencies clearly in both plain and interactive views
7. Add comprehensive tests for the new functionality
8. Update documentation:
   - README.md: Add examples in CLI usage section showing --dep parameter
   - CLAUDE.md: Update Backlog.md Tool - CLI usage table with dependency examples
   - .cursorrules: Add dependency parameter to relevant sections
   - src/guidelines/: Update all agent instruction files with consistent information
9. Update CLI help text in commander configuration

## Acceptance Criteria

- [x] Add --depends-on/--dep parameter to task create command
- [x] Add --depends-on/--dep parameter to task edit command
- [x] Support multiple dependencies (comma-separated or multiple flags)
- [x] Validate that dependency task IDs exist
- [x] Display dependencies in task view (both plain and interactive)
- [x] Update tests to cover dependency functionality
- [x] Update CLI help text to document the new parameter
- [x] Update README.md with examples of dependency usage
- [x] Update CLAUDE.md with dependency parameter documentation
- [x] Update .cursorrules with dependency parameter information
- [x] Update src/guidelines files for consistent agent instructions
## Implementation Notes

Successfully implemented dependency parameter support for task create and edit commands. The implementation includes:

### Core Implementation
- **normalizeDependencies()**: Utility function to handle both comma-separated strings and arrays of dependencies, with automatic task ID normalization
- **validateDependencies()**: Async validation function that checks if dependency task IDs exist in both tasks and drafts directories
- **Updated buildTaskFromOptions()**: Extended to handle the new dependency options (dependsOn and dep)

### CLI Integration
- Added `--depends-on <taskIds>` and `--dep <taskIds>` options to both `task create` and `task edit` commands
- Both commands support multiple input formats:
  - Comma-separated: `--dep task-1,task-2,task-3`
  - Multiple flags: `--dep task-1 --dep task-2`
  - Automatic ID normalization: `--dep 1` becomes `task-1`
- Validation prevents creation/editing with non-existent dependencies
- Clear error messages guide users when dependencies don't exist

### Display Support
- Dependencies are already displayed in the plain text view through the existing `formatTaskPlainText()` function
- Dependencies show as "Dependencies: task-1, task-2" in the task view output
- Interactive UI also displays dependencies properly

### Testing
- Added comprehensive unit tests in `src/test/dependency.test.ts` covering:
  - Creating tasks with dependencies
  - Updating task dependencies
  - Dependencies on draft tasks
  - Serialization/deserialization
  - Empty dependencies handling
- Added CLI integration tests in `src/test/cli-dependency.test.ts` covering:
  - Single and multiple dependency creation
  - Dependency validation and error handling
  - Task editing with dependencies
  - Task ID normalization
  - Draft task dependencies
  - Plain text display verification

### Files Modified
- `/src/cli.ts`: Added dependency options and validation logic
- `/src/test/dependency.test.ts`: New comprehensive test suite
- `/src/test/cli-dependency.test.ts`: New CLI integration tests

The implementation is fully functional and passes all tests. The dependency feature integrates seamlessly with existing functionality while maintaining backward compatibility.

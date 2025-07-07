---
id: task-163
title: Fix intermittent git failure in task edit
status: Done
assignee: []
created_date: '2025-07-07'
updated_date: '2025-07-07'
labels:
  - bug
dependencies: []
---

## Description

The `backlog task edit` command intermittently fails with a `git status` error, even when the task file is successfully modified. This is caused by an unsafe git commit operation that doesn't properly stage the file before committing. The fix is to ensure that only the specified file is staged and committed, preventing other repository changes from interfering with the operation.

## Acceptance Criteria

- [x] The `backlog task edit` command should not fail intermittently.
- [x] The `backlog task edit` command should only stage and commit the modified task file.
- [x] The `backlog task edit` command should not commit any other staged or unstaged changes in the repository.
- [x] The fix should be covered by tests.

## Implementation Plan

1. Analyze current git commit implementation in Core.updateTask()
2. Identify specific failure points in GitOperations.addAndCommitTaskFile()
3. Implement safer git staging that only targets the specific task file
4. Add retry logic for transient git failures
5. Improve error handling and reporting for git operations
6. Add unit tests to verify isolated file staging behavior
7. Add integration tests to simulate failure scenarios

## Implementation Notes

Successfully implemented git isolation fix with the following improvements:

**Approach Taken:**
- Identified root cause: addAndCommitTaskFile() was committing ALL staged changes, not just the task file
- Implemented index reset before staging to ensure isolation
- Added retry logic with exponential backoff for transient failures
- Enhanced error handling with detailed staging validation

**Features Implemented:**
- resetIndex() method to clear staging area without affecting working directory
- commitStagedChanges() method with pre-commit validation
- retryGitOperation() method with configurable retry count and exponential backoff
- Isolated git commit logic that only commits the specific task file

**Technical Decisions:**
- Reset index before each task commit to prevent interference from other staged changes
- Exponential backoff (100ms, 200ms, 400ms) for retry attempts
- Detailed error messages that include operation context and attempt count
- Validation of staged changes before committing to prevent empty commits

**Modified Files:**
- src/git/operations.ts - Enhanced addAndCommitTaskFile with isolation and retry logic
- src/test/git-isolation.test.ts - Added tests to verify new git operations methods

---
id: BACK-4.12
title: 'CLI: Handle task ID conflicts across branches'
status: Done
assignee: []
reporter: @MrLesk
created_date: '2025-06-09'
labels: []
dependencies: []
parent_task_id: task-4
---
## Description
Implement detection of the latest task ID across all remote branches when creating a new task. The CLI should fetch branch references and inspect task files, similar to the kanban board remote status check, to determine the highest available ID before assigning the next one.

## Acceptance Criteria
 - [x] `backlog task create` checks all remote branches for task files and chooses the next sequential ID.
 - [x] New tasks always use an ID higher than any found across branches to avoid conflicts.

## Implementation Notes

**Core Git Operations Added (src/git/operations.ts):**
- `fetch(remote = "origin")`: Executes `git fetch` to update remote branch information
- `listRemoteBranches(remote = "origin")`: Uses `git branch -r --list origin/*` to discover all remote branches
- `listFilesInRemoteBranch(branch, path)`: Uses `git ls-tree -r origin/{branch} --name-only -- {path}` to list files in specific remote branch paths

**Enhanced ID Generation (src/cli.ts:74-128):**
- Modified `generateNextId()` to scan all remote branches for existing task IDs before assignment
- Fetches latest remote branch information via `git fetch origin`
- Iterates through all remote branches and scans `.backlog/tasks` directory for task files
- Extracts task IDs using regex `/task-([\d.]+)/` pattern matching
- Prevents ID collisions for both main tasks (`task-N`) and subtasks (`task-N.M`)
- Gracefully handles git failures with try-catch, falling back to local-only ID generation

**Comprehensive ID Conflict Prevention:**
- Compares both local and remote task IDs to determine next available sequential ID
- Handles subtask creation by checking parent task patterns across all branches
- Ensures new task IDs are always higher than any found across local and remote sources
- Maintains backward compatibility with existing local-only ID generation logic

**Test Coverage (src/test/remote-id-conflict.test.ts):**
- Creates comprehensive test scenario with bare git repository and remote branches
- Sets up feature branch with task-1, then tests main branch task creation
- Verifies that `backlog task create` correctly assigns task-2 (avoiding conflict with remote task-1)
- Confirms CLI properly detects and respects remote task IDs during ID assignment
- Test passes successfully, validating cross-branch ID conflict prevention

**Quality Assurance:**
- All 122 tests pass, including the new remote ID conflict test
- Code passes all Biome linting and formatting checks
- Implementation maintains existing functionality while adding robust remote branch support
- Error handling ensures CLI remains functional even when git operations fail

The implementation successfully prevents task ID conflicts across all repository branches, enabling safe collaborative development with distributed task creation across multiple feature branches.

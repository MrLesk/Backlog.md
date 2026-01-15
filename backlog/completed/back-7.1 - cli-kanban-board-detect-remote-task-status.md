---
id: BACK-7.1
title: 'CLI: Kanban board detect remote task status'
status: Done
assignee: []
reporter: @MrLesk
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels: []
dependencies: []
parent_task_id: task-7
---

## Description

Improve the Kanban board command so it checks all branches on the `origin`
remote for task updates before rendering the board. Use `git fetch` to get the
latest references and then iterate through each branch to collect task files
using `git ls-tree`. Retrieve each task file with `git show` and merge the most
recent status into the board view. If multiple branches contain the same task,
adopt the frontmatter from the task that supplies the latest status so fields
like `title` and `assignee` remain current.

Status conflicts can occur when the same task has different status values in
multiple branches. In that case always display the last status found in the
iteration order and respect the status sequence defined in `config.yml`.
All frontmatter fields should also come from the task file that provided the
chosen status.

## Acceptance Criteria

- [x] `backlog board view` fetches and scans every branch under `origin` for task files.
- [x] The displayed status for each task reflects the most recent entry across all branches.
- [x] Status columns follow the configured order and fall back to the last seen status on conflicts, copying the full frontmatter from the task that provided the displayed status.

## Implementation Notes

Added remote task status detection to the CLI kanban board view. Key technical details:

**Git Operations Enhanced:**
- Added `fetchRemote()`, `listRemoteBranches()`, `listFilesInTree()`, and `showFile()` methods to `GitOperations` class in `src/git/operations.ts`
- These methods use git commands: `fetch`, `branch -r`, `ls-tree -r --name-only`, and `show` respectively

**Board View Logic (src/cli.ts:428-454):**
- Fetches latest remote references using `core.gitOps.fetchRemote()`
- Iterates through all remote branches from `core.gitOps.listRemoteBranches()`
- For each branch, scans `.backlog/tasks` directory using `core.gitOps.listFilesInTree()`
- Retrieves and parses task files using `core.gitOps.showFile()` and `parseTask()`
- Merges task status based on configured status order - later statuses override earlier ones
- Preserves all frontmatter (title, assignee, etc.) from the task providing the winning status
- Gracefully handles remote access errors (offline scenarios, missing remotes)

**Status Conflict Resolution:**
- Uses `statuses.indexOf()` to determine status progression order from config.yml
- Condition `newIdx > currentIdx || currentIdx === -1 || newIdx === currentIdx` ensures the most advanced status wins
- When status indices are equal, the last seen task (iteration order) takes precedence
- Entire task object is replaced (not just status) to maintain frontmatter consistency

**Testing:**
- Comprehensive test in `src/test/cli.test.ts` verifies remote status merging with bare git repositories
- Test creates a feature branch with updated task status and verifies main branch picks up the advanced status


---
id: task-94
title: Cross-branch task ID checking and branch info
status: To Do
assignee: []
created_date: '2025-06-19'
labels: []
dependencies: []
---

## Description

Check last task ID across all branches when creating tasks. Display branch containing latest task version in board.

## Acceptance Criteria

- [ ] `backlog task create` checks all local and remote branches for the highest task ID
- [ ] New tasks use an ID greater than any found across branches
- [ ] `backlog board` displays which branch has the latest version of each task

## Implementation Plan

1. Fetch and scan `.backlog/tasks` across all branches to determine the max ID
2. Integrate branch detection into task creation logic
3. Update board rendering to show the branch that last modified each task

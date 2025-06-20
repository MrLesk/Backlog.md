---
id: task-94
title: 'CLI: Show created task file path'
status: To Do
assignee: []
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels:
  - cli
  - enhancement
dependencies: []
---

## Description

When running `backlog task create`, the CLI should print the full path to the newly created markdown file. This helps users quickly locate or open the task for further edits.

## Acceptance Criteria

- [ ] After `backlog task create` completes, the CLI outputs the path to the created markdown file.
- [ ] Works in both plain and interactive modes.
- [ ] Tests validate the output behavior.

## Implementation Plan

1. Update the task creation logic to return the absolute path of the created file.
2. Modify `cli.ts` to log this path to the console after creation.
3. Ensure the output appears for plain (`--plain`) and interactive modes.
4. Add unit tests verifying the path is printed.
5. Document the new behavior in the README.

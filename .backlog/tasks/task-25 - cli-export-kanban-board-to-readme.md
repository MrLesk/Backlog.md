---
id: task-25
title: 'CLI: Export Kanban board to README'
status: To Do
assignee: []
created_date: '2025-06-09'
labels: []
dependencies: []
---
## Description

Implement new command backlog board export to append the board to README.md or specified output file.

## Acceptance Criteria

- [ ] `backlog board export` writes the kanban board to `readme.md` if it exists.
- [ ] Provide `--output <path>` option to save board to another file.
- [ ] Automatically create the file if the specified path does not exist.
- [ ] Appended content preserves existing file contents and adds the board at the end.

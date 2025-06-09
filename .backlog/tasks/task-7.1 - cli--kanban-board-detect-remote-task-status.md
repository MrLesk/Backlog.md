---
id: task-7.1
title: 'CLI: Kanban board detect remote task status'
status: "To Do"
assignee: []
reporter: @MrLesk
created_date: '2025-06-09'
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

- [ ] `backlog board view` fetches and scans every branch under `origin` for task
      files.
- [ ] The displayed status for each task reflects the most recent entry across
      all branches.
- [ ] Status columns follow the configured order and fall back to the last seen
      status on conflicts, copying the full frontmatter from the task that
      provided the displayed status.


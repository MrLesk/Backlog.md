---
id: BACK-172
title: Order tasks by status and ID in both web and CLI lists
status: To Do
assignee: []
created_date: '2025-07-12'
labels: []
dependencies: []
---

## Description

Update both the web UI task list and CLI task list command to order tasks by:
1. Status ascending (To Do → In Progress → Done)
2. Within each status group, order by task ID descending (newest first)

This will provide consistent ordering across both interfaces and make it easier to find tasks by status priority.

## Acceptance Criteria

### Web UI Task List
- [ ] Tasks are grouped and ordered by status: "To Do", "In Progress", "Done"
- [ ] Within each status, tasks are ordered by ID descending (newest first)
- [ ] Visual grouping or section headers show status groups clearly
- [ ] Maintains current task card design and functionality

### CLI Task List
- [ ] `bun run cli task list` orders tasks by status ascending, then ID descending
- [ ] `bun run cli task list --plain` also follows the same ordering
- [ ] Output clearly shows the ordering (status groups visible)
- [ ] Maintains current CLI output format and information
- [ ] Works with existing filtering options if any


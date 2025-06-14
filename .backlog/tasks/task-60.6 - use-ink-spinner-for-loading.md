---
id: task-60.6
title: Use Ink spinner for loading
status: To Do
assignee: []
created_date: '2025-06-14'
labels:
  - cli
dependencies: []
parent_task_id: task-60
---

## Description

Simplify loading.ts by replacing blessed screens with an Ink <Spinner> component. Provide fallback to console output when not TTY.

## Acceptance Criteria
- [ ] Loading screens use Ink spinner
- [ ] Works when Ink unavailable (non-TTY)

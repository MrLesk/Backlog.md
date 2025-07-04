---
id: task-111
title: Add editor shortcut (E) to kanban and task views
status: To Do
assignee: []
created_date: '2025-07-04'
labels: []
dependencies: []
---

## Description

Add keyboard shortcut 'E' to open the selected task file in the user's preferred editor from both the kanban board view and individual task view. The editor should be determined from the EDITOR environment variable.

## Acceptance Criteria

- [ ] Pressing 'E' in kanban view opens selected task in editor
- [ ] Pressing 'E' in task view opens current task in editor
- [ ] Editor is determined from EDITOR environment variable
- [ ] Falls back gracefully if EDITOR is not set
- [ ] Help text shows the new 'E' shortcut
- [ ] Works on all platforms (Windows/Mac/Linux)

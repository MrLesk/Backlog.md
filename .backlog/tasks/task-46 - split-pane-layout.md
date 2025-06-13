---
id: task-46
title: Split-pane layout
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - enhancement
dependencies: []
---

## Description

Goal: List on the left, detail on the right.

Detailed work:
- Add a parent grid layout, 30% width left / 70% right.
- Left pane lists tasks; right pane shows currently selected task detail.
- Arrow keys change list selection and refresh detail pane.

## Acceptance Criteria
- [ ] Down-arrow changes highlight and updates detail.
- [ ] Resizing keeps the 30/70 ratio within ±2 columns.

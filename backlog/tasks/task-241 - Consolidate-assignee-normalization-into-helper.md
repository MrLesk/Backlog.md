---
id: task-241
title: Consolidate assignee normalization into helper
status: To Do
assignee:
  - '@codex'
created_date: '2025-08-23 20:42'
updated_date: '2025-08-26 16:41'
labels: []
dependencies: []
---

## Description

Normalization of the `assignee` field from string to array is duplicated across `Core.createTask`, `Core.createDraft`, and `Core.updateTask`. Consolidate this logic into a single helper function or centralize it during YAML handling to avoid divergence and ensure consistent behavior across create/update paths.

Notes:
- The markdown parser already normalizes `assignee` on read. This task focuses on removing write-time duplication and ensuring symmetry between read/write paths.
- Prefer a single, reusable normalization utility in Core or a shared util to reduce future drift.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Introduce helper to normalize `assignee` (string→array) or handle it during YAML parsing/serialization.
- [ ] #2 Replace duplicated normalization in `Core.createTask`, `Core.createDraft`, and `Core.updateTask` with the helper.
- [ ] #3 Tests cover task creation, draft creation, and task updates with both string and array `assignee` inputs.
<!-- AC:END -->

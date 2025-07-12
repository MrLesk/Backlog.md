---
id: task-56
title: Simplify TUI blessed import
status: Done
assignee:
  - '@codex'
created_date: '2025-06-14'
updated_date: '2025-06-14'
labels:
  - refactor
dependencies: []
---

## Description

Remove dynamic loading of blessed library

## Acceptance Criteria
- [x] Blessed imported statically across UI modules
- [x] Dynamic import helpers removed
- [x] Tests and build succeed
- [x] Task committed to repository

## Implementation Notes
Simplified all UI modules to import `blessed` directly since Bun bundles
dependencies. Removed runtime fallbacks and updated tests accordingly.

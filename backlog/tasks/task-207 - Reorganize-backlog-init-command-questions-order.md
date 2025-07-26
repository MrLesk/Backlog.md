---
id: task-207
title: Reorganize backlog init command questions order
status: Done
assignee: []
created_date: '2025-07-26'
updated_date: '2025-07-26'
labels:
  - cli
  - ux
  - enhancement
dependencies: []
---

## Description

Reorder the prompts in the backlog init command to improve logical flow and user experience. Remove the automatic git commits question and keep it only in advanced settings.

## Acceptance Criteria

- [x] Init command prompts appear in this order:
  1. Cross-branch checking configuration
  2. Git hooks bypass
  3. Zero-padding configuration
  4. Default editor
  5. Override web UI settings
  6. Agent instructions selection
  7. Claude agent installation
- [x] Cross-branch checking prompts are nested properly (remote operations and active days only show if cross-branch is enabled)
- [x] Zero-padding prompts are nested properly (digit count only shows if zero-padding is enabled)
- [x] Web UI prompt uses 'override' instead of 'configure'
- [x] Agent selection prompt includes hint about space to select
- [x] Automatic git commits question is removed from init flow

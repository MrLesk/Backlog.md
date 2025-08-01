---
id: task-207
title: Reorganize backlog init command questions order
status: Done
assignee: ["@claude"]
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

## Implementation Notes

- Reorganized src/cli.ts init command to follow the specified order
- Each main prompt is numbered (1-7) with nested prompts as sub-items (e.g., 1.1, 1.2)
- Cross-branch checking prompts only show remote operations and active days when enabled
- Zero-padding prompts only show digit count when enabled
- Web UI prompts only show port and browser settings when override is selected
- Changed "Configure web UI" to "Override default web UI settings" as requested
- Added "(space to select)" directly in the agent instructions prompt message
- Kept autoCommit as a hidden/advanced setting with default false
- All prompts use consistent error handling with onCancel callbacks
- Tested prompt flow to ensure conditional nesting works correctly

---
id: BACK-209
title: Fix cleanup command to handle non-standard task filenames
status: Done
assignee: ["@claude"]
created_date: '2025-07-26'
updated_date: '2025-07-26'
labels:
  - bug-fix
  - cli
dependencies: []
---

## Description

Fixed a bug where the cleanup command would fail when encountering task files that didn't follow the standard naming convention. This affected task-196 which used lowercase and hyphens instead of spaces and Title-Case.

## Implementation Notes

The cleanup command was failing for tasks with non-standard filenames (e.g., 'task-196-add-nixos-packaging-support.md' instead of 'task-196 - Add NixOS packaging support.md'). Updated getTaskPath, getTaskFilename, and getDraftPath functions in src/utils/task-path.ts to handle both naming formats by checking for both 'task-ID -' and 'task-ID-' patterns.

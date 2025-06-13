---
id: task-49
title: Status styling
status: Done
assignee:
  - Claude
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - enhancement
dependencies: []
---

## Description

Goal: Clear, colored status icons.

Detailed work:
Build a (icon,color) lookup:
- Done → ✔, green
- In Progress → ◒, yellow
- Blocked → ●, red
- Replace the current green dot logic with this component.

## Acceptance Criteria
- [x] Unit test verifies mapping table.
- [x] Snapshot shows correct icon + color for each mocked state.

## Implementation Notes

Created a new status icon component (`src/ui/status-icon.ts`) that provides:
- `getStatusStyle()` - Returns both icon and color for a given status
- `getStatusColor()` - Returns just the color (for backward compatibility)
- `getStatusIcon()` - Returns just the icon
- `formatStatusWithIcon()` - Returns formatted string with icon and status text

The component implements the following mappings:
- Done → ✔ (green)
- In Progress → ◒ (yellow)
- Blocked → ● (red)
- To Do → ○ (white) - Added for completeness
- Review → ◆ (blue)
- Testing → ▣ (cyan)
- Unknown statuses → ○ (white) as default

Key changes made:
1. Created `src/ui/status-icon.ts` with the status icon/color lookup component
2. Updated `src/ui/task-viewer.ts` to use the new component for status display
3. Updated `src/ui/board.ts` to show status icons in column headers
4. Removed the old `getStatusColor` function from task-viewer.ts
5. Created comprehensive unit tests in `src/test/status-icon.test.ts`

The status icons are now consistently used across all UI components, providing clear visual indicators for task status.

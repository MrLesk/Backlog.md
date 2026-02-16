---
id: BACK-361
title: Add label-based filtering to TUI and web UI task list views
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 20:15'
updated_date: '2026-01-22 22:07'
labels:
  - tui
  - web
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to filter tasks by one or more labels in both the terminal UI (TUI) and web UI task list views. This enables quick narrowing of tasks when working with labeled workflows (e.g., "cli", "mcp", "bug").

Reuse the filtering patterns already established for status and priority filters, but adapt the UI/UX to handle label selection. Consider the limited footer space in TUI and how to present multiple label selections clearly without cluttering the interface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI task list view supports filtering by label(s)
- [x] #2 Web UI task list view supports filtering by label(s)
- [x] #3 Multiple labels can be selected (OR logic - show tasks matching any selected label)
- [x] #4 Label filter integrates with existing status and priority filters (filters combine with AND logic)
- [x] #5 Available labels are populated from current task set
- [x] #6 Filter state is clearly displayed in the footer/UI without overwhelming limited space
- [x] #7 Clearing label filter restores full task list
- [x] #8 Filter patterns are consistent with existing status/priority filter implementation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan for BACK-361

Goal
- Ensure label-based filtering is present and clearly communicated in both TUI and web task list views, consistent with existing status/priority filtering patterns.

What I’ll change
1) TUI filter header (label selector)
- Update the label selector button text to show a concise label summary (ex: "bug", "bug, ui", "bug, ui +1") instead of only a count, while keeping the dropdown affordance (▼).
- Reuse existing helper `formatLabelSummary` from `src/utils/label-filter.ts` and strip the "Labels: " prefix for compact button content.
- Keep the summary short to respect limited footer/header space.

2) Web task list
- Confirm the existing label filter UI in `src/web/components/TaskList.tsx` already supports multi-select, URL sync, and OR logic via API search.
- If no gaps are found, no changes needed; otherwise make minimal adjustments consistent with current filter UI.

Files to touch
- `src/ui/components/filter-header.ts` (import and use label summary helper for button content)
- (If needed) `src/web/components/TaskList.tsx` for minor UI consistency tweaks

Behavior checks
- Selecting labels in TUI updates filtered list (OR logic across labels).
- Status/priority filters combine with label filter (AND logic).
- Available labels come from tasks + config (existing `collectAvailableLabels`).
- Clearing labels resets to "All" and shows full list.

Validation
- Manual spot-check in TUI and web UI (no long tests unless you want them).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adjusted TUI filter header label selector to show concise label summary (using formatLabelSummary) instead of only a count; web label filter already satisfied requirements. Ran `bun test`, `bunx biome check . --write`, and `bunx tsc --noEmit`. Biome formatting updated src/cli.ts, src/file-system/operations.ts, src/utils/task-path.ts, src/test/core.test.ts, and src/test/filesystem.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the TUI filter header label selector to show a concise label summary (e.g., "bug", "bug, ui +1") using the existing label summary helper, improving filter state visibility without adding UI clutter. Web task list label filtering already met the requirements, so no changes were needed there. Ran Biome formatting which updated a few existing files to match formatter output.

Tests:
- bun test
- bunx biome check .
- bunx tsc --noEmit
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-361
title: Add label-based filtering to TUI and web UI task list views
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-01-15 20:15'
updated_date: '2026-04-25 23:39'
labels:
  - tui
  - web
  - enhancement
dependencies: []
modified_files:
  - src/ui/components/filter-header.ts
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
1. Rebase PR #499 onto current main and drop stale formatter-only changes from the old branch.
2. Keep the current shared TUI/Web label filtering implementation on main.
3. Update the TUI filter header label popup button to show the same concise label summary used by the shared label-filter helper.
4. Validate with focused label/header tests, typecheck, Biome check, and the full test suite before pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR #499 was rebased onto current main. The stale changes in src/cli.ts, src/file-system/operations.ts, src/test/core.test.ts, src/test/filesystem.test.ts, and src/utils/task-path.ts were dropped because current main already contains newer logic there. The remaining code changes import formatLabelSummary in src/ui/components/filter-header.ts, use it for the Labels popup button, and keep popup button content from parsing blessed tags so user-defined labels render literally. Current main already provides the label filtering behavior for the TUI task list, TUI board, Web UI, shared search, available label collection, OR label matching, and AND composition with other filters. Codex review flagged the tag parsing risk on the first rebased push, and the follow-up patch disables tag parsing for these popup buttons.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prepared PR #499 for current main by rebasing BACK-361 and reducing the patch to the remaining live UI improvement: the TUI filter header now displays a concise selected-label summary via formatLabelSummary. Popup buttons no longer parse blessed tags, so label text containing braces or blessed-style tags is displayed literally instead of affecting terminal styling. The broader label-filtering behavior already exists on main across TUI and Web surfaces, so no stale formatter-only files are changed in the final branch.

Validation passed locally with:
- bun test src/test/label-filter.test.ts src/test/filter-header-navigation.test.ts
- bunx tsc --noEmit
- bun run check .
- bun test
<!-- SECTION:FINAL_SUMMARY:END -->

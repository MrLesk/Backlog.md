---
id: task-309
title: Improve TUI empty state when task filters return no results
status: Done
assignee:
  - '@codex'
created_date: '2025-10-27 21:36'
updated_date: '2025-12-03 20:39'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
When a user applies search text or filters in the TUI task list that yield no matching tasks, the list pane continues to display the previous set of tasks. Only the details pane shows the "No tasks match your current filters" empty state (see screenshot `codex-clipboard-zzg1oI.png`). This is confusing because it looks like the old tasks are still selectable even though they no longer match.

## Reproduction Steps
1. Open the Backlog.md TUI task list view.
2. Enter a search term that does not match any tasks (e.g. `blabasdasdasdasddas`).
3. Observe that the details pane shows an empty state, but the task list on the left still shows the old results instead of clearing.

## Suggested Approach
- Detect when the current search/filters return an empty result set and clear the list pane selection/history.
- Render an empty-state message in the list pane (instead of showing stale tasks) so the layout matches the details pane messaging.
- Consider extracting existing copy so both panes reuse the same message source if appropriate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a search/filter that yields zero matching tasks, the list pane no longer displays any stale tasks from previous results.
- [x] #2 When no matches are available, the list pane displays a clear empty-state message (e.g. "No tasks match your current filters") inline where tasks would normally appear.
- [x] #3 Selecting or moving focus in the list pane while filters return zero results does not re-surface stale tasks until filters actually yield matches.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Fix Summary

### Changes Made

1. **`src/ui/components/generic-list.ts`** - Fixed `destroy()` method to also destroy the underlying `listBox` component, not just the screen. This was the root cause - the old list items remained visible because the listBox wasn't being removed from the parent container.

2. **`src/ui/task-viewer-with-search.ts`** - Added empty state display in the list pane:
   - Added `listEmptyStateBox` variable to track the empty state UI element
   - Added `showListEmptyState()` and `hideListEmptyState()` helper functions
   - When filters return 0 results, now shows "No matching tasks" with active filter summary in the list pane
   - When filters return results, properly hides the empty state before showing the new list

### Result
Both panes now show consistent empty state messaging when search/filters return no results. The stale task list no longer remains visible.
<!-- SECTION:NOTES:END -->

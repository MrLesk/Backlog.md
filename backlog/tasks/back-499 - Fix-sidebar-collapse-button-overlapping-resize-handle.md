---
id: BACK-499
title: Fix sidebar collapse button overlapping resize handle
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-29 17:41'
updated_date: '2026-05-29 17:42'
labels: []
dependencies:
  - BACK-483
priority: medium
ordinal: 157400
actual_start: '2026-05-30 01:40'
actual_end: '2026-05-30 01:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar resize handle (BACK-483) conflicts with the sidebar collapse toggle button in the Web UI. The collapse button is positioned at `-right-3` with `z-10`, while the resize handle sits at `right-0` with `z-20` and spans the full height of the sidebar (`top-0 bottom-0`).

Because the resize handle has a higher z-index, it captures mouse events over the portion of the collapse button that overlaps with the sidebar's right edge. This causes two problems:

1. **Hover interference**: When the mouse is over the collapse button, the resize handle's `hover:bg-blue-400/50` effect is triggered, showing a blue ghost bar.
2. **Drag interference**: The resize handle's `onMouseDown` fires instead of the button's `onClick`, causing the sidebar to enter resize mode when the user intends to collapse it.

**Expected behavior**: The collapse button should always be clickable and should not trigger the resize handle's hover or drag behavior.

**Root cause**: Z-index mismatch — the resize handle (`z-20`) is above the collapse button (`z-10`).

**Fix**: Raise the collapse button's z-index to `z-30` so it sits above the resize handle and receives mouse events first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering over the collapse button does not trigger the resize handle's blue hover effect
- [x] #2 Clicking the collapse button toggles the sidebar collapsed state; resize drag does not start
- [x] #3 Resize handle continues to work normally outside the collapse button's area
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
File to modify: `src/web/components/SideNavigation.tsx`

Change the collapse button's className from `z-10` to `z-30`:
```tsx
<button
    onClick={toggleCollapse}
    className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-30 flex items-center justify-center w-6 h-6 ..."
>
```

The resize handle remains at `z-20`, so the button now correctly sits on top in the stacking context.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed by raising the collapse button z-index from z-10 to z-30 in src/web/components/SideNavigation.tsx. The button now sits above the resize handle (z-20) and receives mouse events first, preventing both hover interference and drag interference. Type-check passes.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

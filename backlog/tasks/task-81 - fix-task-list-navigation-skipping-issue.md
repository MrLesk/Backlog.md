---
id: task-81
title: Fix task list navigation skipping issue
status: Done
assignee:
  - '@claude'
created_date: '2025-06-17'
updated_date: '2025-06-17'
labels: []
dependencies: []
---

## Description

Fix navigation bug in task list view where up/down arrow keys skip one task when navigating, except at the edges of the scrollable view. The board view works correctly and should be used as reference for the fix.

## Acceptance Criteria

- [x] Task list navigation moves one item at a time consistently
- [x] No skipping behavior in the middle of the list  
- [x] Edge cases (first/last items) work correctly
- [x] Navigation behavior matches board view implementation
- [x] All existing functionality still works
- [x] Tests pass and code follows project standards

## Implementation Notes

The issue was in `/src/ui/components/generic-list.ts` - there were conflicting navigation systems causing race conditions.

**Root Cause:** 
- Task list view uses `GenericList` component with `keys: true` (blessed's built-in navigation)
- Custom key handlers were also defined, creating conflicts
- The `select` event was triggering on every navigation change, not just explicit selections
- Board view works correctly because it uses `keys: false` and handles all navigation manually

**Solution:**
1. **Disabled blessed's built-in keyboard handling**: Changed `keys: true` to `keys: false` and `vi: true` to `vi: false`
2. **Removed conflicting select event handler**: The select event was triggering selection callbacks during navigation
3. **Fixed manual navigation**: Updated key handlers to maintain `selectedIndex` state properly
4. **Matched board view approach**: Now uses the same pattern as the working board view

Key changes in `src/ui/components/generic-list.ts`:
```typescript
// Line 145: Disable built-in navigation
keys: false,
vi: false,

// Lines 243-252: Remove select event handler to prevent conflicts
// Don't use the select event for navigation - only for explicit selection

// Lines 258-270: Fixed navigation with proper state management
this.listBox.key(keys.up || ["up", "k"], () => {
    const current = this.listBox.selected ?? 0;
    if (current > 0) {
        this.listBox.select(current - 1);
        this.selectedIndex = current - 1;  // Maintain state
    }
});
```

This eliminates the race condition between blessed's built-in navigation and custom handlers, ensuring consistent 1-to-1 navigation behavior.

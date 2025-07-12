---
id: task-85
title: Merge and consolidate loading screen functions
status: Done
assignee:
  - '@claude'
created_date: '2025-06-18'
updated_date: '2025-06-20'
labels:
  - refactor
  - optimization
dependencies: []
---

## Description

The codebase currently has two different loading screen functions (`withLoadingScreen` and `createLoadingScreen`) in `src/ui/loading.ts` that have overlapping functionality and duplicated code. Both functions create blessed-based loading screens with spinners and fallback to console output for non-TTY environments. They share similar initialization, styling, spinner animation, and cleanup logic that should be consolidated into a unified, reusable system.

## Acceptance Criteria

- [x] `withLoadingScreen` and `createLoadingScreen` no longer have duplicated code
- [x] Both functions continue to work with their existing API signatures
- [x] All current usages of loading screens in the codebase continue to work unchanged
- [x] Loading screens display correctly in both TTY and non-TTY environments
- [x] Escape and Ctrl+C keyboard shortcuts still close loading screens
- [x] Spinner animation continues to work smoothly
- [x] No visual or functional regression in loading screen behavior
- [x] Code is properly documented with JSDoc comments

## Implementation Plan

1. **Analysis Phase**
   - Map current usage of both loading functions
   - Identify duplicated code blocks
   - Document shared functionality

2. **Design Phase**
   - Design a base loading screen utility/class
   - Plan how to extract common elements (spinner, screen setup, TTY fallback)
   - Consider extracting constants (spinner chars, colors, dimensions)

3. **Refactoring Phase**
   - Create shared utilities for common functionality
   - Refactor `withLoadingScreen` to use shared utilities
   - Refactor `createLoadingScreen` to use shared utilities
   - Ensure API compatibility is maintained

4. **Testing Phase**
   - Test all existing loading screen usages
   - Verify TTY and non-TTY behavior
   - Test keyboard interaction
   - Ensure no visual regressions

## Implementation Notes

### Approach Taken

Created a shared `createLoadingScreenBase` function that consolidates all duplicated code between `withLoadingScreen` and `createLoadingScreen`. This function handles:

- TTY detection and fallback to console output
- Blessed screen initialization
- Loading box creation with configurable dimensions
- Spinner animation with shared constants
- Keyboard shortcut handling (Escape/Ctrl+C)
- Cleanup logic

### Technical Decisions and Trade-offs

1. **Internal API Design**: Used a configuration object pattern for flexibility while keeping the function internal (not exported)
2. **Spinner Constants**: Extracted spinner characters and interval as module-level constants for consistency
3. **Type Safety**: Maintained strict TypeScript types while avoiding non-null assertions per linting rules
4. **Backwards Compatibility**: Both public functions maintain their exact API signatures

### Files Modified

- `src/ui/loading.ts`: Complete refactoring to eliminate duplication

### Follow-up Tasks Needed

None - all acceptance criteria have been met and the refactoring is complete.

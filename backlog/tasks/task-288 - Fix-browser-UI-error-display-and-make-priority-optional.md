---
id: task-288
title: Fix browser UI error display and make priority optional
status: Done
assignee: []
created_date: '2025-10-15 17:48'
updated_date: '2025-10-15 17:54'
labels:
  - bug
  - ui
  - validation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix two related issues:

1. Browser UI doesn't display validation errors properly - errors are caught and only logged to console
2. Priority field is required but should be optional

Related to GitHub issues #397, #396
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Browser UI displays API validation errors to users instead of only logging to console
- [x] #2 Modal stays open when validation errors occur so users can see and fix the error
- [x] #3 Tasks can be created without specifying a priority (empty priority is treated as undefined)
- [x] #4 Valid priority values (high/medium/low) still work correctly
- [x] #5 Invalid priority values show appropriate error messages
- [x] #6 All existing tests pass (605 tests)
- [x] #7 Changes are committed on a task branch, not main
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

Fixed two related issues in the browser UI (GitHub #397, #396):

### 1. Error Display Fix
**Problem:** Validation errors were caught in `App.tsx` and only logged to console, never shown to users.

**Solution:**
- **src/web/App.tsx (lines 179-206)**: Removed try-catch block from `handleSubmitTask` to allow errors to propagate to TaskDetailsModal
- **src/web/components/TaskDetailsModal.tsx (lines 176-192)**: Enhanced error handling to:
  - Extract error messages from API responses (handles Error objects, error properties, and strings)
  - Display errors in the modal UI
  - Keep modal open when errors occur instead of closing immediately

### 2. Priority Optional Fix
**Problem:** Empty string priority caused validation errors - field appeared optional in UI but wasn't truly optional in backend.

**Solution:**
- **src/core/backlog.ts (line 127)**: Updated `normalizePriority` to treat empty string `""` as `undefined`
- **src/web/components/TaskDetailsModal.tsx (line 161)**: Explicitly convert empty string to `undefined` when submitting

### Testing
- Manual test script verified all scenarios work correctly:
  - Task creation without priority ✅
  - Task creation with empty string priority ✅  
  - Task creation with valid priority ✅
  - Invalid priority properly rejected with error message ✅
- Full test suite: 605 tests pass ✅

### Technical Decisions
- Error propagation: Removed App.tsx error catching to leverage React's natural error flow
- Priority handling: Two-layer approach (UI conversion + backend normalization) ensures robustness
- Modal UX: Only closes on successful submission, improving user experience when errors occur
<!-- SECTION:NOTES:END -->

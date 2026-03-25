---
id: BACK-195
title: Fix React Router deep linking for documentation and decisions pages
status: Done
assignee:
  - '@claude'
created_date: '2025-07-15'
updated_date: '2025-07-16'
labels:
  - bug
  - routing
  - react
  - ux
dependencies: []
---

## Description

When navigating to documentation or decisions pages through the sidebar, the pages load correctly. However, when copying the URL and opening it in a new tab or refreshing the page, the application fails to load the content and shows a blank page. This breaks deep linking functionality and makes it impossible to bookmark or share specific documentation/decision pages.

## Acceptance Criteria

- [x] Direct URL navigation works for documentation pages
- [x] Direct URL navigation works for decisions pages
- [x] Page refresh maintains current content
- [x] Bookmarking specific docs/decisions works correctly
- [x] Shared URLs load the correct content in new tabs
- [x] 404 handling for non-existent docs/decisions

## Implementation Plan

1. Investigate React Router setup for documentation and decisions routes
2. Check URL normalization issues
3. Fix routing configuration to support deep linking
4. Test direct URL navigation for both docs and decisions
5. Ensure 404 handling works correctly

## Implementation Notes

### Root Cause
The issue was caused by a race condition in the DocumentationDetail and DecisionDetail components. These components had a condition that prevented content loading when the parent's `docs` or `decisions` arrays were empty:

```typescript
// Before fix:
} else if (id && docs.length > 0) {
    loadDocContent();
}
```

When accessing URLs directly (deep linking), the parent component hadn't loaded the data yet, so `docs.length` or `decisions.length` was 0, preventing the components from loading content.

### Solution Implemented
Removed the array length check from both components, allowing them to fetch content directly from the API regardless of the parent's data state:

```typescript
// After fix:
} else if (id) {
    loadDocContent();
}
```

The `loadDocContent` and `loadDecisionContent` functions were also updated to always attempt fetching from the API, ensuring deep linking works even before the parent component loads its data.

### Modified Files
- `src/web/components/DocumentationDetail.tsx`: Removed `docs.length > 0` condition and updated content loading logic
- `src/web/components/DecisionDetail.tsx`: Removed `decisions.length > 0` condition and updated content loading logic

### Testing
Verified that:
- Direct URL navigation now works for both documentation and decisions pages
- Page refresh maintains the current content
- The components fetch data independently when accessed via deep links
- Server-side routing correctly serves index.html for all documentation/* and decisions/* routes

### Additional Enhancement: URL Sanitization
As requested by the user, implemented URL sanitization to create cleaner, more readable URLs:

#### Implementation
- Created `src/web/utils/urlHelpers.ts` with `sanitizeUrlTitle()` function that:
  - Converts titles to lowercase
  - Replaces spaces with hyphens
  - Removes special characters (keeping only alphanumeric, hyphens, and underscores)
  - Handles multiple consecutive hyphens
  - Trims leading/trailing hyphens

#### Files Modified for URL Sanitization
- `src/web/components/DocumentationDetail.tsx`: Updated navigation after save to use sanitized URLs
- `src/web/components/DecisionDetail.tsx`: Updated navigation after save to use sanitized URLs
- `src/web/components/SideNavigation.tsx`: Updated all navigation links (sidebar and search results) to use sanitized URLs

#### Result
URLs changed from: `/documentation/1/My%20Awesome%20Title!`
To: `/documentation/1/my-awesome-title`

This improves readability while maintaining full deep linking functionality.

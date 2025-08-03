---
id: task-211
title: Add version number display to browser UI
status: Done
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-03 10:28'
labels:
  - ui
  - frontend
  - enhancement
dependencies: []
---

## Description

Add a subtle version number display to the browser UI for debugging purposes. The version should be displayed on the right side of the Settings item in the sidebar, so it's visible when the sidebar is expanded but hidden when collapsed. The version must come from the same embedded version that the CLI uses (backlog -v), not from package.json.

## Acceptance Criteria

- [x] Version number is displayed on the right side of the Settings item in the sidebar
- [x] Version text is small and muted (subtle gray color)
- [x] Version format shows as 'Backlog.md - v{version}' (e.g. Backlog.md - v1.6.2)
- [x] Version is only visible when sidebar is expanded (not shown when collapsed)
- [x] Version number comes from the embedded version in the compiled binary (same as backlog -v)
- [x] Body tag includes version as data attribute for easy inspection
- [x] Version display does not interfere with user experience or UI elements

## Implementation Notes

Added version display functionality to the browser UI with the following key components:

**Frontend Implementation:**
- Created `src/web/utils/version.ts` utility that fetches version from `/api/version` endpoint
- Modified `src/web/App.tsx` to set version as `data-version` attribute on body tag (`Backlog.md - v{version}`)
- Updated `src/web/components/SideNavigation.tsx` to display version on right side of Settings item when sidebar is expanded

**Backend Implementation:**
- Added `/api/version` endpoint in `src/server/index.ts` with `handleGetVersion()` method
- Leveraged existing `src/utils/version.ts` utility that uses embedded version from compiled binary (same as CLI)

**Key Features:**
- Version displays as "Backlog.md - v{version}" format with small gray text
- Only visible when sidebar is expanded (hidden when collapsed)
- Uses same embedded version source as CLI (`backlog -v`)
- Body tag includes `data-version` attribute for debugging/inspection
- Graceful error handling with empty fallback if version fetch fails

**Files Modified:**
- `src/web/utils/version.ts` (new)
- `src/web/App.tsx`
- `src/web/components/SideNavigation.tsx`
- `src/server/index.ts`

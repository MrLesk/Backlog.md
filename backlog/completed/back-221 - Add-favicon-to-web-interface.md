---
id: BACK-221
title: Add favicon to web interface
status: Done
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03 10:12'
labels: []
dependencies: []
---

## Description

The Backlog.md web interface lacks a favicon, making it harder to identify in browser tabs. Adding a favicon will improve recognition and give the UI a more polished feel.
The favicon is currently uploaded under `.github/favicon.png`.

## Acceptance Criteria

- [x] Favicon is visible in the browser tab when using the web UI
- [x] Favicon reflects Backlog.md branding
- [x] Favicon loads consistently across all web UI pages without errors
- [x] Favicon asset is bundled with the project and served by the web server

## Implementation Notes

Added favicon support to the Backlog.md web interface with the following components:

**Favicon Assets:**
- Created `src/web/favicon.png` - primary favicon file served by the web server
- Added `.github/favicon.png` - source favicon for branding reference

**Frontend Implementation:**
- Added favicon link tag to `src/web/index.html` (`<link rel="icon" type="image/png" href="./favicon.png">`)
- Positioned in HTML head section for proper browser recognition

**Backend Implementation:**
- Extended server static file handling in `src/server/index.ts` to serve `/favicon.png` requests
- Added conditional check for `pathname === "/favicon.png"` in static file routing
- Implemented proper Content-Type header (`image/png`) for favicon responses
- Uses `Bun.file()` for efficient file serving

**Key Features:**
- Favicon appears in all browser tabs across all web UI pages
- Consistent branding with Backlog.md visual identity
- Efficient server-side delivery with proper HTTP headers
- No errors in browser console when loading favicon

**Files Modified:**
- `src/web/index.html` - added favicon link tag
- `src/server/index.ts` - added favicon serving logic
- `src/web/favicon.png` (new) - primary favicon asset
- `.github/favicon.png` (new) - source favicon file

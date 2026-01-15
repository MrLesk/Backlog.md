---
id: BACK-197
title: Fix decision page refresh showing blank screen
status: Done
assignee: []
created_date: '2025-07-21'
labels: []
dependencies: []
---

## Description

Decision pages show blank screen when refreshed due to server not serving index.html for React Router routes. This breaks the user experience for deep-linked decision URLs.

## Acceptance Criteria

- [x] Decision pages load correctly when refreshed
- [x] All JavaScript chunks load properly on refresh
- [x] React Router handles client-side routing correctly

## Implementation Notes

Fixed server routing issue in src/server/index.ts by changing fallback behavior from 404 to serving index.html. This allows React Router to handle client-side routing on page refresh. Modified line 274 to return indexHtml(req) instead of 404 response.

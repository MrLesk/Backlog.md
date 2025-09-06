---
id: task-257
title: Deep link URLs for tasks in board and list views
status: To Do
assignee: []
created_date: '2025-09-06 22:11'
labels: []
dependencies: []
---

## Description

Background

The web app supports deep links for Documentation and Decisions using SEO‑friendly routes like `/documentation/:id/:title` and `/decisions/:id/:title` that load the item and update the URL accordingly (see `App.tsx`, `DocumentationDetail`, `DecisionDetail`, and `sanitizeUrlTitle`).

For Tasks, there is no deep link route today:
- Board (index at `/`) can open a task popup using a `?highlight=task-123` query, but the URL doesn’t reflect the task.
- All Tasks (`/tasks`) opens the task popup on click but doesn’t change the URL.
- The server doesn’t currently route `/board/*` or `/tasks/*` to the SPA entry.

Goal

Add shareable deep links for tasks that open the right view and automatically show the task popup, mirroring the docs/decisions UX but without a separate detail page.

Requested behavior

- Kanban board: clicking a task updates the URL to `/board/123/title` and opens the popup. Sharing that URL should load the board view and automatically open the popup for `task-123`.
- All tasks list: clicking a task updates the URL to `/tasks/123/title` and opens the popup. Sharing that URL should load the list view and automatically open the popup for `task-123`.
- The `title` slug is cosmetic (use `sanitizeUrlTitle`); the numeric ID is the source of truth (convert to `task-<id>` when loading).
- Closing the popup should revert the URL back to the base view (`/board` or `/tasks`) without a reload; browser Back should close the popup too.
- Maintain backwards compatibility for existing `?highlight=task-123` links.

Notes

- Server must serve `index.html` for `/board` and wildcard `/board/*`, and for `/tasks/*` like docs/decisions.
- If a direct deep link is opened before tasks are loaded, attempt loading the single task by API to ensure the modal opens reliably (similar to how `DecisionDetail` does).
- If an invalid or nonexistent ID is provided, gracefully fall back to the base view and do not open a popup.

Out of scope

- No separate per‑task detail page.
- No share button UI changes (the address bar URL is sufficient for sharing).

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add client routes: /board/:id/:title and /tasks/:id/:title (both optional :title)
- [ ] #2 Board: clicking a task navigates to /board/123/title and opens popup; closing returns to /board; Back closes popup
- [ ] #3 All Tasks: clicking a task navigates to /tasks/123/title and opens popup; closing returns to /tasks; Back closes popup
- [ ] #4 Direct visit to /board/123/title loads board and opens task-123 popup (even if tasks not yet loaded)
- [ ] #5 Direct visit to /tasks/123/title loads list and opens task-123 popup (even if tasks not yet loaded)
- [ ] #6 Keep supporting ?highlight=task-123 as a fallback
- [ ] #7 Sanitize title with existing helper; ID is source of truth; ignore slug mismatches
- [ ] #8 Server: route /board and /board/* and /tasks/* to SPA index
- [ ] #9 Graceful handling for invalid IDs (no crash, no popup)
<!-- AC:END -->

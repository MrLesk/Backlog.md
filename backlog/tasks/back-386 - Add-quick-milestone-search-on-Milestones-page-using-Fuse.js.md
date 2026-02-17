---
id: BACK-386
title: Add quick milestone search on Milestones page using Fuse.js
status: To Do
assignee:
  - '@codex'
created_date: '2026-02-17 20:29'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a client-side quick search input on the Web Milestones page so users can rapidly filter milestone groups/tasks by fuzzy text match. This should improve navigation when many milestones/tasks are present and match the existing page visual style.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Milestones page shows a search input near the page header and it is keyboard-focusable.
- [ ] #2 Typing in the search input filters visible milestone groups/tasks using Fuse.js fuzzy matching across task id and title.
- [ ] #3 Search updates results quickly without full page reload and preserves existing collapse/expand behavior.
- [ ] #4 Clearing the search restores the full milestones view.
- [ ] #5 Web tests cover search filtering behavior and empty/no-match state handling.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

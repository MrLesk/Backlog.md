---
id: BACK-620
title: Align the filter footer hint between TUI kanban and task list
status: To Do
assignee: []
created_date: '2026-08-09 18:59'
labels: []
dependencies: []
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported by Alex 2026-08-09 with screenshots: the TUI kanban board footer shows "[s/t/p/i/l] Filter" while the TUI task list footer shows "[T/P/F/I] Filter" - different casing, different separator styling, and apparently different letters. Align the two. First determine what filter keybindings each view actually offers (the hints must reflect the real keys); if the filter sets genuinely differ per view, keep the correct letters but unify the presentation (same casing and separator convention); if a hint advertises a key that does not work or omits one that does, fix the hint to match the real bindings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both footers use the same casing and separator convention for the filter hint
- [ ] #2 Each footer lists exactly the filter keys that actually work in that view
- [ ] #3 A test or recorded verification covers both footer strings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

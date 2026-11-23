---
id: BACK-832
title: Add a documents index and a reading view to the web UI
status: To Do
assignee: []
created_date: '2026-11-23T20:53:00Z'
labels:
  - web
dependencies:
  - BACK-828
references:
  - src/web/components/DocumentationDetail.tsx
  - src/web/lib/docs-tree.ts
  - src/web/components/SideNavigation.tsx
priority: medium
type: enhancement
ordinal: 428000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Documents were added to the web UI early and never finished. They can only be reached through the tree in the sidebar: `/documentation` shows "No document selected". The document page shows the raw ID, a fixed "Documentation" label and the full file path, but never the type or the tags, which only the CLI can set. A body that starts with its own level-one heading repeats the title, and the reading styles depend on a class that has no effect in this build.

The web redesign approved by the maintainer on 2026-11-23 gives documents an index and a reading view. The index lists every document with its type, tags and last update, grouped by folder. The reading view shows the title once, a line with the ID, type and dates, the text in a readable column, an outline of the headings, and the type and tags as properties that can be changed.

This slice follows the slice that introduces the colors, type and page shell. It uses the document commands that exist when it is picked up; BACK-741 and BACK-742 may rename or extend them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The /documentation page lists every document with title, ID, type, tags and last update, grouped by folder under collapsible headers with top-level documents first.
- [ ] #2 The index can be narrowed by type and by a search box that matches title and ID.
- [ ] #3 The sidebar has one Docs entry with the document count in place of the document tree.
- [ ] #4 A document opens as a reading page that shows the title once, a line with ID, type, updated and created dates, and the rendered Markdown in a readable column with working styles for headings, lists, tables, code, callouts and Mermaid diagrams.
- [ ] #5 The reading page shows an outline of the document headings that scrolls to the chosen heading.
- [ ] #6 Type and tags are shown on the page and can be changed there through the same core update the CLI uses, and saving without a change sends no request.
- [ ] #7 Edit and Archive keep working, and creating a document asks for title, type and folder in labeled fields.
- [ ] #8 The index and the page have clear empty, loading and error states in light and dark.
- [ ] #9 Both are checked in the running browser UI in light and dark, at desktop and narrow widths, and with the keyboard alone, and tests cover the folder grouping, the type filter, and a type or tag change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

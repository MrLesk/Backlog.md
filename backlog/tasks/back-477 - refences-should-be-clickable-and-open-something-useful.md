---
id: BACK-477
title: refences should be clickable and open something useful
status: To Do
assignee:
  - '@lenucksi'
created_date: '2026-05-08 21:21'
updated_date: '2026-05-17 20:27'
labels: []
milestone: m-8
dependencies: []
references:
  - BACK-239
priority: low
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
references exist. it'd be nice if those could be clickable if it's a file or url in the web ui
not sure what would need to happen in the text ui
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Related to BACK-239 (Auto-link tasks to documents/decisions + backlinks). This ticket is the simpler foundation: make the `references:` frontmatter field render as a clickable hyperlink in the web UI. BACK-239 builds on top by adding body-text pattern detection and computed backlink lists. Implement this first; BACK-239 depends on it.
<!-- SECTION:NOTES:END -->

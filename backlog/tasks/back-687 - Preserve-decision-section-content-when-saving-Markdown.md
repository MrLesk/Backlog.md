---
id: BACK-687
title: Preserve decision section content when saving Markdown
status: Done
assignee:
  - '@Iams4kura'
created_date: '2026-09-13 16:18'
updated_date: '2026-09-13 16:29'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1008'
  - 'https://github.com/MrLesk/Backlog.md/issues/1010'
type: bug
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Saving a decision through the browser HTTP API truncates its text at nested headings because the update parser treats ## inside ### as a section boundary. Empty sections can also read back as the following heading. These are data round-trip failures reported in #1008 and #1010.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Decision updates preserve nested headings and the text following them in all sections.
- [x] #2 Empty decision sections remain empty on read and explicit updates; omitted sections retain their existing content.
- [x] #3 Regression tests exercise the real decision HTTP endpoints and persisted Markdown, including CRLF and inline heading-like text.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add deterministic HTTP regressions covering decision reads, updates, and persisted Markdown on the untouched upstream base. 2. Share the existing section parser between reads and updates and preserve explicit empty values. 3. Run affected tests, the full CI test profile, type checks, Biome, and CLI build; inspect the complete diff.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared the existing section parser between decision reads and updates, anchored level-two heading boundaries, and preserved explicit empty values while retaining omitted sections. On Bun 1.3.14, the same four real HTTP/file regressions fail on base c0ec546a3b519c0c7b83070fe936f6bf49e14357 and pass after the fix. Affected tests: 49 passed. Full repository CI profile: 2876 passed, 8 platform/environment skips, 0 failures. TypeScript, Biome (429 files), compiled build and CLI version smoke check passed. No dependency or lockfile changes.
<!-- SECTION:FINAL_SUMMARY:END -->

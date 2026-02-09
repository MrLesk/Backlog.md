---
id: BACK-377
title: Prevent web preview crash on angle-bracket type strings
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 03:55'
updated_date: '2026-02-09 03:57'
labels:
  - bug
  - web
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/504'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix blank page in browser task details when markdown contains angle-bracket type notation like `Result<List<MenuItem>>`. Ensure markdown preview does not crash and add regression coverage for problematic content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening task details with markdown containing angle-bracket type strings (e.g. `Result<List<MenuItem>>`) no longer crashes the web UI.
- [x] #2 Markdown preview remains functional for normal content after the fix.
- [x] #3 A regression test covers the markdown preview path with problematic angle-bracket content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced crash in markdown preview rendering path with `Result<List<MenuItem>>` and confirmed React throws due tag interpretation (`menuitems cannot have children nor dangerouslySetInnerHTML`). Added markdown sanitization in `MermaidMarkdown` to escape tag-like `<...` starts (while preserving angle-bracket autolinks), preventing React from interpreting type notation as HTML tags. Added regression tests for problematic angle-bracket content and normal markdown rendering.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed web preview blank-page crash for angle-bracket type strings by sanitizing tag-like `<...` sequences before rendering markdown in `MermaidMarkdown`. Added regression test `src/test/mermaid-markdown.test.tsx` to ensure problematic strings no longer throw and normal markdown behavior remains functional.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

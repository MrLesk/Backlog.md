---
id: BACK-555
title: Auto-link task IDs in markdown fields to deep links
status: Done
assignee:
  - '@cottrell'
created_date: '2026-07-24 07:21'
updated_date: '2026-07-24 07:21'
labels:
  - web
  - enhancement
dependencies: []
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automatically detect inline task ID references (e.g. TASK-123, TASK-358.8) in markdown fields in the Web UI and render them as clickable links to /tasks/:id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task IDs in markdown content (e.g., TASK-123, BACK-456, TASK-358.8) automatically render as clickable links to /tasks/<ID>
- [x] #2 Task ID links are not rendered inside code blocks or existing markdown links
- [x] #3 Tests cover auto-linking of task IDs in Web markdown rendering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add TASK_ID_REGEX matching in sanitizeMarkdownSource inside src/web/components/MermaidMarkdown.tsx targeting /tasks/<ID>.
2. Ensure task IDs are not linked if inside existing markdown links [text](url) or inline/block code formatting ().
3. Add web tests for MermaidMarkdown autolinking.
4. Verify using bun test, bunx tsc --noEmit, and bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validated with bun test src/test/mermaid-markdown.test.tsx, bunx tsc --noEmit, and bun run check .
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented automatic inline task ID autolinking to /tasks/:id in MermaidMarkdown. Verified via unit tests, TypeScript type checking, and Biome checks.
<!-- SECTION:FINAL_SUMMARY:END -->

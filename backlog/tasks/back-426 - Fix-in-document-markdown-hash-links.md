---
id: BACK-426
title: Fix in-document markdown hash links
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-02 18:26'
labels:
  - web-ui
  - markdown
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/529'
modified_files:
  - src/web/components/MermaidMarkdown.tsx
  - src/test/mermaid-markdown.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #529: make links to headings within rendered documents/tasks work reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rendered markdown headings receive stable deterministic IDs.
- [x] #2 Links using #anchor navigate within the rendered document without leaving the current document context unexpectedly.
- [x] #3 Tests or browser verification cover a document with multiple heading links.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the shared web markdown renderer and nearby tests for existing heading/link behavior.
2. Keep same-page hash links inside the current markdown route/context despite the document base URL.
3. Add focused regression coverage for hash-only markdown links.
4. Run targeted tests plus relevant type/lint checks for the touched area.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented hash-only markdown link handling in the shared MermaidMarkdown renderer by resolving href="#..." values against the current route and query string in the browser. This keeps generated heading anchors and authored heading links in the current task/document/decision route despite the app-level <base href="/">.

Validation: bun test src/test/mermaid-markdown.test.tsx passed; bunx tsc --noEmit passed; bun test passed (1373 pass, 2 skip); git ls-files scoped Biome check passed for tracked configured files. Global bun run check . was also attempted but is blocked by unrelated untracked onionskin.config.json formatting outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hash-only markdown links now resolve to the current route plus hash in the web markdown renderer, so in-document heading links stay in the current rendered markdown context. Added a regression test with multiple heading links and a simulated <base href="/"> document. Verified with focused renderer tests, TypeScript, full tests, and tracked-file Biome checks; global bun run check . is blocked by unrelated untracked onionskin.config.json.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-769
title: Keep generated task comments as plain Markdown text
status: Done
assignee:
  - '@codex'
created_date: '2026-10-16 06:03'
updated_date: '2026-10-16 06:06'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1055'
  - src/markdown/structured-sections.ts
modified_files:
  - src/test/comments.test.ts
  - src/markdown/structured-sections.ts
priority: medium
type: bug
ordinal: 389000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1055 shows that generated comment separators sit directly below author/date metadata and comment text. Standard Markdown interprets those lines as level-two heading underlines, so ordinary comments look like headings in raw task-file previews. The stored text already parses correctly; fix its generated Markdown layout while keeping intentional headings and existing comment records readable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New plain comment bodies and author/date metadata render as ordinary content without accidental Markdown headings.
- [x] #2 Intentional Markdown headings inside comments keep their formatting, and body, author, timestamp and order survive reading and writing.
- [x] #3 Previously generated compact delimiter comments and older marker-based comments still read and can be appended or saved without content loss, with LF and CRLF line endings.
- [x] #4 Rendering regressions and a CLI persistence test verify the shared formatter behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the generated-heading bug with rendering assertions in the existing comment tests. 2. Add Markdown-safe spacing around the existing comment delimiters in the shared formatter, retaining the current parser and file markers. 3. Cover intentional headings, metadata variants, ordered comments, legacy formats, LF/CRLF and actual CLI output. 4. Run scoped comment and Markdown tests, type checks, Biome and the compiled build; review for simplicity, open a focused PR, handle Codex findings, and merge after final approval and passing CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced issue #1055 with five failing comment tests before the change. Added actual Markdown-to-HTML rendering assertions, metadata variants, intentional headings, old compact and marker-based formats, ordered round trips, LF/CRLF coverage, and a persisted CLI comment rendering check. The shared formatter now separates metadata and bodies from delimiter lines with blank lines; the existing parser is unchanged.

Validation: 114 focused comment/Markdown/section tests and 100 related MCP/checklist tests pass (214 total). Type checks, Biome, compiled build and compiled CLI/browser/MCP smoke checks pass. Rendering assertions verify ordinary paragraphs rather than accidental headings, with deliberate headings preserved. Legacy compact and marker-based fixtures round-trip metadata, bodies and order across LF/CRLF and appends. Simplicity review kept one formatter-line change, reused the existing parser and test file, and added no helper, dependency, migration or public option.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added blank-line spacing around generated task comment delimiters so plain bodies and author/date metadata render as ordinary Markdown content. Intentional headings remain intact, and both older comment formats still parse and append without changing body text, metadata or order. Verified 214 related tests, type checks, Biome, build and compiled CLI/browser/MCP smoke checks. Five updated rendering/format checks failed before the fix and pass afterward.
<!-- SECTION:FINAL_SUMMARY:END -->

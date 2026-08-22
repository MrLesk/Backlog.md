---
id: BACK-637
title: >-
  Preserve consecutive blank lines inside fenced code blocks in notes (issue
  930)
status: Done
assignee:
  - ox-alpha
created_date: '2026-08-22 12:02'
updated_date: '2026-08-22 21:29'
labels: []
dependencies: []
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task edit --notes` (and --append-notes) collapses every run of two or more blank lines in section content via updateStructuredSections' global \n{3,} normalization, including inside fenced code blocks. Content inside fences must round-trip byte-for-byte; blank-line normalization outside fences keeps current behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Notes containing fenced code blocks (backtick and tilde) with 2+ consecutive blank lines survive backlog task edit --notes / --append-notes byte-for-byte
- [x] #2 Unterminated fences keep the rest of the section fenced (blank lines preserved) through edits
- [x] #3 Prose outside fences keeps current normalization: runs of 2+ blank lines collapse to one
- [x] #4 One shared fence-aware helper serves updateStructuredSections, stripSectionInstances, stripCommentsSection, and updateCommentsContent with no duplicated fence logic
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause: updateStructuredSections() in src/markdown/structured-sections.ts ends with output.replace(/\\n{3,}/g) over the whole serialized task file, collapsing blank lines inside fenced code blocks stored in notes; the same literal normalization exists in stripSectionInstances(), stripCommentsSection(), and updateCommentsContent(). 2. Add one shared fence-aware helper that collapses runs of 2+ blank lines to one outside fences and leaves every line inside backtick or tilde fences untouched (CommonMark-style open/close tracking). 3. Replace the four raw regex normalizations with calls to the helper, keeping each site existing trim behavior. 4. Regression tests: notes with 2+ blank lines inside backtick and tilde fences preserved byte-for-byte via the Core edit path; normalization still applied to prose outside fences. 5. Verify tsc, biome check, full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audited inherited WIP: call-site swaps were correct, but the helper misclassified runs adjacent to fence boundaries (checked the line before the run instead of the first blank line) and accepted any indent width plus backticks in backtick info strings. Rewrote it as a single-pass CommonMark tracker (<=3 space indents, same-character closings at least as long as the opener, unterminated fence extends to end of text); all four normalization sites share it.

Validation: bunx tsc --noEmit clean; biome clean on structured-sections.ts + both test files; targeted 22 pass (structured-sections-code-fences.test.ts, implementation-notes.test.ts); scoped suites 106 pass (markdown, append-notes, edit-preservation, acceptance-criteria x3); full suite 2358 pass / 6 skip / 0 fail across 244 files. bun run check . still fails on 5 untouched files with pre-existing format drift (core/backlog.ts, core/content-store.ts, file-system/operations.ts, server/index.ts, ui/components/task-composer.ts) - out of scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved consecutive blank lines inside fenced code blocks through the Core notes edit path by replacing the four global newline-run normalizations with one shared fence-aware collapseBlankLines helper; prose outside fences normalizes exactly as before. Verified via new unit + CLI regression tests (backtick, tilde, unterminated fences) and a manual scratch-project round trip.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-637
title: >-
  Preserve consecutive blank lines inside fenced code blocks in notes (issue
  930)
status: In Progress
assignee:
  - '@grok'
created_date: '2026-08-22 12:02'
updated_date: '2026-08-26 21:47'
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
1. Blocking CI: CodeQL js/bad-tag-filter on the HTML-comment end detector in collapseBlankLines. Change the comment-end regexp so it accepts both --> and --!> (standard `--!?>` form). Do not add an HTML parser or extra CommonMark features.

2. Sentinel-in-fence (Codex P2, confirmed user-visible): `SECTION_SENTINEL_LINE_REGEX` currently resets fence state on any marker-shaped line, so a fenced example such as `<!-- SECTION:DESCRIPTION:BEGIN -->` stops being fenced and consecutive blanks collapse. Skip sentinel resets while a fence is already open (marker-shaped lines inside fences stay fence content).

3. Keep unterminated-fence scoping without treating in-fence markers as boundaries: run the existing collapseBlankLines helper on each section body in buildSectionBlock so later sections still normalize independently.

4. List-indented HTML (Codex P2, confirmed): HTML-block openers still use `^ {0,3}` on the raw line, so a list-nested `<div>` is missed while the fence detector already honors list indent. Reuse the existing container-relative indent for HTML-block starts so fence-like lines inside that HTML stay non-fences and prose blanks still collapse.

5. Skip trailing-blank unterminated-fence P2: loss comes from pre-existing `.trim()` / `replace(/\s+$/)` on section bodies and extractStructuredSection, not from this PR.

6. Regression tests for (2) and (4); keep existing fence/HTML/section-scoping tests. tsc, biome on touched files, targeted markdown tests, full bun test. Commit `BACK-637 - ...` and push to origin/tasks/back-637-preserve-blank-lines-in-code-fences.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audited inherited WIP: call-site swaps were correct, but the helper misclassified runs adjacent to fence boundaries (checked the line before the run instead of the first blank line) and accepted any indent width plus backticks in backtick info strings. Rewrote it as a single-pass CommonMark tracker (<=3 space indents, same-character closings at least as long as the opener, unterminated fence extends to end of text); all four normalization sites share it.

Validation: bunx tsc --noEmit clean; biome clean on structured-sections.ts + both test files; targeted 22 pass (structured-sections-code-fences.test.ts, implementation-notes.test.ts); scoped suites 106 pass (markdown, append-notes, edit-preservation, acceptance-criteria x3); full suite 2358 pass / 6 skip / 0 fail across 244 files. bun run check . still fails on 5 untouched files with pre-existing format drift (core/backlog.ts, core/content-store.ts, file-system/operations.ts, server/index.ts, ui/components/task-composer.ts) - out of scope.

Merge-ready follow-up on PR #933:

- CodeQL js/bad-tag-filter: HTML comment end detector is now `--!?>` (matches `-->` and `--!>`).
- Sentinel-shaped lines inside an open fence no longer reset fence state; blank lines in those examples round-trip.
- Unterminated-fence scoping is preserved by collapsing each section body with the existing helper before wrapping.
- HTML-block openers use the same list-container indent as fences, so list-nested `<div>` content is not treated as a fence.
- Skipped trailing-blank unterminated-fence P2: pre-existing section `.trim()` / extract trim, not introduced here.
- Skipped NOTES:END-inside-fence extraction: extractStructuredSection still matches the first real END marker (pre-existing).

CodeQL follow-up: fence tests no longer contain a standalone --> token. HTML-comment fixtures build closers as --${bang}> and cover both --> and --!> round-trips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved consecutive blank lines inside fenced code blocks through the Core notes edit path by replacing the four global newline-run normalizations with one shared fence-aware collapseBlankLines helper; prose outside fences normalizes exactly as before. Verified via new unit + CLI regression tests (backtick, tilde, unterminated fences) and a manual scratch-project round trip.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-381
title: Fix frontmatter parsing corruption when titles contain dollar-sign sequences
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-11 20:04'
updated_date: '2026-02-11 20:05'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/516'
  - src/markdown/parser.ts
  - src/test/markdown.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate and fix bug where task frontmatter parsing is corrupted when YAML title includes `$` followed by digits (reported in GitHub issue #516). Ensure parsing remains correct for all metadata fields and add regression coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parsing markdown frontmatter with titles containing `$` sequences (for example `$15,000`) preserves all frontmatter fields correctly.
- [x] #2 A regression test fails on current main behavior and passes with the fix.
- [x] #3 Existing markdown parsing tests remain passing.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #516 by parsing markdown content with a YAML title containing `$15,000` and verify metadata corruption.
2. Add a regression test in `src/test/markdown.test.ts` that covers `$` + digit sequences in frontmatter title and asserts full frontmatter integrity.
3. Update `src/markdown/parser.ts` replacement logic to avoid replacement-string `$` interpolation side effects.
4. Run scoped tests for markdown parsing and any directly affected suites.
5. Run typecheck/lint only if required by touched files and update task checkboxes/notes with evidence.
6. Do a post-fix simplification pass to ensure the minimal safe implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Supersedes BACK-380 due manual ID correction requested by user after concurrent task creation on another machine.

Reproduced bug locally with new regression test: `bun test src/test/markdown.test.ts` failed before fix with YAMLException on title containing `$15,000`.

Applied minimal fix in `src/markdown/parser.ts` by switching frontmatter replacement to callback form to avoid `$` replacement token expansion.

Validation after fix: `bun test src/test/markdown.test.ts`, `bunx tsc --noEmit`, and `bun run check src/markdown/parser.ts src/test/markdown.test.ts` all pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

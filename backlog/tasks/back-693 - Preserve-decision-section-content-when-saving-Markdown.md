---
id: BACK-693
title: Preserve decision section content when saving Markdown
status: Done
assignee:
  - '@codex-1018'
created_date: '2026-09-27 22:04'
updated_date: '2026-10-19T16:11:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/1018'
  - 'https://github.com/MrLesk/Backlog.md/issues/1008'
  - 'https://github.com/MrLesk/Backlog.md/issues/1010'
  - src/core/backlog.ts
  - src/markdown/parser.ts
  - src/test/server-decision-sections.test.ts
modified_files:
  - src/core/backlog.ts
  - src/markdown/parser.ts
  - src/test/server-decision-sections.test.ts
  - src/test/cli-milestone-management.test.ts
priority: high
type: bug
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Saving a decision through the browser HTTP API can truncate nested headings, read an empty section as the next heading, and prevent explicitly clearing section content. PR #1018 provides a shared-parser correction for issues #1008 and #1010, but its BACK-687 record conflicts with the existing CLI paging task. This task tracks the original contributor fix under an allocator-assigned identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Decision updates preserve nested headings and following text in every decision section.
- [x] #2 Empty sections read as empty, explicit empty updates clear them, and omitted sections retain existing content.
- [x] #3 Real HTTP and persisted-Markdown tests cover nested headings, inline heading-like text, CRLF, empty sections, and omitted sections.
- [x] #4 The existing contributor PR uses this task identity and matching title while retaining the original contributor commits.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the contributor HTTP/file regressions on current main, verify the remote PR head, and preserve its contributor commits while merging current main.
2. Keep one shared section parser for decision reads and writes; preserve current frontmatter, timestamps, archive protections, and file commit behavior. Add only regression coverage needed for the accepted body parsing contract and the milestone caller.
3. Run focused HTTP/file parser, archive, metadata, linked-file, and milestone checks; run canonical types, Biome, build, and compiled public behavior.
4. Freeze the main-relative diff and source/test hashes for full-context architecture review, then run the canonical full test profile on the immutable source.
5. After review, simplify if needed, finalize the task through the CLI, and prepare the reviewed commit. Publication and merge remain with the coordinating agent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and validation:
- Retains the original contributor implementation from PR #1018 commit b9e4d34527c2bb15fed218d4975cc366f1ae77da by Iams4kura. BACK-693 replaces the PR task record because BACK-687 is already assigned to a different task.
- Decision updates now reuse the existing extractSection parser. Anchored level-two headings preserve nested headings and inline hashes; horizontal whitespace after the heading prevents empty sections from swallowing the next heading. Nullish fallback preserves omitted sections while allowing explicit empty sections to clear.
- All four new HTTP/file regression cases failed before the production change, reproducing nested-heading truncation with LF and CRLF, incorrect empty-section reads, and failure to clear content.
- With the production change applied to main commit 755da34209c8efcdc556b0f74ab9b5a6bada043d: 49/49 tests passed across src/test/server-decision-sections.test.ts, src/test/server-documents-endpoint.test.ts, and src/test/markdown.test.ts. The existing milestone description CLI test also passed (1/1), covering the other use of the shared section parser.
- bunx tsc --noEmit, bun run check . (434 files), bun run build, and git diff --check passed. Local checks used Bun 1.4.2; CI uses Bun 1.3.14.
- Simplicity review retained the original patch unchanged: it removes the duplicate parser and adds no extra layer. The source patch has stable Git patch ID f9bc8739e0b3de34698aa22196519de8de6c1817.
- Acceptance criteria 1–3 and the Definition of Done checks are verified by these results. The task remains In Progress until the PR identity repair and final review are complete.

2026-10-19: Revalidated PR head 0e6e8ae4b0b4e639f67c55f9bb937c1ee276c89f. All four original HTTP/file cases fail on current main 6615b0cd. Merging that main into the existing contributor ancestry; resolved the import conflict by retaining FrontmatterReferenceError and the shared extractSection import.

2026-10-19 merge-ready validation on main 6615b0cd7e08b4bbcb3bc5018abe7b485c817999 (Bun 1.4.3, macOS arm64):
- All four original contributor HTTP/file regression cases fail on current main before the fix; they reproduce LF/CRLF nested-heading truncation, empty-section misreads, and ignored explicit clears.
- The current repair keeps the original shared-parser implementation and removes the duplicate core parser. It retains main's frontmatter-reference checks, explicit UTC timestamps, archived decision refusal, and linked-file commit paths. Original contributor commit b9e4d34527c2bb15fed218d4975cc366f1ae77da, maintainer task commit ea1b0c01e01e9ae53affe03636c056c435badafa, and PR head 0e6e8ae4b0b4e639f67c55f9bb937c1ee276c89f remain in ancestry. PR #1018 already uses the matching BACK-693 title and task identity.
- Focused decision HTTP/file, Markdown, document, archive, metadata, linked-file, and timestamp suites: 136 passed, 0 failed across 10 files. Final touched decision/milestone suites: 15 passed, 0 failed. The clear/omit test now covers all four sections; the existing milestone CLI test preserves nested headings and inline hashes.
- bun run check:types, bunx tsc --noEmit, bun run check . (465 files), bun run build, and git diff --check passed. A standalone compiled CLI/browser proof verifies UTC creation dates, LF/CRLF nested headings, inline##text, persisted content, explicit clears, and omitted-section retention.
- Existing canonical full profile passed unchanged: TERM=xterm-256color BACKLOG_TEST_CLI_BUNDLE=<bundled CLI> bun scripts/run-ci-tests.ts --profile=full --parallel=4 --isolate --timeout=10000 --max-concurrency=4. Parallel pass: 3176 passed, 13 skipped, 0 failed across 282 files; serial DOM pass: 399 passed, 0 failed across 39 files. Total: 3575 passed, 13 skipped, 0 failed; 17364 assertions.
- Full-context architecture review returned KEEP, with no blocker or change recommendation. All 573 frozen source/test entries matched after the full suite. Simplicity review retained one shared parser and no extra abstraction.
- This is the bounded known-section body repair. Unknown extra sections and fenced level-two heading examples remain within the existing decision model's limits; broader decision changes are outside this task. Publication, remote checks, and merge are handled separately.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision Markdown saves now use one shared section parser, preserving nested headings and inline hashes. Empty sections read empty, explicit empty sections clear content, and omitted sections retain content. The contributor's original commits are preserved while current main's metadata, UTC, archive, and linked-file behavior remains covered.

Verified with focused HTTP/file and milestone tests, types, Biome, build, a compiled CLI/browser proof, and the unchanged full profile: 3575 passed, 13 skipped, 0 failed. Full-context architecture review returned KEEP. Scope remains the existing four decision sections.
<!-- SECTION:FINAL_SUMMARY:END -->

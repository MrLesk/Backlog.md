---
id: BACK-693
title: Preserve decision section content when saving Markdown
status: In Progress
assignee:
  - '@codex-pr-decision'
created_date: '2026-09-27 22:04'
updated_date: '2026-09-27 22:11'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/1018'
  - 'https://github.com/MrLesk/Backlog.md/issues/1008'
  - 'https://github.com/MrLesk/Backlog.md/issues/1010'
modified_files:
  - src/core/backlog.ts
  - src/markdown/parser.ts
  - src/test/server-decision-sections.test.ts
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
- [ ] #4 The existing contributor PR uses this task identity and matching title while retaining the original contributor commits.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect PR #1018 and the decision HTTP, core, parser, and serializer flow. Preserve the contributor implementation and commits; use BACK-693 because BACK-687 already belongs to another task.
2. Apply the contributor regression tests first and confirm failures against existing behavior.
3. Reuse the shared section parser for decision reads and updates, anchor level-two headings, and distinguish explicit empty content from omitted sections.
4. Verify the HTTP and Markdown suites, the existing milestone description test, TypeScript, Biome, and CLI build. Record the local runtime separately from CI.
5. Review for scope and simplicity, then replace the conflicting task record in the existing PR while preserving the original source code and contributor history. Complete final PR checks and review before marking this task Done.
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
<!-- SECTION:NOTES:END -->

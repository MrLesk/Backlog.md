---
id: BACK-507.8
title: Document search CLI parity with MCP operation
status: Done
assignee:
  - '@gpt-5.5-xhigh'
created_date: '2026-06-13 21:14'
updated_date: '2026-06-13 21:19'
labels: []
dependencies: []
modified_files:
  - src/cli.ts
  - src/test/cli-doc-search.test.ts
  - CLI-INSTRUCTIONS.md
parent_task_id: BACK-507
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a scoped CLI document search command so CLI users and agents can discover and run the document search operation exposed through MCP as document_search. The command should complement the global backlog search --type document path, not replace it, and should provide a focused doc namespace surface with clear help, validation, and plain text output suitable for agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog doc search <query> searches Backlog.md documents using the same document search behavior as MCP document_search where practical.
- [x] #2 The command supports a limit option aligned with MCP document_search validation and rejects missing or invalid query/limit inputs with actionable errors.
- [x] #3 Output is plain text and includes enough document identity/context for agents to follow up with backlog doc view <docId>.
- [x] #4 backlog doc search --help includes an input schema with required fields, optional fields, read/write behavior, output shape, and examples.
- [x] #5 Tests cover successful document search, no-result behavior, validation failures, limit handling, and help output.
- [x] #6 README or CLI reference docs mention backlog doc search where document commands are documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the existing document CLI group, global `backlog search --type document` implementation, MCP `document_search` handler, and nearby tests to identify shared search/index behavior and validation conventions.
2. Add a scoped `backlog doc search <query>` command under the existing doc namespace, reusing the current document search/index path where practical and aligning the `--limit` option with MCP validation.
3. Make CLI output plain text with document ids plus enough title/path/context for agents to follow up with `backlog doc view <docId>`, including a clear no-results response.
4. Extend `backlog doc search --help` with an agent-friendly schema section covering required/optional inputs, read/write behavior, output shape, and examples.
5. Add focused CLI tests for success, no results, validation failures, limit handling, and help output; update README and/or CLI instructions where document commands are documented.
6. Run focused tests, `bunx tsc --noEmit`, and `bun run check .`, then update acceptance criteria, notes, modified files, and final summary in Backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented scoped `backlog doc search <query>` under the existing `doc` command group. The command validates non-empty query length (1-200 chars) and `--limit` as an integer in the MCP-aligned 1-100 range before loading project state, then calls the shared search service with `types: ["document"]`. Output is always plain text with document id, title, path, type, tags, score, and a `backlog doc view <docId>` follow-up line. Added focused CLI tests for success, no results, missing/invalid query and limit validation, limit handling, and help schema content. Updated CLI-INSTRUCTIONS.md document command references. Verification passed: `bun test src/test/cli-doc-search.test.ts`, `bunx tsc --noEmit`, and `bun run check .`. The full check initially reported formatting in concurrent milestone-management work; formatting was applied so the required full check passes without reverting concurrent edits.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented scoped document search CLI parity for MCP `document_search`.

Changes:
- Added `backlog doc search <query>` under the existing document command namespace.
- Reused the shared fuzzy search service with `types: ["document"]` rather than duplicating document indexing behavior.
- Added validation for query length and `--limit` range aligned with MCP schema limits.
- Added plain text output with document id, title, path, type, tags, score, and `backlog doc view <docId>` follow-up commands.
- Added agent-oriented help schema content and CLI reference documentation.
- Added focused CLI tests covering success, no results, validation failures, limit handling, and help output.

Verification:
- `bun test src/test/cli-doc-search.test.ts` passed.
- `bunx tsc --noEmit` passed.
- `bun run check .` passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

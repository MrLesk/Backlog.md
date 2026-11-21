---
id: BACK-824
title: Lock document and decision IDs before looking up their files
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T23:01:55Z'
updated_date: '2026-11-21T23:12:56Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1249
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/test/content-record-locks.test.ts
modified_files:
  - src/test/content-record-locks.test.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/test/mcp-documents.test.ts
  - src/mcp/tools/documents/handlers.ts
  - src/server/index.ts
type: bug
ordinal: 420000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An edit that lists a document while another edit renames it can lose the old filename and report a missing record. Use the existing per-record lock to protect the lookup and mutation together in the shared write path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overlapping edits of one record either preserve the fields of every successful change or report the existing lock contention error, even when an edit renames the file.
- [x] #2 Document and decision updates, archive, restore, and delete use the same record identity for contention, including equivalent spellings of an ID. Independent records retain separate locks.
- [x] #3 Missing and ambiguous record IDs and archived-state refusals retain their existing behavior when the lock is available.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin the concurrent rename at the first record lookup and show the current failure with the existing lock tests.
2. Acquire the same per-checkout document or decision lock by canonical ID before looking up its current file. Keep the lock through validation, the write, and any commit. Apply that order to the existing shared record mutations.
3. Verify fail-fast contention, stored ID aliases, missing and ambiguous IDs, archived records, and independent edits. Check types, formatting, readability, the broader suite, and the original Linux CI scenario.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Paused an edit after it listed the old filename. On main a competing rename succeeded and the first edit reported a missing document. On this branch the rename reported contention, the first edit saved its tags, and retrying the rename preserved both changes. The MCP entry point and two concurrent core updates passed 100 repetitions each.

CLI, HTTP, MCP, archive and restore suites cover normal contention, stale locks, aliases, duplicate IDs, independent records and archive-state refusals. A missing document returned HTTP 404 and MCP DOCUMENT_NOT_FOUND. Type checking, Biome and the codehygiene check on changed lines passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Document and decision writes now take the checkout lock for their canonical ID before loading the current Markdown file. The MCP update tool uses the same lookup. Generated IDs keep their lock names. Hand-written IDs that cannot form a distinct portable filename use a hash, so older clients can use a different lock for those IDs.
<!-- SECTION:FINAL_SUMMARY:END -->

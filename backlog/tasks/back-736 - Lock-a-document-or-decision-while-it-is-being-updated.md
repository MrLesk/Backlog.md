---
id: BACK-736
title: Lock a document or decision while it is being updated
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 19:08'
updated_date: '2026-10-28T21:48:00Z'
labels:
  - enhancement
dependencies:
  - BACK-600
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/server/index.ts
modified_files:
  - src/cli.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/types/index.ts
  - src/test/content-record-locks.test.ts
type: enhancement
ordinal: 354000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task edit takes a lock on that task and reads the task again inside the lock. A second edit that arrives while the first is running fails at once with "Edit failed: <id> is being modified by another process; retry if appropriate.", and nothing is merged or overwritten behind the user's back. Document and decision updates have no such protection. Each update reads the file, changes the record in memory and writes the whole file back, so two overlapping updates of the same record can end with one silently undoing the other while both report success.

The maintainer's ruling on issue #1065 is that documents and decisions follow the task model with one shared implementation. For updates that means the per-record lock tasks already use, with the same fail-fast answer, on every path that changes a document or a decision: the CLI, the web API and the MCP document tools. The lock is reused, not rebuilt.

Depends on BACK-600, after which document and decision writes identify their file by its frontmatter ID, so the lock and the write agree on which file a record owns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While an update of a document is in progress, a second update of the same document fails immediately: the CLI exits non-zero with a message saying the document is being modified by another process, and the file holds exactly what the first update wrote.
- [x] #2 The same holds for two overlapping updates of one decision on every decision update path that exists.
- [x] #3 Over HTTP the rejected update answers 409 with a JSON `error` message for `PUT /api/docs/:id` and `PUT /api/decisions/:id`, and the MCP `document_update` tool returns an error.
- [x] #4 Two updates of the same record that change different fields never end with the first change silently undone: either both changes are stored or the second update is rejected.
- [x] #5 Updates of different records do not block each other.
- [x] #6 A lock left behind by a process that has ended is recovered the way a stale task lock is, so the record does not stay locked.
- [x] #7 Tests cover overlapping updates for documents and for decisions, on the CLI where a command exists and over HTTP.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved by Alex on 2026-10-28. Extend the existing per-file task/draft lock to documents and decisions, using canonical content-record identity and the same stale recovery and fail-fast errors. Resolve once to obtain the file, take the lock, then resolve and validate again inside it. Hold it through every update, archive, restore, delete, and scoped commit. Map contention to HTTP 409; CLI and MCP retain their shared error handling. Prove same-record contention, independent records, stale recovery, no lost updates, CLI/HTTP/MCP failures, and lifecycle contention. Run focused existing identity, archive and status suites, types, and Biome; obtain the required cold simplicity and full-context complexity reviews, then Codex PR review before merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The implementation needs the safe content-record lookups and path-bound writes already present in main (BACK-732 and subsequent archive work). BACK-600 and BACK-640 remain open for their broader remaining scope; this work will verify the relevant identity behavior rather than mark those tasks complete. Includes the task comment from Alex on 2026-10-13: archive, restore and delete share the update lock.

Regression evidence: before implementation, seven new locking tests failed, including successful concurrent writes that lost document tags or reset an accepted decision to proposed. The shared lock fixes these. Cold simplicity review found a stale-body fallback in CLI doc update; omitted content now stays omitted until core rereads inside the lock. A new regression failed before that correction and passes afterwards. The related 11-file run had 183 passes and one existing missing-decision wording failure; the original wording was restored. The final affected 5-file run passes all 125 tests, including 11 new locking tests, CLI document/status behavior, core, and HTTP documents. Type checks and Biome pass. The canonical type command is bun run check:types, replacing the stale tsc DoD wording. Cold simplicity review and separate full-context complexity review are complete; no supported finding remains.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @alex-agent
created: 2026-10-13 18:47
---
Issue #1101 adds archive, delete and restore for documents (BACK-761, BACK-762) and decisions (BACK-763), and a web Archive button for both (BACK-764). They are built before this lock exists and take no lock. The lock added here must cover them too: archive, delete and restore of a document or a decision take the same lock as an update of that record, on every interface.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documents and decisions now share the task lock policy for updates, archive, restore, and delete. Core rereads the record under the lock and holds it through the write and optional commit. Contention fails immediately, HTTP returns 409, and existing CLI/MCP error handling reports the refusal. Metadata-only CLI document updates preserve the latest body. Verified contention, canonical ID aliases, stale recovery, independent records, lifecycle paths, and existing mutation behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-736
title: Lock a document or decision while it is being updated
status: To Do
assignee: []
created_date: '2026-10-11 19:08'
updated_date: '2026-10-13 18:47'
labels:
  - enhancement
dependencies:
  - BACK-600
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
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
- [ ] #1 While an update of a document is in progress, a second update of the same document fails immediately: the CLI exits non-zero with a message saying the document is being modified by another process, and the file holds exactly what the first update wrote.
- [ ] #2 The same holds for two overlapping updates of one decision on every decision update path that exists.
- [ ] #3 Over HTTP the rejected update answers 409 with a JSON `error` message for `PUT /api/docs/:id` and `PUT /api/decisions/:id`, and the MCP `document_update` tool returns an error.
- [ ] #4 Two updates of the same record that change different fields never end with the first change silently undone: either both changes are stored or the second update is rejected.
- [ ] #5 Updates of different records do not block each other.
- [ ] #6 A lock left behind by a process that has ended is recovered the way a stale task lock is, so the record does not stay locked.
- [ ] #7 Tests cover overlapping updates for documents and for decisions, on the CLI where a command exists and over HTTP.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @alex-agent
created: 2026-10-13 18:47
---
Issue #1101 adds archive, delete and restore for documents (BACK-761, BACK-762) and decisions (BACK-763), and a web Archive button for both (BACK-764). They are built before this lock exists and take no lock. The lock added here must cover them too: archive, delete and restore of a document or a decision take the same lock as an update of that record, on every interface.
---
<!-- COMMENTS:END -->

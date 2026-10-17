---
id: BACK-735
title: Allocate document and decision IDs with the task allocator
status: To Do
assignee: []
created_date: '2026-10-11 19:08'
updated_date: '2026-10-14 05:16'
labels:
  - enhancement
dependencies:
  - BACK-732
  - BACK-734
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: enhancement
ordinal: 353000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tasks, documents and decisions each pick their next ID with separate code, and the three look in different places. `backlog task create` considers the working copy, other branches as configured, and sibling worktrees including files that are not committed yet. `backlog doc create` and `backlog decision create` consider only the working copy and the committed files of each branch. They do not look at sibling worktrees, so two worktrees of one repository can hand out the same document or decision number before either one commits. When the branch information cannot be read, both carry on with the local files alone and say nothing, which narrows the check without the user knowing. The decision code is a copy of the document code, so every fix has to be made twice.

The maintainer's ruling on issue #1065 is that documents and decisions follow the task model with one shared implementation. For ID allocation that means documents and decisions use the allocator tasks use and scan what it scans. The visible form of the IDs does not change: `doc-N` and `decision-N` in lower case, zero padded when `zero_padded_ids` is set.

Depends on BACK-732 (stored IDs are counted whatever their letter case, which must still hold after the switch) and BACK-734 (decision creation runs under the create lock, which allocation relies on).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With an uncommitted document in one worktree, `backlog doc create` in a sibling worktree of the same repository assigns a number that document does not use. The same holds for decisions and `backlog decision create`.
- [ ] #2 Document and decision creates consider other branches under the same configuration that governs the scan for `backlog task create`.
- [ ] #3 A failure to read other branches or worktrees is handled the same way for all three kinds; documents and decisions no longer continue silently with a local-only scan where `backlog task create` would not.
- [ ] #4 New IDs keep their current form: `doc-N` and `decision-N` in lower case, zero padded when `zero_padded_ids` is configured.
- [ ] #5 12 parallel `backlog doc create` runs and 12 parallel `backlog decision create` runs each still give 12 files with distinct IDs.
- [ ] #6 A project that is not a git repository still creates documents and decisions with increasing IDs.
- [ ] #7 No separate document or decision allocator remains; all three kinds get their IDs from the same code.
- [ ] #8 Tests cover the two-worktree case for documents and for decisions.
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
Issue #1101 adds archive folders for documents and decisions: `backlog/archive/docs/` (BACK-761) and `backlog/archive/decisions/` (BACK-763). An archived record keeps its ID reserved until it is deleted (BACK-762, BACK-763). When documents and decisions move to the task allocator here, the ID rule must keep counting those two folders, so `backlog doc create` and `backlog decision create` never hand out the ID of an archived record.
---

author: @alex-agent
created: 2026-10-14 05:16
---
BACK-762 (document delete and restore) found that the document ID step reads committed files on every local branch, including the current one. So with auto-commit off, a deleted document keeps its number until the deletion is committed, while a deleted task releases its number at once because the task ID step does not read the current branch. BACK-762 accepts this and states it in its criterion 10. When documents and decisions move to the task allocator here, they should get the task rule, and the BACK-762 criterion and guide text that describe the difference should be updated with it.
---
<!-- COMMENTS:END -->

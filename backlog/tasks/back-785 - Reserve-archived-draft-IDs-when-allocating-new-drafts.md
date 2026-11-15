---
id: BACK-785
title: Reserve archived draft IDs when allocating new drafts
status: Done
assignee:
  - '@mhrstmnn'
created_date: '2026-10-20 14:24'
updated_date: '2026-10-20 14:48'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1052'
type: bug
ordinal: 395000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Archiving a draft moves its file to `backlog/archive/drafts/`, but draft ID allocation reads only `backlog/drafts/`, so `draft create` and `task demote` hand out the ID of an archived draft again when it was the highest. Two files then claim one draft ID, references to it become ambiguous, and archiving the new draft under the same title silently overwrites the archived file, because the draft archive move replaces an existing target. Tasks, documents, and decisions already keep archived IDs reserved and refuse to replace a file when archiving. Reported in https://github.com/MrLesk/Backlog.md/issues/1052.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After the highest draft is archived, `draft create` allocates the next number instead of the archived draft ID
- [x] #2 After the highest draft is archived, `task demote` allocates the next draft number instead of the archived draft ID
- [x] #3 Archiving a draft whose file name already exists in `backlog/archive/drafts/` fails without changing either file
- [x] #4 Regression tests fail on the previous behavior and pass with the fix
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce on main: draft create and task demote reuse the highest archived draft ID; archiving a second draft with the same ID and title overwrites the archived file.
2. Reserve archived draft IDs in FileSystem.listOccupiedDraftIds, the one source of draft IDs for draft create (Core.generateNextId), task demote and prefix migration, by also reading archived draft file names (archive keeps the file name and is bound by it).
3. Make the draft archive write refuse an existing target ("wx", existing pathTakenError), as record saves already do, so the source stays in place.
4. Tests first (core create, filesystem demote, archive refusal), red on main; mutation check; full type, lint and test runs; before/after CLI run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced on main (bac6ae0c): draft create and task demote reuse the highest archived draft ID; a second archive of a reused ID with the same title replaced the archived file. Tasks (BACK-719), documents and decisions already reserve archived IDs.

Fix in src/file-system/operations.ts: listOccupiedDraftIds also reads the draft file names in backlog/archive/drafts through a shared scanDraftFilenames helper (listDraftFilenames keeps its doctor signature). It is the single source for draft create, task demote and prefix migration. File names suffice because draft archive is bound by file name and keeps it. An archive folder that cannot be read counts as empty, as the drafts folder does for allocation. archiveDraft now writes the archive copy with "wx" and reports the existing pathTakenError, so a file already in the archive is never replaced and the draft stays on the board; this only matters for boards that already hold a reused ID.

Considered and left out: switching draft archive to the core never-replace move (moveWithoutReplacing) used by task and document archive. It lives in src/core and would pull a core import into the file-system layer; the existing "wx" write is the file-system layer's own no-replace idiom and keeps the copy-then-unlink behavior unchanged. No archived draft listing or restore was added; archived drafts stay undocumented as before.

Tests: core create, filesystem demote and archive refusal were red on main and pass with the fix. Mutation (scan the drafts folder instead of the archive) turns both ID tests red. check:types and biome pass.

Full suite (bun run test, macOS, Bun 1.4.2): branch 3584 pass / 19 fail; clean main bac6ae0c 3582 pass / 18 fail. The 18 are the same tests on both (cli-create-preserves-existing-files document/decision cases and cli-decision-archive, which receive the "Remote operations disabled" notice instead of the created line under full-suite load); all 136 tests in those three files pass when run alone. The extra branch failure, ContentStore "publishes watched same-path local creation as one branch-version identity", is a 3 s watcher wait that involves no drafts and passed 5 of 5 runs alone.

CLI before/after (source CLI, temp projects): with DRAFT-4 and DRAFT-5 archived, main creates DRAFT-4 and demotes TASK-1 to DRAFT-5; the branch creates DRAFT-6 and demotes to DRAFT-7. Archive, create with the same title, archive again: main leaves only the second body in the archive; the branch gives the new draft DRAFT-2 and the first archived body stays. With a same-named file already in the archive, main replaces it and exits 0; the branch refuses with the existing path-taken message, exits 1, and leaves both files unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Archived drafts now keep their IDs reserved, as archived tasks, documents and decisions already do. Draft ID allocation (draft create, task demote, prefix migration) also counts the draft file names in backlog/archive/drafts, so a new draft no longer receives the ID of the highest archived draft. Draft archive writes its copy without replacing an existing file, so an archived draft is never overwritten: on a board that already holds a reused ID, archiving the live copy fails with the existing path-taken message and leaves both files unchanged.

Verification: three regression tests (core create, filesystem demote, archive refusal) fail on main and pass; a mutation of the archive scan turns the ID tests red. check:types and Biome pass. The full suite shows the same 18 load-dependent failures as clean main plus one watcher-timing test that passes alone. CLI before/after runs recorded in the notes.

Not changed: no listing, view or restore for archived drafts; draft archive keeps its copy-then-unlink move rather than the core never-replace move.
<!-- SECTION:FINAL_SUMMARY:END -->

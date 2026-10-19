---
id: BACK-761
title: Archive documents from the CLI and MCP
status: Done
assignee:
  - '@codex-761'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-15 22:08'
labels:
  - enhancement
dependencies:
  - BACK-731
  - BACK-732
  - BACK-765
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - core
  - commands
  - mcp-tools
  - file-storage
  - content-store
  - web-server
modified_files:
  - src/constants/index.ts
  - src/types/index.ts
  - src/utils/document-id.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/utils/task-links.ts
  - src/core/content-store.ts
  - src/server/index.ts
  - src/mcp/errors/mcp-errors.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/schemas.ts
  - src/mcp/tools/documents/index.ts
  - src/mcp/utils/document-response.ts
  - src/cli.ts
  - src/test/content-identity.test.ts
  - src/test/docs-recursive.test.ts
  - src/utils/id-generators.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/mcp/README.md
  - src/test/cli-doc-archive.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-document-archive.test.ts
  - src/test/server-document-archive.test.ts
  - src/test/document-archive.test.ts
  - src/core/archived-task-move.ts
  - src/test/commit-failure-after-change.test.ts
  - src/test/linked-record-commit.test.ts
priority: high
type: enhancement
ordinal: 382000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md can create and update documents but has no supported way to retire one. Issue #1101 reports this on 1.52.0: `backlog doc --help` lists `create`, `update`, `list`, `search` and `view`, the web page of a document offers only Edit, and the only way to get rid of an obsolete document is to delete its Markdown file by hand, which the shipped guidance forbids. The owner's answer on the issue is "we should have doc deletion".

The owner's ruling is that documents and decisions follow the task flow from issue #1064 (BACK-719, BACK-730, BACK-731). Removing a record takes two steps: archive first, then delete, and delete works only on an archived record. An archived record can be restored with the same ID. This task delivers the first step for documents: archive, from the CLI and from MCP, together with everything that makes an archived document safe to keep. Its ID stays reserved, it is read-only, it can still be viewed, and it no longer shows up in lists and search.

Rules from the ruling that shape this task:

- One core function does the work. The CLI command and the MCP tool only translate input and output. No rule lives in the CLI, MCP or web layer.
- A task's `documentation` list is free text (paths or URLs), not document IDs. Archiving a document changes no task. It prints the tasks and drafts that name the moved file, so a person can update them.
- Existing code is reused, not copied. The file move that never replaces a file comes from the task archive work. The rules for counting IDs and writing record files come from BACK-732.

Scope:

- Delete and restore are the next task of this stack. Until then an archived document can be viewed but cannot be brought back or removed.
- Decisions are a later task of this stack.
- No TUI control and no web control is added. The web Archive button is the last task of this stack. The web is touched only where it shares core code: archived documents leave its sidebar and search, and its save refuses them.
- Known gap: documents have no update lock today (BACK-736 adds one), so archive takes no lock.

Paths below use the default `backlog/` folder. A project with another backlog folder uses that folder.

This is the first of four stacked tasks for issue #1101. Each is one branch and one pull request. This one builds on BACK-765, which stages moved linked record files as links and gives a failed commit after a move one message. BACK-765 builds on the top of the task archive stack (BACK-720, pull request #1097), which is itself based on BACK-732 (pull request #1099). The order is #1099, #1094 to #1097, BACK-765, then this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog doc archive <docId>` on a document under `backlog/docs/` exits zero, prints `Archived document <id>`, and moves the document's file to the same relative path under `backlog/archive/docs/`. Example: `backlog/docs/guides/doc-3 - API-Guidelines.md` becomes `backlog/archive/docs/guides/doc-3 - API-Guidelines.md`. Folders that do not exist yet are created.
- [x] #2 `<docId>` is accepted in every form `backlog doc view` accepts, such as `doc-3`, `3` and `doc-003`.
- [x] #3 The moved file is byte for byte the file that was under `backlog/docs/`. Archive does not rewrite it, so its ID, dates and content are unchanged.
- [x] #4 Archive never replaces a file. When `backlog/archive/docs/` already has a file at the destination path, the command exits non-zero with a message that names that file, and no file is moved or changed.
- [x] #5 `backlog doc archive <docId>` on a document that is already archived exits non-zero with the read-only message for archived documents and changes nothing.
- [x] #6 `backlog doc archive <docId>` for an ID that no document claims exits non-zero with a not found message and changes nothing.
- [x] #7 An ID claimed by more than one file, counting `backlog/docs/` and `backlog/archive/docs/` together, fails closed: `backlog doc archive`, `backlog doc view` and `backlog doc update` each exit non-zero with the ambiguity message, and no file is moved or changed. The message lists each file with its folder, so a file under `backlog/docs/` and a file of the same name under `backlog/archive/docs/` can be told apart.
- [x] #8 `backlog doctor` reports an ID claimed by a file under `backlog/docs/` and a file under `backlog/archive/docs/` as a duplicate document ID and names both files.
- [x] #9 An archived document keeps its ID reserved: with `doc-1` under `backlog/docs/` and `doc-2` archived, `backlog doc create` assigns `doc-3`.
- [x] #10 An archived document file is counted the way a document file under `backlog/docs/` is counted after BACK-732: by the ID in its frontmatter, by the number in its file name, and in the committed files of other branches. The ID of a document that was archived and committed on another branch is not assigned by `backlog doc create` on this branch.
- [x] #11 An archived document is read-only on the CLI: `backlog doc update <docId>` exits non-zero, changes no file, and prints one message saying that the document is archived and read-only, for example `Document doc-3 is archived. Archived documents are read-only.`
- [x] #12 The MCP tool `document_update` and the web save (`PUT /api/docs/<id>`, which answers 400 with a JSON `error`) refuse an archived document with that same message and change no file.
- [x] #13 `backlog doc view <docId>` on an archived document exits zero and prints the document as it does for any other document, plus a line that says the document is archived. The interactive viewer shows that line too. The file is not changed.
- [x] #14 The MCP tool `document_view` returns an archived document with a line that says it is archived.
- [x] #15 An archived document is left out of `backlog doc list`, `backlog doc search`, `backlog search`, the MCP tools `document_list` and `document_search`, and the web sidebar and web search (`GET /api/docs` and `GET /api/search`).
- [x] #16 After a successful archive the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the moved file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [x] #17 A `documentation` entry names the file when it is the path the file had before the move, written from the project root, for example `backlog/docs/guides/doc-3 - API-Guidelines.md`. The entry also matches with `./` in front of the path or with `#` and a fragment after it. Nothing else matches: not a URL, not an absolute path, not a bare ID such as `doc-3`.
- [x] #18 Archive changes no task file and no draft file.
- [x] #19 A document file that is a symbolic link is moved as a link. Afterwards `backlog/archive/docs/` holds a link to the same target, and the target file is still in place and unchanged.
- [x] #20 A document inside a symlinked subfolder of `backlog/docs/` is archived like any other document: its file moves to the matching path under `backlog/archive/docs/`.
- [x] #21 A link loop inside `backlog/docs/` or `backlog/archive/docs/` (a folder link that points back at one of its own parent folders) does not make `backlog doc archive`, `backlog doc view` or `backlog doc list` hang or fail.
- [x] #22 With auto-commit on (`auto_commit: true`), a successful archive makes one commit that holds the move of the document's file and nothing else.
- [x] #23 With auto-commit off, archive makes no commit and adds nothing to the Git index.
- [x] #24 When the file was moved but the commit fails, the command says that the document was archived and that committing the change failed, and exits non-zero.
- [x] #25 The MCP server offers the tool `document_archive`. It takes one document ID like `document_view`, rejects unknown fields, and returns a success message, the same line of tasks and drafts, and the same refusal messages as the CLI.
- [x] #26 `backlog doc --help` lists `archive`, and `backlog doc archive --help` with its help schema describes the command with an example.
- [x] #27 The CLI command and the MCP tool call one core function and hold no rule of their own. The file move is the never-replace move that task archive uses, reused and not copied.
- [x] #28 Tests drive the CLI for every behavior above and the MCP tool for the same rules.
- [x] #29 `CLI-INSTRUCTIONS.md`, the shipped guides (`backlog instructions` and the agent guidelines) and the MCP guides that list the document tools say how a document is archived: the file moves to `backlog/archive/docs/`, the ID stays reserved, the document stays viewable and is read-only, and tasks that name the file are printed and not changed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
First of four stacked tasks for issue #1101 (branch tasks/back-761-archive-documents on top of BACK-720, pull request #1097). One core function does the work; the CLI command and the MCP tool only translate input and output.

1. Storage (src/file-system/operations.ts, src/constants/index.ts, src/types/index.ts).
   - Archived documents live in `archive/docs` under the same relative path. `listArchivedDocuments` reads them through the reader `listDocuments` uses, and marks each with `archived: true`. `listDocuments` keeps returning the docs folder only, so lists, search, the content store and the web sidebar leave archived documents out without a rule of their own.
   - That reader walks the folders itself and reads each real folder once, under the shortest path that leads to it. A link loop therefore ends, and a file that several paths lead to is one file. A folder that really lies inside the other document folder is left to that folder's listing. (Revised during implementation: the first version kept the recursive glob and removed duplicates afterwards. In the full test suite that glob kept following a link loop until the test timed out, so the glob is gone.)
   - `documentFilePath` and `documentProjectPath` are the one place that says which folder a listed document is in. `saveDocument` refuses an archived document, because it writes under the docs folder only.

2. Core (src/core/backlog.ts).
   - `Core.getDocument` resolves an ID over the docs folder and the archive together, so an ID that more than one file claims fails closed with the existing ambiguity error. The message names each file by its path from the project root, so the folder is visible.
   - `Core.archiveDocument(documentId, autoCommit?)` is the one operation: look up, refuse an archived document, collect the tasks, archived tasks and drafts whose `documentation` list names the file, move the file with the never-replace move task archive uses, take it out of the content store, commit the move when auto-commit is on. A commit that fails after the move says that the document was archived.
   - `updateDocumentFromInput` refuses an archived document with one typed message. Every refusal extends the refusal class the task operations use, renamed so the name is true for documents.
   - The private helper that moves a task file into or out of the archive is generalized to any record file instead of being copied.
   - `diagnoseContentIdentity` (doctor) and both document ID allocators count archived documents: frontmatter IDs, file names, and committed files of other branches (src/utils/id-generators.ts).
   - The view text for `doc view` and the interactive viewer comes from core and carries one line for an archived document.

3. Matching rule (src/utils/task-links.ts): one function decides whether a `documentation` entry names a file (the path from the project root, optionally with `./` in front or `#fragment` behind), and one function formats the `Still listed as documentation by: ...` line for the CLI and MCP.

4. CLI (src/cli.ts): `backlog doc archive <docId>` with help schema and example. No options.

5. MCP (src/mcp/tools/documents/*): `document_archive` with the one-ID input of `document_view`. `document_update` reports core's refusal unchanged and `document_view` shows the archived line. The refusal translation the task tools use is shared, not copied.

6. Web server (src/server/index.ts): `PUT /api/docs/<id>` answers 400 with core's message for an archived document. No route and no control is added.

7. Guides: CLI-INSTRUCTIONS.md, the guides behind `backlog instructions`, agent-guidelines, and the MCP guides that list the document tools.

8. Tests in projects outside the repository: the CLI for every acceptance criterion (src/test/cli-doc-archive.test.ts), the MCP tools for the same rules, the HTTP save and lists, the matching rule, the folder walk with link loops, the tool list, help and guides.

9. Verification: tsc, biome, the changed and related test files one at a time, the full suite, and a scripted end-to-end run of every acceptance criterion against a binary built from this branch (CLI and MCP over stdio) in private mktemp projects.

10. Review round. (a) The folder walk no longer follows a link to a folder inside the document folder, so a document is listed under the folder it is really in whatever the link is called; a folder outside is still read once. (b) The shared Git helper stages a record file that is a link as the link when the link is new or changed in Git, so a moved link is committed; an unchanged link still stands for the file it points to, so an edit through it commits that file. (c) One error type, `ChangeNotCommittedError`, carries the sentence for a change whose commit failed, for task archive, restore and delete and for document archive, and `runCoreOperation` turns it into the MCP error. (d) The comment on the walk states the reason that holds for not using a glob.

Approved repair refresh (2026-10-16): Merge exact repaired BACK-765 parent 986b3464df238e5795d35cb0f814e5edcb55d2d8 without rewriting existing commits. Preserve its bounded task/draft/allocator locking, shared move path, one content-store publication, and applied-deletion error mapping. Add red-to-green coverage for file links across active/archive document stores in both directions, while preserving distinct file links, folder rules, loops, ambiguity, archive/read-only behavior, ID reservation, source creation safety and linked commits. Reuse findDocumentFiles existing opposite-store membership check before including file links. Run affected document and inherited regression suites, canonical checks/build, and compiled CLI/MCP probes. Perform a subtraction pass and hold this task In Progress with stable code for the full-context architecture review before finalization, commit or push.

Final review gate: full-context architecture review returned KEEP. Complete independent verification, record the proof, verify the existing acceptance criteria and DoD, then commit the reviewed merge and protected-push only this existing branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-761-archive-documents, stacked on BACK-720 (pull request #1097), which carries BACK-732 and the task archive stack.

Core: `Core.archiveDocument(documentId, autoCommit?)` is the one operation. It resolves the ID with `Core.getDocument`, which now searches the docs folder and the archive together, so an ID that more than one file claims fails closed with the existing `AmbiguousIdError` and an unknown ID returns null. An archived document is refused with `DocumentArchivedError` ("Document X is archived. Archived documents are read-only."). Everything that only reads (the auto-commit setting, the tasks and drafts that name the file) is read before the move, so a failure there leaves the document in the docs folder. The file moves to the same relative path under `archive/docs` through `moveRecordFile`, the helper task archive and task restore use, generalized from `moveTaskFile`; it calls the shared `moveWithoutReplacing`. A file already at the destination is refused with `DocumentFileExistsError`, which names that file from the project root. The file is not rewritten. With auto-commit on the move is one commit; a commit that fails after the move reports "Document X was archived, but committing the change failed: ...".

Read-only: `updateDocumentFromInput`, the one function the CLI, MCP and the web save all update through, refuses an archived document with the same `DocumentArchivedError`. `FileSystem.saveDocument` refuses one too, because it writes under the docs folder only and would create a second file for the ID. All refusals extend `RecordRefusedError`, the class the task refusals extend (renamed from `TaskRefusedError`).

Storage: `listDocuments` and the new `listArchivedDocuments` share one reader. `Document.archived` marks an archived document, and `documentFilePath` and `documentProjectPath` are the only place that maps the flag to a folder. The reader walks the folders itself (`findDocumentFiles`) and reads each real folder once, so a link loop ends and a file reachable through several paths is one file. Hidden names, a missing link target, another extension and README files are left out as before. A subfolder that cannot be read is now reported in `unreadable` and the rest is still listed. A folder that really lies inside the other document folder is left to that folder's listing.

Why the glob went: the first version kept `Bun.Glob("**/*.md")` with `followSymlinks` and removed duplicates afterwards. In three of three full-suite runs that glob kept walking a two-link loop (the trace showed paths such as guides/up/guides/up/.../self/self/...) until the test timed out. The same scan returns in under a millisecond in a fresh process and in every partial run, so the trigger is unknown. The walk does not depend on it.

Reserved IDs and doctor: `generateNextDocId` counts archived documents by frontmatter ID, by the number in the file name (also for a file that cannot be parsed) and in the committed files of other branches (`archive/docs` is listed next to `docs`). `Core.generateNextId(EntityType.Document)`, which no command uses, counts them as well. `diagnoseContentIdentity` checks both folders together, so doctor reports a duplicate across them and names both files.

Viewing: `Core.getDocumentViewText` (renamed from `getDocumentContent`) returns what `doc view` prints and the interactive viewer shows: the stored file and, for an archived document, the line "This document is archived and read-only." above it. MCP `document_view` puts the same line above its rendering.

Adapters: `backlog doc archive <docId>` has no options. MCP `document_archive` takes the input of `document_view` and returns "Archived document X." plus the line of tasks and drafts. The translation of a core refusal into a tool error moved out of the task handlers into `runCoreOperation`, which both handler classes use. `document_update` passes a refusal on unchanged. `PUT /api/docs/<id>` answers 400 with core's message. No TUI control, no web control and no HTTP route was added. The content store drops an archived document at once through `removeDocument` (the watcher's removal, made public), so MCP lists and search do not wait for a file event.

Tasks that name the file: `documentationEntryNamesFile` holds the matching rule and `formatDocumentationReferencesMessage` the line, both in src/utils/task-links.ts. Archive changes no task and no draft.

Guides: CLI-INSTRUCTIONS.md, the task-execution guide behind `backlog instructions`, agent-guidelines, the two MCP overviews and src/mcp/README.md describe archiving.

Tests keep their projects outside the repository. src/test/cli-doc-archive.test.ts drives the CLI for every acceptance criterion, including the interactive viewer in a pseudo-terminal, a project with another backlog folder, symlinked files and folders, link loops in both folders, and Git. src/test/mcp-document-archive.test.ts drives the MCP tools, src/test/server-document-archive.test.ts the HTTP save and lists, and src/test/document-archive.test.ts the matching rule, the folder walk and the core function. One existing assertion changed: the ambiguity candidates in src/test/content-identity.test.ts are now paths from the project root.

Verification: `bunx tsc --noEmit` clean; `bun run check .` clean (442 files). The added and changed test files pass one at a time (cli-doc-archive 32, document-archive 32, mcp-document-archive 10, server-document-archive 3, mcp-server 15, content-identity 13, docs-recursive 3), and so do the existing document, search, content-store, MCP document and ID-generation files. `bun run test`: 3,082 pass, 8 skip, 0 fail across 300 files; it exits 1 with no failing test because src/test/list-window.test.ts leaves an exit code set, as on the base. A scripted end-to-end run against a binary built from this branch covered every acceptance criterion through the CLI, MCP over stdio and the HTTP save in private mktemp projects.

Seen while verifying, outside this task: with auto-commit on, archiving a record file that is a symbolic link to a file outside the repository moves the file and then fails to commit, for documents and for tasks alike. The shared commit helper in src/git/operations.ts resolves the path through the link. The content store (`findIdentityCandidate`) and the duplicate task ID report still use a recursive glob with `followSymlinks`.

Review round (independent review, must fix first).

Listing: `findDocumentFiles` followed a link inside the docs folder whose target is also inside it, so the link path won whenever it was shorter or sorted first (`0alias -> guides`, `shortcut -> a/b/c`). The document was then listed, archived and matched against `documentation` entries under the path of the link. The rule is now: a folder inside the document folder is read under its own path and never through a link, and a folder outside it is read once, under the shortest link. Loops still end: a link back into the folder is not walked, and a link to a folder above it comes back to the folder itself, which was read already. Tests: src/test/document-archive.test.ts "lists a document under the folder it is really in when ... leads there too" (four link shapes) and "reads a folder outside the docs folder once, under the shortest link to it"; src/test/cli-doc-archive.test.ts "keeps a document under its own folder when the link ... also leads to it" (search path, archive destination, documentation line).

Why not a glob: the comment now gives the reason that holds. A recursive glob returns a file once for every path that leads to it, so one folder link back into the docs folder lists every document several times and every ID is ambiguous. The hang seen inside the full test suite is mentioned as seen and not reproduced.

Linked record files and auto-commit: `getPathContext` and `getRelativePathForRepo` in src/git/operations.ts resolve a path through every link. They do so because the backlog folder or a subfolder may be a link, into this repository or into another one, and Git cannot stage a path beyond a link; and because an edit written through a linked record file changes the file the link points to, which is the file to commit. For a record file that is a link and was just moved, resolving the last component staged the unchanged target and lost the link: with the target inside the repository the commit held only the removal and the command exited 0, with the target outside the commit failed. The fix is one private helper, `changedFileLinkPath`: a symbolic link to a file whose own path is new or changed in Git is given to Git as the link; an unchanged link is resolved as before. Nothing changes for a path that is not a file link. Tests: src/test/cli-linked-record-commit.test.ts covers document archive and task archive and restore with the target inside and outside the repository, an edit through a committed link (still commits the target), and a document in a linked folder that leads outside the repository, which still fails with the commit-failed sentence and exit 1.

Commit failed after the change: `commitFailedAfter` became the error type `ChangeNotCommittedError`. Task archive now throws it too (still tagged for the browser), so `backlog task archive` prints "Task X was archived, but committing the change failed: ..." where it printed only the Git error. `runCoreOperation` turns it into the MCP error with the words of core, so `task_archive`, `task_restore` and `task_delete` no longer answer "An unexpected error occurred" for it. The document tool handlers share one helper, `changeDocument`, for create, update and archive. Tests: src/test/commit-failure-after-change.test.ts (CLI, MCP, core and the task archive route).

Flaky watcher tests: src/test/content-store.test.ts fails now and then on tests that wait three seconds for a file event ("publishes watched same-path local creation as one branch-version identity", "publishes watched distinct-path local creation with the refreshed branch collision identity", "removes tasks, documents, and decisions when files are deleted"). Measured on unpacked copies of both trees, one process per run: base 5 of 60 runs failed, this branch 5 of 55, and this branch with the glob put back 1 of 20. The walk is not the cause.

Final counts for the content-store watcher tests, one process per run: the base copy failed in 7 of 70 runs, this branch in 6 of 50 (worktree and copy), and this branch with the recursive glob put back in 1 of 20. The line above gave the counts before the last runs. Full suite after the review round: 3,106 pass, 8 skip, 0 fail across 302 files.

Split after the second review. The Git staging rule for a moved file that is a link (changedFileLinkPath and withResolvedFolder in src/git/operations.ts), ChangeNotCommittedError with its use by task archive, restore and delete, and runCoreOperation moved to BACK-765 (branch tasks/back-765-linked-record-commits). This branch builds on it now and keeps the document work. Where the review-round notes above describe those three changes, they are BACK-765's.

What stays here: document archive throws ChangeNotCommittedError; runCoreOperation catches RecordRefusedError (renamed here from TaskRefusedError) and the document tool handlers use it; the comments of ChangeNotCommittedError and moveWithoutReplacing speak of tasks and documents. src/test/cli-linked-record-commit.test.ts became src/test/linked-record-commit.test.ts in BACK-765, which drives the CLI and MCP with task files; this branch adds its document tests there (archive as a link with the target inside and outside the repository, an edit through a committed link, a document in a linked folder). src/test/commit-failure-after-change.test.ts comes from BACK-765 with the task cases; this branch adds backlog doc archive, document_archive and the core error for a document. The modified-file list no longer holds src/git/operations.ts, src/mcp/tools/tasks/handlers.ts and src/test/cli-linked-record-commit.test.ts, and holds src/test/linked-record-commit.test.ts.

Checks after the split: bunx tsc --noEmit and bun run check . clean. One file at a time: linked-record-commit 15, commit-failure-after-change 10, cli-doc-archive 35, document-archive 37, mcp-document-archive 10, server-document-archive 3, mcp-server 15, content-identity 13, docs-recursive 3, no failures. bun run test: 3,117 pass, 8 skip, 1 fail across 302 files; the one failure is the content-store watcher test that fails now and then on the base too (publishes watched distinct-path local creation with the refreshed branch collision identity), and src/test/content-store.test.ts then passed on its own (67 pass). The end-to-end CLI and MCP scripts and the link probe were run again against a binary built from this branch, with the same results as before the split.

Approved repair refresh (2026-10-16): Integrated exact repaired BACK-765 parent 986b3464df238e5795d35cb0f814e5edcb55d2d8 as a merge without rewriting existing commits. Resolved three integration conflicts: task archive and restore keep the parent's complete task-to-allocator locking spans and one transitionTask publication, and use the existing shared moveRecordFile helper; runCoreOperation keeps RecordRefusedError, ChangeNotCommittedError and TaskDeletionAppliedError handling; linked-record tests keep the parent's task cases and this task's document cases.

Repaired findDocumentFiles by resolving each symbolic-link target once and checking the existing foreignDirectory/isWithinDirectory authority before either file inclusion or folder traversal. An active-store file link into the archive cannot publish an archived document as active, and an archive-store file link into active docs cannot make it archived or falsely ambiguous. No target-based file deduplication was added. Existing folder shortcuts, shortest external-folder paths, loop termination, equal/nested-store behavior, distinct file links, real duplicate ambiguity and source creation protection are preserved.

Red-to-green proof: the two new core store-membership cases failed in both directions before the repair, and the new CLI cross-store list/search/lookup case exposed the archived document in active output before the repair. All now pass. Strengthened the distinct-file-link regression for two separate links to the same same-store or external target; both remain listed and ambiguous. Test snapshots compare directory entries in sorted order because readdir order is not stable.

Verification of the reviewed source/test bytes:
- bun run check:types: no type errors in 553 files.
- bun run check .: clean, 450 files.
- bun run build: passed; built dist/backlog.
- Affected document filesystem/Core/CLI/MCP/HTTP/identity/search/ID/link-commit suites: 364 pass, 0 fail across 22 files.
- Inherited task/draft/allocator locking, applied-deletion, single-publication, archive/restore and content-store regressions: 227 pass, 0 fail across 10 files.
- BACK-732 source creation safety, atomic task create and Core: 103 pass, 0 fail across 3 files.
- Total: 694 pass, 0 fail across 35 files.
- CLI interactive tests use env -u NO_COLOR TERM=xterm-256color. The inherited viewer test is unchanged; the shell's default TERM=dumb and NO_COLOR=1 suppress cursor gaps, which caused its first attempt to fail. It passes with normal terminal capabilities.
- Compiled dist/backlog probes in isolated temporary projects passed through both CLI and MCP over stdio: archive and view ID aliases; reciprocal file links across stores; active list/search exclusion; archived read-only refusals; archived ID reservation; archive of a relative file link with the external target unchanged.
- git diff --check and cached diff check are clean. Subtraction pass found no further layer or helper to remove: one existing store-boundary authority and one target resolution serve files and folders.
Full-context architecture review returned KEEP with no new scope or required source changes. No document update lock was added; restore/delete and web archive controls remain later tasks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documents can be archived through backlog doc archive and document_archive while keeping their IDs, view access, read-only protection and original file bytes. The repaired listing applies the existing opposite-store boundary to file links as well as folder links, so a link cannot make an archived document appear active or falsely ambiguous. Distinct file links and real duplicate IDs still fail closed, and folder paths and loops keep their existing rules.

The branch includes the exact repaired BACK-765 parent without rewriting earlier commits. Task archive/restore locking spans, one content-store publication, applied-deletion error handling, source creation safety and linked-record commits remain intact.

Verification: 694 tests pass across 35 affected files; canonical type, Biome and build checks pass. Compiled CLI and MCP stdio probes pass for archive/read-only/alias lookup, store links, ID reservation and unchanged external link targets. The unchanged interactive viewer test passes with normal terminal capabilities. Full-context architecture review: KEEP. Documents still have no update lock; restore/delete and web archive controls remain out of scope.
<!-- SECTION:FINAL_SUMMARY:END -->

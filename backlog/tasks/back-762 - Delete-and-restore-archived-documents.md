---
id: BACK-762
title: Delete and restore archived documents
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-14 05:01'
labels:
  - enhancement
dependencies:
  - BACK-761
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - core
  - commands
  - mcp-tools
  - file-storage
  - content-store
modified_files:
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/core/content-store.ts
  - src/cli.ts
  - src/mcp/tools/documents/schemas.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/index.ts
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
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/mcp-document-restore-delete.test.ts
  - src/test/document-archive.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/commit-failure-after-change.test.ts
priority: high
type: enhancement
ordinal: 383000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since BACK-761 a document can be archived: it leaves the lists, keeps its ID and is read-only. Two things are still missing. A user cannot bring an archived document back, so an archive made by mistake can only be undone by moving the file by hand. And a user cannot remove a document for good or free its number, which is what issue #1101 asks for and what the owner confirmed on the issue ("we should have doc deletion").

The owner's ruling follows the task flow (BACK-730 for delete, BACK-731 for restore). Delete is the second step and works only on an archived document. Archiving is the confirming step, so delete asks no question and has no confirmation flag. Restore moves an archived document back with the same ID.

Rules from the ruling that shape this task:

- Each operation is one core function. The CLI commands and the MCP tools only translate input and output. No rule lives in the CLI, MCP or web layer.
- A task's `documentation` list is free text (paths or URLs), not document IDs. Delete changes no task. It prints the tasks and drafts that name the removed file, so a person can update them.
- The code of BACK-761 is reused, not copied. Restore is the archive move in the other direction.

Scope:

- No TUI control and no web control is added. Delete and restore stay on the CLI and MCP, the same split tasks have.
- BACK-761 leaves the read-only message without a way out, because restore did not exist yet. This task adds the restore command to that message.
- Known gap: documents have no update lock today (BACK-736 adds one), so delete and restore take no lock.

Paths below use the default `backlog/` folder. A project with another backlog folder uses that folder.

This is the second of four stacked tasks for issue #1101. Each is one branch and one pull request. This one builds on BACK-761.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doc restore <docId>` on an archived document exits zero, prints `Restored document <id>`, and moves the file from `backlog/archive/docs/` back to the same relative path under `backlog/docs/`. Folders that no longer exist are created.
- [ ] #2 The restored file is byte for byte the archived file. Restore does not rewrite it, so the document keeps its ID.
- [ ] #3 A restored document behaves like any other document: `backlog doc list` and `backlog doc search` show it, and `backlog doc update` changes it.
- [ ] #4 Restore never replaces a file. When `backlog/docs/` already has a file at the destination path, the command exits non-zero with a message that names that file, and no file is moved or changed.
- [ ] #5 `backlog doc restore <docId>` on a document that is not archived exits non-zero with a message saying the document is not archived, and changes nothing.
- [ ] #6 From this task on, the read-only message for archived documents names the restore command, for example `Document doc-3 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-3`. It is the same message everywhere it appears: `backlog doc update`, `backlog doc archive`, the MCP tools `document_update` and `document_archive`, and `PUT /api/docs/<id>`.
- [ ] #7 `backlog doc delete <docId>` on an archived document exits zero, prints `Deleted document <id>`, and removes the document's file from `backlog/archive/docs/`. Afterwards `backlog doc view <docId>` no longer finds the document.
- [ ] #8 `backlog doc delete <docId>` on a document that is not archived exits non-zero with a message saying a document must be archived before it can be deleted, and leaves the file unchanged.
- [ ] #9 `backlog doc delete` asks no question, also when its input is not a terminal, and offers no confirmation flag: `backlog doc delete <docId> --yes` fails with an unknown option error and deletes nothing.
- [ ] #10 Delete releases the ID. With `doc-5` as the highest document number: after `backlog doc archive doc-5` a new document gets `doc-6`. After `doc-6` is archived and deleted and `doc-5` is deleted, the next `backlog doc create` assigns `doc-5` again.
- [ ] #11 The number of a deleted document stays reserved while another file in this checkout or a committed file on another branch still uses it.
- [ ] #12 After a successful delete the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the removed file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [ ] #13 For delete, a `documentation` entry names the file when it is one of two paths written from the project root: the archive path the file was removed from (`backlog/archive/docs/...`) or the path the file had before it was archived (`backlog/docs/...`). As for archive, the entry also matches with `./` in front of the path or with `#` and a fragment after it, and a URL, an absolute path or a bare ID such as `doc-3` does not match.
- [ ] #14 Delete changes no task file and no draft file.
- [ ] #15 `backlog doc restore` and `backlog doc delete` for an ID that no document claims exit non-zero with a not found message and change nothing.
- [ ] #16 An ID claimed by more than one file, counting `backlog/docs/` and `backlog/archive/docs/` together, fails closed for restore and for delete: the command exits non-zero with the ambiguity message that lists each file with its folder, and nothing is moved or removed.
- [ ] #17 An archived document file that is a symbolic link is restored as a link to the same target.
- [ ] #18 Delete of an archived document file that is a symbolic link removes the link only. The file it points to is still in place and unchanged.
- [ ] #19 With auto-commit on (`auto_commit: true`), a successful restore makes one commit that holds the move of the file and nothing else, and a successful delete makes one commit that holds the removal of the file and nothing else.
- [ ] #20 With auto-commit off, restore and delete make no commit and add nothing to the Git index.
- [ ] #21 When the file was moved or removed but the commit fails, the command says that the document was restored or deleted and that committing the change failed, and exits non-zero.
- [ ] #22 The MCP server offers the tools `document_restore` and `document_delete`. Each takes one document ID like `document_view`, rejects unknown fields (so there is no confirmation field), and returns a success message and the same refusal messages as the CLI. `document_delete` also returns the line of tasks and drafts.
- [ ] #23 `backlog doc --help` lists `restore` and `delete`, and the help and help schema of each command describe it with an example.
- [ ] #24 Each operation is one core function that the CLI command and the MCP tool both call. Neither holds a rule of its own, and restore reuses the file move that archive uses.
- [ ] #25 Tests drive the CLI for every behavior above and the MCP tools for the same rules.
- [ ] #26 `CLI-INSTRUCTIONS.md`, the shipped guides (`backlog instructions` and the agent guidelines) and the MCP guides that list the document tools say that removing a document takes two steps, archive then delete, that delete asks no question and releases the ID, that tasks naming the file are printed and not changed, and how an archived document is restored.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: one move with a direction. archiveDocument becomes a one-line call of a private moveDocument(documentId, direction), and restoreDocument is the other call; the lookup, the refusal, the reads before the move, the move through moveRecordFile, the content store and the commit live once in moveDocument. A shared lookup (loadDocumentForChange) gives archive, restore and delete the same not-found and wrong-state answers.
2. Refusals: DocumentArchivedError names backlog doc restore <id>; DocumentNotArchivedError for restore and delete; DocumentFileExistsError takes the operation, so restore names the file already in the docs folder.
3. Delete: deleteDocument(documentId) refuses a document that is not archived, reads the tasks and drafts that name either path of the file (archive path and the path before the archive), removes the file through FileSystem.removeArchivedDocumentFile, and commits the removal alone. That helper removes only the file of an archived document: it refuses a document that is not archived, a path outside the archive folder for documents and a file that no longer claims the document's ID, and removes a link as a link.
4. Commit failure: restore and delete throw ChangeNotCommittedError with the task wording; widen its comment.
5. Content store: a restored document is published at once (addDocument), as an archived one is removed at once.
6. Adapters: backlog doc restore and backlog doc delete (no options, so --yes is unknown) and the MCP tools document_restore and document_delete with the input of document_view; one shared report of the confirmation and the line of tasks and drafts per interface.
7. Guides: CLI-INSTRUCTIONS.md, the task-execution guide, agent guidelines, the two MCP overviews and src/mcp/README.md.
8. Tests outside the repository: CLI for every criterion, MCP for the same rules, core and storage rules, link cases with auto-commit for a target inside and outside the repository, and the commit-failure sentence. Check criteria 10 and 11 against the document ID generator as it is.
<!-- SECTION:PLAN:END -->

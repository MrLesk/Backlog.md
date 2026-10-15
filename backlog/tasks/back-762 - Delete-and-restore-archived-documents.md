---
id: BACK-762
title: Delete and restore archived documents
status: Done
assignee:
  - '@codex-762'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-15 22:15'
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
  - src/core/backlog.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/mcp-document-restore-delete.test.ts
modified_files:
  - .github/copilot-instructions.md
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - AGENTS.md
  - DEVELOPMENT.md
  - README.md
  - backlog/config.yml
  - backlog/tasks/back-715 - Upgrade-Bun-to-1.4.3-and-refresh-dependencies.md
  - backlog/tasks/back-716 - Enable-bytecode-for-compiled-Backlog-executables.md
  - >-
    backlog/tasks/back-717 -
    Simplify-x64-Bun-packaging-and-retain-old-CPU-checks.md
  - backlog/tasks/back-718 - Use-Bun’s-built-in-TypeScript-checker.md
  - >-
    backlog/tasks/back-719 -
    Replace-task-completion-with-one-archive-flow-and-add-task-delete.md
  - backlog/tasks/back-730 - Add-task-delete-for-archived-tasks.md
  - backlog/tasks/back-731 - Restore-archived-tasks-to-the-board.md
  - backlog/tasks/back-761 - Archive-documents-from-the-CLI-and-MCP.md
  - >-
    backlog/tasks/back-765 -
    Commit-moved-linked-record-files-as-links-and-report-a-failed-commit-in-one-sentence.md
  - biome.json
  - bun.lock
  - bun.nix
  - flake.lock
  - flake.nix
  - package.json
  - scripts/build.ts
  - src/commands/task-wizard.ts
  - src/core/archived-task-move.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/statistics.ts
  - src/file-system/operations.ts
  - src/mcp/errors/mcp-errors.ts
  - src/server/index.ts
  - src/test/archived-task-folders.test.ts
  - src/test/board-tui-move.test.ts
  - src/test/cli-doc-archive.test.ts
  - src/test/cli-doctor.test.ts
  - src/test/cli-missing-storage-directories.test.ts
  - src/test/cli-released-id-draft-links.test.ts
  - src/test/cli-task-delete.test.ts
  - src/test/cli-task-restore.test.ts
  - src/test/config-commands.test.ts
  - src/test/content-store.test.ts
  - src/test/document-archive.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/malformed-task-dependencies.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/react-dom-preload.test.ts
  - src/test/server-statistics-endpoint.test.ts
  - src/test/statistics.test.ts
  - src/test/vacated-task-references.test.ts
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/utils/task-search.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/utils/mermaid.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/mcp-document-restore-delete.test.ts
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
- [x] #1 `backlog doc restore <docId>` on an archived document exits zero, prints `Restored document <id>`, and moves the file from `backlog/archive/docs/` back to the same relative path under `backlog/docs/`. Folders that no longer exist are created.
- [x] #2 The restored file is byte for byte the archived file. Restore does not rewrite it, so the document keeps its ID.
- [x] #3 A restored document behaves like any other document: `backlog doc list` and `backlog doc search` show it, and `backlog doc update` changes it.
- [x] #4 Restore never replaces a file. When `backlog/docs/` already has a file at the destination path, the command exits non-zero with a message that names that file, and no file is moved or changed.
- [x] #5 `backlog doc restore <docId>` on a document that is not archived exits non-zero with a message saying the document is not archived, and changes nothing.
- [x] #6 From this task on, the read-only message for archived documents names the restore command, for example `Document doc-3 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-3`. It is the same message everywhere it appears: `backlog doc update`, `backlog doc archive`, the MCP tools `document_update` and `document_archive`, and `PUT /api/docs/<id>`.
- [x] #7 `backlog doc delete <docId>` on an archived document exits zero, prints `Deleted document <id>`, and removes the document's file from `backlog/archive/docs/`. Afterwards `backlog doc view <docId>` no longer finds the document.
- [x] #8 `backlog doc delete <docId>` on a document that is not archived exits non-zero with a message saying a document must be archived before it can be deleted, and leaves the file unchanged.
- [x] #9 `backlog doc delete` asks no question, also when its input is not a terminal, and offers no confirmation flag: `backlog doc delete <docId> --yes` fails with an unknown option error and deletes nothing.
- [x] #10 The number of a deleted document stays reserved while another file in this checkout or a committed file on another branch still uses it.
- [x] #11 After a successful delete the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the removed file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [x] #12 For delete, a `documentation` entry names the file when it is one of two paths written from the project root: the archive path the file was removed from (`backlog/archive/docs/...`) or the path the file had before it was archived (`backlog/docs/...`). As for archive, the entry also matches with `./` in front of the path or with `#` and a fragment after it, and a URL, an absolute path or a bare ID such as `doc-3` does not match.
- [x] #13 Delete changes no task file and no draft file.
- [x] #14 `backlog doc restore` and `backlog doc delete` for an ID that no document claims exit non-zero with a not found message and change nothing.
- [x] #15 An ID claimed by more than one file, counting `backlog/docs/` and `backlog/archive/docs/` together, fails closed for restore and for delete: the command exits non-zero with the ambiguity message that lists each file with its folder, and nothing is moved or removed.
- [x] #16 An archived document file that is a symbolic link is restored as a link to the same target.
- [x] #17 Delete of an archived document file that is a symbolic link removes the link only. The file it points to is still in place and unchanged.
- [x] #18 With auto-commit on (`auto_commit: true`), a successful restore makes one commit that holds the move of the file and nothing else, and a successful delete makes one commit that holds the removal of the file and nothing else.
- [x] #19 With auto-commit off, restore and delete make no commit and add nothing to the Git index.
- [x] #20 When the file was moved or removed but the commit fails, the command says that the document was restored or deleted and that committing the change failed, and exits non-zero.
- [x] #21 The MCP server offers the tools `document_restore` and `document_delete`. Each takes one document ID like `document_view`, rejects unknown fields (so there is no confirmation field), and returns a success message and the same refusal messages as the CLI. `document_delete` also returns the line of tasks and drafts.
- [x] #22 `backlog doc --help` lists `restore` and `delete`, and the help and help schema of each command describe it with an example.
- [x] #23 Each operation is one core function that the CLI command and the MCP tool both call. Neither holds a rule of its own, and restore reuses the file move that archive uses.
- [x] #24 Tests drive the CLI for every behavior above and the MCP tools for the same rules.
- [x] #25 `CLI-INSTRUCTIONS.md`, the shipped guides (`backlog instructions` and the agent guidelines) and the MCP guides that list the document tools say that removing a document takes two steps, archive then delete, that delete asks no question and releases the ID, that tasks naming the file are printed and not changed, and how an archived document is restored.
- [x] #26 Delete releases the ID once no file uses its number. With `doc-5` as the highest document number, after `backlog doc archive doc-5` a new document gets `doc-6`; after `doc-6` is archived and deleted and `doc-5` is deleted, the next `backlog doc create` assigns `doc-5` again when there is no Git repository, when auto-commit is on, or once the deletions are committed. With auto-commit off, the number of a committed document stays reserved until the deletion is committed, because the committed file still holds it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the existing BACK-762 history and merge exact parent BACK-761 9e8b06b9856a486c766cae8ea248e4907b102a6c.
2. Add real Git CLI and MCP regressions for committed nested documents archived with auto-commit off, with the archive both unstaged and staged, then deleted with auto-commit on.
3. Keep the repair in Core.deleteDocument: derive the active and archived paths through existing FileSystem mappings and stage/select both in the existing scoped commit.
4. Verify restore/delete contracts, IDs, links, commit failures, task coordination/publication and creation safety; run canonical type/lint/build checks and compiled CLI/MCP probes.
5. Review for simpler code, preserve objective evidence and complete the approved existing PR branch update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-762-document-delete-restore, on top of BACK-761 (pull request #1106).

Core: restore is the archive move in the other direction. Core.archiveDocument and Core.restoreDocument are one-line calls of the private moveDocument(documentId, direction), which holds the lookup, the refusal, the reads before the move (auto-commit setting, records naming the file), the move through moveRecordFile and moveWithoutReplacing, the content store update (removeDocument on archive, the new addDocument on restore) and the commit. Core.deleteDocument shares the lookup and refusal (loadDocumentForChange) and the records lookup (listRecordsDocumenting, which now takes several paths: delete matches the archive path and the path before the archive). DOCUMENT_CHANGE_WORDS gives the commit verb and the past tense of each operation, used for the commit message and for ChangeNotCommittedError.

Refusals: DocumentArchivedError names backlog doc restore <id>. DocumentNotArchivedError answers restore and delete of a document that is not archived. DocumentFileExistsError takes the operation, so restore names the docs folder. All extend RecordRefusedError, so MCP reports them as VALIDATION_ERROR through runCoreOperation and the web save as 400.

Removing the file: FileSystem.removeArchivedDocumentFile(document) removes only the file of an archived document. It refuses a document that is not archived and a file that no longer claims the document's ID; documentFilePath already refuses a path with .. or an absolute path. unlink removes a link as a link.

Adapters: backlog doc restore and backlog doc delete have no options, so --yes is an unknown option. The MCP tools document_restore and document_delete take the input of document_view. One reportDocumentChange per interface prints archive, restore and delete. Restore also reports the records that name the archive path the file left (choice to confirm).

ID release, criteria 10 and 11 against the generator as it is: generateNextDocId counts local files (frontmatter ID and file-name number, both folders) and the committed files of every local branch, the current one included (listAllBranches). So delete releases the number without Git and with auto-commit on. With auto-commit off and the document committed, the current branch's last commit still claims the number until the deletion is committed; the task ID step does not read the current branch, so tasks release at once. Criterion 10 is left unchecked and the point is reported for a ruling; the generator is unchanged.

Tests: src/test/cli-doc-restore-delete.test.ts (31) and src/test/mcp-document-restore-delete.test.ts (9) are new. src/test/document-archive.test.ts adds the core functions, the content store and removeArchivedDocumentFile. src/test/linked-record-commit.test.ts commits archive, restore and delete of a linked document file (target inside and outside). src/test/commit-failure-after-change.test.ts adds doc restore and delete for the CLI and MCP. BACK-761 tests follow the new read-only message, tool list and guide wording. Four deliberate breaks (ID check, content store on restore, the path before the archive, removing the link target) each fail a test.

Checks: bunx tsc --noEmit and bun run check . clean. One file at a time: cli-doc-restore-delete 31, mcp-document-restore-delete 9, document-archive 44, linked-record-commit 15, commit-failure-after-change 14, cli-doc-archive 35, mcp-document-archive 10, server-document-archive 3, mcp-server 16, content-store 67, docs-recursive 3, content-identity 13, no failures. bun run test: 3,169 pass, 8 skip, 0 fail across 304 files at commit 87743b47 (it exits 1 with no failing test, as on the base); the last commit changes two comments or descriptions and adds one MCP guide test, whose files then passed on their own. End-to-end CLI and MCP-over-stdio scripts ran against a binary built from this branch.

Ruling on the released ID (coordinator, 2026-10-14): keep the document ID step as it is and state its behavior in the criterion. The document ID step moves to the task allocator in BACK-735, which gives documents the task rule; changing it here would do part of BACK-735 early and would free a number when a document file is removed by hand without a commit. The old criterion 10 was removed and added back reworded as criterion 26, so criteria 11 to 26 of the earlier list are now 10 to 25.

Proof of criterion 26, src/test/cli-doc-restore-delete.test.ts: no Git repository, the full doc-5 and doc-6 sequence ("releases the ID, so the next created document receives it"); auto-commit on ("releases the ID of a deleted document when auto-commit is on"); auto-commit off with a committed document, reserved before the deletion is committed and given out again after it ("keeps the number of a committed document until its deletion is committed when auto-commit is off", added for this ruling); and src/test/mcp-document-restore-delete.test.ts "releases the ID of a deleted document for the next document_create" for a document that was never committed. All pass; cli-doc-restore-delete has 32 tests now.

Shell completion: `backlog doc restore` and `backlog doc delete` complete the IDs of archived documents (new getArchivedDocumentIds on listArchivedDocuments); every other doc command still completes the documents in the docs folder. One condition in getArgumentCompletions names restore and delete of both tasks and documents, the one task restore and task delete already used. Decision commands complete no IDs, as before.

Refresh: exact parent BACK-761 9e8b06b9 merged cleanly with --no-commit --no-ff. Modified-file metadata includes the inherited integration changes; the bounded repair will be reviewed against that parent. No commit or push yet.

Regression before repair: four real Git tests (CLI and MCP, each with archive unstaged and staged) fail because delete reports success without making a deletion commit. The repair derives active and archived record paths in Core.deleteDocument and selects/stages both through the existing path-scoped commit owner.

Refresh verification (2026-10-16): 511 unique tests passed across 27 files. Document/commit/identity group: 192 tests across 11 files; its initial interactive viewer failure came from an omitted terminal environment, and the unchanged cli-doc-archive file then passed 37/37 with env -u NO_COLOR TERM=xterm-256color. Inherited task locking, publication, applied-deletion and draft lifecycle group: 241/241 across 11 files. Creation safety, document baseline, task documentation and completions: 78/78 across 5 files. All four new real-Git regression cases failed before the repair (no deletion commit) and passed after it. bun run check:types passed 555 files; bun run check . passed 452 files; bun run build and git diff --check passed. Biome 2.5.15 reformatted only two existing test blocks during integration.

Compiled probes against dist/backlog passed in isolated temporary projects: byte-preserving nested document restore, archive with auto-commit off, enable auto-commit, delete through CLI and through a fresh MCP stdio session, one scoped deletion commit, neither record path left in HEAD, unchanged unrelated staged and unstaged content, and doc-1 reused. The first MCP probe changed config externally in a session with no initialized content store and retained cached autoCommit=false; the final bounded probe starts MCP after the setting is enabled. Config-watch behavior is outside this repair and source is unchanged for it.

Criterion evidence: restore/refusal/byte/list/update rules and nested paths are covered by CLI restore/delete, MCP restore/delete and document-archive tests; link-only deletion safety by CLI link and linked-record-commit tests; documentation reports/no task edits by CLI and MCP tests; scoped commit/no-commit/applied commit failure by both regression cases and commit-failure-after-change tests; ID release and other-file/other-branch reservation by CLI Git cases and MCP create. Help, shipped guide wording and completion are tested. The canonical Bun type checker replaces the older tsc command named in this task DoD.

Subtraction review: the repair adds no exported helper, lock, new abstraction or adapter rule. Both record paths stay in the one delete owner and existing stageChangedPath/commitFiles flow. Full-context architecture review returned KEEP with no new product choice. Coordinator authorized finalization and the protected existing-branch push after independent proof.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Document restore/delete is complete in the CLI and MCP. Restore moves archived files back byte for byte with the same ID; deletion is archived-only, removes links without their targets, reports documentation references and preserves unrelated work.

The refreshed delete commit now includes the former active path and the archived path. A document archived with auto-commit off and later deleted with auto-commit on no longer remains in HEAD or keeps its ID reserved there. Existing ID claims on other files and branches remain respected.

Verified with 511 unique tests across 27 files, four failing-before/passing-after Git regressions, canonical type/lint/build checks and compiled CLI/MCP probes. Exact BACK-761 parent merged without rewriting history; architecture review accepted the bounded implementation. Documents still have no update lock; that follow-up remains outside this task. Config-cache behavior is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->

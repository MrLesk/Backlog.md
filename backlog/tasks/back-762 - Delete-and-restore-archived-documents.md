---
id: BACK-762
title: Delete and restore archived documents
status: Done
assignee:
  - '@codex-762'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-15 22:36'
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
  - src/git/operations.ts
  - src/test/git.test.ts
modified_files:
  - CLI-INSTRUCTIONS.md
  - backlog/tasks/back-762 - Delete-and-restore-archived-documents.md
  - src/cli.ts
  - src/completions/data-providers.ts
  - src/completions/helper.test.ts
  - src/completions/helper.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/file-system/operations.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/mcp/README.md
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/index.ts
  - src/mcp/tools/documents/schemas.ts
  - src/test/cli-doc-archive.test.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/commit-failure-after-change.test.ts
  - src/test/document-archive.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/mcp-document-archive.test.ts
  - src/test/mcp-document-restore-delete.test.ts
  - src/test/mcp-server.test.ts
  - src/test/server-document-archive.test.ts
  - src/utils/id-generators.ts
  - src/test/git.test.ts
  - src/git/operations.ts
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
1. Preserve the existing BACK-762 history and exact BACK-761 parent 9e8b06b9856a486c766cae8ea248e4907b102a6c.
2. Keep Core.deleteDocument active and archived record paths in the one staging/scoped-commit owner.
3. Resolve missing historical paths through the existing GitOperations helper: find the nearest existing real folder, reconstruct the suffix and retain that folder for repository discovery; share the result in path context and relative commit paths.
4. Require every selected commit path to be addressable by getRelativePathForRepo before temporary index/commit work, removing the unresolved absolute fallback while preserving supported link behavior and applied-state errors.
5. Verify CLI/MCP staged and unstaged archives with zero/one/several removed parents, historical index entries through ordinary/linked folders, and refusal of an unresolved selected path in one physical repository.
6. Run the full affected 32-file suite, canonical checks and compiled CLI/MCP/external-folder probes. Complete the accepted source review, final record and protected existing-branch update.
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

Current-head review reproduction: at 285702c8 archive a committed nested document with auto-commit off, remove one or three empty active-path ancestors, enable auto-commit and delete. Delete reports success with no new commit; HEAD retains the record and next ID is doc-2. getIndexEntries returns no entry despite git ls-files still tracking it. GitOperations is byte-identical to eee13289; this is an incomplete existing repair, not a new contract. An existing folder link reproduces the same missing-parent lookup while its physical record path remains tracked. Coordinator approved the correction in the existing shared Git path owner. Modified-file metadata is now scoped to this task against exact parent 9e8b06b9, rather than unrelated inherited merge changes.

Missing-parent regression proof before correction: the existing parents-present controls pass (4); all 12 added missing-parent cases fail across CLI, MCP and direct Git operations. Unstaged archives silently make no delete commit; staged archives report applied deletion with commit reconciliation failure. Direct Git index lookups return no entry for real tracked historical paths, including paths through an existing linked folder. The shared GitOperations resolver now reconstructs from the nearest real existing folder and keeps it as repository-discovery cwd; Core two-path scope is unchanged.

Missing-parent correction preliminary proof: all 16 targeted real Git cases pass after 12 added cases failed before the correction. Canonical type checker passed 555 files, Biome passed 452 files and build passed. Four compiled probes (CLI and fresh MCP, each one or several removed active folders) pass byte-preserving restore, one scoped delete commit, no document paths left in HEAD, unchanged unrelated staged/unstaged content, and doc-1 reuse. Full-context review returned KEEP. Subtraction review keeps the one existing private path resolver; both Git path context and relative commit paths share its reconstructed path, and repository discovery uses the nearest existing real folder. Core two-path scope and existing changed-file-link rules are unchanged. Full affected-suite evidence remains in progress.

Verification found one newly introduced regression and finalization was paused. The external-linked-folder archive test reports success after the ancestor correction, while immutable285702c8 reports the required already-archived commit failure and makes no commit. Real source-path context and relative path are null in both. commitFiles retained that unresolved absolute lexical path, then join(repoRoot, path) manufactured a synthetic in-repository path. The nearest-ancestor resolver made that synthetic empty path reconcile successfully. The coordinator approved removing this overbroad commitFiles fallback through the existing selected-path authority; no document-specific check or promised-behavior change.

Final correction verification (2026-10-16): 643 tests passed across 32 files, 0 failures, 3,136 assertions, with env -u NO_COLOR TERM=xterm-256color and the CI 10-second test timeout. The suite covers Git/index/commit paths, ordinary and linked missing parents, document CLI/MCP/Core contracts, decisions baseline, scope, applied commit errors, inherited task locks/publication, creation safety, documentation and completions. Type checker passed 555 files, Biome passed 452 files, build and git diff --check passed. The selected-path unit proves an unresolved path in one physical repository fails with HEAD and the staged index unchanged; its fixture uses realpath as existing link fixtures do. This does not add a cross-repository atomicity promise or alias-root policy.

The initial ancestor-only correction exposed the old commitFiles absolute-path fallback and failed the existing external-linked-folder archive case. Read-only immutable-before/working-after probes proved the regression. Removing that fallback restores the existing exit 1/no-commit/already-archived failure while the nearest-ancestor resolution fixes valid missing historical parents. The existing external-folder test is unchanged. The new guard test failed before the guard and now passes. No Core, lock, allocator, containment-policy or exported-API changes were added.

Compiled dist/backlog probes passed CLI and fresh MCP deletion with one and several original folders removed: exactly one scoped deletion commit, no active/archive record in HEAD, byte-preserving restore, unchanged unrelated staged/unstaged content, and doc-1 reuse. A compiled external-linked-folder probe also restores the supported applied archive failure with no commit. Source probe before 285702c8 and final correction records remain in temporary proof files; no fixture changes were made in the repository.

Final full-context review returned KEEP with no new product choice. Subtraction review keeps one shared private resolver and removes the unsafe fallback instead of adding another path owner. Modified-file metadata is scoped against exact parent 9e8b06b9. Reviewed source/test hashes remain GitOperations 25122826821748083420c7c88e646392ac852da4, git.test 1e51a00a96d411bb03bb5836138c74bb4f2f6afe, CLI 683a6990c3bc7667d2538f42fde62612306ad1ca and MCP abfd4eb2ea2ed320c9a70bf87ed28c294e30b831.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Document restore/delete is complete in the CLI and MCP. Restore preserves file bytes and IDs; archived-only delete removes file links without their targets, reports documentation references and keeps unrelated work unchanged.

Delete commits both the former active path and archived path, including when empty original folders were removed after an uncommitted archive. The shared Git path resolver now finds the nearest existing real folder and keeps its repository context. Selected commits reject unresolved paths before index/commit work, preserving the existing external-linked-folder failure behavior and truthful applied-state message.

Verified with 643 tests across 32 files, failing-before/passing-after missing-parent and selected-path regressions, canonical type/lint/build checks, and compiled CLI/MCP and external-folder probes. Full-context review accepted the bounded implementation. Existing claims on other files/branches remain respected; document update locks and config-cache behavior remain outside this task.
<!-- SECTION:FINAL_SUMMARY:END -->

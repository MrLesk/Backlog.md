---
id: BACK-763
title: 'Archive, delete and restore decisions from the CLI'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-14 06:06'
labels:
  - enhancement
dependencies:
  - BACK-762
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - core
  - commands
  - file-storage
  - content-store
  - web-server
modified_files:
  - src/types/index.ts
  - src/constants/index.ts
  - src/utils/decision-id.ts
  - src/file-system/operations.ts
  - src/core/content-store.ts
  - src/utils/id-generators.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/mcp/tools/documents/handlers.ts
  - src/server/index.ts
  - src/test/server-document-archive.test.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/document-archive.test.ts
  - src/test/commit-failure-after-change.test.ts
  - src/test/content-identity.test.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/cli-decision-archive.test.ts
  - src/test/server-decision-archive.test.ts
  - src/test/decision-archive.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/mcp-server.test.ts
priority: high
type: enhancement
ordinal: 384000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decisions have the same gap that issue #1101 reports for documents. `backlog decision --help` lists only `create` and `list`, so a decision that was recorded by mistake or is no longer wanted can only be removed by deleting its Markdown file by hand, which the shipped guidance forbids.

The owner's ruling on issue #1101 is that decisions get the same three operations as documents (BACK-761, BACK-762), with the same rules: archive first, delete only an archived decision, restore with the same ID. Archived decisions live in `backlog/archive/decisions/`. The operations go through the same core functions the document commands use, so the two kinds cannot drift apart.

Rules from the ruling that shape this task:

- The CLI commands only translate input and output. No rule lives in the CLI or the web layer.
- A task's `documentation` list is free text (paths or URLs). Archive and delete change no task. They print the tasks and drafts that name the decision's file, so a person can update them.
- The document code is reused, not copied.

Scope:

- CLI only. The web Archive button is the next task of this stack. The web is touched only where it shares core code: archived decisions leave its sidebar and search, and its save refuses them.
- Choice to confirm on the pull request: decisions get no MCP tools. The MCP server has no decision tools today, and BACK-739 records the same ruling for the decision commands of issue #1065.
- Known gap: no command prints a single decision until BACK-739 adds `backlog decision view`, so an archived decision cannot be read from the CLI. It can be restored and is then listed again.
- Known gap: decisions have no update lock today (BACK-736 adds one), so these operations take no lock.
- Decision files are stored flat in `backlog/decisions/`, so there is no subfolder path to keep.

Paths below use the default `backlog/` folder. A project with another backlog folder uses that folder.

This is the third of four stacked tasks for issue #1101. Each is one branch and one pull request. This one builds on BACK-762.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog decision archive <decisionId>` on a decision in `backlog/decisions/` exits zero, prints `Archived decision <id>`, and moves the decision's file under the same name to `backlog/archive/decisions/`. The folder is created when it does not exist.
- [x] #2 `<decisionId>` is accepted as `decision-2`, as `2`, and with leading zeros such as `decision-002`, the same forms the document commands accept for a document ID.
- [x] #3 `backlog decision restore <decisionId>` on an archived decision exits zero, prints `Restored decision <id>`, and moves the file under the same name back to `backlog/decisions/`. A restored decision shows up in `backlog decision list` again.
- [x] #4 Archive and restore do not rewrite the file. It is byte for byte the same before and after, so the decision keeps its ID.
- [x] #5 `backlog decision delete <decisionId>` on an archived decision exits zero, prints `Deleted decision <id>`, and removes the file from `backlog/archive/decisions/`.
- [x] #6 `backlog decision delete` asks no question, also when its input is not a terminal, and offers no confirmation flag: `backlog decision delete <decisionId> --yes` fails with an unknown option error and deletes nothing.
- [x] #7 `backlog decision delete <decisionId>` on a decision that is not archived exits non-zero with a message saying a decision must be archived before it can be deleted, and leaves the file unchanged.
- [x] #8 `backlog decision restore <decisionId>` on a decision that is not archived exits non-zero with a message saying the decision is not archived, and changes nothing.
- [x] #9 `backlog decision archive <decisionId>` on a decision that is already archived exits non-zero with the read-only message for archived decisions and changes nothing.
- [x] #10 Archive and restore never replace a file. When the destination folder already has a file of that name, the command exits non-zero with a message that names the file, and no file is moved or changed.
- [x] #11 Each of the three commands exits non-zero with a not found message for an ID that no decision claims, and changes nothing.
- [x] #12 An ID claimed by more than one file, counting `backlog/decisions/` and `backlog/archive/decisions/` together, fails closed for all three commands: each exits non-zero with the ambiguity message that lists each file with its folder, and nothing is moved or removed.
- [x] #13 `backlog doctor` reports an ID claimed by a file in `backlog/decisions/` and a file in `backlog/archive/decisions/` as a duplicate decision ID and names both files.
- [x] #14 An archived decision keeps its ID reserved: with `decision-1` in `backlog/decisions/` and `decision-2` archived, `backlog decision create` assigns `decision-3`.
- [x] #15 An archived decision file is counted the way a decision file in `backlog/decisions/` is counted after BACK-732: by the ID in its frontmatter, by the number in its file name, and in the committed files of other branches.
- [x] #16 An archived decision is read-only. Every way of changing a decision that exists when this task is built refuses it with one core message that names the restore command, for example `Decision decision-2 is archived. Archived decisions are read-only. Restore it first: backlog decision restore decision-2`, and leaves the file unchanged. On `main` today the only such way is the web save `PUT /api/decisions/<id>`, which answers 400 with a JSON `error` holding that message.
- [x] #17 An archived decision is left out of `backlog decision list` (plain and `--json`), `backlog search`, and the web sidebar and web search (`GET /api/decisions` and `GET /api/search`).
- [x] #18 After a successful archive or delete the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the decision's file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [x] #19 Naming a decision's file follows the rule documents use. For archive the entry is the path the file had before the move, written from the project root (`backlog/decisions/...`). For delete it is that path or the archive path (`backlog/archive/decisions/...`). The entry also matches with `./` in front of the path or with `#` and a fragment after it. A URL, an absolute path or a bare ID such as `decision-2` does not match.
- [x] #20 Archive, restore and delete change no task file and no draft file.
- [x] #21 A decision file that is a symbolic link is archived and restored as a link to the same target. Delete removes the link only, and the file it points to is still in place and unchanged.
- [x] #22 With auto-commit on (`auto_commit: true`), each successful archive, restore and delete makes one commit that holds that one change and nothing else.
- [x] #23 With auto-commit off, the three commands make no commit and add nothing to the Git index.
- [x] #24 When the file was moved or removed but the commit fails, the command says what was done and that committing the change failed, and exits non-zero.
- [x] #25 The MCP server gains no decision tool: its tool list contains no tool whose name starts with `decision_`.
- [x] #26 `backlog decision --help` lists `archive`, `restore` and `delete`, and the help and help schema of each command describe it with an example.
- [x] #27 Documents and decisions share one implementation of archive, delete and restore. The decision commands hold no rule of their own, and no second copy of the document code exists.
- [x] #28 Tests drive the CLI for every behavior above.
- [x] #29 `CLI-INSTRUCTIONS.md` and the shipped guides (`backlog instructions` and the agent guidelines) describe the three decision commands: archive then delete as the two steps of removing a decision, the reserved ID, the read-only state, and restore.
- [x] #30 Delete releases the ID once no file uses its number. After `decision-3`, the highest decision number, is archived and deleted, the next `backlog decision create` assigns `decision-3` again when there is no Git repository, when auto-commit is on, or once the deletion is committed. With auto-commit off, the number of a committed decision stays reserved until the deletion is committed, because the committed file still holds it. The number also stays reserved while another file in this checkout or a committed file on another branch still uses it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. One implementation for documents and decisions. A content record kind ("document" | "decision") supplies the lookup (Core.getDocument, the new Core.getDecision), the two folders and the file check (FileSystem.contentRecordFilePath, contentRecordProjectPath, removeArchivedContentRecordFile), the refusal words and the noun (one words table), and the store calls (ContentStore addDocument/removeDocument, the new addDecision/removeDecision). moveDocument, deleteDocument and loadDocumentForChange become moveContentRecord, deleteContentRecord and loadContentRecordForChange; archive, restore and delete are archiveContentRecord, restoreContentRecord and deleteContentRecord. The document error classes become ContentRecordArchivedError, ContentRecordNotArchivedError and ContentRecordFileExistsError. The CLI runs the archive, restore and delete commands of both kinds through one action that takes the kind; the MCP document handlers keep a document-only report helper, since MCP has document tools only; both print the lines core describes (describeContentRecordChange).
2. Decisions are flat: listDecisions reads backlog/decisions only and listArchivedDecisions reads backlog/archive/decisions, through one reader with the existing flat pattern; no folder walk.
3. Decisions get what documents have: Core.getDecision resolves an ID over both folders and names files from the project root when it is ambiguous; generateNextDecisionId and the core allocator count the archive (frontmatter, file name, other branches); doctor reports a duplicate across the two folders; archived decisions stay out of decision list (plain and --json), backlog search, GET /api/decisions and web search.
4. Read-only: every way of changing a decision on this base refuses an archived one with the core message naming backlog decision restore <id>: Core.updateDecisionFromContent (the web save, 400) and FileSystem.saveDecision. No decision view and no MCP decision tool.
5. CLI: backlog decision archive, restore and delete, with no options. Guides: CLI-INSTRUCTIONS.md, the task-execution guide and the agent guidelines.
6. Tests outside the repository: a CLI test file for every criterion, core and storage rules, the web routes, the MCP tool list, link cases with auto-commit for a target inside and outside the repository, and the commit-failure sentence; the four cases of the released-ID rule.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-763-decision-archive-delete-restore, on top of BACK-762 (pull request #1107).

One implementation: the document operations of BACK-761 and BACK-762 now take a content record kind (ContentRecordKind, "document" | "decision"). Core.archiveContentRecord and Core.restoreContentRecord call moveContentRecord(kind, id, direction); Core.deleteContentRecord removes; loadContentRecordForChange gives all three the same refusals. A kind supplies its lookup and store calls in Core.contentRecords (getDocument or the new getDecision; ContentStore removeDocument/addDocument or the new removeDecision/addDecision), its words in CONTENT_RECORD_WORDS (noun, plural, the CLI command named in the read-only message, the folder name, the not-found message), and its storage in FileSystem.contentRecordStorage (the two folders, the path under them, how a file's ID is read for the check before removal). The error classes are ContentRecordArchivedError, ContentRecordNotArchivedError and ContentRecordFileExistsError; the result is ContentRecordChangeResult; describeContentRecordChange gives the lines the CLI prints and MCP returns (MCP adds periods). The storage helpers are contentRecordFilePath, contentRecordProjectPath and removeArchivedContentRecordFile; the last refuses a record that is not archived and a file that no longer claims the record's ID, and a decision path with a folder in it is refused when the path is built. A restored record reaches the store without the archived key.

Decisions are flat: listDecisions reads backlog/decisions and listArchivedDecisions reads backlog/archive/decisions through one reader with the existing decision-*.md pattern; no folder walk. getDecision resolves an ID over both folders and names files from the project root when it is ambiguous; findDecisionById takes the describe function as findDocumentById does. The decision ID step and the core allocator count the archive (frontmatter, file name, and the archive folder on every branch); doctor checks both folders.

Read-only: the ways to change a decision on this base are Core.updateDecisionFromContent (the web save PUT /api/decisions/<id>) and FileSystem.saveDecision (behind createDecision); both refuse an archived decision, core with the message naming backlog decision restore <id>, which the web save returns as 400. GET /api/decisions/<id> now resolves through Core.getDecision, so an archived decision is served marked archived and an ID claimed in both folders answers 409, as for documents. No decision view and no MCP decision tool.

The released-ID criterion was reworded through the CLI as criterion 30, following the BACK-762 ruling: the decision ID step also reads committed files on the current branch. The old criterion 16 was removed, so criteria 17 to 30 of the earlier list are now 16 to 29.

Tests: src/test/cli-decision-archive.test.ts (34), src/test/decision-archive.test.ts (10) and src/test/server-decision-archive.test.ts (3) are new. src/test/linked-record-commit.test.ts runs the link case for documents and decisions from one table; src/test/commit-failure-after-change.test.ts adds decision archive, restore and delete; src/test/mcp-server.test.ts asserts no decision_ tool; src/test/content-identity.test.ts expects decision candidates from the project root. Five deliberate breaks (archive left out of the ID step, the archive folder left out of the branch scan, the read-only refusal removed, doctor without the archive, the store left alone on archive) each fail a test.

Checks: bunx tsc --noEmit and bun run check . clean. One file at a time: cli-decision-archive 34, decision-archive 10, server-decision-archive 3, linked-record-commit 17, commit-failure-after-change 17, mcp-server 16, document-archive 44, cli-doc-archive 35, cli-doc-restore-delete 32, mcp-document-archive 10, mcp-document-restore-delete 9, server-document-archive 3, content-identity 13, content-store 67, cli-doctor 34, filesystem 53, cli-doc-decision-board 20, server-search-endpoint 26, no failures. bun run test: 3,223 pass, 8 skip, 0 fail across 307 files (it exits 1 with no failing test, as on the base). An end-to-end run against a built binary covered the CLI, the web save and lists over HTTP, and the MCP tool list over stdio.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog decision archive`, `backlog decision restore` and `backlog decision delete` give decisions the two-step removal and the way back that documents have. Archived decisions live in `backlog/archive/decisions/`, keep their ID reserved, are read-only, and leave lists and search.

What changed
- One implementation for documents and decisions. archiveContentRecord, restoreContentRecord and deleteContentRecord take a content record kind; the kind supplies its lookup and store calls (Core.contentRecords), its words (CONTENT_RECORD_WORDS) and its storage (FileSystem.contentRecordStorage). The document commands and MCP tools call the same functions with "document", the decision commands with "decision". A third kind is one entry in each of the three places.
- Decisions are read flat from their two folders. Core.getDecision resolves an ID over both, failing closed with files named from the project root. The ID step, the core allocator and doctor count the archive.
- An archived decision is read-only: the web save answers 400 with "Decision X is archived. Archived decisions are read-only. Restore it first: backlog decision restore X", and the file save refuses it too.
- Archived decisions leave decision list (plain and --json), backlog search, GET /api/decisions and web search. MCP gains no decision tool.
- Help, CLI-INSTRUCTIONS.md, the task-execution guide and the agent guidelines describe the three commands.

Verification
- bunx tsc --noEmit and bun run check . are clean. bun run test: 3,223 pass, 8 skip, 0 fail across 307 files (it exits 1 with no failing test, as on the base).
- New decision tests on the CLI (34), in core (10) and over HTTP (3); the link-commit, commit-failure and MCP tool-list tests cover decisions too. End-to-end run against a built binary through the CLI, HTTP and MCP over stdio.

Released ID
- Same rule as for documents (BACK-762 ruling): the decision ID step counts committed files on every branch, the current one included, so with auto-commit off the number of a committed decision is released once the deletion is committed. BACK-735 aligns documents and decisions with tasks.

Choices to confirm
- GET /api/decisions/<id> serves an archived decision marked archived, as documents are served; the page's save is refused.
- The decision ambiguity message names files from the project root; the not-found message is "Decision not found: <id>".
- Restore prints the line of tasks and drafts that name the archive path, as for documents.

Known gaps
- No command prints a single decision until BACK-739; an archived decision is read by restoring it. No update lock for decisions (BACK-736). The web page still offers Edit for an archived decision opened by URL; its save is refused (BACK-764). Not verified on Windows.
<!-- SECTION:FINAL_SUMMARY:END -->

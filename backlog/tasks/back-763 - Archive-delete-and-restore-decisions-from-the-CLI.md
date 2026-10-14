---
id: BACK-763
title: 'Archive, delete and restore decisions from the CLI'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-14 05:38'
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
- [ ] #1 `backlog decision archive <decisionId>` on a decision in `backlog/decisions/` exits zero, prints `Archived decision <id>`, and moves the decision's file under the same name to `backlog/archive/decisions/`. The folder is created when it does not exist.
- [ ] #2 `<decisionId>` is accepted as `decision-2`, as `2`, and with leading zeros such as `decision-002`, the same forms the document commands accept for a document ID.
- [ ] #3 `backlog decision restore <decisionId>` on an archived decision exits zero, prints `Restored decision <id>`, and moves the file under the same name back to `backlog/decisions/`. A restored decision shows up in `backlog decision list` again.
- [ ] #4 Archive and restore do not rewrite the file. It is byte for byte the same before and after, so the decision keeps its ID.
- [ ] #5 `backlog decision delete <decisionId>` on an archived decision exits zero, prints `Deleted decision <id>`, and removes the file from `backlog/archive/decisions/`.
- [ ] #6 `backlog decision delete` asks no question, also when its input is not a terminal, and offers no confirmation flag: `backlog decision delete <decisionId> --yes` fails with an unknown option error and deletes nothing.
- [ ] #7 `backlog decision delete <decisionId>` on a decision that is not archived exits non-zero with a message saying a decision must be archived before it can be deleted, and leaves the file unchanged.
- [ ] #8 `backlog decision restore <decisionId>` on a decision that is not archived exits non-zero with a message saying the decision is not archived, and changes nothing.
- [ ] #9 `backlog decision archive <decisionId>` on a decision that is already archived exits non-zero with the read-only message for archived decisions and changes nothing.
- [ ] #10 Archive and restore never replace a file. When the destination folder already has a file of that name, the command exits non-zero with a message that names the file, and no file is moved or changed.
- [ ] #11 Each of the three commands exits non-zero with a not found message for an ID that no decision claims, and changes nothing.
- [ ] #12 An ID claimed by more than one file, counting `backlog/decisions/` and `backlog/archive/decisions/` together, fails closed for all three commands: each exits non-zero with the ambiguity message that lists each file with its folder, and nothing is moved or removed.
- [ ] #13 `backlog doctor` reports an ID claimed by a file in `backlog/decisions/` and a file in `backlog/archive/decisions/` as a duplicate decision ID and names both files.
- [ ] #14 An archived decision keeps its ID reserved: with `decision-1` in `backlog/decisions/` and `decision-2` archived, `backlog decision create` assigns `decision-3`.
- [ ] #15 An archived decision file is counted the way a decision file in `backlog/decisions/` is counted after BACK-732: by the ID in its frontmatter, by the number in its file name, and in the committed files of other branches.
- [ ] #16 An archived decision is read-only. Every way of changing a decision that exists when this task is built refuses it with one core message that names the restore command, for example `Decision decision-2 is archived. Archived decisions are read-only. Restore it first: backlog decision restore decision-2`, and leaves the file unchanged. On `main` today the only such way is the web save `PUT /api/decisions/<id>`, which answers 400 with a JSON `error` holding that message.
- [ ] #17 An archived decision is left out of `backlog decision list` (plain and `--json`), `backlog search`, and the web sidebar and web search (`GET /api/decisions` and `GET /api/search`).
- [ ] #18 After a successful archive or delete the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the decision's file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [ ] #19 Naming a decision's file follows the rule documents use. For archive the entry is the path the file had before the move, written from the project root (`backlog/decisions/...`). For delete it is that path or the archive path (`backlog/archive/decisions/...`). The entry also matches with `./` in front of the path or with `#` and a fragment after it. A URL, an absolute path or a bare ID such as `decision-2` does not match.
- [ ] #20 Archive, restore and delete change no task file and no draft file.
- [ ] #21 A decision file that is a symbolic link is archived and restored as a link to the same target. Delete removes the link only, and the file it points to is still in place and unchanged.
- [ ] #22 With auto-commit on (`auto_commit: true`), each successful archive, restore and delete makes one commit that holds that one change and nothing else.
- [ ] #23 With auto-commit off, the three commands make no commit and add nothing to the Git index.
- [ ] #24 When the file was moved or removed but the commit fails, the command says what was done and that committing the change failed, and exits non-zero.
- [ ] #25 The MCP server gains no decision tool: its tool list contains no tool whose name starts with `decision_`.
- [ ] #26 `backlog decision --help` lists `archive`, `restore` and `delete`, and the help and help schema of each command describe it with an example.
- [ ] #27 Documents and decisions share one implementation of archive, delete and restore. The decision commands hold no rule of their own, and no second copy of the document code exists.
- [ ] #28 Tests drive the CLI for every behavior above.
- [ ] #29 `CLI-INSTRUCTIONS.md` and the shipped guides (`backlog instructions` and the agent guidelines) describe the three decision commands: archive then delete as the two steps of removing a decision, the reserved ID, the read-only state, and restore.
- [ ] #30 Delete releases the ID once no file uses its number. After `decision-3`, the highest decision number, is archived and deleted, the next `backlog decision create` assigns `decision-3` again when there is no Git repository, when auto-commit is on, or once the deletion is committed. With auto-commit off, the number of a committed decision stays reserved until the deletion is committed, because the committed file still holds it. The number also stays reserved while another file in this checkout or a committed file on another branch still uses it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. One implementation for documents and decisions. A content record kind ("document" | "decision") supplies the lookup (Core.getDocument, the new Core.getDecision), the two folders and the file check (FileSystem.contentRecordFilePath, contentRecordProjectPath, removeArchivedContentRecordFile), the refusal words and the noun (one words table), and the store calls (ContentStore addDocument/removeDocument, the new addDecision/removeDecision). moveDocument, deleteDocument and loadDocumentForChange become moveContentRecord, deleteContentRecord and loadContentRecordForChange; archive, restore and delete are archiveContentRecord, restoreContentRecord and deleteContentRecord. The document error classes become ContentRecordArchivedError, ContentRecordNotArchivedError and ContentRecordFileExistsError. The CLI and MCP report helpers take the kind.
2. Decisions are flat: listDecisions reads backlog/decisions only and listArchivedDecisions reads backlog/archive/decisions, through one reader with the existing flat pattern; no folder walk.
3. Decisions get what documents have: Core.getDecision resolves an ID over both folders and names files from the project root when it is ambiguous; generateNextDecisionId and the core allocator count the archive (frontmatter, file name, other branches); doctor reports a duplicate across the two folders; archived decisions stay out of decision list (plain and --json), backlog search, GET /api/decisions and web search.
4. Read-only: every way of changing a decision on this base refuses an archived one with the core message naming backlog decision restore <id>: Core.updateDecisionFromContent (the web save, 400) and FileSystem.saveDecision. No decision view and no MCP decision tool.
5. CLI: backlog decision archive, restore and delete, with no options. Guides: CLI-INSTRUCTIONS.md, the task-execution guide and the agent guidelines.
6. Tests outside the repository: a CLI test file for every criterion, core and storage rules, the web routes, the MCP tool list, link cases with auto-commit for a target inside and outside the repository, and the commit-failure sentence; the four cases of the released-ID rule.
<!-- SECTION:PLAN:END -->

---
id: BACK-763
title: 'Archive, delete and restore decisions from the CLI'
status: Done
assignee:
  - '@codex-763'
created_date: '2026-10-13 18:46'
updated_date: '2026-10-15 22:21'
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
  - src/core/backlog.ts
  - src/test/cli-decision-archive.test.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/mcp-document-restore-delete.test.ts
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/cli.ts
  - src/completions/helper.test.ts
  - src/constants/index.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/file-system/operations.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/mcp/tools/documents/handlers.ts
  - src/server/index.ts
  - src/test/cli-decision-archive.test.ts
  - src/test/cli-doc-restore-delete.test.ts
  - src/test/commit-failure-after-change.test.ts
  - src/test/content-identity.test.ts
  - src/test/decision-archive.test.ts
  - src/test/document-archive.test.ts
  - src/test/linked-record-commit.test.ts
  - src/test/mcp-server.test.ts
  - src/test/server-decision-archive.test.ts
  - src/test/server-document-archive.test.ts
  - src/types/index.ts
  - src/utils/decision-id.ts
  - src/utils/id-generators.ts
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
1. Merge repaired BACK-762 commit 285702c87d597529e532fee11093104f2ecf5e80 into the existing BACK-763 branch, preserving its original commits and shared document/decision lifecycle owner.
2. Carry active-plus-archive path staging and scoped commit selection into deleteContentRecord for both kinds. Preserve existing links, ambiguity, allocator, locking, applied-delete errors, and publication behavior.
3. Add a decision CLI regression for a committed active record archived without auto-commit, then deleted with auto-commit. Cover staged and unstaged archives, HEAD removal, ID reuse, and unrelated index/worktree preservation. Prove it fails with the original single-path owner.
4. Run focused document and decision suites, inherited safety checks, type/lint/build checks, and compiled CLI/MCP isolated-project proofs. Review the implementation for simplification.
5. After the completed full-context KEEP review and passing verification, finalize the task, commit the reviewed merge, protect the push against the expected remote commit, and return the shared checkout to unchanged main.
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

Integration started from original BACK-763 7c641aed and exact repaired BACK-762 285702c8. Resolving three merge conflicts. First retain the original single-path shared deletion owner long enough to show that the new decision regression detects the reported mixed-auto-commit defect; then carry the parent two-path repair into that same owner.

Preserved the parent opposite-store link membership and distinct-file ambiguity assertions in document-archive tests, translated to the existing shared ContentRecord API.

Kept the BACK-763 table-driven document and decision linked-record Git tests while preserving inherited task-link coverage.

Red proof: the two new decision mixed-auto-commit CLI cases failed on the original single-path generic deletion owner (0 pass, 2 fail). Both reported success but made no commit (expected count 4, actual 3). Carried the repaired parent behavior into the existing shared deleteContentRecord: derive activeRecord with withoutArchivedFlag, resolve its path using contentRecordFilePath, pre-read config/references, remove the archive file, then stage and commit the same [removedPath, activePath] list with existing subjects/errors.

Biome 2.5.15 formatting applied to the changed decision CLI regression file after parent runtime/toolchain integration.

Biome removed the extra blank line left by the linked-record merge conflict resolution.

Progress proof: Bun 1.4.3; check:types (558 files), Biome 2.5.15 (455 files), and build pass. Six mixed-auto-commit regression cases pass across decision CLI, document CLI and document MCP. HTTP lifecycle/search: 32 pass. Inherited task lock-order, allocator, publication and applied-delete checks: 165 pass. CLI/completion/MCP stdio checks: 47 pass. The unchanged interactive document viewer failed with the default terminal environment; the complete document CLI archive suite passes (37 tests) with env -u NO_COLOR TERM=xterm-256color. Compiled-binary proof passed all six isolated-project cases; evidence /private/tmp/back-763-compiled-proof-BpO7CO/proof.json, script /tmp/back-763-compiled-proof.ts. Each case confirms both paths absent from HEAD, one scoped delete commit, ID reuse, and unrelated staged/unstaged/untracked work preserved; each MCP call starts after configuration is saved and confirms no decision_ tool.

Review hold: the complete focused lifecycle/identity/link/Git/error batch finished with 404 pass and the one known terminal-environment viewer failure; the complete failed-file rerun with the required terminal environment passed all 37 tests. No test source workaround was applied. The source remains stable. Modified-file attribution is scoped to the final feature/integration diff against exact parent 285702c8; parent-only inherited history files are excluded. Task remains In Progress for full-context architecture review, with no commit or push.

Full-context architecture review returned KEEP: no supported blocker, new decision, or source change. Acceptance evidence: the decision CLI suite proves lifecycle, ID forms, byte preservation, refusal/no-confirmation behavior, collisions, documentation reports, reservation/reuse, links, scoped Git commits, and help/guides (AC 1-15, 18-24, 26, 28-30). Core and HTTP suites prove read-only saves and filtered lists/search (AC 16-17); MCP tool-list/compiled stdio proof confirms no decision tools (AC 25); shared document/decision lifecycle code and both-kind regression/link suites prove AC 27. All acceptance criteria and DoD items are verified.
Validation covered 405 focused lifecycle/identity/link/Git/error cases across 14 files (404 initial passes; one unchanged interactive viewer case failed with default terminal settings, then its complete 37-case file passed with env -u NO_COLOR TERM=xterm-256color), 165 inherited task safety cases, 32 HTTP cases, and 47 CLI/completion/real MCP stdio cases. No semantic test workaround. Red proof has 2 expected failures on the original single-path owner; the repaired six-case CLI/MCP regression has 6 passes. All six compiled-binary isolated-project cases pass. check:types (558 files), Biome 2.5.15 (455 files), and build pass on Bun 1.4.3.
Subtraction pass: retained one existing lifecycle owner and the existing kind/path/subject/error helpers. One changedPaths array drives both staging and commit selection; no layer, lock, API shim, or exported path helper was added. Reviewed source/test diff against 285702c8 is /tmp/back-763-review.diff, SHA-256 af8a09f466888c0781807a00a55a9966abfcc6670f3c3ca685ed9bd10bf1034d. Compiled proof evidence is /private/tmp/back-763-compiled-proof-BpO7CO/proof.json. Final modified-file attribution contains the 24 feature/integration paths against the exact parent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refreshed existing PR #1108 on repaired BACK-762 commit 285702c8 while preserving the original BACK-763 commits and shared document/decision lifecycle implementation.
The shared deleteContentRecord stages and commits both the archived file path and its former active path. A record archived without a commit and then deleted with auto-commit enabled is removed from HEAD, and its ID is reusable when no other file or branch claims it. Existing link-only behavior, identity refusals, scoped commits, and inherited task safety remain intact.
Verification: 405 focused lifecycle/identity/link/Git/error cases validated (the unchanged viewer file passes all 37 cases with the required terminal settings), plus 165 inherited safety, 32 HTTP, and 47 CLI/completion/MCP stdio cases. The new two-case decision regression fails on the old owner; all six repaired CLI/MCP cases and all six compiled-binary isolated-project proofs pass. Types, Biome, and build pass. Full-context review: KEEP, no blocker or new product decision. Windows was not verified.
<!-- SECTION:FINAL_SUMMARY:END -->

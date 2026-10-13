---
id: BACK-761
title: Archive documents from the CLI and MCP
status: To Do
assignee: []
created_date: '2026-10-13 18:46'
updated_date: '2026-10-13 18:51'
labels:
  - enhancement
dependencies:
  - BACK-731
  - BACK-732
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
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

This is the first of four stacked tasks for issue #1101. Each is one branch and one pull request. This one builds on BACK-731 (pull request #1096, part of the task archive stack #1094 to #1097) and on BACK-732 (pull request #1099). Those are two separate branches off `main`, so this branch needs the code of both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doc archive <docId>` on a document under `backlog/docs/` exits zero, prints `Archived document <id>`, and moves the document's file to the same relative path under `backlog/archive/docs/`. Example: `backlog/docs/guides/doc-3 - API-Guidelines.md` becomes `backlog/archive/docs/guides/doc-3 - API-Guidelines.md`. Folders that do not exist yet are created.
- [ ] #2 `<docId>` is accepted in every form `backlog doc view` accepts, such as `doc-3`, `3` and `doc-003`.
- [ ] #3 The moved file is byte for byte the file that was under `backlog/docs/`. Archive does not rewrite it, so its ID, dates and content are unchanged.
- [ ] #4 Archive never replaces a file. When `backlog/archive/docs/` already has a file at the destination path, the command exits non-zero with a message that names that file, and no file is moved or changed.
- [ ] #5 `backlog doc archive <docId>` on a document that is already archived exits non-zero with the read-only message for archived documents and changes nothing.
- [ ] #6 `backlog doc archive <docId>` for an ID that no document claims exits non-zero with a not found message and changes nothing.
- [ ] #7 An ID claimed by more than one file, counting `backlog/docs/` and `backlog/archive/docs/` together, fails closed: `backlog doc archive`, `backlog doc view` and `backlog doc update` each exit non-zero with the ambiguity message, and no file is moved or changed. The message lists each file with its folder, so a file under `backlog/docs/` and a file of the same name under `backlog/archive/docs/` can be told apart.
- [ ] #8 `backlog doctor` reports an ID claimed by a file under `backlog/docs/` and a file under `backlog/archive/docs/` as a duplicate document ID and names both files.
- [ ] #9 An archived document keeps its ID reserved: with `doc-1` under `backlog/docs/` and `doc-2` archived, `backlog doc create` assigns `doc-3`.
- [ ] #10 An archived document file is counted the way a document file under `backlog/docs/` is counted after BACK-732: by the ID in its frontmatter, by the number in its file name, and in the committed files of other branches. The ID of a document that was archived and committed on another branch is not assigned by `backlog doc create` on this branch.
- [ ] #11 An archived document is read-only on the CLI: `backlog doc update <docId>` exits non-zero, changes no file, and prints one message saying that the document is archived and read-only, for example `Document doc-3 is archived. Archived documents are read-only.`
- [ ] #12 The MCP tool `document_update` and the web save (`PUT /api/docs/<id>`, which answers 400 with a JSON `error`) refuse an archived document with that same message and change no file.
- [ ] #13 `backlog doc view <docId>` on an archived document exits zero and prints the document as it does for any other document, plus a line that says the document is archived. The interactive viewer shows that line too. The file is not changed.
- [ ] #14 The MCP tool `document_view` returns an archived document with a line that says it is archived.
- [ ] #15 An archived document is left out of `backlog doc list`, `backlog doc search`, `backlog search`, the MCP tools `document_list` and `document_search`, and the web sidebar and web search (`GET /api/docs` and `GET /api/search`).
- [ ] #16 After a successful archive the command prints one more line with the IDs of the tasks on the board, the archived tasks and the drafts of this checkout whose `documentation` list names the moved file, for example `Still listed as documentation by: TASK-2, DRAFT-1`. When none names the file, that line is not printed.
- [ ] #17 A `documentation` entry names the file when it is the path the file had before the move, written from the project root, for example `backlog/docs/guides/doc-3 - API-Guidelines.md`. The entry also matches with `./` in front of the path or with `#` and a fragment after it. Nothing else matches: not a URL, not an absolute path, not a bare ID such as `doc-3`.
- [ ] #18 Archive changes no task file and no draft file.
- [ ] #19 A document file that is a symbolic link is moved as a link. Afterwards `backlog/archive/docs/` holds a link to the same target, and the target file is still in place and unchanged.
- [ ] #20 A document inside a symlinked subfolder of `backlog/docs/` is archived like any other document: its file moves to the matching path under `backlog/archive/docs/`.
- [ ] #21 A link loop inside `backlog/docs/` or `backlog/archive/docs/` (a folder link that points back at one of its own parent folders) does not make `backlog doc archive`, `backlog doc view` or `backlog doc list` hang or fail.
- [ ] #22 With auto-commit on (`auto_commit: true`), a successful archive makes one commit that holds the move of the document's file and nothing else.
- [ ] #23 With auto-commit off, archive makes no commit and adds nothing to the Git index.
- [ ] #24 When the file was moved but the commit fails, the command says that the document was archived and that committing the change failed, and exits non-zero.
- [ ] #25 The MCP server offers the tool `document_archive`. It takes one document ID like `document_view`, rejects unknown fields, and returns a success message, the same line of tasks and drafts, and the same refusal messages as the CLI.
- [ ] #26 `backlog doc --help` lists `archive`, and `backlog doc archive --help` with its help schema describes the command with an example.
- [ ] #27 The CLI command and the MCP tool call one core function and hold no rule of their own. The file move is the never-replace move that task archive uses, reused and not copied.
- [ ] #28 Tests drive the CLI for every behavior above and the MCP tool for the same rules.
- [ ] #29 `CLI-INSTRUCTIONS.md`, the shipped guides (`backlog instructions` and the agent guidelines) and the MCP guides that list the document tools say how a document is archived: the file moves to `backlog/archive/docs/`, the ID stays reserved, the document stays viewable and is read-only, and tasks that name the file are printed and not changed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-733
title: Keep a record's body unchanged when frontmatter is written
status: To Do
assignee: []
created_date: '2026-10-11 19:08'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: bug
ordinal: 351000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A document whose body starts with a line of three dashes is damaged when it is saved. Markdown uses that line as a horizontal rule, and it is also the frontmatter delimiter. When the file is written, the body is read again and its leading block is taken as more frontmatter. The command prints success and exits 0. Reproduced on main at 380b8f83:

- `backlog doc update doc-1 --content` with a body made of a rule, a paragraph, a second rule and more text stores only the text after the second rule. The paragraph between the rules disappears from the body and is written into the frontmatter one character per key (`'0': T`, `'1': e`, and so on).
- A body that opens with a rule, some `key: value` lines and a closing rule has those lines moved into the frontmatter of the file. They are not known keys, so the next save drops them and the text is gone for good.

Documents are the record type affected today because their body is free text. Task and decision bodies start with a section heading and do not hit this, but all three are written by the same shared code. The body a caller supplies should reach the file exactly as given, whatever it starts with. Found while reviewing the document and decision write paths for issue #1065.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After `backlog doc update <id> --content <body>` with a body that starts with a `---` line, the stored body is the supplied text, complete and in order, and `backlog doc view <id> --plain` shows it in full.
- [ ] #2 The frontmatter of that file contains only the keys Backlog.md writes for a document; no line of the body appears in it.
- [ ] #3 The same holds when the body is supplied on create or update through the web API (`POST /api/docs`, `PUT /api/docs/:id`) and through the MCP document tools.
- [ ] #4 A document saved with such a body still has the full body after a later update that does not touch the content, for example a title change.
- [ ] #5 Task, decision and document files whose body does not start with `---` are written byte for byte as they are today.
- [ ] #6 Tests cover a body that starts with a rule followed by text and a body that starts with a `---` delimited block of `key: value` lines.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

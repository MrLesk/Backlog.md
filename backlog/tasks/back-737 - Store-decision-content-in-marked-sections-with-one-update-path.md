---
id: BACK-737
title: Store decision content in marked sections with one update path
status: To Do
assignee: []
created_date: '2026-10-11 19:08'
updated_date: '2026-10-12 06:04'
labels:
  - bug
dependencies:
  - BACK-734
  - BACK-736
  - BACK-640
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - 'https://github.com/MrLesk/Backlog.md/issues/1008'
  - 'https://github.com/MrLesk/Backlog.md/issues/1010'
  - 'https://github.com/MrLesk/Backlog.md/pull/1018'
type: bug
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A decision file has no reliable way to be changed. The only write path is `PUT /api/decisions/:id`, which the web UI uses. It takes the whole body as text, reads it back into the sections it knows and rebuilds the file from those, so anything else is lost while the response says `{"success":true}`. Issue #1065 shows two cases: a body with an extra `## Revisit trigger` section is saved without that section, and a JSON body is written into the file literally. Issues #1008 and #1010 report related section reading defects on the same path (a `###` subheading cutting a section short, and an empty section returning the next heading). Those are fixed under BACK-693 in pull request #1018, and this task builds on that section reader.

The maintainer's ruling on issue #1065 is that decisions follow the task model. A decision keeps its four sections, Context, Decision, Consequences and Alternatives, and the content of each is delimited by marker comments the way task sections are, for example `<!-- SECTION:CONTEXT:BEGIN -->` and `<!-- SECTION:CONTEXT:END -->` under `## Context`. The task section code is reused for this, not copied. Every decision update goes through one core function that all interfaces call, and the HTTP write endpoint changes from a text body to JSON in one release, with no period in which both are accepted. This task does not change which status values are accepted; that is BACK-745.

Existing decision files have no markers. On the first write of such a file each known section is wrapped where it stands: marker lines are added, every original line stays in its original order, and nothing moves. Text outside the four sections, such as a preamble or other level-two sections like `## References`, is kept as it is on this and every later write. That text cannot be edited through a command or the web editor, which matches how tasks treat text outside their managed sections.

The way task code converts a task file without markers must not be reused unchanged for decisions. It treats a section as running to the next section title it knows, so an unknown section that follows a known one is absorbed into it and ends up inside its markers, and the next replacement of that section deletes it. Decision files usually have sibling level-two sections, so in a decision without markers a known section ends at the next level-two heading.

Not yet examined and settled during plan review: a `## ` line inside a fenced code block, a file that contains the same known heading twice, and files with CRLF line endings.

Not part of this task: new CLI commands or flags for decisions, the web decision editor, the `superseded_by` and `updated_date` keys, and markers for documents, whose body stays free text.

Depends on BACK-734 (one create function, which writes new decisions in the marked form), BACK-736 (decision updates take the per-record lock) and BACK-640 (one identity lookup per record type). BACK-693 has to be merged first as well; its task record is not on main yet, so pull request #1018 is listed under references and not as a dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After `backlog decision create`, and after any update, each of the sections Context, Decision, Consequences and Alternatives that the file contains has its content between `<!-- SECTION:<NAME>:BEGIN -->` and `<!-- SECTION:<NAME>:END -->` markers under its `##` heading.
- [ ] #2 The first update of a decision file without markers adds marker lines around each known section where it stands and applies the requested change; every other original line is still present in its original order.
- [ ] #3 Text outside the four sections, including a preamble and unknown level-two sections such as `## Revisit trigger` or `## References`, is unchanged after every update, including a later replacement of the section that precedes it.
- [ ] #4 An update replaces only the sections it names: a section sent as empty text is cleared, a section left out keeps its content, and headings nested inside a section stay inside it.
- [ ] #5 `PUT /api/decisions/:id` accepts a JSON object with any of title, status, context, decision, consequences and alternatives, applies it through the shared core update and answers with JSON.
- [ ] #6 The endpoint answers 400 with a JSON `error` for a body that is not a JSON object of that shape, including a plain text body, and for section text that contains a section marker line; 404 for an unknown ID; 409 for an ambiguous ID or a record locked by another update. In each of these cases no file is changed.
- [ ] #7 The reproduction from issue #1065 no longer loses content: a decision file that contains `## Revisit trigger` still contains it with its text after an update, and a JSON body is never written into the file literally.
- [ ] #8 `GET /api/decisions` and `GET /api/decisions/:id` still return the four section fields with no marker lines in their values, `backlog decision list` output is unchanged, the web decision page still displays decisions, and no web control sends a text body to the endpoint.
- [ ] #9 Task files are read and written exactly as before, and the existing task section tests pass unchanged.
- [ ] #10 Tests cover a new decision, a file without markers that has a preamble and unknown sections before, between and after the known ones, clearing and omitting sections, and each HTTP error case.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @alex-agent
created: 2026-10-12 06:04
---
Two review points raised on pull request #1088 (the held status edit) are to be settled in the shared decision update path built here, for every decision write: (1) resolve and validate the project config, including the auto-commit setting, before the file is written, so a config error cannot leave a half-applied change; (2) decide and state what auto-commit does when a decision file is a link to a target outside the repository, where staging the link commits nothing.
---
<!-- COMMENTS:END -->

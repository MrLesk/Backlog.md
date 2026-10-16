---
id: BACK-739
title: Add decision view and section flags to decision create and edit
status: To Do
assignee: []
created_date: '2026-10-11 19:09'
updated_date: '2026-10-13 18:47'
labels:
  - enhancement
dependencies:
  - BACK-737
  - BACK-727
  - BACK-738
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - 'https://github.com/MrLesk/Backlog.md/issues/920'
type: enhancement
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI can create a decision with a title and a status and can list decisions, and that is all. `backlog decision create` always produces empty Context, Decision and Consequences sections, no command fills them in afterwards, and no command prints a single decision. The shipped guidance tells users not to edit decision files by hand, so the supported workflow ends with a permanently empty record, and the only way to write content is the HTTP endpoint behind the web UI, which is not a documented interface (issue #920). Issue #1065 shows that people depend on that endpoint for lack of a command.

The maintainer's ruling on issue #1065 is that decisions follow the task commands: `view`, `create` with content, and `edit`, with one flag per section as `backlog task create` and `backlog task edit` have for theirs. The flags are `--context`, `--decision`, `--consequences` and `--alternatives`. Each replaces one section; there are no append variants. The title can be changed from the CLI too, because the web editor may change it and both go through the same core function. The CLI adds no logic of its own. Decisions get no MCP tools. Which status values are accepted is covered by BACK-745, not by this task.

Depends on BACK-737 (marked sections and the shared core update), BACK-727 (which adds `backlog decision edit` with `-s`) and BACK-738 (the `superseded_by` and `updated_date` keys that `decision view` shows).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog decision create "<title>"` accepts `--context`, `--decision`, `--consequences` and `--alternatives`; each value given is stored in its section and sections not given stay empty.
- [ ] #2 `backlog decision edit <id>` accepts the same four flags: each replaces the content of that section, a flag given an empty value clears the section, and sections not named keep their content.
- [ ] #3 `backlog decision edit <id> -t <title>` changes the title; afterwards `backlog decision list` shows the new title and exactly one file exists for that ID.
- [ ] #4 An edit changes nothing in the file beyond what its flags name, apart from `updated_date`: other sections, text outside the four sections and other frontmatter values stay as they were.
- [ ] #5 `backlog decision view <id> --plain` prints the ID, title, date and status of the decision, `superseded_by` and `updated_date` when set, and its content; `--json` prints the same as versioned JSON.
- [ ] #6 `backlog decision view` and `backlog decision edit` exit non-zero with a clear message and change no file for an ID that matches no decision, and refuse an ID shared by two files with the same ambiguity message `backlog doc view` gives.
- [ ] #7 A decision written with these flags has the same file content as one given the same values through `PUT /api/decisions/:id`.
- [ ] #8 `backlog decision --help` lists `view`; the help and help schema of each command describe the new options with an example, multi-line values work with real newlines as for task Markdown fields, and the shipped instruction guides (`backlog instructions`) describe how to write and read a decision from the CLI.
- [ ] #9 Tests cover create with sections, replacing, clearing and omitting sections on edit, the title change, and view in plain and JSON form.
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
created: 2026-10-13 18:47
---
Issue #1101 adds `backlog decision archive`, `delete` and `restore` (BACK-763). Archived decisions live in `backlog/archive/decisions/`, and until this task adds `decision view` they cannot be read from the CLI. `decision view` must read archived decisions and mark them as archived, as `doc view` does for archived documents (BACK-761). `decision edit` on an archived decision is refused with the core read-only message that names `backlog decision restore`.
---
<!-- COMMENTS:END -->

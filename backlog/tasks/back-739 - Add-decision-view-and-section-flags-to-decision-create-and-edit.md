---
id: BACK-739
title: Add decision view and section flags to decision create and edit
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 19:09'
updated_date: '2026-10-28T22:38:00Z'
labels:
  - enhancement
dependencies:
  - BACK-737
  - BACK-727
  - BACK-738
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
  - 'https://github.com/MrLesk/Backlog.md/issues/920'
  - src/cli.ts
  - src/core/backlog.ts
  - src/types/index.ts
  - src/formatters/json-output.ts
  - src/markdown/structured-sections.ts
  - src/commands/help-schema.ts
  - src/guidelines/cli-instructions/overview.md
modified_files:
  - src/test/cli-decision-content.test.ts
  - src/types/index.ts
  - src/core/backlog.ts
  - src/formatters/json-output.ts
  - src/formatters/decision-plain-text.ts
  - src/cli.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/test/cli-decision-status.test.ts
  - src/test/cli-create-preserves-existing-files.test.ts
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
- [x] #1 `backlog decision create "<title>"` accepts `--context`, `--decision`, `--consequences` and `--alternatives`; each value given is stored in its section and sections not given stay empty.
- [x] #2 `backlog decision edit <id>` accepts the same four flags: each replaces the content of that section, a flag given an empty value clears the section, and sections not named keep their content.
- [x] #3 `backlog decision edit <id> -t <title>` changes the title; afterwards `backlog decision list` shows the new title and exactly one file exists for that ID.
- [x] #4 An edit changes nothing in the file beyond what its flags name, apart from `updated_date`: other sections, text outside the four sections and other frontmatter values stay as they were.
- [x] #5 `backlog decision view <id> --plain` prints the ID, title, date and status of the decision, `superseded_by` and `updated_date` when set, and its content; `--json` prints the same as versioned JSON.
- [x] #6 `backlog decision view` and `backlog decision edit` exit non-zero with a clear message and change no file for an ID that matches no decision, and refuse an ID shared by two files with the same ambiguity message `backlog doc view` gives.
- [x] #7 A decision written with these flags has the same file content as one given the same values through `PUT /api/decisions/:id`.
- [x] #8 `backlog decision --help` lists `view`; the help and help schema of each command describe the new options with an example, multi-line values work with real newlines as for task Markdown fields, and the shipped instruction guides (`backlog instructions`) describe how to write and read a decision from the CLI.
- [x] #9 Tests cover create with sections, replacing, clearing and omitting sections on edit, the title change, and view in plain and JSON form.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved in Alex's 2026-10-28 implementation plan. The actor is a person or agent using the shipped CLI. Add --context, --decision, --consequences and --alternatives to decision create/edit, forwarding real multiline strings to core. Share validation of decision input and preserve the existing locked allocator and update path; empty section values clear and omitted values preserve. Add -t/--title to edit. Add decision view through existing core identity lookup, including archived decisions, with readable text and versioned JSON metadata plus full content; keep marker comments out of human output. Preserve existing missing/ambiguous/archive refusal behavior. Extend help schemas, newline examples, and shipped guides. Cover creation, partial/empty updates, title rename, plain/JSON/archive reads, identity refusals, and CLI/HTTP content parity with isolated fixtures. Run relevant tests, types, Biome and build; obtain cold simplicity and full-context complexity reviews; address relevant Codex findings and merge after dependencies. No new MCP decision tools or status policy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added section flags and title editing through shared core validation and locked save paths. View uses the existing active/archive identity lookup and small plain/JSON formatters. Versioned JSON follows the existing updatedAt convention and retains the complete raw body; human output removes structural markers. Unknown metadata and unmanaged sections survive writes, and missing/ambiguous/archive refusals keep files unchanged. Ten acceptance tests failed before implementation and pass after it. Final content/status suite: 32 passed; the other 51 supersession/JSON/HTTP tests passed. Additional allocator, locking, archive, preflight and CLI coverage: 105 passed. Updated existing help assertions to check supported fields and examples without assuming their order. Types and Biome pass; compiled build and binary smoke pass create, edit, JSON view, real multiline values, archived JSON read and shipped instructions. Plain view is covered by the CLI acceptance tests. The task's bunx tsc wording is stale; the current repository check:types is bun --check. Cold review found one misplaced duplicate documentation row, removed and verified; separate full-context complexity review found no blockers. Own specification and quality review complete. GitHub CI and Codex review remain required before the authorized merge.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @alex-agent
created: 2026-10-13 18:47
---
Issue #1101 adds `backlog decision archive`, `delete` and `restore` (BACK-763). Archived decisions live in `backlog/archive/decisions/`, and until this task adds `decision view` they cannot be read from the CLI. `decision view` must read archived decisions and mark them as archived, as `doc view` does for archived documents (BACK-761). `decision edit` on an archived decision is refused with the core read-only message that names `backlog decision restore`.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CLI now provides a complete decision workflow: create with four section flags; edit only named sections, clear with empty values, and change titles; view active or archived decisions as readable text or versioned JSON. All writes use the shared core path, preserving metadata and unmanaged content. Help and shipped instructions cover real newlines, clearing, omission and archived reads. Verification: ten acceptance regressions red before implementation and green after; 32 final content/status, 51 other related, and 105 integration tests passed. Types, Biome, build and compiled CLI smoke passed. Required reviews completed with no remaining blockers.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-741
title: Rename doc update to doc edit
status: To Do
assignee: []
created_date: '2026-10-11 19:09'
updated_date: '2026-10-13 18:47'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: enhancement
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tasks are changed with `backlog task edit`, documents with `backlog doc update`. The same action has two names, so people and scripts that know one command guess wrong on the other. The maintainer's ruling on issue #1065 is that document and decision commands use the task verbs (`create`, `list`, `view`, `edit`), and that `doc update` is renamed to `doc edit` with no alias.

This is a deliberate breaking change. A script that still calls `backlog doc update` fails with an unknown command error and changes nothing, which is loud and carries no risk to data.

Only the name of the CLI command changes. Its options and behavior stay as they are, and the MCP tool `document_update` keeps its name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doc edit <docId>` accepts the options `backlog doc update` accepts today (`--title`, `--content`, `-p/--path`, `-t/--type`, `--tags`) and behaves the same.
- [ ] #2 `backlog doc update` is no longer a command: it is absent from `backlog doc --help`, and running it exits non-zero with an unknown command error and changes no file. No alias and no deprecation notice exist.
- [ ] #3 The MCP tool `document_update` keeps its name, schema and behavior.
- [ ] #4 Command help, the help schema, shell completion, `CLI-INSTRUCTIONS.md`, the shipped instruction and guideline files (`backlog instructions`) and messages that suggest the command refer to `backlog doc edit` and no longer mention `doc update`.
- [ ] #5 CLI tests for document updates use the new name, and a test covers the removed command failing without changing a file.
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
Issue #1101 makes archived documents read-only (BACK-761, BACK-762): `backlog doc update` on an archived document is refused with a core message that names `backlog doc restore`. After the rename here, that refusal applies to `backlog doc edit`, and the help, guides and tests that describe it under `doc update` move to the new name.
---
<!-- COMMENTS:END -->

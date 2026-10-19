---
id: BACK-746
title: Add custom field lists to the project config
status: To Do
assignee: []
created_date: '2026-10-11 19:34'
updated_date: '2026-10-18 19:44'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 364000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog rewrites the frontmatter of a record from the keys it knows, so any other top-level key in a task, draft, document or decision file is dropped on the next write (issues #918 and #1091). Projects use such keys for their own tools: an `approval` block, `depends_on` and `task` links, recurrence and reminder fields.

The maintainer's ruling on both issues is that Backlog does not keep unknown keys implicitly, because it cannot work correctly with keys it knows nothing about. A project names the custom keys it uses in its config instead, and Backlog keeps exactly those and returns them on every read surface. There is one list per record type: tasks and drafts share one, documents have their own, and decisions have their own. The working names used here are `task_custom_fields`, `document_custom_fields` and `decision_custom_fields`; the exact key names are settled during plan review. The lists have no default, so nothing changes for a project until it sets one, as with `projects`.

This task adds the config side only. Today a config key Backlog does not know is itself removed by the next config save: after `task_custom_fields: [approval]` is added to `backlog/config.yml`, `backlog config set maxColumnWidth 25` rewrites the file without that line, and the web settings page saves through the same writer. The lists therefore have to be known config keys before any record behavior can depend on them. They are edited in the config file like the other configured lists (`statuses`, `labels`, `priorities`, `types`, `projects`), which `backlog config get` and `backlog config list` show and `backlog config set` refuses.

A name Backlog already uses as a frontmatter key for a record type is reserved for that type, for example `status` and `labels` for tasks and drafts, `tags` for documents and `date` for decisions. For decisions this includes `superseded_by` and `updated_date`, which BACK-738 adds. A reserved or malformed name is rejected with the existing config error, which today reads like "Backlog could not start because <config file> has an invalid value for "projects": expected a list, got a number. Edit that key so its value is a list, then run the command again."

Not part of this task: keeping the keys in record files, showing them, and the `backlog doctor` finding, which are separate tasks. Not planned in this first version at all: setting or clearing custom keys from the CLI, MCP or web UI, typed values, filtering or searching by custom keys, and milestone files, which the ruling does not cover.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The project config file accepts three lists of key names: one for tasks and drafts, one for documents and one for decisions (working names `task_custom_fields`, `document_custom_fields`, `decision_custom_fields`). Each is read by the same rules as the other configured lists such as `projects`, and a value that is not a list stops the command with the existing config error.
- [ ] #2 The lists have no default: a project that sets none behaves exactly as today.
- [ ] #3 A name has to start with a letter and contain only letters, digits, `_` and `-`. Any other name stops the command with the existing config error, which names the config file, the key and the offending name.
- [ ] #4 A name Backlog already uses as a frontmatter key for that record type is reserved for that type and rejected the same way, for example `status` in the task list or `tags` in the document list; `superseded_by` and `updated_date` are reserved in the decision list. A name that is not reserved for a type may appear in the list of that type and in more than one list.
- [ ] #5 `backlog config get <key>` prints each list and `backlog config list` shows all three, under key names that follow the existing naming; `backlog config set` treats them the way it treats `statuses` and `projects`.
- [ ] #6 The lists survive a config save: after `backlog config set` on another key, and after a save from the web settings page, each list is still in the config file with the same names in the same order.
- [ ] #7 No record behavior changes: with or without the lists set, creating, editing, viewing and listing tasks, drafts, documents and decisions works as today.
- [ ] #8 `ADVANCED-CONFIG.md` lists the three keys with the name rule and the reserved names.
- [ ] #9 Tests cover reading the lists, a malformed name, a reserved name for each record type, `config get` and `config list`, and the lists surviving a CLI config save and a web settings save.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Canceled: Alex's 2026-10-18 decision replaced configured field lists with automatic preservation of all unknown keys. No configuration registration is needed. Documents/decisions are implemented in BACK-748; tasks/drafts remain future BACK-747. This task is superseded and archived unimplemented, not Done.
<!-- SECTION:NOTES:END -->

---
id: BACK-750
title: 'Return configured custom fields in plain, JSON and MCP output'
status: To Do
assignee: []
created_date: '2026-10-11 19:35'
updated_date: '2026-10-18 19:45'
labels:
  - enhancement
dependencies:
  - BACK-747
  - BACK-748
  - BACK-749
  - BACK-739
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 368000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once BACK-747, BACK-748 and BACK-749 are in place, a configured custom key is kept in the file, but no command output shows it. `backlog task view --plain`, the `--json` output and MCP results print only the fields Backlog knows, so a person or a tool has to open the file to see a value Backlog is keeping. The one exception is `backlog doc view --plain`, which prints the file as stored.

The maintainer's ruling on issues #918 and #1091 is that configured keys are returned on every read surface: plain output, the versioned `--json` output, MCP results, the TUI detail view and the web UI. This task covers the first three; the TUI and the web UI are a separate task. Every surface takes the keys from the same core read and adds no logic of its own. Custom keys are shown only: nothing here sets, clears, filters or searches by them.

In `--json` output the keys are carried in a `customFields` object on task, document and decision data. Adding the field is a backward-compatible change within schema version 1, so `schemaVersion` stays 1 and the documented field list in `CLI-INSTRUCTIONS.md` is extended. The field is present for every project, including those that set no list, where it is empty.

Settled during plan review: how a value is represented in `customFields`. Plain output shows a value as it is written in the file. The parsed form of some values differs from what was written (a bare date becomes a timestamp, `1.10` becomes `1.1`), so it has to be decided whether JSON carries parsed data or the written text.

Depends on BACK-747, BACK-748 and BACK-749 (which make the keys available on tasks, drafts, documents and decisions) and on BACK-739 (which adds `backlog decision view`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plain detail output for a task or draft (`backlog task view <id> --plain`, `backlog task <id> --plain` and the draft equivalent) lists each configured key the record carries with its value as written in the file; a record that carries none shows nothing extra.
- [ ] #2 `backlog decision view <id> --plain` lists the configured keys of the decision the same way.
- [ ] #3 Task data in `task list --json`, `task view --json` and `search --json` carries a `customFields` object with the configured keys the record carries. It is always present and is `{}` when there are none.
- [ ] #4 Document data in `search --json` and decision data in `decision list --json`, `decision view --json` and `search --json` carry the same `customFields` object.
- [ ] #5 `schemaVersion` stays 1: `customFields` is added as a backward-compatible field, no existing field changes, and the documented field list in `CLI-INSTRUCTIONS.md` is extended to name it for task, document and decision data.
- [ ] #6 MCP results that show the details of a task or a document, such as `task_view` and `document_view`, include the configured keys with their values; MCP tool inputs are unchanged.
- [ ] #7 Only configured keys are returned: a key in the file that is not in the list for that record type appears on none of these surfaces.
- [ ] #8 For one record, plain, JSON and MCP output show the same set of keys.
- [ ] #9 No command or tool gains a way to set, clear, filter or search by custom keys.
- [ ] #10 Tests cover plain, JSON and MCP output for a task and a document and plain and JSON output for a decision, with and without configured keys.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Canceled: Alex's 2026-10-18 decision treats automatically preserved unknown metadata as opaque user data. Configured custom fields and their proposed plain/JSON/MCP output are superseded. BACK-748 adds preservation only, with no public JSON or display additions. This task is archived unimplemented, not Done.
<!-- SECTION:NOTES:END -->

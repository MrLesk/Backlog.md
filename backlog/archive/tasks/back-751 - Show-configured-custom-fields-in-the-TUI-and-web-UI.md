---
id: BACK-751
title: Show configured custom fields in the TUI and web UI
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
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 369000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A configured custom key that Backlog keeps in a file is not visible in the TUI or the web UI. Both show only the fields Backlog knows, so someone working there cannot tell that a task carries an `approval` state, or a document a `depends_on` list, without opening the file.

The maintainer's ruling on issues #918 and #1091 is that configured keys are returned on every read surface: plain output, the versioned `--json` output, MCP results, the TUI detail view and the web UI. This task covers the TUI detail view and the web UI; plain, JSON and MCP output are a separate task. Both views take the keys from the same core read as every other surface and add no logic of their own.

This extends existing views and adds no new one: the Details block of the TUI task view, the metadata sidebar of the web task details modal, and the header metadata of the web document page and decision page. The display is read only. Custom keys are shown only: nothing here sets, clears, filters or searches by them. Records without configured keys, and projects that set no list, look exactly as they do today.

Settled during plan review: how a multi-line value such as a nested block is laid out in these views. The value is shown as it is written in the file.

Depends on BACK-747, BACK-748 and BACK-749, which make the keys available on tasks, drafts, documents and decisions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI task detail view shows each configured key a task or draft carries, with its value as written in the file, in its Details block.
- [ ] #2 The web task details modal shows the same keys and values in its metadata sidebar.
- [ ] #3 The web document page and the web decision page show the configured keys of the record in their header metadata.
- [ ] #4 A multi-line value is shown in full, and a long value does not break the layout of the view.
- [ ] #5 Only configured keys are shown: a key in the file that is not in the list for that record type does not appear.
- [ ] #6 The display is read only; no view gains a control to set or clear a custom key.
- [ ] #7 A record that carries no configured key, and every record in a project that sets no list, looks exactly as it does today.
- [ ] #8 For one record the TUI, the web UI and `--plain` output show the same keys and values.
- [ ] #9 The views are checked in the running TUI and in the browser at desktop width and at a narrow width, not by tests alone.
- [ ] #10 Tests cover a task, a document and a decision with configured keys and a record without any.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Canceled: Alex's 2026-10-18 decision replaced registered custom fields with automatic preservation of opaque user metadata. The proposed custom-field TUI/web display plan is superseded; BACK-748 adds preservation only. This task is archived unimplemented, not Done.
<!-- SECTION:NOTES:END -->

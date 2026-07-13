---
id: BACK-430
title: Create tasks with an intent-first TUI composer
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-12 22:10'
labels:
  - tui
  - enhancement
milestone: m-8
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/579'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the production first slice of an intent-first Blessed task composer. The TUI should support deliberate capture and review using the canonical task and draft paths, without changing default semantics in the CLI, MCP adapter, or shared core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The board exposes a discoverable task-creation command and the TUI help identifies its shortcut and purpose.
- [ ] #2 The first slice presents Title, multiline Description, Status, Type, and Priority, using configured choices and supporting the existing unset behavior where the corresponding public task field permits it.
- [ ] #3 The resting Status value is the first configured workflow status; it never defaults to the focused column or to Draft.
- [ ] #4 Draft appears as an extra first option only after the user actively opens or changes Status; merely opening the selector does not select Draft, and leaving the field unchanged preserves the first configured workflow status.
- [ ] #5 Explicit Create is the only persistence point: a normal status uses the canonical task-creation path, while explicitly selecting Draft uses the canonical draft-creation path.
- [ ] #6 Cancel exits without creating or modifying any task or draft.
- [ ] #7 Validation and persistence errors are shown without partial writes and preserve all entered values for correction or retry.
- [ ] #8 After success, the board refreshes once and focuses the created task when visible; draft or filtered-out results receive honest confirmation that explains why no task is focused.
- [ ] #9 Rendered keyboard QA covers discovery, entry, selection, review, creation, cancellation, errors, focus, and scrolling at normal and narrow terminal sizes.
- [ ] #10 Automated tests cover configured field choices, exact default/Draft semantics, canonical task-versus-draft payloads, cancellation, failures, board refresh/focus, filtered results, and watcher behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A disposable Blessed prototype proved the modal, keyboard, refresh, focus, filtered-result, validation, cancellation, and persistence-error mechanics at 100x30, 80x24, and 50x18. Its title/status-only scope and focused-column status default were research choices, not approved production behavior; the acceptance criteria above supersede them. The older 6038cd5 implementation remains research only. Future execution must research the current code and record a fresh plan after activation.
<!-- SECTION:NOTES:END -->

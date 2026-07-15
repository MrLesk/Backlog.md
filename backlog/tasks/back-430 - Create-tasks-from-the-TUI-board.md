---
id: BACK-430
title: Create tasks with an intent-first TUI composer
status: In Progress
assignee:
  - '@back430-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-15 06:41'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one Blessed task-composer component with a single preserved form model for Title, multiline Description, Status, Type, Priority, explicit Create, and Cancel. Build choices from configured values, keep the first workflow status at rest, and expose Draft only inside the opened Status picker without selecting it.
2. Integrate the composer behind the established N shortcut, footer, and board help. Persist only through Core.createTaskFromInput, retain the modal and entered values on validation or persistence failure, then perform one explicit board refresh with created-task focus when visible and honest confirmation for drafts or filtered results.
3. Add focused tests for choice/default semantics, payload shaping, retries/cancellation, board upsert/focus helpers, filter visibility, and help discovery. Exercise watcher reconciliation so the local optimistic update and later filesystem event cannot duplicate the task.
4. Run rendered keyboard QA at normal and narrow terminal sizes, then focused tests, full tests, typecheck, Biome, and build. Simplify the interaction and update task notes without finalizing acceptance criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A disposable Blessed prototype proved the modal, keyboard, refresh, focus, filtered-result, validation, cancellation, and persistence-error mechanics at 100x30, 80x24, and 50x18. Its title/status-only scope and focused-column status default were research choices, not approved production behavior; the acceptance criteria above supersede them. The older 6038cd5 implementation remains research only. Future execution must research the current code and record a fresh plan after activation.

Implemented a single Blessed composer model behind the N shortcut and documented it in the footer and board help. The composer captures Title, multiline Description, Status, Type, and Priority, uses configured choices with explicit unset values, keeps the first configured workflow status at rest, and exposes Draft only in the opened Status picker. Persistence stays on Core.createTaskFromInput for both tasks and drafts. Validation and persistence failures retain values for retry; cancel performs no write. Successful tasks are upserted once and focused when visible, while drafts and filtered tasks receive explicit explanations. Added focused coverage for defaults, Draft semantics, payloads, canonical task and draft persistence, retry state, watcher reconciliation, board focus outcomes, filtered outcomes, and help discovery. Rendered PTY QA passed at 100x30, 80x24, and 50x18 for discovery, multiline entry and scrolling, configured selectors, normal and Draft creation, validation recovery, visible focus, filtered confirmation, and cancellation. Full bun test passed. TypeScript, Biome, build, and diff checks passed.
<!-- SECTION:NOTES:END -->

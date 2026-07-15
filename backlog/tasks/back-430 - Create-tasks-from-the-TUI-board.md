---
id: BACK-430
title: Create tasks with an intent-first TUI composer
status: In Progress
assignee:
  - '@back430-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-15 18:19'
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
1. Keep one Blessed composer for Title, multiline Description, Status, Type, Priority, explicit Create, and Cancel, with live full/compact reflow and Esc cancellation from every focusable control.
2. Persist through Core.createTaskFromInput. Auto-commit only the created path, preserve unrelated staged work, and compensate failures only when the current file and staged blob still match the exact created state; restore any safely captured prior bytes.
3. Reconcile board subscriptions while creation is active, unwind lifecycle state in finally, and render/focus once after actual composer success.
4. Cover task and draft commit success/failure, slow-hook concurrent edits, pre-existing paths, traversal, resize, rejection recovery, and rendered terminal QA before broad validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A disposable Blessed prototype proved the modal, keyboard, refresh, focus, filtered-result, validation, cancellation, and persistence-error mechanics at 100x30, 80x24, and 50x18. Its title/status-only scope and focused-column status default were research choices, not approved production behavior; the acceptance criteria above supersede them. The older 6038cd5 implementation remains research only. Future execution must research the current code and record a fresh plan after activation.

Implemented a single Blessed composer model behind the N shortcut and documented it in the footer and board help. The composer captures Title, multiline Description, Status, Type, and Priority, uses configured choices with explicit unset values, keeps the first configured workflow status at rest, and exposes Draft only in the opened Status picker. Persistence stays on Core.createTaskFromInput for both tasks and drafts. Validation and persistence failures retain values for retry; cancel performs no write. Successful tasks are upserted once and focused when visible, while drafts and filtered tasks receive explicit explanations. Added focused coverage for defaults, Draft semantics, payloads, canonical task and draft persistence, retry state, watcher reconciliation, board focus outcomes, filtered outcomes, and help discovery. Rendered PTY QA passed at 100x30, 80x24, and 50x18 for discovery, multiline entry and scrolling, configured selectors, normal and Draft creation, validation recovery, visible focus, filtered confirmation, and cancellation. Full bun test passed. TypeScript, Biome, build, and diff checks passed.

Specification corrections completed. Core creation now compensates the newly written task or draft and its exact staged Git path when post-write auto-commit fails; an actual failing pre-commit hook proves no task remains, form values survive, and retry reuses TASK-1 without creating TASK-2. Board subscription updates are queued while creation is active, equivalent delayed snapshots are ignored, and rendering is coalesced so real integration tests observe exactly one immediate screen render with TASK-2 focused for watcher delivery before persistence resolves, before composer closure, and after board success. The actual composer Cancel action was exercised and performed zero writes. Layout now uses the real terminal dimensions: the full 100x30 form receives enough height for Create, Cancel, help, and chrome, while 80x24 and 50x18 use compact controls and width-appropriate help. Fresh tmux captures verified all three dimensions and board help discovery for N. Focused composer and help coverage passes 17 tests with 64 assertions. The full bun test suite, bunx tsc --noEmit, bun run check ., bun run build, and git diff --check pass.

The final focused run includes the created-task focus assertions and passes 17 tests with 67 assertions.

Quality corrections implemented with ownership-safe compensation and path-limited auto-commit. Slow failing hooks no longer allow rollback to delete later edits, pre-existing bytes are restored when safe, and task/draft creation preserves unrelated staged contents and index state on success and failure. The actual composer now cancels with Esc from all seven focusable controls, removes its resize handler on close, reflows live between full and compact layouts, and does not render on close before the board render. Board task-creation flags and queued watcher state always unwind through finally, including composer setup rejection. Focused validation passes 66 tests with 232 assertions across composer, auto-commit, CLI create, and Git operations; TypeScript and Biome pass.

Final quality validation: the full suite passes 1,730 tests with 4 intentional interactive skips and 0 failures (7,297 assertions). Fresh rendered PTY QA on one open composer passes 100x30 → 80x24 → 50x18 → 100x30 with fields, actions, help, and chrome visible throughout. After final self-review, focused coverage passes 66 tests with 232 assertions; TypeScript, Biome, build, and git diff --check pass.
<!-- SECTION:NOTES:END -->

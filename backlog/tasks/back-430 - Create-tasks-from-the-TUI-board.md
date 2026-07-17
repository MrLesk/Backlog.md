---
id: BACK-430
title: Create tasks with an intent-first TUI composer
status: Done
assignee:
  - '@codex-pr791'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-17 22:34'
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
- [x] #1 The board exposes a discoverable task-creation command and the TUI help identifies its shortcut and purpose.
- [x] #2 The first slice presents Title, multiline Description, Status, Type, and Priority, using configured choices and supporting the existing unset behavior where the corresponding public task field permits it.
- [x] #3 The resting Status value is the first configured workflow status; it never defaults to the focused column or to Draft.
- [x] #4 Draft appears as an extra first option only after the user actively opens or changes Status; merely opening the selector does not select Draft, and leaving the field unchanged preserves the first configured workflow status.
- [x] #5 Explicit Create is the only persistence point: a normal status uses the canonical task-creation path, while explicitly selecting Draft uses the canonical draft-creation path.
- [x] #6 Cancel exits without creating or modifying any task or draft.
- [x] #7 Validation and persistence errors are shown without partial writes and preserve all entered values for correction or retry.
- [x] #8 After success, the board refreshes once and focuses the created task when visible; draft or filtered-out results receive honest confirmation that explains why no task is focused.
- [x] #9 Rendered keyboard QA covers discovery, entry, selection, review, creation, cancellation, errors, focus, and scrolling at normal and narrow terminal sizes.
- [x] #10 Automated tests cover configured field choices, exact default/Draft semantics, canonical task-versus-draft payloads, cancellation, failures, board refresh/focus, filtered results, and watcher behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the exact owned staged blob during path-limited auto-commit and add race coverage.
2. Preserve hook-modified task bytes when rollback ownership is lost, return an actionable recovery error, and test that the user data survives.
3. Reload autoCommit at TUI composer submission and normalize repository-relative Git paths in cross-platform assertions.
4. Run focused tests, TypeScript, Biome, build, broader verification, then record objective evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A disposable Blessed prototype proved the modal, keyboard, refresh, focus, filtered-result, validation, cancellation, and persistence-error mechanics at 100x30, 80x24, and 50x18. Its title/status-only scope and focused-column status default were research choices, not approved production behavior; the acceptance criteria above supersede them. The older 6038cd5 implementation remains research only. Future execution must research the current code and record a fresh plan after activation.

Implemented a single Blessed composer model behind the N shortcut and documented it in the footer and board help. The composer captures Title, multiline Description, Status, Type, and Priority, uses configured choices with explicit unset values, keeps the first configured workflow status at rest, and exposes Draft only in the opened Status picker. Persistence stays on Core.createTaskFromInput for both tasks and drafts. Validation and persistence failures retain values for retry; cancel performs no write. Successful tasks are upserted once and focused when visible, while drafts and filtered tasks receive explicit explanations. Added focused coverage for defaults, Draft semantics, payloads, canonical task and draft persistence, retry state, watcher reconciliation, board focus outcomes, filtered outcomes, and help discovery. Rendered PTY QA passed at 100x30, 80x24, and 50x18 for discovery, multiline entry and scrolling, configured selectors, normal and Draft creation, validation recovery, visible focus, filtered confirmation, and cancellation. Full bun test passed. TypeScript, Biome, build, and diff checks passed.

Specification corrections completed. Core creation now compensates the newly written task or draft and its exact staged Git path when post-write auto-commit fails; an actual failing pre-commit hook proves no task remains, form values survive, and retry reuses TASK-1 without creating TASK-2. Board subscription updates are queued while creation is active, equivalent delayed snapshots are ignored, and rendering is coalesced so real integration tests observe exactly one immediate screen render with TASK-2 focused for watcher delivery before persistence resolves, before composer closure, and after board success. The actual composer Cancel action was exercised and performed zero writes. Layout now uses the real terminal dimensions: the full 100x30 form receives enough height for Create, Cancel, help, and chrome, while 80x24 and 50x18 use compact controls and width-appropriate help. Fresh tmux captures verified all three dimensions and board help discovery for N. Focused composer and help coverage passes 17 tests with 64 assertions. The full bun test suite, bunx tsc --noEmit, bun run check ., bun run build, and git diff --check pass.

The final focused run includes the created-task focus assertions and passes 17 tests with 67 assertions.

Quality corrections implemented with ownership-safe compensation and path-limited auto-commit. Slow failing hooks no longer allow rollback to delete later edits, pre-existing bytes are restored when safe, and task/draft creation preserves unrelated staged contents and index state on success and failure. The actual composer now cancels with Esc from all seven focusable controls, removes its resize handler on close, reflows live between full and compact layouts, and does not render on close before the board render. Board task-creation flags and queued watcher state always unwind through finally, including composer setup rejection. Focused validation passes 66 tests with 232 assertions across composer, auto-commit, CLI create, and Git operations; TypeScript and Biome pass.

Final quality validation: the full suite passes 1,730 tests with 4 intentional interactive skips and 0 failures (7,297 assertions). Fresh rendered PTY QA on one open composer passes 100x30 → 80x24 → 50x18 → 100x30 with fields, actions, help, and chrome visible throughout. After final self-review, focused coverage passes 66 tests with 232 assertions; TypeScript, Biome, build, and git diff --check pass.

Final re-review identified exact prior-index restoration, empty-project board startup, and safe bounded retry as remaining work. The required Claude loop-breaker was run with the full HEAD/index/worktree scenario and proposed index-info design. It remained silent beyond four minutes and returned only Execution error when stopped once, so no advisory was available and it was not retried. Implementation proceeds from direct Git-state evidence and ownership checks.

Final re-review corrections are complete. Exact per-path index entries and working-tree bytes are snapshotted independently and restored only when the generated state is still owned. Task auto-commit retries remain bounded to three path-limited attempts and stop immediately when the file or index entry changes. Unfiltered empty kanban projects now enter the board and can create their first task, while task-list and parent-filter empty-result messages remain unchanged. Fresh rendered CLI QA created TASK-1 from an empty 80x24 board using N, title entry, five Tabs, and Enter; the created task stayed selected, opened in details, and the board remained usable at 50x18. This QA exposed and fixed an inactive Blessed textarea cancel crash, with the exact keyboard path now covered. Final focused coverage passes 32 tests with 142 assertions. The full suite passes 1,734 tests with 4 intentional interactive skips and 0 failures (7,317 assertions across 196 files in 183.01 seconds). TypeScript, Biome, build, and git diff --check pass.

Final publication verification: 64 focused tests passed across the TUI composer, help, empty-board loading, auto-commit, CLI commit behavior, atomic creation, and Git operations. TypeScript, Biome, build, and git diff --check also passed. Earlier fresh rendered PTY QA verified discovery, data entry, selectors, creation, cancellation, retry, focus, scrolling, and live resize at 100x30, 80x24, and 50x18.

Codex review repair: path-limited commits now build from the owned staged entries in an isolated temporary index, so later worktree bytes are not committed and unrelated staged work remains untouched. Failed hooks that modify the generated task preserve those bytes and return actionable recovery guidance instead of deleting user data. TUI submission reloads autoCommit at create time, and Git path assertions normalize Windows separators. Validation passed: 35 focused composer/unified-view tests, 63 broader Git/auto-commit/milestone tests, full suite 1,737 passed with 4 intentional interactive skips, bunx tsc --noEmit, bun run check ., bun run build, and git diff --check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired the TUI task composer review findings by committing the owned staged blob, preserving and reporting hook-modified task files on failed rollback, reloading autoCommit at submission, and normalizing cross-platform Git paths. Verified with focused and broader Git tests, the full 1,737-test suite, TypeScript, Biome, build, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->

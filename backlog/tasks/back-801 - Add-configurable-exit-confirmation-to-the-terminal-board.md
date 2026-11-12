---
id: BACK-801
title: Add configurable exit confirmation to terminal views
status: Done
assignee:
  - '@codex'
created_date: '2026-11-11T02:29:00Z'
updated_date: '2026-11-11T04:02:00Z'
labels: []
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/components/confirm-popup.ts
  - src/ui/unified-view.ts
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/cli.ts
  - ADVANCED-CONFIG.md
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-task-viewer-focus.test.ts
  - src/commands/overview.ts
  - src/ui/overview-tui.ts
  - src/ui/tui.ts
  - src/ui/components/generic-list.ts
modified_files:
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/cli.ts
  - src/ui/unified-view.ts
  - src/ui/components/confirm-popup.ts
  - src/ui/board.ts
  - ADVANCED-CONFIG.md
  - src/test/config-commands.test.ts
  - src/test/board-confirm-exit.test.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-task-viewer-focus.test.ts
  - src/ui/overview-tui.ts
  - src/commands/overview.ts
  - src/ui/tui.ts
  - src/ui/components/generic-list.ts
  - src/test/tui-quit-confirmation-pty.test.ts
  - scripts/run-tui-interactive-tests.sh
type: enhancement
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide opt-in quit confirmation across terminal board, task list/detail, project overview, and document browsing. Preserve immediate loading cancellation, nested-popup dismissal, and navigation within a view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With confirmExit enabled, board, task-list/detail, overview, document selection, and document viewer quit actions show the shared Quit Backlog.md? prompt.
- [x] #2 Cancel is left and Quit right initially selected. The opening key does not confirm; Enter activates selection, q/Ctrl+C confirm, and Escape/Cancel restore the active view.
- [x] #3 Missing or false confirmExit preserves immediate exits. Configuration commands and YAML persistence remain compatible; noninteractive output never prompts.
- [x] #4 Loading cancellation, nested popup dismissal, Escape navigation, Tab view switching, and selecting a document remain immediate rather than quit-confirmation actions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Configuration round-trip and focused board/popup tests pass, including enabled and disabled behavior, cancellation, confirmation, focus restoration, and preserved Escape precedence.
- [x] #5 Type checking, Biome checks, and relevant interactive TUI checks pass; inspect the rendered prompt over a board.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Pass confirmExit from existing command config into overview and document browsing. Reuse the shared quit popup, guard repeated quit requests while open, and restore original focus after cancellation. Confine document-selection handling to the standalone genericSelectList wrapper so nested generic lists retain their behavior. Keep loading cancellation and document selection immediate. Update docs/type guidance and task evidence; add interactive CLI regression coverage for overview, document list/view, handoff, false/missing settings, and cancellation/confirmation. Run focused tests, types, Biome, existing interactive checks, and review the full exit-path inventory. Amend the existing single-commit PR #1195 and retain Coded by Codex.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research found existing board modal guards, pending-write-safe closeBoard teardown, and shared confirmation popup chrome. Bun and gh are currently unavailable on PATH; verification and PR tooling must be resolved before completion. Default policy has been asked of the user and is not yet decided.

User approved the recorded implementation plan, including opt-in default and No initially selected. Implementation started.

Verification:
- 136 focused tests across 10 files passed (config, exit dialog, popup chrome, board moves/settings/live task popups, unified views, task lifecycle, input lifecycle).
- All 11 existing interactive PTY tests passed using the repository runner. Initial tool startup failed because extracted Expect needed its library directory; correcting LD_LIBRARY_PATH resolved it without code or test changes.
- Final board-confirm-exit suite passed after explicitly covering task-popup Escape precedence.
- A temporary filesystem-only project exercised the actual CLI in a 100x30 PTY: visible centered overlay, No highlighted by default, Escape/q/Enter(No)/mouse No cancellation, Ctrl+C request, Tab+Enter(Yes) exit status 0, and immediate exit when disabled. Terminal mouse press/release were sent separately to match physical input. Rendered frame inspected.
- bun run check:types, bun run check, and git diff --check pass.
- Own specification and simplicity review: configuration follows existing boolean conventions; one requestExit delegates to existing modal guard and pending-write-safe closeBoard; other confirmation callers retain their behavior. No broader architecture change or external review was required.
- Used verified Bun 1.4.4 and Node 26.12.1 outside the repository for tooling. No dependency or lockfile changes.
- GitHub CLI reports no authenticated host. Local commit author approved by user: Kyle McNayr <kyle@kylemcnayr.com>. Push/PR publication may be blocked by authentication.

Approved revision supersedes the initial Yes/No policy: title is Quit Backlog.md?, Cancel is on the left, and Quit is on the right and selected each time the prompt opens. Existing configuration and non-selectable confirmations are unchanged. Updated documentation and board tests, including mouse actions, default Enter confirmation, cancellation/focus restoration, selection reset, and modal navigation. The layout assertion initially exposed that the non-TTY test fixture had no terminal dimensions; it now uses a 100x30 screen, consistent with other UI tests. Final verification: 61 focused tests across board confirmation, popup chrome, task lifecycle, and configuration passed; all 11 interactive PTY tests passed; types, Biome, and diff whitespace checks passed. A real-terminal smoke test verified the rendered labels/order/highlight, Escape/q/Tab+Enter/Cancel-click cancellation, Ctrl+C opening, direct Enter quit, and disabled immediate exit. Self-review found no remaining acceptance or quality issues. User requires local-only work; no push or PR.

Approved shortcut revision: q and Ctrl+C now confirm quitting from the open prompt regardless of selection; Escape and Cancel dismiss it. Added four shortcut cases covering both keys with Quit and Cancel selected; all four failed against the previous cancellation behavior and passed after the change. The same real program key dispatch verifies that the opening keypress cannot also confirm. Updated cancellation and live-update tests plus configuration documentation. Verification passed: 30 focused tests across board confirmation, popup chrome, and task lifecycle; 11 interactive PTY tests; type checking; Biome; diff whitespace checks. A separate real-terminal smoke test confirmed q then q and Ctrl+C then Ctrl+C exit with status 0 for both selections. Self-review confirmed shared non-selectable dialogs and existing teardown remain unchanged. Local-only work; no push or PR.

Scope expanded at user request to both terminal views after task-list quit bypassed the board-only implementation. Both configuration-loading paths now read confirmExit, and the task-list quit keys use its modal guard and existing cleanup/exit path. A shared quit-popup helper owns the title, labels, and selectable layout. Cancellation restores list/detail focus; Escape navigation and Tab handoff are preserved. Extended existing task-viewer focus tests rather than introducing a second harness. Initial fixture failures were traced to creating the test screen before the temporary loading screen destroyed shared input listeners, and to the established filter-popup return focus; the fixture now creates its screen at the same point as production and tests explicitly leave filters before switching. Verification: 75 focused tests across five files passed, including both config-loading paths and 27 task-viewer tests; 11 existing interactive PTY tests passed; type checking, Biome, and diff checks passed. Seven real-terminal smoke scenarios passed: q/Escape/Ctrl+C in direct task-list launch and board-to-list handoff, each with cancellation and successful confirmation, plus disabled immediate exit. Self-review found the change localized to configuration reading, shared dialog setup, and quit routing; no unresolved acceptance findings. User authorized updating PR #1195, retaining one commit and Coded by Codex.

Extended confirmation to overview, standalone document selection, and document viewing using the shared quit dialog. Cancellation restores focus; loading cancellation, nested list behavior, document handoff, and noninteractive output retain their existing behavior. Added 10 interactive regression tests covering 28 terminal sessions and included them in the existing TUI runner. Initial failures exposed terminal cursor movement replacing literal spaces in rendered output; corrected text matching without narrowing scenarios. Verification: 90 focused tests passed; all 21 interactive tests passed; type checking, Biome, CLI build, and diff whitespace checks passed. Self-review traced command config through each quit path and found no remaining acceptance issues. Update PR #1195 as one commit with Coded by Codex; preserve the unrelated local configuration edit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Opt-in confirmExit now covers board, task list/detail, overview, document selection, and document viewer. The shared prompt has Cancel left and Quit right/default; Enter activates selection, q/Ctrl+C confirm, and Escape cancels. Missing or false configuration retains immediate exits, and navigation/loading cancellation remain unchanged. Validation evidence is recorded in implementation notes.
<!-- SECTION:FINAL_SUMMARY:END -->

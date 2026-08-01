---
id: BACK-559
title: Make Core the sole browser task boundary
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:12'
updated_date: '2026-08-01 20:44'
labels:
  - web-ui
  - performance
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/807'
type: bug
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #807 exposed repeated task-corpus scans during browser mutations and refreshes, but the architectural cause is that browser handlers resolve task identity through Core and also call Core.filesystem task list/load/save operations directly. This duplicates active/completed/branch identity resolution, bypasses the ContentStore lifecycle, and lets browser behavior drift from BACK-557 fail-closed semantics.

Make Core the sole browser task read and mutation boundary for list, detail, update, complete, reorder, and duplicate operations. Core must provide separate read and mutation resolution over one coherent active/completed/branch identity snapshot. ContentStore and its watchers own coherent loading, identity-index updates, persistence publication, and lifecycle transitions. Preserve the valid issue #807 latency work: one snapshot per mutation or preview, duplicate-repair reuse, complete reorder responses, one WebSocket reconciliation, and no redundant foreground refresh. This complete architecture direction was explicitly approved by Alex; PR #828 and commit e2499879 are rejected evidence only and are not implementation bases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Browser task list, detail, update, complete, reorder, and duplicate-repair handlers make zero direct task-corpus list/load/save calls through core.filesystem; Core is their sole task boundary.
- [ ] #2 Core exposes separate read and mutation resolution paths over one coherent active/completed/branch identity snapshot: detail reads include completed-only tasks, while mutations accept only unambiguous local active targets and fail before writes otherwise.
- [ ] #3 Active/active, active/completed, distinct-path cross-branch, zero-padded, cross-prefix, and filename/frontmatter collisions fail closed with browser 409 responses and no file mutation, while BACK-557 same-path branch versions remain one identity.
- [ ] #4 ContentStore and watchers atomically install coherent visible-task and identity state before publishing creation, deletion, completion, archive, malformed-sibling recovery, and branch-promotion events.
- [ ] #5 Duplicate-repair preview reuses one Core-owned active/completed snapshot for duplicate detection, occupied-ID allocation, and fingerprint preparation.
- [ ] #6 Browser updates preserve updated-date, status callbacks, auto-commit, Git staging and commit behavior; completed tasks remain excluded from the active board.
- [ ] #7 A board reorder returns and applies every changed task, performs no redundant foreground board refresh, emits one WebSocket reconciliation, and preserves mutation callback and auto-commit behavior.
- [ ] #8 An ephemeral same-machine fixture with 20 active and 430 completed tasks records objective before and after evidence meeting the issue #807 performance objective without adding durable benchmark infrastructure.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add RED regression coverage at the public and shared-model boundaries: instrument every browser task route to prove zero task-corpus filesystem calls; prove completed-only detail reads; prove unchanged-filename frontmatter-ID, active/completed, distinct-path branch, zero-padded, and cross-prefix collisions fail closed with 409 and no writes; cover watcher creation/deletion/branch promotion, malformed-sibling recovery, listener-time completion/archive identity, callbacks, auto-commit, and reorder publication.
2. Introduce one internal TaskCorpusSnapshot loaded by Core and owned atomically by ContentStore, containing visible active tasks, local active tasks, local completed tasks, branch identity records, and the TaskIdentityIndex. Give ContentStore explicit read resolution (active or completed) and mutation resolution (unambiguous working-copy active only), with freshness always rebuilding the complete identity snapshot rather than refreshing only active records or checking filenames alone.
3. Route Core task list/detail/update/complete/archive/reorder and duplicate preview through the ContentStore snapshot. Persist already-resolved exact local paths, update the coherent post-write/post-transition snapshot before publication, and preserve updated-date, status callback, auto-commit, Git staging/commit, BACK-557 same-path identity, and fail-closed collision behavior.
4. Remove direct browser task-corpus filesystem access from list/detail/update/complete/reorder/duplicate handlers. Return all changed reorder tasks, batch persistence publication into one WebSocket reconciliation, apply response tasks optimistically without a redundant foreground refresh, and reject stale responses after newer reconciliation.
5. Verify focused Core, ContentStore, task-loader, server/browser, watcher, lifecycle, duplicate-repair, reorder, and identity suites. Run an ephemeral 20-active/430-completed before/after fixture, simplify the design, commit an immutable head, run full bun test, bunx tsc --noEmit, bun run check ., bun run build, and git diff --check, then prepare the exact-head handoff for the coordinator’s fresh independent reviewer. Keep BACK-559 In Progress until that reviewer approves.

6. Fresh-review correction: add RED regressions for exact-path complete/archive/update auto-commit, exact-path watcher deletion after frontmatter-ID change, moved-first atomic reorder reconciliation, and ambiguous reorder 409/no-write. Trace each failure to its current boundary, apply only the four narrow fixes, rerun focused/full/performance gates, and return a new immutable head for another fresh review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture evidence on origin/main 928d85c1: browser list parent resolution, detail, update, and complete handlers call task-corpus operations through core.filesystem before delegating to Core. Core.getTask separately lists active tasks, calls filesystem.loadTask for active/completed collision detection, and consults a Core-owned TaskIdentityIndex, while ContentStore stores only the visible task array and active-directory watcher events publish visible state without the matching identity state. Reorder calls getTask once per ordered ID and update persistence reloads tasks after save. Duplicate preview scans active/completed multiple times.

Rejected evidence e2499879 is not an implementation base. Its useful direction is a ContentStore-owned TaskCorpusSnapshot and exact-path persistence, but its resolveTask method returned not-found for completed-only identity results, refreshTask used filename-list equality before targeted active parsing and could miss a changed frontmatter ID on an unchanged filename, and lifecycle/watcher fixes were layered after initial implementation. The clean design will make read versus mutation resolution explicit and install one complete snapshot before every publication.

Implementation complete in isolated worktree. ContentStore now owns TaskCorpusSnapshot (visible active, local active/completed, branch identity index) with explicit read and mutation resolution. Core routes browser detail/update/complete/reorder/duplicate behavior through this snapshot; server handlers no longer call task-corpus filesystem list/load/save directly. Lifecycle and watcher publications install identity and visible state together. Reorder returns all changed tasks, batches store publication into one debounced WebSocket reconciliation, and the web client applies all response tasks while rejecting stale responses.

Ephemeral issue #807 fixture (same machine, 20 active + 430 completed, origin/main 928d85c1 versus this worktree): repeated detail x10 improved 722.5ms -> 658.1ms; repeated update x5 improved 1736.7ms -> 371.2ms (~78.6% reduction). No durable benchmark files were added. Focused post-fix verification: 122 pass, 0 fail across reorder, callbacks, Core, server boundary, auto-commit, and publication suites. Full repository rerun pending.

Final implementation verification: bun test passed 1826, skipped 4, failed 0 across 203 files (327.35s); bunx tsc --noEmit passed; bun run check . passed; bun run build passed; git diff --check passed. BACK-559 intentionally remains In Progress with acceptance criteria unchecked pending the coordinator’s fresh independent reviewer.

Fresh review of 278316d7 identified four blockers: lifecycle/update auto-commit still re-resolve by ID after an exact mutation target exists; watcher deletion keys only by the filename-derived ID after frontmatter identity changes; web reorder applies changedTasks one-by-one so a moved-first result invalidates the request object before sibling updates; ambiguous reorder errors fall through to HTTP 500. Correction started with task remaining In Progress.

Fresh-review corrections implemented with RED-to-GREEN coverage. Core complete/archive now rename the already-resolved exact source path and stage that exact move; update auto-commit uses the path returned by saveTask instead of re-resolving by ID. Task watcher rename/deletion reconciliation replaces and removes by exact watched path, including frontmatter identity changes, while preserving existing moved-file recovery. Reorder response tasks are applied as one batch after one stale-request check. Ambiguous reorder targets return HTTP 409 before writes. Focused correction assertions: 11 pass, 0 fail; broader boundary run exposed one existing rename-recovery regression, which was corrected and reverified with 5 focused watcher tests plus TypeScript. Ephemeral 20-active/430-completed rerun against origin/main 928d85c1: detail x10 636.7ms -> 612.5ms; update x5 1612.1ms -> 348.6ms (~78.4% reduction). Full final gates pending.

Fresh post-correction final verification: bun test passed 1831, skipped 4, failed 0 across 203 files (298.21s); bunx tsc --noEmit passed; bun run check . passed across 343 files; bun run build passed. The correction remains intentionally In Progress with acceptance criteria and Definition of Done unchecked pending fresh independent review.
<!-- SECTION:NOTES:END -->

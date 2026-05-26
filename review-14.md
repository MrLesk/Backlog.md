# Review round 14 - 2026-05-26

**Verdict:** APPROVE

## Findings

No blocking findings.

## Notes

- Round-13 finding #1 is closed. `buildBoardEditorRows(statuses, { columns: [] })` returns one row per status with `visible: false`, so a saved hide-all config reloads into Settings as all hidden instead of all visible. If the user opens Settings and makes no board changes, `emit()` is not called and `config.board` remains `{ columns: [] }`; if they change another setting and save, the existing hide-all board config is preserved. If they do trigger `emit()` while all rows are hidden, `visibleColumns` is `[]`, `allVisibleInOrder` is false, and the component emits `{ columns: [] }`, not `undefined`.
- The amber all-hidden warning triggers on initial hide-all render because `rows.every((row) => !row.visible)` is true for the helper-derived state. `hasCustomization` is also true because every row is hidden, so "Reset to defaults" appears and can recover to the default board.
- Round-13 finding #2 is closed. In milestone mode, `cleanupLaneKey` picks the first visible lane whose terminal-status bucket has tasks, and only that lane's terminal-status column receives `onCleanup`. For lanes A/B/C with Done counts 5/0/2, A gets the cleanup affordance and C does not. If no lane has terminal-status tasks, no cleanup affordance is rendered; that is acceptable because there is nothing to clean.
- Single-lane mode is intentionally unchanged. `cleanupLaneKey` is `null`, but the non-milestone render path still attaches cleanup to the single terminal-status column, which cannot duplicate across lanes.
- Filter-dependent cleanup placement can move between lanes because `laneMetadataTasksByLane` switches to the filtered grouping when active filters are set. That means the cleanup button can move from lane A to lane B if filters hide A's Done tasks but not B's. I do not consider that a defect: it follows the visible/filtered board state and still keeps the global action unique.
- Hidden terminal status behavior is safe, with one nuance: `groupTasksByLaneAndStatus()` seeds visible statuses but still creates buckets for task statuses not in the visible status list. So if Done is hidden, `cleanupLaneKey` may still compute a lane that has hidden Done tasks. No cleanup button renders because `visibleColumns` has no `column.status === realTerminalStatus`. The user-visible behavior is correct, though the internal `cleanupLaneKey` is not necessarily `null` in that scenario.
- Test coverage is good enough for this iteration. The new pure helper tests pin the hide-all Settings regression. There is still no automated test for `Board.tsx` milestone cleanup selection or hidden terminal statuses; extracting the cleanup-lane choice into a pure helper would make that cheap to unit test, but I would not block approval on that small inline branch after tracing it.
- Non-blocking cleanup: [src/types/index.ts](D:\1064n\Programacion\claude\Backlog.md\src\types\index.ts:294) still documents `board.columns` as "When omitted or empty, every entry ... renders as a column." That is stale for the new hide-all contract. Per the project guidance, this is source-level commentary rather than a supported external API contract, so I am not treating it as approval-blocking, but it should be corrected to prevent future confusion.

## Verification

- Read the requested touched files in full:
  `src/utils/build-board-editor-rows.ts`, `src/test/build-board-editor-rows.test.ts`, `src/web/components/Settings.tsx`, `src/web/components/Board.tsx`, and `src/test/board-config-roundtrip.test.ts`.
- Also traced supporting code:
  `src/web/lib/lanes.ts`, `src/utils/terminal-status.ts`, and the `BoardConfig` type comment in `src/types/index.ts`.
- Ran `bunx tsc --noEmit`; PowerShell blocked the `bunx.ps1` shim via execution policy, so I ran the equivalent `C:\Users\logan\.bun\bin\bun.exe x tsc --noEmit`.
  Result: exit 0.
- Ran the requested targeted suite 10 times with `C:\Users\logan\.bun\bin\bun.exe test ...`.
  Result distribution: 10/10 runs passed, 0 failures. Each run reported `97 pass, 6 skip, 0 fail` and `Ran 103 tests across 10 files`. I did not reproduce the reported `save-task-on-serialized > supports async onSerialized callbacks` flake.
- I did not perform the optional red/green mutation of `buildBoardEditorRows` because this review was requested as read-only. The checked-in regression test directly covers that case.

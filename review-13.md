# Review round 13 — 2026-05-26

**Verdict:** CHANGES REQUESTED

## Findings

### important — saved `{ board: { columns: [] } }` reloads as “all visible” in Settings, so the editor cannot round-trip the hide-all state
- **Location:** [src/web/components/Settings.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Settings.tsx:609), [src/web/components/Settings.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Settings.tsx:621), [src/web/components/Settings.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Settings.tsx:624)
- **Issue:** `BoardColumnsSection` still conflates “board config absent” with “board config explicitly present but empty.” On reload it computes `configured = board?.columns ?? []`, then uses `configured.length > 0` to decide whether omitted statuses should be hidden. For the persisted hide-all state (`board.columns = []`), that becomes `false`, so every status row is reconstructed as `visible: true`. The UI therefore shows the opposite of the saved config: all `Show` checkboxes checked, no amber “board will be empty” warning, and no `Reset to defaults` affordance. I verified this by rendering `Settings` with `/api/config` returning `board: { columns: [] }`; the page rendered `checked=3` and `reset=false`.
- **Suggested fix:** Distinguish `board?.columns === undefined` from `board.columns.length === 0` when building `initialRows` (for example, derive `hasConfigured` from field presence, not array length). Add a UI test that reloads a saved `board: { columns: [] }` config into `Settings` and asserts the rows come back hidden.

### important — milestone-lane mode still duplicates the single global cleanup action once per lane
- **Location:** [src/web/components/Board.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Board.tsx:616), [src/web/components/Board.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Board.tsx:638), [src/web/components/TaskColumn.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\TaskColumn.tsx:327)
- **Issue:** The round-12 fix correctly anchors cleanup on the real terminal status, but in milestone mode each lane renders the full column set and independently passes `onCleanup` to its terminal column. `TaskColumn` renders the button whenever `onCleanup` is present and that lane’s column has tasks, so the same global cleanup action appears once per milestone lane that has terminal-status tasks. That is misleading UI: the modal/endpoint are global, not lane-scoped. I confirmed this with a render probe using `lane=milestone` and two milestone lanes each containing a `Done` task; the page rendered `cleanupButtons=2`. Current tests only cover the non-milestone case.
- **Suggested fix:** Render this affordance only once in milestone mode (for example as a board-level action, or only on one designated lane/column) and add a milestone-lane UI test asserting a single cleanup button.

## Verification I performed
- Read the full touched files:
  `src/file-system/operations.ts`, `src/utils/resolve-board-config.ts`, `src/web/components/Board.tsx`, `src/web/components/Settings.tsx`, `src/test/board-config-roundtrip.test.ts`, `src/test/resolve-board-config.test.ts`, plus `review-12.md`.
- Ran `C:\Users\logan\.bun\bin\bun.exe x tsc --noEmit`.
  Outcome: exit `0`.
- Ran `C:\Users\logan\.bun\bin\bun.exe test src/test/board-config-roundtrip.test.ts src/test/resolve-board-config.test.ts src/test/task-write-coordinator.test.ts src/test/task-hook-dispatcher.test.ts src/test/watcher-lock.test.ts src/test/status-callback.test.ts src/test/race-guard.test.ts src/test/save-task-on-serialized.test.ts src/test/core-reinit-hook-authority.test.ts` five times.
  Outcome distribution: `90 pass, 6 skip, 0 fail` on all 5 runs (`96` total each run). I did not reproduce the round-12 combined-run failures on this machine.
- Ran targeted runtime probes for the round-12 storage contract:
  `undefined -> { columns: [] }` saved `board:\n  columns: []`, reloaded as `{"columns":[]}`, and `resolveBoardColumns()` returned `[]`.
  `{ columns: [] } -> undefined` saved with no `board:` block, reloaded as `undefined`, and `resolveBoardColumns()` returned the full default status list.
  `{ columns: [valid, color] }` saved a `color:` line, reloaded the color, and resolved with the color intact.
- Ran targeted UI probes:
  Rendering `Settings` against a fetched config containing `board: { columns: [] }` produced `checked=3` and no `Reset to defaults` button, demonstrating the hide-all reload bug above.
  Rendering `BoardPage` in `lane=milestone` with two milestone lanes each containing a terminal-status task produced `cleanupButtons=2`.

## Notes
- The round-12 storage/resolver fixes themselves are in place:
  `parseBoardConfig()` / `serializeBoardBlock()` now preserve `columns: []`, collapse `{ board: {} }` to `undefined`, and the fresh-`FileSystem` round-trip helper no longer false-passes from cache.
  `resolveBoardColumns()` now preserves `[]`, and `Board.tsx` now distinguishes `undefined` from `[]` in its fallback logic.
- Two last-mile UI behaviors are still unpinned by automated tests even aside from the defects above:
  there is no test that asserts the board actually renders zero columns for an empty resolved board, and no test that asserts a saved column color reaches the `TaskColumn` accent dot.
- I kept the review read-only; I did not mutate source to do red/green confirmation.

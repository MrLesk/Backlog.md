# Review round 12 — 2026-05-26

**Verdict:** CHANGES REQUESTED

## Findings

### important — bare `board:` does not survive a real reload, and the new round-trip test is a false positive
- **Location:** [src/file-system/operations.ts](D:\1064n\Programacion\claude\Backlog.md\src\file-system\operations.ts:1497), [src/file-system/operations.ts](D:\1064n\Programacion\claude\Backlog.md\src\file-system\operations.ts:1588), [src/test/board-config-roundtrip.test.ts](D:\1064n\Programacion\claude\Backlog.md\src\test\board-config-roundtrip.test.ts:33)
- **Issue:** `serializeBoardBlock()` emits a bare `board:` header for the empty-section state, but `parseBoardConfig()` treats `gray-matter`'s `board: null` result as `undefined` and drops it. On a fresh `FileSystem` instance, `saveConfig({ board: {} })` reloads as no `board` at all. The new `preserves an explicit empty board` test does not catch this because `writeAndLoad()` saves and reloads on the same `FileSystem` instance, so `loadConfig()` returns the cached object from `saveConfig()` instead of reparsing disk.
- **Suggested fix:** Make `parseBoardConfig()` map bare `board:` back to `{}` explicitly, and rewrite the round-trip helper/tests to reload through a fresh `FileSystem` instance whenever the behavior under test is parser/serializer persistence.

### important — the Settings UI can emit “hide every column”, but that state is not representable end-to-end
- **Location:** [src/web/components/Settings.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Settings.tsx:637), [src/utils/resolve-board-config.ts](D:\1064n\Programacion\claude\Backlog.md\src\utils\resolve-board-config.ts:22), [src/file-system/operations.ts](D:\1064n\Programacion\claude\Backlog.md\src\file-system\operations.ts:1588)
- **Issue:** If the user unchecks every row, `BoardColumnsSection.emit()` sends `{ columns: [] }`. That is immediately ambiguous with the “no overrides” state: serialization collapses it to a bare `board:`, and `resolveBoardColumns()` treats an empty array as “fall back to `config.statuses`”. Result: “hide all columns” cannot persist, and in practice resolves back to the default full board.
- **Suggested fix:** Decide on one supported semantic and enforce it consistently. Either forbid saving an empty visible set in the Settings UI, or change the config contract so an explicit empty column list is preserved and consumed as “render zero columns”. Add a test that exercises the all-hidden path from Settings emit semantics through save/load/resolve.

### important — stale configured columns filtering down to `[]` is undone by `Board.tsx`
- **Location:** [src/utils/resolve-board-config.ts](D:\1064n\Programacion\claude\Backlog.md\src\utils\resolve-board-config.ts:24), [src/web/components/Board.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Board.tsx:82)
- **Issue:** `resolveBoardColumns()` correctly returns `[]` when `board.columns` was non-empty but every entry got filtered out as stale. `Board.tsx` then treats `boardColumns.length === 0` as “no board config supplied” and falls back to `statuses.map(...)`. That is the opposite of the design called out in the brief: an explicitly empty effective board should stay empty, not silently resurrect every status column.
- **Suggested fix:** Distinguish `undefined` from `[]` in the board consumer. If `boardColumns` was supplied, consume it verbatim, even when empty. Add a focused test for the “configured list filtered to empty” case; nothing currently covers the App/Board consumer behavior.

### important — hiding the true terminal status moves the cleanup action onto the wrong column
- **Location:** [src/web/components/Board.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Board.tsx:89), [src/web/components/Board.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Board.tsx:629), [src/core/backlog.ts](D:\1064n\Programacion\claude\Backlog.md\src\core\backlog.ts:2301)
- **Issue:** The board computes `terminalStatus` from `visibleStatuses`, not from the real configured workflow statuses. If the user hides the actual terminal status, the cleanup button migrates to the last visible column, but the server cleanup endpoints still operate on tasks in the true terminal status from `config.statuses`. That is misleading UI: clicking “cleanup” from an `In Progress` column can move old `Done` tasks the user cannot even see on the board.
- **Suggested fix:** Base the cleanup affordance on the real workflow terminal status, not the visible board subset. If the terminal status column is hidden, the cleanup affordance should disappear from the board or move to some neutral board-level action, not to another status column. Add a UI test for “terminal status hidden”.

### nit — board-column reordering is pointer-only and the drag affordance is not keyboard reachable
- **Location:** [src/web/components/Settings.tsx](D:\1064n\Programacion\claude\Backlog.md\src\web\components\Settings.tsx:728)
- **Issue:** Reordering relies entirely on native HTML5 drag events on a `div`, with a non-focusable handle glyph. That gives you no keyboard path and no touch fallback on platforms where HTML5 DnD is not supported.
- **Suggested fix:** Either add keyboard/pointer fallbacks or explicitly accept/document the desktop-only limitation. At minimum, make the handle an actual focusable control and add an integration test for whatever interaction model is intended to be supported.

## Verification I performed
- Read the full touched files:
  `src/utils/resolve-board-config.ts`, `src/test/resolve-board-config.test.ts`, `src/test/board-config-roundtrip.test.ts`, `src/types/index.ts`, `src/file-system/operations.ts`, `src/web/components/TaskColumn.tsx`, `src/web/components/Board.tsx`, `src/web/components/BoardPage.tsx`, `src/web/App.tsx`, `src/web/components/Settings.tsx`, plus `context.md`.
- Audited adjacent consumers for hidden-status fallout:
  `src/web/components/TaskList.tsx`, `src/web/components/TaskDetailsModal.tsx`, `src/web/components/Statistics.tsx`, `src/web/lib/lanes.ts`, `src/utils/terminal-status.ts`, `src/server/index.ts`, `src/core/backlog.ts`.
- Ran `C:\Users\logan\.bun\bin\bun.exe x tsc --noEmit`.
  Outcome: exit 0.
- Ran `C:\Users\logan\.bun\bin\bun.exe test src/test/board-config-roundtrip.test.ts src/test/resolve-board-config.test.ts src/test/task-write-coordinator.test.ts src/test/task-hook-dispatcher.test.ts src/test/watcher-lock.test.ts src/test/status-callback.test.ts src/test/race-guard.test.ts src/test/save-task-on-serialized.test.ts src/test/core-reinit-hook-authority.test.ts`.
  Outcome: not the claimed baseline on this machine; got `85 pass, 6 skip, 2 fail`. One failure was unrelated existing hook-authority lock cleanup (`core-reinit-hook-authority.test.ts`), and one failure hit `board-config-roundtrip.test.ts` only inside the combined run.
- Re-ran `C:\Users\logan\.bun\bin\bun.exe test src/test/board-config-roundtrip.test.ts --rerun-each 1`.
  Outcome: `8 pass, 0 fail` in isolation.
- Ran targeted runtime probes with `bun run -` / `node -`:
  confirmed `gray-matter` parses bare `board:` as `null`;
  confirmed `parseBoardConfig("board:\\n")` returns `undefined`;
  confirmed `saveConfig({ board: {} })` followed by a fresh `FileSystem.loadConfig()` drops `board`;
  confirmed `saveConfig({ board: { columns: [] } })` followed by fresh load and `resolveBoardColumns()` resolves back to all statuses;
  confirmed the new YAML quoting preserves tricky status strings such as `"true"`, `"null"`, `"*alias"`, `"a:b"`, backslashes, and embedded quotes.
- Did not mutate source to force tests red/green; review was read-only.

## Notes
- `extractTopLevelBlock()` does stop correctly at the next top-level key in the `definition_of_done` / `board` / `mcp` sandwich case; I verified that path directly.
- A scalar `board: "something"` is ignored rather than crashing. The flat parser's switch does not choke on it, and `parseBoardConfig()` drops non-object values.
- Hidden statuses remain reachable outside the board: list filters and task status pickers still source from the full configured statuses, not from `board.columns`.
- First render does not flash an empty kanban while config is loading because `Board.tsx` returns a loading state when `isLoading && statuses.length === 0`.

# Code Review (Round 2) — 2026-05-20

## Verdict
CHANGES REQUESTED

## Prior findings — addressed?

| Prior finding | Status | Evidence |
|---|---|---|
| Task #1 test gate did not mirror resolver lookup | ADDRESSED | [src/test/status-callback.test.ts](D:/1064n/Programacion/claude/Backlog.md/src/test/status-callback.test.ts:11) |
| Task #1 missing resolver coverage for uppercase `AUTO` and unknown shell name | ADDRESSED | [src/test/status-callback.test.ts](D:/1064n/Programacion/claude/Backlog.md/src/test/status-callback.test.ts:45) |
| Task #2 browser task write path dropped `onStatusChange` | ADDRESSED | `context.md` Task #2, “Planned changes (revised after review)” Step 1 |
| Task #2 browser lacked server-side capability surface for shell warning UX | ADDRESSED | `context.md` Task #2, Step 2; current `/api/status` surface exists at [src/server/index.ts](D:/1064n/Programacion/claude/Backlog.md/src/server/index.ts:1676) and client wrapper at [src/web/lib/api.ts](D:/1064n/Programacion/claude/Backlog.md/src/web/lib/api.ts:532) |
| Task #3 design added a second watcher plus timestamp cooldown | ADDRESSED | `context.md` Task #3, revised Steps 1–3 |
| Task #4 assumed nested `board:` config without parser/serializer support | ADDRESSED | `context.md` Task #4, revised Step 1 |
| Task #5 allowed arbitrary field ordering despite fixed card composition | ADDRESSED | `context.md` Task #5, revised Steps 1–2 |

## New findings on revised designs

- **Severity**: important
- **Location**: [src/core/content-store.ts](D:/1064n/Programacion/claude/Backlog.md/src/core/content-store.ts:606)
- **Issue**: Task #3 fixed the cooldown problem, but the revised suppression point is still too high in the stack. `ContentStore` already patches `filesystem.saveTask()` and immediately routes in-process writes through `handleTaskWrite()`. Putting the “suppress next disk event” counter in `Core.updateTask()` duplicates responsibility and misses the cleaner shared signal that already exists on the save path. It also makes the future `backlog watch` path harder to share cleanly with browser/server code.
- **Suggested fix**: Move suppression ownership to the shared save path, not `Core.updateTask()`. A dispatcher-owned save-source tag/counter attached at the `saveTask` wrapper is simpler and covers all in-process task writes seen by the watcher.

- **Severity**: nit
- **Location**: [src/file-system/operations.ts](D:/1064n/Programacion/claude/Backlog.md/src/file-system/operations.ts:1457)
- **Issue**: Task #4’s revised reviewer guidance says to assert unrelated fields were not “reordered,” but this config layer already serializes the whole file into a canonical order and does not preserve comments. Order-preservation is not a behavior the current implementation has.
- **Suggested fix**: Make the acceptance test semantic, not textual: verify fields survive round-trip and `board:` is neither dropped nor mangled. Do not require original key order/comments to survive `saveConfig()`.

- **Severity**: nit
- **Location**: [src/web/components/TaskCard.tsx](D:/1064n/Programacion/claude/Backlog.md/src/web/components/TaskCard.tsx:109)
- **Issue**: Task #5’s slot model is close, but the current card has invariant structure beyond configurable data fields: title, cross-branch banner/tooltip, and priority border/chip are part of the composition. “One default field per slot” is underspecified unless the design explicitly separates configurable fields from always-on card chrome.
- **Suggested fix**: Define a small enum of configurable fields only (`id`, `priority`, `labels`, `createdDate`, `assignee`, etc.) and state explicitly that title/branch indicators/drag-state visuals are not governed by `board.card.hide`.

## Task #1 implemented code — re-audit

No new code issues beyond the round-1 nits. The test gate now mirrors resolver lookup, the two missing resolver tests are present, and the local run matches the updated `14 pass / 6 skip / 0 fail` expectation.

## Verification I performed

- `bunx.cmd biome check src/utils/status-callback.ts src/core/backlog.ts src/file-system/operations.ts src/types/index.ts src/test/status-callback.test.ts` → exit `0`
- `bunx.cmd tsc --noEmit` → exit `0`
- `bun.cmd test src/test/status-callback.test.ts` → exit `0`; `14 pass / 6 skip / 0 fail`

## Notes / open questions for the human

- Decide whether `backlog watch` and `backlog browser` may run concurrently on the same project. The revised design already calls out lockfile vs documented user responsibility; that choice should be made before implementation starts.

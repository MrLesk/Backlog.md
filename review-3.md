# Code Review (Round 3) — 2026-05-20

## Verdict
CHANGES REQUESTED

## Round-2 findings — addressed?

| Round-2 finding | Status | Evidence |
|---|---|---|
| Task #3 suppression should move from `Core.updateTask()` to the shared `saveTask` wrapper in `ContentStore` | PARTIALLY ADDRESSED | `context.md` §Task #3, Step 2 now targets the wrapper; the wrapper exists at `src/core/content-store.ts:606`, but `src/core/backlog.ts:2524` still shows an in-process task write path that bypasses `filesystem.saveTask()` entirely |
| Task #4 review should require semantic round-trip, not textual preservation | ADDRESSED | `context.md` §Task #4, Reviewer focus areas; current config serializer is canonicalizing at `src/file-system/operations.ts:1457` |
| Task #5 should split configurable fields from always-on card chrome via an explicit enum | PARTIALLY ADDRESSED | `context.md` §Task #5 now names both sets, and the chrome mostly maps to `src/web/components/TaskCard.tsx:82`; the enum still includes `milestone`, which the current card does not render anywhere |

## New findings on revised designs

- **Severity**: important
- **Location**: `src/core/backlog.ts:2524`
- **Issue**: Task #3 now puts suppression in the right general layer, but the design overstates the wrapper as the single point every in-process task write passes through. `editTaskInTui()` writes the task file with `Bun.write(...)`, then calls `contentStore.upsertTask(...)`; it never goes through `filesystem.saveTask()`. If the hook dispatcher relies only on the `saveTask` wrapper tag/counter, this path can still produce a false “hand edit” hook or leave the dispatcher snapshot out of sync.
- **Suggested fix**: Narrow the design claim. Either route this editor-save path through `filesystem.saveTask()`, or define one shared suppression/snapshot API that both the wrapper and this direct-write path must call before touching disk.

- **Severity**: important
- **Location**: `src/web/components/TaskCard.tsx:121`
- **Issue**: Task #5’s `ConfigurableCardField` enum still does not match the card that exists today. The revised design calls this a visibility-only feature over fixed current slots, but `milestone` is not rendered in `TaskCard.tsx` at all. Adding it is not a visibility toggle; it is a new slot and a layout change.
- **Suggested fix**: Either remove `milestone` from the initial enum, or explicitly expand the scope to add a milestone slot and update the “visibility-only / byte-identical by default” claim accordingly.

- **Severity**: nit
- **Location**: `src/file-system/operations.ts:240`
- **Issue**: Task #3’s lockfile example is project-scoped and non-colliding, but it is not phrased in terms of the repo’s existing backlog-dir abstraction. Current locking already derives from `getBacklogDir()` and uses `<backlogDir>/.locks/create`. A literal `.backlog/watcher.lock` would drift from projects using `backlog/` or a custom backlog directory.
- **Suggested fix**: Define the watcher lock relative to the resolved backlog directory, ideally alongside the existing create lock namespace, e.g. `<backlogDir>/.locks/watcher`.

## Cross-section consistency

Tasks #2–#5 are mostly coherent as one plan. Task #4’s proposed shape can carry Task #5 cleanly as `board.card.hide`. The remaining mismatch is local to Task #5: the config enum names `milestone`, but the current fixed card composition has no milestone slot to hide or show.

## Verification I performed

- `bunx.cmd biome check src/utils/status-callback.ts src/core/backlog.ts src/file-system/operations.ts src/types/index.ts src/test/status-callback.test.ts` → exit `0`
- `bunx.cmd tsc --noEmit` → exit `0`
- `bun.cmd test src/test/status-callback.test.ts` → exit `0` (`14 pass / 6 skip / 0 fail`)

## Notes / open questions for the human

- If Task #3 keeps the lockfile, decide whether the intended invariant is “exactly one watcher per project, regardless of entry point” and document the lock path in backlog-dir terms, not `.backlog` specifically.
- If Task #5 must support milestone on cards, that is now a small UI-feature addition, not just config plumbing. Decide whether that belongs in this task or a follow-up.

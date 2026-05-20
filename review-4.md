# Code Review (Round 4) — 2026-05-20

## Verdict
APPROVE WITH NITS

## Round-3 findings — addressed?

| Round-3 finding | Status | Evidence |
|---|---|---|
| Task #3 needed a suppression model that covers write paths bypassing `filesystem.saveTask()` | ADDRESSED | `context.md` Task #3 Step 2 now moves to an explicit `TaskWriteCoordinator`; production task-content writes are `src/file-system/operations.ts:289` (`saveTask`) and `src/core/backlog.ts:2524` (`editTaskInTui` direct `Bun.write`) |
| Task #3 lockfile path should follow backlog-dir conventions, not a literal `.backlog/...` path | ADDRESSED | `context.md` Task #3 Step 3 now uses `<backlogDir>/.locks/watcher`; existing convention is `src/file-system/operations.ts:240-253` (`<backlogDir>/.locks/create`) |
| Task #5 had `milestone` in the enum without any current card slot to render it | ADDRESSED | `context.md` Task #5 now treats milestone as an intentional UI addition; current absence in code remains confirmed at `src/web/components/TaskCard.tsx:143-170` |

## New findings on revised designs

- **Severity**: nit
- **Location**: `context.md` Task #3 Step 2
- **Issue**: The handle-based coordinator is the right model, but the design should make the call-site discipline explicit: `beginWrite`/`endWrite` must bracket the write in `try/finally`, and coordinator cleanup should not introduce a second failure path after a successful disk write. Without that, a thrown write or post-write error can leak suppression state.
- **Suggested fix**: State the contract directly in the design doc: every call site uses `const h = beginWrite(...); try { ...write... } finally { endWrite(h); }`, and `endWrite` should be idempotent or otherwise safe during cleanup.

- **Severity**: nit
- **Location**: `context.md` Task #5 Step 1
- **Issue**: The milestone slot is now intentionally in scope, but the proposed placement options are not equally consistent with the stated invariant that existing fields remain byte-identical. In the current card, `footer-right` is already occupied by assignee (`src/web/components/TaskCard.tsx:163-169`), so choosing that option would likely reshape an existing field rather than adding only one new render.
- **Suggested fix**: Prefer a non-displacing slot in implementation, e.g. body-above-labels, or update the design if the assignee/footer layout is meant to change too.

## Verification I performed

- `bunx.cmd biome check src/utils/status-callback.ts src/core/backlog.ts src/file-system/operations.ts src/types/index.ts src/test/status-callback.test.ts` → exit `0`
- `bunx.cmd tsc --noEmit` → exit `0`
- `bun.cmd test src/test/status-callback.test.ts` → exit `0` (`14 pass / 6 skip / 0 fail`)
- Write-path audit: `rg -n "Bun\\.write\\(|writeFile\\(|writeFileSync\\(|appendFile\\(|appendFileSync\\(|saveTask\\(" src` plus targeted reads of `src/core/backlog.ts` and `src/file-system/operations.ts`

## Notes / open questions for the human

- No remaining design issue here looks likely to cause correctness bugs or architectural rework during implementation. The remaining choices are implementation-shape details.

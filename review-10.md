# Review round 10 — 2026-05-25

**Verdict:** CHANGES REQUESTED

## Findings

### important — reinitialize still leaks an in-flight old-project authority probe
- **Location:** [src/core/backlog.ts](/D:/1064n/Programacion/claude/Backlog.md/src/core/backlog.ts:274), [src/core/backlog.ts](/D:/1064n/Programacion/claude/Backlog.md/src/core/backlog.ts:311), [src/core/backlog.ts](/D:/1064n/Programacion/claude/Backlog.md/src/core/backlog.ts:637)
- **Issue:** The round-9 stale-authority fix is only complete for the already-resolved case. If `resolveHookAuthority()` has started for project A but has not yet resolved when `reinitializeProjectRoot(projectB)` runs, `void this.releaseHookAuthority()` clears the fields too early: `hookAuthorityLockHolder` is still `null`, so nothing is released. The in-flight async closure from `resolveHookAuthority()` can then finish later and assign `this.hookAuthorityLockHolder = holder` for project A after the `Core` has already moved to project B. The next dispatch in B will re-probe because `hookAuthorityResolution` was nulled, so the fire/suppress decision is no longer stale, but the old project's watcher lock can remain held for the rest of the process lifetime. That blocks another process from becoming watcher authority for project A until process exit or stale-lock recovery.
- **Suggested fix:** Make the probe generation-aware so stale probe completions are discarded. For example, increment an authority-generation counter in `releaseHookAuthority()` / `reinitializeProjectRoot()`, capture it in `resolveHookAuthority()`, and only install `hookAuthorityLockHolder` if the generation still matches when the await returns; otherwise immediately release the stale holder. An equivalent cancellation token or `AbortController` pattern would also work.

## Verification I performed
- Read `review-9.md` and traced each prior finding against the new implementation.
- Read in full: [src/file-system/operations.ts](/D:/1064n/Programacion/claude/Backlog.md/src/file-system/operations.ts:1), [src/core/content-store.ts](/D:/1064n/Programacion/claude/Backlog.md/src/core/content-store.ts:1), [src/core/backlog.ts](/D:/1064n/Programacion/claude/Backlog.md/src/core/backlog.ts:1), [src/test/save-task-on-serialized.test.ts](/D:/1064n/Programacion/claude/Backlog.md/src/test/save-task-on-serialized.test.ts:1), [src/test/core-reinit-hook-authority.test.ts](/D:/1064n/Programacion/claude/Backlog.md/src/test/core-reinit-hook-authority.test.ts:1), plus the existing hook/coordinator/lock/status suites requested in the prompt.
- Ran `C:\Users\logan\.bun\bin\bunx.exe tsc --noEmit` — passed with exit code 0.
- Ran `C:\Users\logan\.bun\bin\bun.exe test src/test/task-write-coordinator.test.ts src/test/task-hook-dispatcher.test.ts src/test/watcher-lock.test.ts src/test/status-callback.test.ts src/test/race-guard.test.ts src/test/save-task-on-serialized.test.ts src/test/core-reinit-hook-authority.test.ts` — passed with exit code 0. Result: `70 pass, 6 skip, 0 fail` (`Ran 76 tests across 7 files`).
- I did not temporarily patch or revert source files; this was a read-only review.

## Notes
- Round-9 finding #1 looks fixed. `saveTask()` now exposes serialized bytes before `Bun.write()`, the ContentStore wrapper records the hash in that pre-write callback, and `editTaskInTui()` records before writing. The new `save-task-on-serialized` tests are a reasonable pin for that timing contract.
- The new reinit test still does not drive a real lazy probe before reinit, which is why the remaining in-flight-probe race slipped through. Once the generation/cancellation fix exists, I would add a test that forces `resolveHookAuthority()` to stall, calls `reinitializeProjectRoot()`, then verifies the stale holder gets released instead of sticking to the old project.

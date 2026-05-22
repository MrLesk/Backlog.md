# Review round 5 — 2026-05-22

**Verdict:** CHANGES REQUESTED

## Findings

### important — Background refreshes can leave the app stuck in loading mode
- **Location:** `src/web/App.tsx:265`
- **Issue:** `loadAllData()` only clears `isLoading` in `finally` when `showLoading` is `true` *and* the generation is still current. If an initial/foreground load starts with `showLoading: true` and a later background refresh (`refreshData()` or `config-updated`) bumps `loadGenerationRef` before that first request settles, the older request skips the `setIsLoading(false)` call and the newer request never clears it because `showLoading` is `false`. The result is a persistent skeleton sidebar until a full reload happens.
- **Suggested fix:** Decouple spinner teardown from the `showLoading` flag. The latest generation should always be able to clear `isLoading`, or you should track which generation actually enabled the loading UI and clear that state when it is superseded.

### important — The reconnect/onlineness reload path bypasses the generation guard and reintroduces stale overwrites
- **Location:** `src/web/App.tsx:225`
- **Issue:** `applySearchResults()` still writes `tasks`, `docs`, and `decisions` directly. `loadAllData()` is safe only because it checks the generation before calling `applySearchResults()`. The separate offline→online effect calls `applySearchResults()` and then sets milestone state itself with no generation check at all. That gives you a second stale-write path: a slower reconnect refresh can overwrite fresher websocket-triggered data. It also reloads only search/milestones, so config/status/project-name changes made while offline can lag behind this path.
- **Suggested fix:** Stop duplicating the partial reload logic. Route the online-restored effect through `loadAllData({ showLoading: false })` or `refreshData()` so every state write goes through the same race-controlled path.

### important — `dispatch.ps1` log/prompt filenames are neither unique enough nor fully sanitized for Windows
- **Location:** `backlog/prompts/dispatch.ps1:38`
- **Issue:** The “per-invocation” filename uses second-resolution timestamp + task id + status. Two firings for the same task/status inside the same second will collide and clobber `.log`, `.err`, and `.prompt` files, which is plausible in the exact retry/loop scenario this change is trying to harden. On top of that, only whitespace is sanitized out of `$env:NEW_STATUS`; custom statuses containing `:`, `?`, `*`, `[` and other Windows-invalid filename characters will break the dispatcher outright.
- **Suggested fix:** Build the stem from fully sanitized dynamic segments and add a uniqueness component that survives same-second retries, e.g. milliseconds plus PID, or a GUID. Reuse that safe stem for the `.log`, `.err`, and `.prompt` sidecar files.

### nit — The new race/reconnect/PowerShell behaviors still have no targeted regression coverage
- **Location:** `src/web/App.tsx:265`
- **Issue:** The added logic is exactly in the areas that already failed in smoke testing: interleaved refreshes, websocket reconnect/backoff, and Windows prompt dispatch. There are backend callback tests, but nothing exercises `App.tsx` generation discard / `showLoading: false` behavior / reconnect cleanup, and nothing checks the PowerShell dispatcher’s `claude.cmd` resolution plus stdin redirection path.
- **Suggested fix:** Add focused tests before merge: a small web test that forces overlapping refresh promises and verifies stale responses are discarded without leaving `isLoading` stuck, plus a Windows-specific dispatcher test that validates the resolved executable and multi-line prompt delivery mechanism.

## Verification I performed
- `Get-Content -Raw` on all requested changed files and targeted surrounding code paths.
- `git diff -- src/core/backlog.ts src/web/App.tsx backlog/prompts/dispatch.ps1 backlog/prompts/dispatch.sh backlog/prompts/README.md backlog/prompts/code.test.md backlog/prompts/review.test.md backlog/prompts/ready.test.md src/server/index.ts src/utils/status-callback.ts src/test/status-callback.test.ts`
- `bunx tsc --noEmit` via PowerShell shim: failed immediately with execution-policy block (`bunx.ps1` not allowed).
- `bun test src/test/status-callback.test.ts` via PowerShell shim: failed immediately with execution-policy block (`bun.ps1` not allowed).
- `bun run check .` via PowerShell shim: failed immediately with execution-policy block (`bun.ps1` not allowed).
- `C:\Users\logan\.bun\bin\bunx.exe tsc --noEmit`: exit 0.
- `C:\Users\logan\.bun\bin\bun.exe test src/test/status-callback.test.ts`: exit 0, 23 passed / 6 skipped / 0 failed.
- `C:\Users\logan\.bun\bin\bun.exe run check .`: exit 1 with a large pre-existing Biome failure set (`280 errors`, mostly formatting/base-tree issues outside this change).

## Notes
- I did not find a production code path that semantically depends on `executeStatusChangeCallback()` finishing before `updateTaskFromInput()` returns. `src/server/index.ts:981` returns the directly updated task, not callback-derived state, so the fire-and-forget change looks contract-safe for the MCP/web edit path.
- WebSocket cleanup itself looks structurally correct: the effect clears the pending reconnect timer, marks the closure cancelled, and closes the current socket so `onclose` cannot schedule a new timer on unmount.
- The README’s recommendation to use per-invocation `powershell -NoProfile -ExecutionPolicy Bypass -File ...` is the right default for a drop-in local hook. It avoids telling users to mutate machine/user policy globally. I would keep that recommendation and only soften the wording around the exact default policy, because “effective policy may block unsigned local scripts” is more accurate than claiming `CurrentUser` is universally `Restricted`.

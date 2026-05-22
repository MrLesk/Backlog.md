# Review round 7 — 2026-05-22

**Verdict:** APPROVE

## Findings

(none)

## Verification I performed
- Read in full:
  - `src/web/lib/race-guard.ts`
  - `src/web/App.tsx`
  - `src/test/race-guard.test.ts`
  - `src/test/dispatch-ps1.test.ts`
  - `backlog/prompts/dispatch.ps1`
  - `review-6.md`
- Ran:
  - `C:\Users\logan\.bun\bin\bunx.exe tsc --noEmit` → exit `0`
  - `C:\Users\logan\.bun\bin\bun.exe test src/test/status-callback.test.ts src/test/race-guard.test.ts src/test/dispatch-ps1.test.ts` → exit `0` (`39` pass, `6` skipped, `0` fail)
- I did not temporarily revert source files. I verified the strengthened tests structurally against the production paths they now exercise:
  - `trackSpinner` is tested directly for `show: true`, `show: false`, and idempotent `release()`, and the overlapping-load simulation now wires `createGenerationGate + trackSpinner` exactly the way `App.tsx` does.
  - The new dispatcher stdin test no longer short-circuits via `BACKLOG_DISPATCH_DRY_RUN=1`; it installs a stub `claude.cmd`, prepends that directory to `PATH`, waits for the detached child to write the captured stdin file, and asserts on the actual received content.

## Notes
- Round-6 nit #1 is addressed. A no-op `release()` would now fail both the direct `trackSpinner` tests and the overlapping-load simulation. Removing the `show` guard would fail the `show: false` test immediately.
- Round-6 nit #2 is addressed. Reverting the dispatcher back to the old prompt-as-argument behavior would not satisfy the new stub-child stdin assertions; the test now reaches the real `Start-Process -RedirectStandardInput` path.
- `trackSpinner` is semantically safe in its current use:
  - It is created inside `loadAllData`, not during render, so there is no StrictMode double-render concern analogous to `useRef(createGenerationGate())`.
  - `release()` is genuinely idempotent because it flips the private `enabled` flag before calling `setLoading(false)` a second time.
  - `trackSpinner({ show: showLoading, setLoading: setIsLoading })` still preserves the original ordering in `loadAllData`: spinner-on happens before any async fetch work starts.
- The `Select-Object -First 1` fix in `dispatch.ps1` is the right behavior on Windows. `Get-Command ... -CommandType Application` can return multiple matches when `PATH` contains multiple `claude.cmd` locations; picking the first match follows normal `PATH` precedence and avoids the real `Object[]` failure the new test exposed.
- Test isolation looks clean: the stub dir, captured stdin file, copied dispatcher, prompt fixtures, sidecars, and logs all live under `scratchRoot`, and `afterEach` removes that tree recursively. `BACKLOG_DISPATCH_DRY_RUN: ""` in the spawned env is sufficient to override any inherited `1`, because the child sees an empty string and the script checks specifically for equality with `'1'`.

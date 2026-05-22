# Review round 6 — 2026-05-22

**Verdict:** APPROVE WITH NITS

## Findings

### nit — The spinner “regression test” does not exercise the production spinner cleanup path
- **Location:** `src/test/race-guard.test.ts:72`
- **Issue:** The new test hardcodes the fixed `enabledLoading` pattern inside the test body instead of exercising `App.tsx` or a shared helper that owns the spinner teardown. If `src/web/App.tsx` were reverted to the old buggy `finally` condition, this test would still pass, because the test never references the production `finally` logic at all. That means round-5 finding #1 is fixed in code, but not actually pinned by test coverage yet.
- **Suggested fix:** Either extract the spinner-teardown decision into a tiny helper and test that helper directly, or add a minimal App-level test that drives overlapping `loadAllData` calls and asserts the foreground load cannot leave `isLoading` stuck.

### nit — The PowerShell “multi-line prompt delivery” test never reaches the `Start-Process`/stdin path
- **Location:** `src/test/dispatch-ps1.test.ts:188`
- **Issue:** `BACKLOG_DISPATCH_DRY_RUN=1` exits at `dispatch.ps1` before `claude` resolution and before `Start-Process -RedirectStandardInput ...` runs. The test therefore proves only that the sidecar file was written correctly; it does not prove that the spawned child would receive that multi-line content via stdin. A revert back to a broken spawn path could still pass this suite as long as the sidecar write remained intact.
- **Suggested fix:** Replace the dry-run in this one test with a stub executable (`claude.cmd` or another temporary wrapper placed first on `PATH`) that captures stdin to a file, then assert on what the child actually received.

## Verification I performed
- Read `review-5.md` and the full contents of:
  - `src/web/App.tsx`
  - `src/web/lib/race-guard.ts`
  - `backlog/prompts/dispatch.ps1`
  - `backlog/prompts/dispatch.sh`
  - `src/test/race-guard.test.ts`
  - `src/test/dispatch-ps1.test.ts`
  - `src/test/status-callback.test.ts`
  - `src/web/main.tsx`
- Searched callers / related context:
  - `rg -n "loadAllData\\(" src/web/App.tsx src/web --glob "!src/web/App.tsx"`
  - `rg -n "StrictMode|createRoot|<App" src/web src --glob "*.tsx" --glob "*.ts"`
- Ran:
  - `C:\Users\logan\.bun\bin\bunx.exe tsc --noEmit` → exit `0`
  - `C:\Users\logan\.bun\bin\bun.exe test src/test/status-callback.test.ts src/test/race-guard.test.ts src/test/dispatch-ps1.test.ts` → exit `0` (`35` pass, `6` skipped, `0` fail)
- I did not temporarily revert source files. Instead, I checked whether the new assertions actually touch the production code paths they claim to pin; the two nits above come from that structural review.

## Notes
- Round-5 finding #1 is fixed in code for the originally reported case. A foreground `loadAllData()` superseded by a background refresh now clears the spinner because `enabledLoading` is tracked independently of staleness.
- Round-5 finding #2 is fixed in code. The offline→online effect now routes through `loadAllData({ showLoading: false })`, so every state write on that path goes through the same generation gate and refreshes config/status/project-name too.
- Round-5 finding #3 is fixed for the original problem statement. The Windows dispatcher now uses millisecond timestamp + PID, writes the sidecar before spawn, and strips the originally reported Windows-illegal filename characters from dynamic segments.
- `useRef(createGenerationGate())` is semantically fine here. The factory is cheap, the first retained ref owns the live gate, and there is no stale closure capture because callers always dereference `loadGenerationRef.current` at use time.
- I agree with the decision not to extract the WebSocket reconnect effect just to unit-test it. After the reload paths were unified behind `loadAllData`, the reconnect logic is small enough that I would not hold the change for more test scaffolding.
- One edge case remains untested: because `src/web/main.tsx` mounts the app under `React.StrictMode`, overlapping foreground loads can exist in development even though production callers currently only issue one foreground load. I do not consider that a blocker for this change, but it is the next place I would look if dev-mode loading flicker appears.

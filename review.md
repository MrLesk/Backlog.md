# Code Review — 2026-05-20

## Verdict
CHANGES REQUESTED

## Task #1 findings (implemented code)

- **Severity**: nit
- **Location**: `src/test/status-callback.test.ts:11`
- **Issue**: The POSIX-shell gate does not match the implementation it is supposed to protect. `resolveShellInvocation()` checks both `sh` and `sh.exe` on Windows, but the test gate only checks `which("sh")`. The resolver matrix is also still missing explicit coverage for case-insensitive `"AUTO"` and the unknown-name fallthrough row. The production code looks correct; the gap is in verification.
- **Suggested fix**: Gate with the same signal as the implementation, e.g. `process.platform !== "win32" ? which("sh") !== null : which("sh") !== null || which("sh.exe") !== null`, and add resolver tests for `"AUTO"` and an unknown shell name such as `"fish"`/`"C:/custom/shell.exe"`.

## Task #2-#5 design findings

### Task #2

- **Severity**: important
- **Location**: `src/server/index.ts:873`
- **Issue**: The planned per-task browser UI is not wired to any server write path yet. `handleUpdateTask()` whitelists task fields and currently drops `onStatusChange`; `handleCreateTask()` does the same on create. Parser/serializer support alone is not enough for the modal to round-trip. If implemented as described, the field will appear editable in the UI but will never persist.
- **Suggested fix**: Extend the browser task contract end-to-end: accept `onStatusChange` in `handleCreateTask()` and `handleUpdateTask()`, thread it into `TaskCreateInput`/`TaskUpdateInput` as needed, and ensure `api.ts` types include it.

- **Severity**: important
- **Location**: `src/server/index.ts:1676`
- **Issue**: The proposed Windows warning UX depends on the server runtime, not the browser runtime, but the current browser API does not expose server platform or shell availability. The client cannot correctly answer “Windows without `sh`?” from `/api/config` or `/api/status` today.
- **Suggested fix**: Add a small server-reported capability surface, e.g. `statusCallbackCapabilities` on `/api/status` or `/api/config`, containing `platform`, resolved default shell, and whether fallback-to-`cmd` would warn.

### Task #3

- **Severity**: important
- **Location**: `src/core/content-store.ts:220`
- **Issue**: The design assumes a new watcher plus timestamp cooldown de-dup, but the browser already starts a task watcher through `ContentStore`, and there is also a standalone `watchTasks()` utility. Adding a second parallel watcher inside `backlog browser` is likely to create duplicate events and racey suppression logic. A time-window cooldown is especially brittle: it can drop legitimate rapid status flips and still fail on atomic-save rename patterns.
- **Suggested fix**: Reuse the existing task-watch path and compare previous vs current parsed task snapshots by task ID. Suppress only writes known to originate from the same in-process `updateTask()` path, not all writes in a time window. Handle `rename`/delete by refreshing from disk, as the existing watcher already does.

### Task #4

- **Severity**: important
- **Location**: `src/file-system/operations.ts:1375`
- **Issue**: The `board:` design is not integrated with the actual config layer. `BacklogConfig` is flat, `parseConfig()` only understands top-level scalar/list keys, and `serializeConfig()` only writes flat keys. A nested `board.columns` block would currently be ignored on load and dropped on save.
- **Suggested fix**: Start by defining the `board` shape in `BacklogConfig`, then teach the config parser/serializer to round-trip it before touching `Settings.tsx`/`Board.tsx`. Otherwise the browser UI will write state that the backend cannot persist.

### Task #5

- **Severity**: nit
- **Location**: `src/web/components/TaskCard.tsx:1`
- **Issue**: The card-fields design says “checkbox list for available fields,” but the current card is a fixed composition with implicit ordering and density assumptions: ID and priority in the header, labels in the middle, created date plus first assignee in the footer. A pure enabled/disabled list is underspecified for how the card should stay readable when many fields are on or when key defaults are off.
- **Suggested fix**: Define a fixed render order (or named slots) up front and treat the config as visibility-only. That keeps the default layout stable and avoids a second design problem around arbitrary field ordering.

## Verification I performed

- `bunx biome check src/utils/status-callback.ts src/core/backlog.ts src/file-system/operations.ts src/types/index.ts src/test/status-callback.test.ts`  
  PowerShell blocked the `bunx.ps1` shim via execution policy, so I reran the equivalent launcher: `bunx.cmd biome check ...` → exit `0`.
- `bunx tsc --noEmit`  
  Reran as `bunx.cmd tsc --noEmit` → exit `0`.
- `bun test src/test/status-callback.test.ts`  
  Reran as `bun.cmd test src/test/status-callback.test.ts` → exit `0`; result was `12 pass / 6 skip / 0 fail`, which matches the expected Windows-without-`sh` case.

## Notes / open questions for the human

- Direct file-edit hooks can only exist while some long-running process is watching the tree. Decide whether Task #3 requires `backlog browser` to be running, or whether `backlog watch` is a first-class supported daemon.
- The worktree contains unrelated local changes outside the Task #1 file list (`src/web/styles/style.css`, `bun.lock`, draft/context files). I treated those as out of scope and reviewed only the files named in `context.md`.

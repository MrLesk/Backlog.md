# Backlog.md Fork — Change Context

This is a fork of [MrLesk/Backlog.md](https://github.com/MrLesk/Backlog.md). The goal of the fork is to automate a status-driven multi-agent workflow (coder ↔ reviewer ↔ human) and to make `backlog browser` more configurable.

This document captures the full scope of planned changes so a reviewer can audit completed work and validate upcoming designs before they land.

## High-level goal

Run a continuous loop where:

1. The "coder" agent picks a task whose status moves to `In Progress`, implements it, and moves the status to `In Review`.
2. The "reviewer" agent picks up `In Review` tasks, reviews, and either passes them on to `Human Review` or moves them back to `In Progress` with notes.
3. Each status change automatically launches the right agent with the right prompt — no manual re-invocation.

Backlog.md already has the engine for this: status-change callbacks (`onStatusChange`) introduced in upstream task BACK-321. The work in this fork closes the remaining gaps and adds requested UI/browser flexibility.

## Pre-existing landscape (before this fork's changes)

The upstream codebase already provides:

- `BacklogConfig.onStatusChange` (`src/types/index.ts`) — global shell command run on status change.
- `Task.onStatusChange` — per-task frontmatter override.
- `Core.updateTask()` (`src/core/backlog.ts`) — single chokepoint that fires `executeStatusChangeCallback` whenever `oldStatus !== newStatus`. This is reached from:
  - CLI: `backlog task edit` → `editTaskOrDraft` → `updateTaskFromInput` → `updateTask`.
  - MCP: `src/mcp/tools/tasks/handlers.ts` → `core.editTaskOrDraft`.
  - Browser drag-and-drop: `src/server/index.ts` → `core.updateTaskFromInput` / `core.reorderTask` → `updateTasksBulk` → `updateTask`.
- `src/utils/status-callback.ts` — runs the command via `Bun.spawn`, passing `TASK_ID`, `OLD_STATUS`, `NEW_STATUS`, `TASK_TITLE` as environment variables.
- Tests in `src/test/status-callback.test.ts` covering global, per-task, no-callback, and reorder paths.

**Identified gaps for this fork:**

1. The callback was hardcoded to `["sh", "-c", command]`, so it silently no-ops on Windows machines without `sh.exe`.
2. Hand-edits to task `.md` files do not fire the callback (no file watcher).
3. The browser UI exposes neither global nor per-task `onStatusChange`.
4. `backlog browser` board has no user-facing configurability for columns/statuses or task card fields.

## Plan (5 tasks, dependency-ordered)

| # | Task | Status | Blocked by |
|---|------|--------|------------|
| 1 | Windows shell support for status callback | **Completed** | — |
| 2 | Browser UI for `onStatusChange` (global + per-task) | Pending | #1 |
| 3 | File watcher that fires status-change hooks on hand edits | Pending | #2 |
| 4 | Configurable kanban columns/statuses in browser | Pending | — |
| 5 | Configurable task card fields in browser | Pending | — |

Tasks #4 and #5 (browser flexibility) are independent of the hook track and can be reviewed/merged separately.

---

## Task #1 — Windows shell support (COMPLETED)

### Design decisions (locked in with the user)

- **Shell resolution: auto-detect with explicit override.** A new optional `shell` field in `backlog.config.yml`. Accepted values: `auto` (default), `sh`, `bash`, `cmd`, `pwsh`, `powershell`, or an absolute path to any interpreter (treated as POSIX-style `-c`).
- **Auto-detect on Windows**: try `Bun.which("sh")` / `Bun.which("sh.exe")` first (Git for Windows ships one); fall back to `cmd.exe /c` and emit a single `console.warn` per process.
- **Variable injection: unchanged** — environment variables only. Users on `cmd` must use `%TASK_ID%`, on PowerShell `$env:TASK_ID`. Documented limitation; no template substitution layer added.
- **No per-task `shell` override.** Config-level only, to keep the surface small.

### Files changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `shell?: string` to `BacklogConfig`, with JSDoc enumerating accepted values. |
| `src/utils/status-callback.ts` | Added `resolveShellInvocation(configShell?, env?)` with injectable `{ platform, which }` for testing. Added `ShellResolution` and `ShellResolverEnv` types. Threaded `shell` through `StatusCallbackOptions` → `executeStatusCallback`. One-time `console.warn` via module-level `warnedOnce` when falling back to `cmd.exe`. |
| `src/core/backlog.ts` | `executeStatusChangeCallback` (around line 1796) now passes `config.shell` to `executeStatusCallback`. |
| `src/file-system/operations.ts` | Config parser case for `shell:` (around the existing `onStatusChange` case); serializer emits `shell: "<value>"` when set; load result includes the field. |
| `src/test/status-callback.test.ts` | Added 7 unit tests for `resolveShellInvocation`. Introduced `testSh` (`Bun.which("sh") ? test : test.skip`) and gated 6 pre-existing tests that depend on POSIX shell syntax (`$VAR`, `>`, `>>`, `>&2`). |
| `ADVANCED-CONFIG.md` | New `shell` row in the config table and a Detailed Notes paragraph covering accepted values and the `%TASK_ID%` / `$env:TASK_ID` / `$TASK_ID` env-var-syntax-by-shell caveat. |

### Behavior matrix

| Platform | `shell` config | `Bun.which("sh")` | Resolved invocation | Warning |
|----------|----------------|-------------------|---------------------|---------|
| POSIX | unset / `auto` | (any) | `["sh", "-c", cmd]` | no |
| Windows | unset / `auto` | found | `[<absolute sh.exe>, "-c", cmd]` | no |
| Windows | unset / `auto` | not found | `["cmd", "/c", cmd]` | yes (once) |
| any | `sh` / `bash` / `cmd` / `pwsh` / `powershell` | n/a | canonical args for the named shell | no |
| any | unknown name or absolute path | n/a | `[value, "-c", cmd]` (POSIX-style) | no |
| any | `auto` (case-insensitive) | (per above) | same as unset | (per above) |

Named-shell args:

- `sh` → `["sh", "-c"]`
- `bash` → `["bash", "-c"]`
- `cmd` → `["cmd", "/c"]`
- `pwsh` → `["pwsh", "-NoProfile", "-Command"]`
- `powershell` → `["powershell", "-NoProfile", "-Command"]`

### Verification performed (on Windows 11, no `sh.exe` on PATH)

```
bunx biome check <touched files>             EXIT 0
bunx tsc --noEmit                            EXIT 0
bun test src/test/status-callback.test.ts    EXIT 0 — 14 pass, 6 skip, 0 fail
```

The 6 skipped tests are existing POSIX-syntax cases (`echo "$VAR" > path`, `>&2`, etc.); they will run automatically on Linux CI and on Windows boxes that have Git for Windows installed.

### Review feedback addressed (review.md, 2026-05-20)

- **Test gate signal mismatch (nit)**: `testSh` now mirrors the resolver's lookup exactly — on Windows it accepts either `sh` or `sh.exe`, on POSIX `sh` alone. Previously the gate could over-skip on Windows hosts that only had `sh.exe` (no extensionless `sh` on PATH).
- **Missing resolver coverage (nit)**: added `"'AUTO' (uppercase) is treated the same as undefined"` (exercises case-insensitivity of the auto-detect branch on both win32 and posix) and `"unknown shell name falls through to POSIX-style `-c` invocation"` (covers the bare-name fallthrough using `fish`/`zsh`, complementing the existing absolute-path case).

### Known limitations / out of scope

- Pre-existing repo-wide formatting drift: `bun run check .` (`biome check .`) reports ~287 errors across the full tree, almost certainly CRLF line-ending issues on Windows. Not addressed in this task. Only the 5 touched files were formatted.
- Pre-existing Windows incompatibility in unrelated tests (e.g., `git init -b main` requires Git ≥ 2.28) — out of scope; not introduced by this change.
- No per-task `shell` override (intentional, see Design decisions).

### Reviewer focus areas for Task #1

- `resolveShellInvocation` — particularly the absolute-path fallthrough (treats it as POSIX `-c`; reviewer should confirm this is acceptable vs erroring or accepting a tuple).
- `warnedOnce` is module-level state — reset is per-process; consider whether tests should clear it between runs (currently not needed because the warning is informational and tests don't assert on `console.warn`).
- Config parser case branch — confirm the `value.replace(/^['"]|['"]$/g, "")` quote-stripping matches the conventions used by adjacent fields.
- Test gating — confirm `Bun.which("sh") !== null` is the right cross-platform signal; an alternative is `process.platform !== "win32" || Bun.which("sh") !== null`.

---

## Task #2 — Browser UI for `onStatusChange` (PENDING, blocked by #1)

### Intent

Expose status-change hook configuration from `backlog browser`, both globally and per-task.

### Planned changes (revised after review)

**Step 1 — Server contract (must land first):**

- `handleCreateTask()` and `handleUpdateTask()` in `src/server/index.ts` currently whitelist task fields and drop `onStatusChange`. Add it to the whitelist on both endpoints and thread it through `TaskCreateInput` / `TaskUpdateInput` (`src/types/index.ts`) as needed. Parser/serializer already round-trip the frontmatter, but the server write path does not — without this fix the per-task UI would *appear* editable while silently discarding the value.
- Confirm or extend the global config PATCH endpoint to include both `onStatusChange` and `shell`.
- `src/web/lib/api.ts` (or wherever the client-side types live) gets the matching field additions.

**Step 2 — Server-reported capability surface:**

- Today the browser cannot tell whether the server-side host is Windows-without-`sh`, which is the warning condition the UX needs. Add a small read-only field to `/api/status` (or `/api/config`) named `statusCallbackCapabilities`, shape roughly:
  ```ts
  { platform: NodeJS.Platform; resolvedShell: string[]; willFallbackToCmd: boolean }
  ```
- Sourced server-side from the same `resolveShellInvocation()` the callback uses, so the browser stays consistent with actual runtime behavior.

**Step 3 — UI:**

- Global: multiline `onStatusChange` editor in `src/web/components/Settings.tsx`, plus a `shell` select bound to the same set the resolver accepts (`auto`/`sh`/`bash`/`cmd`/`pwsh`/`powershell`/custom path). Inline env-var help (`$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, `$TASK_TITLE`) with the `%TASK_ID%` / `$env:TASK_ID` caveat surfaced based on the capability response.
- Per-task: an `onStatusChange` field in `src/web/components/TaskDetailsModal.tsx`, **inside a collapsed "Advanced" section** so normal users never see it. Round-trips to frontmatter via the server contract from Step 1.

### Reviewer focus areas (when implemented)

- Step 1 is a hard prerequisite — verify writes actually persist to disk by round-tripping through the API, not just by reading parser/serializer code.
- Capability surface lives on the server response only; the browser must not derive Windows-ness from `navigator.userAgent` (it's the *server* host that matters).
- Single source of truth: hook strings live only in `backlog.config.yml` / task frontmatter — no caching in browser state.

---

## Task #3 — File watcher for hand edits (PENDING, blocked by #2)

### Intent

Today, hand-editing a task `.md` file (status change in frontmatter) does not fire the hook. Close that gap so all four paths — CLI, MCP, browser, direct file edit — behave identically.

### Planned changes (revised after review)

The codebase already has the watcher infrastructure we need; do not introduce a second one in parallel. Reuse the existing `ContentStore` watcher path (see `src/core/content-store.ts`) and the `watchTasks()` utility.

**Step 1 — Extract a shared "hook firer" module:**

- New file (proposed): `src/core/task-hook-dispatcher.ts`. Owns the previous-status snapshot map (keyed by task ID) and the call into `executeStatusChangeCallback`.
- When the existing `ContentStore` watcher detects a `.md` change, it compares the freshly parsed task's `status` against the snapshot for that ID and dispatches the hook only on transition.

**Step 2 — Anti-loop suppression via a shared `TaskWriteCoordinator`:**

The previous revision claimed the `saveTask` wrapper in `ContentStore` (`src/core/content-store.ts:~606`) was the single point every in-process task write passes through. Round 3 found that's not quite true: `editTaskInTui()` at `src/core/backlog.ts:~2524` writes the task file directly with `Bun.write(...)` and then calls `contentStore.upsertTask(...)`, bypassing `filesystem.saveTask()` entirely. Any future helper that takes a similar shortcut would also slip past.

So the suppression contract has to be explicit at the dispatcher boundary, not implicit at one specific wrapper:

- Introduce a small `TaskWriteCoordinator` in the shared dispatcher (`src/core/task-hook-dispatcher.ts`) with a handle-based API:
  ```ts
  interface TaskWriteCoordinator {
    beginWrite(taskId: string): WriteHandle;
    endWrite(handle: WriteHandle): void;  // idempotent and non-throwing — safe inside finally
  }
  ```
- **Every** in-process code path that writes a task `.md` file is required to bracket its disk write with `beginWrite` / `endWrite`. The wrapped `filesystem.saveTask()` in `ContentStore` does this automatically; the `editTaskInTui()` direct-write path (and any future bypass) must call the coordinator explicitly. Treat this as a hard rule that lives next to the dispatcher's docstring.
- **Call-site contract — always `try`/`finally`**: every site must use the shape below so an error in the disk write (or any post-write code) cannot leak suppression state:
  ```ts
  const h = coordinator.beginWrite(taskId);
  try {
    // disk write goes here
  } finally {
    coordinator.endWrite(h);
  }
  ```
  `endWrite` is contracted to be idempotent and non-throwing so it is always safe to call during cleanup, even if the handle has already been consumed by the watcher or the begin/end pair is unbalanced due to an earlier bug. Re-entry from `finally` after a thrown disk write is the expected path, not an exceptional one.
- When the watcher emits a change event for a task ID, it asks the coordinator whether there's a live (or recently completed) handle for that ID. If yes, the event is in-process and the hook does not fire; if no, the event is a hand edit and the hook fires.
- Handles are preferred over a counter because they tie suppression to a specific async operation. The risk of count drift (an `incr` without a matching `decr` after an error) is eliminated by making the handle's lifecycle visible at the call sites.
- Time-window cooldowns are explicitly rejected — they drop legitimate rapid flips and miss atomic-save rename patterns.
- Renames and deletes refresh from disk the same way the existing watcher already does — no special-casing.

**Step 3 — Two entry points, one watcher:**

- `backlog browser` continues to start the watcher as part of server startup (no change to today's UX).
- New `backlog watch` CLI command (`src/commands/`) starts the same shared watcher headlessly for users who don't keep the browser open. Subcommand should log fired hooks to stdout for visibility and exit cleanly on SIGINT.
- **Concurrency invariant: exactly one watcher per project, regardless of entry point.** Both entry points acquire the same project-scoped lockfile on startup using the `proper-lockfile` dependency already in `package.json`. The lockfile lives **alongside the existing create lock namespace under the resolved backlog directory** — concretely `<backlogDir>/.locks/watcher` (matching the existing `<backlogDir>/.locks/create` pattern, not a literal `.backlog/watcher.lock`). This keeps projects using `backlog/`, `.backlog/`, or a custom `backlogDirectory` setting all consistent.
- Whichever process wins owns the watcher and fires hooks; the loser still starts (so `backlog browser`'s UI keeps working) but skips its watcher and logs a clear message identifying the holder. On clean shutdown the holder releases the lock; stale-lock detection handles crashed processes via `proper-lockfile`'s built-in heartbeat.

### Reviewer focus areas (when implemented)

- Every in-process write path that touches a task `.md` file uses `TaskWriteCoordinator.beginWrite/endWrite`. Specifically audit `editTaskInTui()` and any other helper that calls `Bun.write` / `fs.writeFile` on a task path directly. A missed call site silently breaks the no-double-fire guarantee.
- Lockfile path is resolved from the active backlog directory (`<backlogDir>/.locks/watcher`), not hard-coded to `.backlog/`.
- Lockfile lifecycle is correct on Ctrl-C, on `backlog browser` stop, and on crash (stale-lock recovery via heartbeat).
- Clean shutdown: no leaked FS handles, no orphaned write handles in the coordinator.

---

## Task #4 — Configurable kanban columns/statuses (PENDING)

### Intent

Allow the kanban board to show only chosen columns in a chosen order, with custom colors per status.

### Planned changes (revised after review)

The current config layer is **flat-only**. `parseConfig()` in `src/file-system/operations.ts` only reads top-level scalar/list keys, and `serializeConfig()` only writes flat keys. A nested `board:` block would be silently dropped on load and never re-emitted on save. This is a hard prerequisite blocker that must land before any UI work.

**Step 1 (prerequisite) — Teach the config layer about nested structure:**

- Add `board?: { columns?: Array<{ status: string; color?: string }> }` to `BacklogConfig` in `src/types/index.ts`.
- Extend `parseConfig()` and `serializeConfig()` in `src/file-system/operations.ts` to round-trip the `board:` block. The cleanest approach is probably to swap the hand-rolled YAML for the existing `gray-matter` / yaml dependency in a scoped way for this section, rather than expanding the case-statement parser.
- Round-trip tests in `src/test/` for: empty board, board with columns, board with subset of statuses, board with custom colors, file without `board:` (backward compat).

**Step 2 — Resolve + consume:**

- Add a single `resolveBoardConfig(config)` helper that returns the effective column list (config.board.columns ?? config.statuses with default colors). Keeps fallback logic out of the components.
- `src/web/components/Board.tsx` / `TaskColumn.tsx` consume the resolved list. When `board:` is absent the rendered output is byte-identical to today.

**Step 3 — UI:**

- Settings panel in `src/web/components/Settings.tsx`: reorder via drag, hide/show via per-row toggle, color via color input. Writes go through the global config PATCH endpoint already extended in Task #2 Step 1.

### Reviewer focus areas (when implemented)

- Step 1 first. The config layer already canonicalizes key order and does not preserve comments on save, so do not require *textual* preservation. Verify the round-trip *semantically*: load a file containing `board:` plus unrelated fields, modify and save, reload, and assert every field's *value* survives intact and `board:` is neither dropped nor structurally mangled.
- Hidden statuses still need to be reachable for tasks already in them (currently the list view; confirm it shows all statuses regardless of `board.columns`).
- Existing users with no `board:` block see no visual change.

---

## Task #5 — Configurable task card fields (PENDING)

### Intent

Let users pick which fields appear on each task card: assignee, labels, milestone, priority, id, dates, etc.

### Planned changes (revised after review)

The current `TaskCard.tsx` has a fixed composition with implicit slots — ID and priority in the header, labels in the middle, created date plus first assignee in the footer. An open-ended "enable/disable any field in any order" design would force a layout rewrite. Instead, treat this as a **visibility-only** feature over a stable predetermined slot order.

A clean split between *configurable data fields* and *always-on card chrome* matters: not everything on the card is governed by this config.

**Always-on card chrome (NOT configurable, hard-coded in `TaskCard.tsx`):**

- Task title
- Cross-branch banner / tooltip
- Priority border / chip (visual cue, separate from the `priority` data field)
- Drag-state visuals

**Configurable data fields (governed by `board.card.hide`):**

The set is closed and explicit — adding a new field later is an intentional code change, not user config. Initial enum:

```ts
type ConfigurableCardField = "id" | "priority" | "labels" | "milestone" | "createdDate" | "assignee";
```

**Note on `milestone`**: today's `TaskCard.tsx` does not render milestone at all. This task therefore includes a small UI addition — a milestone slot — alongside the configurability plumbing (see Step 1). This is an intentional scope expansion confirmed during round-3 review; the alternative was to drop `milestone` from the enum entirely or to defer it to a follow-up task.

**Step 1 — Pin the slot map (and add a milestone slot):**

- Codify the slot map in `TaskCard.tsx` as a constant: each slot (header-left, header-right, body, footer-left, footer-right) maps to at most one configurable field. The chrome elements above are rendered unconditionally, outside this map.
- Add a slot for `milestone` in a **non-displacing location**, since `footer-right` is already occupied by the assignee data field (`src/web/components/TaskCard.tsx:163-169`) and reusing it would reshape an existing field rather than adding only one new render. Preferred placement: **body, immediately above labels**. Renders only when the task has a milestone value and the field is not hidden.
- Picking a non-displacing slot is what preserves the invariant that fields already on the card remain byte-identical to today.

**Step 2 — Config shape:**

- Extend the `board:` config from Task #4 with `card?: { hide?: ConfigurableCardField[] }`. Empty/absent → the *new default* card (which includes milestone for tasks that have one).
- No `order` or `show` array — the render order is fixed; users only toggle visibility.

**Step 3 — UI:**

- Settings panel: checkbox list of `ConfigurableCardField` values, all checked by default. Unchecking adds to `card.hide`.

### Reviewer focus areas (when implemented)

- Confirm the `ConfigurableCardField` enum is the only knob; chrome elements (title, branch banner, priority border, drag visuals) must not be reachable from `card.hide`.
- The card stays visually stable when fields are hidden (slot gaps collapse cleanly, alignment doesn't shift).
- Default behavior for fields that already exist (id, priority, labels, createdDate, assignee) renders byte-identically to today. The milestone slot is the **one intentional visual change**: when a task has a milestone and `card.hide` does not include `"milestone"`, it now appears on the card. Tasks without a milestone are unchanged.
- The milestone slot's placement does not break alignment for tasks that have no milestone (empty slot collapses cleanly).

---

## Environment notes for the reviewer

- **Runtime**: Bun 1.3.14, TypeScript 5 (via `bunx tsc`). No `typescript` devDep in `package.json` — `bunx tsc` resolves on the fly.
- **Lint/format**: Biome 2.4.12 (`bun run check .` runs `biome check .`).
- **Tests**: `bun test` (Bun's built-in runner). `bun:test` import.
- **Platform-sensitive tests**: anything that runs a real shell command in `status-callback.test.ts` is gated on `Bun.which("sh") !== null` so the suite is green on POSIX CI and on Windows hosts with or without Git Bash.
- **Cross-platform known issue**: `git init -b main` (used in some unrelated tests) requires Git ≥ 2.28; older Git for Windows installs fail those tests. Not addressed here.

## How to run the verification used for Task #1

```powershell
# from D:\1064n\Programacion\claude\Backlog.md (or repo root)
bunx biome check src/utils/status-callback.ts src/core/backlog.ts `
    src/file-system/operations.ts src/types/index.ts src/test/status-callback.test.ts
bunx tsc --noEmit
bun test src/test/status-callback.test.ts
```

Expected: all three exit 0; the test run reports `14 pass, 6 skip, 0 fail` on Windows-without-sh, or `20 pass, 0 skip, 0 fail` on POSIX / Windows-with-Git-Bash.

## Review history

- `review.md` (2026-05-20) — initial review by a separate reviewer agent. Verdict: CHANGES REQUESTED. Task #1 nits were addressed in-place (see Task #1 → Review feedback addressed). The four "important" findings on Tasks #2–#4 reshaped the design sections above; reread them rather than the original review.md before starting implementation. The Task #5 "nit" reshaped that design from arbitrary field ordering to visibility-only with fixed slots.
- `review-2.md` (2026-05-20) — second review round. Verdict: CHANGES REQUESTED (all design-level, no new code issues on Task #1). All seven prior findings were marked ADDRESSED. Three new findings were folded back into the design sections above:
  - **Task #3 (important)**: suppression ownership moved from `Core.updateTask()` down to the shared `saveTask` wrapper inside `ContentStore`, which is the single point every in-process write passes through. Concurrency between `backlog browser` and `backlog watch` is now resolved via a project-scoped lockfile (`proper-lockfile`, already a devDep).
  - **Task #4 (nit)**: reviewer guidance switched from textual round-trip (the config layer canonicalizes order and drops comments today) to semantic round-trip — assert field *values* survive, not key order or comments.
  - **Task #5 (nit)**: added an explicit `ConfigurableCardField` enum and called out always-on card chrome (title, cross-branch banner, priority border, drag visuals) as outside `board.card.hide`'s control.
- `review-3.md` (2026-05-20) — third review round. Verdict: CHANGES REQUESTED (still design-level, no code changes). Task #4 was confirmed ADDRESSED; Tasks #3 and #5 were PARTIALLY ADDRESSED and have been revised again:
  - **Task #3 (important)**: the round-2 claim that the `saveTask` wrapper was the single in-process write site was wrong — `editTaskInTui()` at `src/core/backlog.ts:~2524` writes via `Bun.write` and bypasses it. Replaced the wrapper-counter model with a handle-based `TaskWriteCoordinator` API (`beginWrite` / `endWrite`) that every in-process write site must call explicitly; the wrapper does it implicitly, direct-write paths must do it manually. Concurrency invariant clarified to "exactly one watcher per project."
  - **Task #3 (nit)**: lockfile path changed from a literal `.backlog/watcher.lock` to a backlog-dir-relative `<backlogDir>/.locks/watcher`, alongside the existing `<backlogDir>/.locks/create` namespace. Works for projects using `backlog/`, `.backlog/`, or custom `backlogDirectory`.
  - **Task #5 (important)**: `milestone` is in the enum but `TaskCard.tsx` doesn't render it today, so it cannot be a pure visibility toggle. User confirmed the scope expansion: this task now also adds a milestone slot to the card. The "byte-identical default" claim was relaxed accordingly — fields that already exist remain byte-identical; the milestone slot is the one intentional new render.
- `review-4.md` (2026-05-20) — fourth review round. **Verdict: APPROVE WITH NITS.** All three round-3 findings confirmed ADDRESSED. Two cleanup nits folded into the designs:
  - **Task #3 Step 2 (nit)**: made the `TaskWriteCoordinator` call-site contract explicit — every site uses `try`/`finally`, and `endWrite` is contracted to be idempotent and non-throwing so cleanup after a failed disk write cannot leak suppression state.
  - **Task #5 Step 1 (nit)**: dropped the displacing `footer-right` placement option for the milestone slot (assignee already lives there); pinned the preferred placement as body-above-labels to preserve the "existing fields byte-identical" invariant.

  **Design is approved.** Implementation track is unblocked starting at Task #2.

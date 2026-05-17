---
id: doc-005
title: Feature Parity Matrix — CLI / TUI / WebUI / MCP
type: other
created_date: '2026-05-17 00:00'
tags:
  - research
  - engineering-consistency
  - parity
  - cli
  - tui
  - webui
  - mcp
---
# Feature Parity Matrix — CLI / TUI / WebUI / MCP

> Research pass 2026-05-17. No code changes. Sources: Serena LSP read of `src/cli.ts`, `src/ui/`, `src/server/index.ts`, `src/mcp/tools/*/handlers.ts`.
>
> Legend: ✅ full support · ⚠️ partial / limited · ❌ missing

---

## Matrix

### Tasks

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| Create | ✅ | ❌ | ✅ | ✅ | TUI shows help to use CLI (`src/ui/task-viewer-with-search.ts`) |
| List / filter | ✅ | ✅ | ✅ | ✅ | |
| View details | ✅ | ✅ | ✅ | ✅ | |
| Edit (all fields) | ✅ | ⚠️ | ✅ | ✅ | TUI opens `$EDITOR`; no field-level form |
| Complete (mark Done) | ⚠️ | ✅ | ✅ | ✅ | CLI has no `task complete` sub-command; use `task edit --status Done` |
| Archive | ✅ | ✅ | ✅ | ✅ | |
| Demote to draft | ✅ | ❌ | ❌ | ✅ | |
| Reorder (ordinal) | ❌ | ❌ | ✅ | ⚠️ | MCP supports ordinal in `editTask`; no dedicated reorder tool |
| Bulk update | ✅ | ❌ | ❌ | ❌ | CLI `task edit` with multiple IDs |
| Cleanup (by age) | ✅ | ❌ | ✅ | ❌ | CLI `task cleanup`; WebUI has preview + execute endpoints |
| Full-text search | ✅ | ✅ | ✅ | ✅ | |
| Filter: status | ✅ | ✅ | ✅ | ✅ | |
| Filter: assignee | ✅ | ✅ | ✅ | ✅ | |
| Filter: label | ✅ | ✅ | ✅ | ✅ | |
| Filter: milestone | ✅ | ✅ | ✅ | ✅ | |
| Filter: priority | ✅ | ✅ | ✅ | ✅ | |
| Filter: modifiedFile | ✅ | ❌ | ✅ | ✅ | |
| Filter: cross-branch | ✅ | ❌ | ✅ | ❌ | |
| Acceptance criteria (check/uncheck) | ✅ | ❌ | ✅ | ✅ | |
| Definition of Done (check/uncheck) | ✅ | ❌ | ✅ | ✅ | |

### Drafts

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| Create draft | ✅ | ❌ | ⚠️ | ❌ | WebUI: only via `task create` with `status=Draft` |
| List drafts | ✅ | ⚠️ | ✅ | ⚠️ | TUI shows drafts in unified view; MCP `listTasks` includes drafts with flag |
| View draft | ✅ | ✅ | ✅ | ✅ | |
| Edit draft | ✅ | ⚠️ | ✅ | ✅ | TUI via `$EDITOR` |
| Archive draft | ✅ | ✅ | ❌ | ✅ | |
| Promote draft → task | ✅ | ❌ | ✅ | ✅ | |

### Milestones

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| List (active) | ✅ | ❌ | ✅ | ✅ | |
| List (archived) | ✅ | ❌ | ✅ | ✅ | |
| Create | ❌ | ❌ | ✅ | ✅ | CLI only has list + archive |
| Rename | ❌ | ❌ | ✅ | ✅ | |
| Archive | ✅ | ❌ | ✅ | ✅ | |
| Remove | ❌ | ❌ | ✅ | ✅ | |
| View (with task counts) | ⚠️ | ❌ | ✅ | ✅ | CLI shows milestones in task list context only |

### Documents

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| Create | ✅ | ❌ | ✅ | ✅ | CLI opens `$EDITOR` for content |
| List | ✅ | ❌ | ✅ | ✅ | |
| View | ✅ | ❌ | ✅ | ✅ | |
| Update | ✅ | ❌ | ✅ | ✅ | |
| Search | ✅ | ❌ | ✅ | ✅ | |
| Delete / archive | ❌ | ❌ | ❌ | ❌ | **No delete in any modality** |

### Decisions

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| Create | ✅ | ❌ | ✅ | ❌ | CLI: title + --status only |
| List | ❌ | ❌ | ✅ | ❌ | **CLI has no `decision list`** |
| View | ❌ | ❌ | ✅ | ❌ | |
| Edit | ❌ | ❌ | ✅ | ❌ | |
| Delete | ❌ | ❌ | ❌ | ❌ | |

### Board / Kanban

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| View (status columns) | ✅ | ✅ | ✅ | ❌ | |
| Filter (priority / label / milestone) | ⚠️ | ✅ | ✅ | ❌ | CLI board is read-only export |
| Group by milestone | ❌ | ❌ | ✅ | ❌ | |
| Reorder (drag & drop) | ❌ | ❌ | ✅ | ❌ | |
| Export to file | ✅ | ❌ | ❌ | ❌ | CLI `board --output` |

### Sequences

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| List sequences | ✅ | ✅ | ✅ | ❌ | |
| View sequence details | ✅ | ✅ | ✅ | ❌ | |
| Move task in sequence | ❌ | ❌ | ✅ | ❌ | WebUI only (`/api/sequences/move`) |
| Set sequence manually | ⚠️ | ❌ | ❌ | ❌ | CLI `sequence set` |

### Configuration

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| View all config | ✅ | ❌ | ✅ | ❌ | |
| Get specific key | ✅ | ❌ | ✅ | ❌ | |
| Set config key | ✅ | ❌ | ✅ | ❌ | |
| Advanced config wizard | ✅ | ❌ | ❌ | ❌ | CLI `configure` command |

### Statistics & Other

| Operation | CLI | TUI | WebUI | MCP | Notes |
|---|---|---|---|---|---|
| Task statistics | ❌ | ❌ | ✅ | ❌ | WebUI only (`/api/statistics`) |
| Project overview | ✅ | ⚠️ | ❌ | ⚠️ | TUI via splash; MCP via workflow instructions |
| Init project | ✅ | ❌ | ✅ | ❌ | |
| Definition of Done defaults (get/set) | ✅ | ❌ | ❌ | ✅ | MCP has dedicated DoD tools |

---

## Top Gaps Summary

| # | Gap | Modalities affected | Impact |
|---|---|---|---|
| **1** | TUI cannot create anything (tasks, drafts, docs, milestones, decisions) | TUI | High — users must context-switch to CLI for all creation |
| **2** | Decisions are WebUI-only for list/view/edit; MCP has no decision support at all | MCP, TUI, CLI (partial) | High — MCP agents cannot manage decisions |
| **3** | CLI lacks `task complete` command | CLI | Medium — workaround is `task edit --status Done` |
| **4** | Document delete/archive is missing everywhere | All | Medium — documents accumulate with no lifecycle exit |
| **5** | Statistics are WebUI-only | CLI, TUI, MCP | Medium — no scriptable statistics access |
| **6** | CLI lacks milestone create/rename/remove | CLI | Medium — milestone lifecycle requires WebUI or MCP |
| **7** | Sequences management (move) is WebUI-only | CLI, TUI, MCP | Low-medium |
| **8** | Cross-branch task filtering not in MCP | MCP | Low |

---

## Proposed Follow-up Stubs

**STUB-P1 — Add `decision list` / `decision view` / `decision edit` to CLI**
CLI currently only has `decision create`. Add `list`, `view`, and `edit` sub-commands to reach parity with WebUI.
*Scope: `src/cli.ts`, ~60 lines, 3 sub-commands.*

**STUB-P2 — Add decisions domain to MCP tools**
`src/mcp/tools/` has no decisions handler. Add `decision_create`, `decision_list`, `decision_view`, `decision_update` tools mirroring the document handler pattern.
*Scope: new `src/mcp/tools/decisions/` handler + schema, ~100 lines.*

**STUB-P3 — Add `task complete` as explicit CLI sub-command**
`task complete <id>` as sugar for `task edit <id> --status Done`, matching what TUI (Y-key) and WebUI (POST /complete) expose. Makes the operation discoverable.
*Scope: `src/cli.ts`, ~10 lines.*

**STUB-P4 — Add `statistics` command to CLI**
Expose the `Core.loadAllTasksForStatistics()` data via a `backlog stats` CLI command with `--plain` / `--json` output. Makes statistics scriptable.
*Scope: `src/cli.ts` + `src/core/backlog.ts`, ~40 lines.*

**STUB-P5 — Add document archive/delete to CLI + MCP**
Implement `doc archive <id>` or `doc delete <id>` in CLI and a `document_archive` MCP tool. Requires deciding on lifecycle semantics (soft-delete to archive/ vs hard delete).
*Scope: `src/cli.ts`, `src/file-system/operations.ts`, new MCP handler method, ~50 lines.*

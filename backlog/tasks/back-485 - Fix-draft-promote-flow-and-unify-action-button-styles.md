---
id: BACK-485
title: 'Fix draft promote flow and unify action button styles'
status: Done
assignee: 
  - '@kimi'
created_date: '2026-05-23 14:20'
updated_date: '2026-05-23 16:36'
labels:
  - web-ui
  - drafts
  - ux
  - filtering
dependencies: []
priority: medium
ordinal: 33200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the drafts page (`/drafts`) display and add filtering capabilities to help users manage draft tasks more efficiently.

Current pain points:
1. The drafts list is a simple flat list with limited information density — users cannot quickly scan priorities, statuses, or milestones.
2. There is no way to filter or search drafts — as the number of drafts grows, finding a specific draft becomes difficult.
3. The "Promote to Task" action was only available in the list view; the draft detail modal incorrectly showed a "Demote to Draft" button instead.
4. Draft cards lack visual distinction for high-priority items.
5. CLI `draft promote` and `task demote` commands do not report the converted target ID, leaving users unsure which new task/draft was created.

Fixes already applied:
- **Draft detail modal action button** (`src/web/components/TaskDetailsModal.tsx`): The modal now detects draft tasks (`id.startsWith("DRAFT-")`) and displays a "Promote to Task" button (green) for drafts, while regular tasks continue to show the "Demote to Draft" button (amber). A keyboard shortcut `p` was also added for promoting drafts from the modal.

Goals:
- Add filtering by status, assignee, labels, and priority.
- Add a search box for fuzzy title/description matching.
- Improve the draft card layout with better information hierarchy.
- Ensure consistent UX between drafts and tasks list views.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Draft detail modal detects draft tasks and shows "Promote to Task" (emerald); regular tasks show "Demote to Draft" (amber)
- [x] #2 Promoting a draft from the detail modal refreshes the task list, closes the draft modal, refreshes the drafts list, and opens the new task detail modal
- [x] #3 Promoting a draft from the drafts list shows a confirmation dialog, reloads the drafts list, and opens the new task detail modal
- [x] #4 "Promote to Task" buttons in both list and modal use consistent emerald color family with full dark-mode support
- [x] #5 Primary blue action buttons (New Task, New Draft, Add Milestone, Create/Save in modals) use consistent styling with dark-mode variants
- [x] #6 Milestone "Add" button no longer has a stray `+` prefix
- [x] #7 Backend `promoteDraft` returns the promoted `Task` object (same shape as `createTask`)
- [x] #8 All changes pass type-checking and linting
- [x] #9 CLI `draft promote <id>` outputs `Promoted draft <id> to task <num>` with the numeric task ID
- [x] #10 CLI `task demote <id>` outputs `Demoted task <id> to draft <num>` with the numeric draft ID
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Web UI — Draft action buttons & styles**
   - Fix draft detail modal to show "Promote to Task" (emerald) for drafts and "Demote to Draft" (amber) for tasks.
   - Unify primary blue action buttons and emerald promote buttons across list/modal with full dark-mode support.

2. **Backend — Return converted IDs**
   - Change `fs.demoteTask()` return type from `boolean` to `string | null` (new draft ID).
   - Change `core.demoteTask()` return type from `boolean` to `string | null`.
   - Update server demote endpoint to return `{ success: true, draftId }`.
   - Update MCP demote handler to return the demoted draft details.

3. **CLI — Report target IDs on promote/demote**
   - `draft promote`: log `Promoted draft <id> to task <num>` (strip prefix).
   - `task demote`: log `Demoted task <id> to draft <num>` (strip prefix).

4. **Tests & validation**
   - Update filesystem, core, CLI, and atomic-task-create tests for new return types.
   - Run scoped tests and build to verify.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Draft detail modal action button fix
- **`src/web/components/TaskDetailsModal.tsx`**
  - Added `isDraftTask = task?.id?.startsWith("DRAFT-")` detection.
  - Draft tasks now show **"Promote to Task"** (emerald, with `p` keyboard shortcut).
  - Regular tasks continue to show **"Demote to Draft"** (amber, `d` shortcut).
  - Added `handlePromote` using `apiClient.promoteDraft()`.

### Promote-to-task end-to-end flow
- **`src/web/lib/api.ts`**: `promoteDraft()` now returns `Promise<Task>`.
- **`src/server/index.ts`**: `/api/drafts/:id/promote` endpoint now returns the promoted `Task` directly (same shape as `createTask`).
- **`src/core/backlog.ts`** & **`src/file-system/operations.ts`**: `promoteDraft()` refactored to return `Task | false` instead of `boolean`.
- **`src/cli.ts`**: Updated to log the promoted task ID.
- **`src/web/components/TaskDetailsModal.tsx`**: Added `onPromoted` prop; on promote success closes draft modal, refreshes tasks via `onSaved`, fires `drafts-updated` event, and opens the new task detail modal.
- **`src/web/components/DraftsList.tsx`**: Added `window.confirm` before promote; on success reloads drafts list, fires `drafts-updated`, and opens the new task detail via `onEditTask`.

### UI polish — button color unification
- **Blue buttons** (`src/web/components/TaskList.tsx`, `DraftsList.tsx`, `MilestonesPage.tsx`) unified to the Board "New Task" style (`bg-blue-500 dark:bg-blue-600`, full focus-ring + dark-mode support).
- **"Promote to Task" buttons** (`TaskDetailsModal.tsx`, `DraftsList.tsx`) unified to emerald color family with full dark-mode support.
- **Milestones page**: removed stray `+` prefix from the "Add Milestone" button text.

### CLI promote/demote output fix
- **`src/file-system/operations.ts`** — `demoteTask()` now returns `string | null` (the new draft ID, e.g. `DRAFT-1`) instead of `boolean`.
- **`src/core/backlog.ts`** — `demoteTask()` now returns `string | null` (passes through the draft ID from `fs.demoteTask`).
- **`src/cli.ts`**
  - `draft promote`: outputs `Promoted draft <id> to task <num>` (prefix stripped).
  - `task demote`: outputs `Demoted task <id> to draft <num>` (prefix stripped).
- **`src/server/index.ts`** — `handleDemoteTask` returns `{ success: true, draftId: newDraftId }`.
- **`src/mcp/tools/tasks/handlers.ts`** — `demoteTask` now loads and returns the demoted draft after conversion.

### Tests updated
- `src/test/filesystem.test.ts`, `cli.test.ts`, `core.test.ts`, `atomic-task-create.test.ts` — adjusted assertions for the new `string | null` return type from `demoteTask`.
- All tests pass (179 pass / 0 fail).

### Type-check / lint / build
- `bunx tsc --noEmit` passes.
- `bun run check .` passes (no new lint errors introduced).
- `bun run build` succeeds; `dist/backlog.exe` updated.
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

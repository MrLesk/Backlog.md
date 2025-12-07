---
id: task-321
title: Status change callbacks in task frontmatter
status: Done
assignee:
  - '@codex'
created_date: '2025-11-18 19:31'
updated_date: '2025-11-28 20:53'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow tasks to define shell command callbacks that run automatically when task status changes. Commands execute from the project repository root when status updates are triggered through Backlog.md workflows.

**Configuration levels:**
1. **Global** (in backlog config): `onStatusChange` setting applies to all tasks
2. **Per-task** (in frontmatter): `onStatusChange` overrides global setting for that task

**Variable injection:**
Commands can use these variables:
- `$TASK_ID` - The task identifier (e.g., "task-321")
- `$OLD_STATUS` - Previous status (e.g., "To Do")
- `$NEW_STATUS` - New status (e.g., "In Progress")
- `$TASK_TITLE` - The task title

**Example global config:**
```yaml
onStatusChange: 'echo "Task $TASK_ID moved from $OLD_STATUS to $NEW_STATUS"'
```

**Example per-task frontmatter:**
```yaml
onStatusChange: 'claude "Task $TASK_ID has been moved to $NEW_STATUS from $OLD_STATUS. Please take over it"'
```

**Working directory:** Commands execute from the project repository root.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Global config supports `onStatusChange` bash command that runs on any task status change
- [x] #2 Task frontmatter supports `onStatusChange` to override global setting for that specific task
- [x] #3 Commands have access to `$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, and `$TASK_TITLE` variables
- [x] #4 Commands execute from the project repository root directory

- [x] #5 Callback failures are reported without blocking status change persistence
- [x] #6 Documentation explains global and per-task configuration with examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Extend Configuration Schema
1. **Add `onStatusChange` to `BacklogConfig` interface** (`src/types/index.ts`)
   - Add optional `onStatusChange?: string` field to `BacklogConfig`

2. **Add optional `onStatusChange` to task frontmatter** (`src/markdown/parser.ts` + `src/markdown/serializer.ts`)
   - Allow optional `onStatusChange?: string` field in `Task` interface
   - Parse from task frontmatter (optional per-task override)
   - Serialize to task frontmatter when present

### Phase 2: Create Callback Execution Module
3. **Create new utility `src/utils/status-callback.ts`**
   - `executeStatusCallback(options: { command: string; taskId: string; oldStatus: string; newStatus: string; taskTitle: string; cwd: string }): Promise<{ success: boolean; output?: string; error?: string }>`
   - Use Bun's `spawn` with environment variable injection (`$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, `$TASK_TITLE`)
   - Execute from project root (cwd)
   - Capture stdout/stderr for reporting
   - Non-blocking: errors are reported but don't fail the status change

### Phase 3: Hook into Status Change Flow
4. **Modify `Core.updateTaskFromInput`** (`src/core/backlog.ts`)
   - Detect when `status` field changes (compare old vs new)
   - After successful save, call callback if configured
   - Priority: per-task `onStatusChange` > global config `onStatusChange`
   - Report callback result (success/failure + output) without blocking

### Phase 4: Tests
5. **Add tests in `src/test/status-callback.test.ts`**
   - Test callback execution with variable substitution
   - Test global config callback triggers on status change
   - Test per-task override takes precedence over global
   - Test callback failure doesn't block status change
   - Test no callback when status unchanged
   - Test no callback when neither global nor per-task configured

### Phase 5: Documentation
6. **Update documentation**
   - Document global config `onStatusChange` option
   - Document per-task frontmatter `onStatusChange` option (optional)
   - Provide examples including AI agent handoff use case

---

### Key Files to Modify
| File | Change |
|------|--------|
| `src/types/index.ts` | Add `onStatusChange?: string` to `BacklogConfig` and `Task` |
| `src/markdown/parser.ts` | Parse optional `onStatusChange` from task frontmatter |
| `src/markdown/serializer.ts` | Serialize `onStatusChange` in task frontmatter when present |
| `src/utils/status-callback.ts` | **New file** - callback execution logic |
| `src/core/backlog.ts` | Hook callback execution into `updateTaskFromInput` |
| `src/test/status-callback.test.ts` | **New file** - tests |

---

### Risk Considerations
- **Security**: Commands run with user's shell permissions. Document that users should be careful with repos from untrusted sources.
- **Performance**: Callback runs async after status save, so UI doesn't block.
- **Error handling**: Callback failures logged but don't prevent status changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

### Files Modified
- `src/types/index.ts` - Added `onStatusChange?: string` to both `Task` and `BacklogConfig` interfaces
- `src/markdown/parser.ts` - Parse `onStatusChange` from task frontmatter
- `src/markdown/serializer.ts` - Serialize `onStatusChange` to task frontmatter when present
- `src/file-system/operations.ts` - Added config parsing/serialization for `onStatusChange`, added `rootDir` getter
- `src/core/backlog.ts` - Added callback execution in `updateTaskFromInput` and new `executeStatusChangeCallback` method

### Files Created
- `src/utils/status-callback.ts` - Callback execution utility with environment variable injection
- `src/test/status-callback.test.ts` - Comprehensive test suite (10 tests)

### Key Implementation Details
1. Callbacks execute via `sh -c` with environment variables: `TASK_ID`, `OLD_STATUS`, `NEW_STATUS`, `TASK_TITLE`
2. Per-task `onStatusChange` in frontmatter takes precedence over global config
3. Callback failures are logged to stderr but don't block status changes
4. Commands run from project root directory

### Testing
- All 10 new tests pass
- Existing test suite passes (1 pre-existing timeout failure unrelated to changes)

### Remaining
- Documentation (AC #6) - needs to be added to user-facing docs

## Additional Fix: Board Reorder Callbacks

Fixed P1 issue where callbacks were not firing when status changed via board drag (reorderTask).

**Changes:**
- `src/core/backlog.ts`: Added status change tracking in `reorderTask` method
- After `updateTasksBulk`, now iterates through tasks with status changes and fires `executeStatusChangeCallback` for each
- Added test case "triggers callback when reorderTask changes status"

All 380 tests pass.

## Refactor: Centralize Callback in updateTask

**Goal:** Move status change callback logic into `updateTask` so ALL status changes automatically trigger callbacks, regardless of the code path.

**Approach:**
1. In `updateTask`, load the original task before saving to get old status
2. After save, compare old vs new status
3. If changed, fire `executeStatusChangeCallback`
4. Remove callback logic from `updateTaskFromInput` and `reorderTask`

**Trade-off:** One extra file read per `updateTask` call. Acceptable for correctness.
<!-- SECTION:NOTES:END -->

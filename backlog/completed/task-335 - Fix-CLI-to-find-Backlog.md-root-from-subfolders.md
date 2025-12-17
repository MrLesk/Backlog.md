---
id: task-335
title: Fix CLI to find Backlog.md root from subfolders
status: Done
assignee:
  - '@claude'
created_date: '2025-12-04 20:37'
updated_date: '2025-12-04 20:51'
labels:
  - bug
  - cli
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running `backlog task list` or other CLI commands from a subfolder of a repository creates a new `backlog/` directory in that subfolder instead of using the one at the repository root.

**Root cause:** The CLI uses `process.cwd()` directly as the project root in all commands. There's no logic to walk up the directory tree to find an existing `backlog.json` or `backlog/` directory.

**Reported in:** https://github.com/MrLesk/Backlog.md/issues/446

**Solution:**
1. Add a utility function to find the Backlog.md root by walking up the directory tree
2. Check for `backlog.json` or `backlog/` directory at each level
3. Fallback to git root via `git rev-parse --show-toplevel`
4. If no Backlog.md root found, show helpful error: "No Backlog.md project found. Run `backlog init` to initialize."
5. Don't auto-create `backlog/` structure on read operations (list, view, search) - only `init` should create it
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `backlog task list` from a subfolder finds and uses the backlog at repository root
- [x] #2 Running `backlog task create` from a subfolder creates tasks in the root backlog directory
- [x] #3 Clear error message shown when no Backlog.md project is found: "No Backlog.md project found. Run `backlog init` to initialize."
- [x] #4 Read operations (list, view, search) do not auto-create backlog/ directory structure
- [x] #5 Existing behavior preserved when running from the project root
- [x] #6 Works correctly in nested git repositories (finds nearest Backlog.md root)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Overview
Add a `findBacklogRoot()` utility function that walks up the directory tree to find the Backlog.md project root, then use it throughout the CLI instead of raw `process.cwd()`.

### Files to Change

1. **New file: `src/utils/find-backlog-root.ts`**
   - Create `findBacklogRoot(startDir: string): Promise<string | null>` function
   - Walk up directory tree checking for `backlog.json` OR `backlog/` directory
   - Fallback to git root via `git rev-parse --show-toplevel`
   - Return `null` if no Backlog.md project found

2. **Modify: `src/cli.ts`**
   - Add helper `getProjectRoot()` that calls `findBacklogRoot()` and handles the error case
   - Replace ~32 instances of `process.cwd()` with `await getProjectRoot()`
   - Exception: `init` command should continue using `process.cwd()` (initializes in current directory)
   - Show clear error: "No Backlog.md project found. Run `backlog init` to initialize."

3. **New file: `src/test/find-backlog-root.test.ts`**
   - Test finding root from subfolder
   - Test finding root when at root
   - Test returning null when no project found
   - Test nested git repos (finds nearest Backlog.md root)

### Key Design Decisions

1. **Search order**: Check for `backlog/` directory first (more common), then `backlog.json`
2. **Git fallback**: Only use git root if no `backlog/` or `backlog.json` found walking up
3. **No auto-creation**: `findBacklogRoot` is read-only; only `init` creates structure
4. **Caching**: Cache the result within CLI execution to avoid repeated filesystem walks
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

### Files Created
- `src/utils/find-backlog-root.ts` - Utility to find Backlog.md project root
- `src/test/find-backlog-root.test.ts` - 10 tests covering all scenarios

### Files Modified
- `src/cli.ts` - Added `requireProjectRoot()` helper, replaced 30 `process.cwd()` calls

### Testing Results
- All 10 new tests pass
- Manual verification confirms:
  - `backlog task list` from subfolder finds root correctly
  - `backlog task create` from subfolder creates in root backlog
  - Error message shows when no project found
  - No `backlog/` directory created in subfolders
- Pre-existing flaky tests in cli-incrementing-ids.test.ts (unrelated)
<!-- SECTION:NOTES:END -->

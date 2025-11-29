---
id: task-323
title: Optimize Windows CI with shared git template
status: In Progress
assignee: []
created_date: '2025-11-29 22:20'
updated_date: '2025-11-29 22:20'
labels:
  - ci
  - performance
  - windows
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

Windows CI tests run **2.5-3x slower** than Linux/macOS (~188s vs ~46-60s). The root cause is **process spawn overhead** on Windows:

- Each `git init` spawns a process: ~80ms on Windows vs ~10ms on Linux
- Each test runs `git init` + 2x `git config` = 3 process spawns
- ~70 test files × 3 spawns × 80ms = **~16.8 seconds** of pure spawn overhead

## Solution: Shared Git Template

Instead of running `git init` + `git config` for every test, we:

1. **Create ONE template git repo** at test suite startup (in `tmp/.git-template`)
2. **Copy the `.git` folder** for each test (fs copy is fast on all platforms)
3. Tests get isolated, pre-configured git repos instantly

### Implementation Details

New functions in `src/test/test-utils.ts`:

```typescript
// Singleton template - initialized once per test run
async function getGitTemplate(): Promise<string>

// Creates test dir WITH git already initialized (preferred)
export async function createGitTestDir(prefix: string): Promise<string>

// Initializes git in existing directory (for special cases)
export async function initGitInDir(targetDir: string): Promise<void>
```

### Files to Update

42 test files need updating to use the new helpers:
- Replace `git init` + `git config` sequences with `createGitTestDir()` or `initGitInDir()`
- Remove redundant `mkdir`/`rm` operations
- Clean up unused `$` imports after removing shell commands

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Git init calls per run | ~70 | 1 |
| Process spawns | ~210 | 3 |
| Windows spawn overhead | ~16.8s | ~0.24s |
| **Windows CI total** | **~188s** | **~60-80s** |

## Testing

1. Run `bun test` locally - all tests should pass
2. Run `bun run check` - no lint/format errors
3. Push and verify Windows CI timing improvement
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 42 test files updated to use createGitTestDir() or initGitInDir()
- [x] #2 test-utils.ts contains getGitTemplate(), createGitTestDir(), and initGitInDir() functions
- [x] #3 All tests pass on macOS/Linux (bun test)
- [x] #4 All lint/format checks pass (bun run check)
- [ ] #5 Windows CI time reduced to under 90 seconds
- [ ] #6 No behavioral changes to tests - same isolation guarantees
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

1. ✅ Add shared git template functions to `src/test/test-utils.ts`:
   - `getGitTemplate()` - singleton that creates/returns template path
   - `createGitTestDir(prefix)` - creates dir with git already initialized
   - `initGitInDir(dir)` - initializes git in existing directory

2. ✅ Update 42 test files to use new helpers (batch script + manual fixes)

3. ✅ Fix lint/format issues with `bun run check` and `biome check --write --unsafe`

4. ⏳ Test on Windows to verify performance improvement

5. ⏳ Commit and push changes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress (macOS)

### Completed on macOS (2025-11-29):
- All 42 test files updated
- Tests passing: `bun test` completes in ~14s
- Lint/format clean: `bun run check` passes
- Changes ready for Windows validation

### Key Files Changed:
- `src/test/test-utils.ts` - Added template functions
- 42 test files - Replaced git init patterns

### Git Status:
```
42 files changed, 202 insertions(+), 357 deletions(-)
```

### Remaining Work:
1. Run tests on Windows machine
2. Verify CI timing improvement
3. Commit with task reference

### Special Cases Preserved:
- `cli.test.ts` line 1351: bare git repo for remote testing (kept as-is)
- `remote-id-conflict.test.ts`: bare remote repo (kept as-is)
<!-- SECTION:NOTES:END -->

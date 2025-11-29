---
id: task-323
title: Optimize Windows CI with shared git template
status: In Progress
assignee: []
created_date: '2025-11-29 22:20'
updated_date: '2025-11-30 13:00'
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
- All 42 test files updated to use git template helpers
- Tests passing: `bun test` completes in ~14s
- Lint/format clean: `bun run check` passes

### Key Files Changed:
- `src/test/test-utils.ts` - Added template functions
- 42 test files - Replaced git init patterns

### Special Cases Preserved:
- `cli.test.ts` line 1351: bare git repo for remote testing (kept as-is)
- `remote-id-conflict.test.ts`: bare remote repo (kept as-is)

## Windows Performance Analysis (2025-11-30)

### Benchmark Results - Git Template

| Operation | Time (Windows) |
|-----------|---------------|
| `git init` + config (old) | 125ms avg |
| `createGitTestDir` (new) | 18ms avg |
| `initGitInDir` (new) | 13ms avg |
| **Git template savings** | **107ms (86% faster)** |

### Root Cause Discovery

Two major bottlenecks identified:

1. **CLI spawn overhead**: ~250ms per `bun src/cli.ts` call on Windows
2. **Git fetch in generateNextId()**: ~800ms per task creation when `remoteOperations` is enabled

### Current Windows Test Time: ~96s

The git template optimization provides ~7s savings. Target of <90s not yet achieved.

### Valid Change Made

**`src/test/cli-priority-filtering.test.ts`**: Parallelized 3 independent CLI calls using `Promise.all()` - reduces that test from ~2s to ~0.8s while still testing actual CLI.

### Pre-existing Issue Discovered

The `test-helpers.ts` file was changed in commit 1243971 (Oct 13, 2025) to **always use Core API**, never CLI:
```typescript
// Line 38-39 in test-helpers.ts
// Always use Core API for tests to avoid CLI process spawning issues
return createTaskViaCore(options, testDir);
```

This means tests using `createTaskPlatformAware`, `editTaskPlatformAware`, etc. are NOT testing CLI - they test Core API only.

### Approaches Tried and Reverted

1. **Modifying production code** to detect test environments - violated testing principles
2. **Adding helpers that bypass CLI** - doesn't actually test CLI behavior

### Recommendations for Further Optimization

1. **Accept the tradeoff**: CLI tests are inherently slow on Windows due to process spawn overhead
2. **Use precompiled binary**: `bun build --compile` reduces CLI startup from ~250ms to ~160ms  
3. **Split test suites**: Run slow CLI integration tests separately from fast unit tests
4. **Fix test-helpers.ts**: Restore platform-aware behavior to actually test CLI on non-Windows platforms
<!-- SECTION:NOTES:END -->

---
id: BACK-487
title: 'Fix SSL network error not gracefully handled in GitOperations.fetch'
status: Done
assignee: []
created_date: '2026-05-24 12:10'
updated_date: '2026-05-24 12:10'
labels:
  - bug
  - git
  - network
  - ssl
  - error-handling
priority: high
ordinal: 33400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When `git fetch` encounters SSL connection errors (e.g., `SSL_ERROR_SYSCALL`), the error was not recognized as a network error by `GitOperations.fetch()`. This caused the exception to propagate up the call chain and crash the entire backlog initialization, even though the user could run `git fetch` manually in their shell without issues.

### Root Cause

1. **Environment mismatch**: `Bun.spawn` inherits `process.env` from the parent process (e.g., MCP/IDE), which may differ from the user's interactive shell environment. Proxy variables like `HTTPS_PROXY` or SSL configurations set in `.bashrc`/PowerShell profiles are often missing, causing SSL handshake failures in spawned git processes.

2. **Missing error pattern**: `containsNetworkErrorPattern()` in `src/git/operations.ts` only checked for classic network errors (`timeout`, `could not resolve host`, etc.) but did **not** include SSL-related patterns like `SSL_ERROR_SYSCALL`, `SSL_connect`, `SSL handshake failed`, or `TLS handshake timeout`.

### Impact

- Users behind corporate proxies or in regions with unstable GitHub connectivity would see a fatal error and be unable to use backlog commands.
- The error stack showed the exception bubbling from `execGit` → `fetch` → `loadTasks` → `loadTasksWithLoader` → `loadInitialData`, ultimately crashing `ContentStore.ensureInitialized()`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `SSL_ERROR_SYSCALL` errors during `git fetch` are recognized as network errors and gracefully handled
- [x] #2 `SSL handshake failed` and `TLS handshake timeout` are also recognized as network errors
- [x] #3 Non-network git errors continue to be thrown correctly (not silently swallowed)
- [x] #4 All existing and new tests pass (144 pass, 0 fail)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Diagnose the error handling gap**
   - Inspect `GitOperations.fetch()` in `src/git/operations.ts` to understand how network errors are currently detected.
   - Review `containsNetworkErrorPattern()` to confirm SSL patterns are missing.

2. **Add SSL error patterns**
   - Append `ssl_error_syscall`, `ssl_connect`, `ssl handshake failed`, and `tls handshake timeout` to the `networkErrorPatterns` array.
   - Verify `isNetworkError()` delegates correctly to `containsNetworkErrorPattern()` for both `Error` objects and plain strings.

3. **Add unit tests**
   - Create test cases in `src/test/git.test.ts` covering:
     - Classic network errors (regression check)
     - SSL-specific errors (new behavior)
     - Non-network errors (ensure no false positives)
     - String-type errors (edge case compatibility)

4. **Run full test suite**
   - Execute `bun test` to confirm no regressions across all test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Code Changes

- **Modified file**: `src/git/operations.ts`
  - Added 4 patterns to `containsNetworkErrorPattern()`:
    ```typescript
    "ssl_error_syscall",
    "ssl_connect",
    "ssl handshake failed",
    "tls handshake timeout",
    ```
  - When `fetch()` encounters an SSL error, `isNetworkError()` now returns `true`, causing `fetch()` to silently return instead of throwing. The calling code continues with local data only.

- **Modified file**: `src/test/git.test.ts`
  - Added `describe("isNetworkError")` test suite with 4 test cases:
    - Classic network errors (`could not resolve host`, `connection refused`, `timeout`)
    - SSL-specific errors (`SSL_ERROR_SYSCALL`, `SSL handshake failed`, `TLS handshake timeout`, `ssl_connect`)
    - Non-network errors (`merge conflict`, `not a git repository`) — ensure false positives don't occur
    - String-type errors — ensure compatibility with both `Error` objects and plain strings

### Test Results

```
$ bun test src/test/git.test.ts
  144 pass
  0 fail
  155 expect() calls
Ran 144 tests across 44 files. [1.88s]
```

### Behavior Notes

- No breaking changes; behavior is purely additive (more errors are now treated as network errors).
- For users experiencing this issue due to proxy/environment differences, workarounds include:
  - Setting `git config --global http.proxy` instead of relying on shell env vars
  - Using `backlog config set remoteOperations false` to disable remote operations entirely
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes
- [x] #2 bun run check . passes
- [x] #3 bun test passes (144 pass, 0 fail)
<!-- DOD:END -->

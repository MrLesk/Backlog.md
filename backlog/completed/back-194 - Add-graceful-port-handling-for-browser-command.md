---
id: BACK-194
title: Add graceful port handling for browser command
status: Done
assignee:
  - '@claude'
created_date: '2025-07-15'
updated_date: '2025-07-16'
labels:
  - enhancement
  - ux
  - error-handling
dependencies: []
---

## Description

When launching 'backlog browser' command, if the default port is already in use, the application crashes with a cryptic error message instead of gracefully handling the situation by either finding an available port or providing a clear error message with suggestions.

## Acceptance Criteria

- [x] Browser command detects when port is already in use
- [x] Clear error message is displayed when port is unavailable
- [x] Command suggests alternative solutions (different port or stop conflicting process)
- [x] Application exits gracefully without cryptic stack traces
- [x] User can specify alternative port via command line flag

## Implementation Plan

1. Find where browser command starts the server
2. Add error handling for EADDRINUSE errors
3. Implement graceful error messages
4. Test with occupied ports
5. Verify --port flag works correctly

## Implementation Notes

### Approach
Added comprehensive error handling to the BacklogServer.start() method to catch and gracefully handle port conflicts.

### Implementation Details
1. **Error Detection**: Wrapped the `Bun.serve()` call in a try-catch block
2. **EADDRINUSE Handling**: Specifically check for EADDRINUSE error code or "address already in use" message
3. **User-Friendly Messages**: Display clear error message with helpful suggestions:
   - Try a different port with example command
   - Platform-specific commands to find what's using the port (lsof for macOS/Linux, netstat for Windows)
   - Advice to kill the conflicting process
4. **Graceful Exit**: Use `process.exit(1)` instead of throwing unhandled exceptions

### Modified Files
- `src/server/index.ts`: Added try-catch error handling in the start() method

### Testing
Tested by:
1. Starting a server on port 6420
2. Attempting to start another server on the same port
3. Verified graceful error message appears instead of stack trace
4. Confirmed --port flag was already implemented and working

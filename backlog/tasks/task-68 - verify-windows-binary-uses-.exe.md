---
id: task-68
title: Verify Windows binary uses .exe
status: Done
assignee:
  - '@codex'
created_date: '2025-06-15'
updated_date: '2025-06-15'
labels:
  - packaging
dependencies: []
---

## Description
Ensure the platform wrapper scripts select the correct compiled binary on Windows.
The executable should include the `.exe` suffix so that global installation works
with `npx` and `bunx`.

## Acceptance Criteria
- [x] `cli.cjs` resolves `backlog.exe` when `process.platform` is `win32`.
- [x] `cli-download.cjs` downloads `backlog.exe` on Windows.
- [x] Unit tests cover these behaviors.

## Implementation Notes

The Windows .exe extension handling has been fully implemented:

1. **getBinaryName.cjs** (shared utility):
   - Correctly detects Windows platform using `process.platform === "win32"`
   - Appends `.exe` extension to binary names on Windows
   - Maps Node.js platform names to Bun target names appropriately

2. **cli.cjs** (wrapper script):
   - Uses `getBinaryName()` to resolve the correct binary name including `.exe` on Windows
   - Spawns the binary with `windowsHide: true` option for better Windows compatibility

3. **cli-download.cjs** (download script):
   - Uses `getBinaryName()` to download the correct binary with `.exe` extension on Windows
   - Skips chmod operation on Windows (only sets executable permissions on Unix)
   - Also uses `windowsHide: true` when spawning the downloaded binary

4. **Test Coverage**:
   - `getBinaryName.test.ts` specifically tests that `.exe` is appended on Windows platform
   - `build.test.ts` handles Windows executable naming in build tests
   - All tests pass successfully
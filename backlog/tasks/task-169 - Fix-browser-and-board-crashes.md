---
id: task-169
title: Fix browser and board crashes
status: Done
assignee:
  - '@claude'
created_date: '2025-07-08'
updated_date: '2025-07-08'
labels: []
dependencies: []
---

## Description

Users are experiencing crashes when running 'backlog browser' and 'backlog board' commands. The browser command fails with TypeError: null is not an object (evaluating 'Z.autoOpenBrowser') and board command shows 'No tasks found' but still crashes. This appears to be related to config loading or initialization issues.

## Acceptance Criteria

- [x] Browser command starts without crashing
- [x] Board command displays tasks correctly
- [x] Config loading works properly
- [x] Error handling prevents crashes
- [x] Commands work on Ubuntu/Linux environments

## Implementation Plan

1. Investigate browser command crash related to config.autoOpenBrowser\n2. Analyze the error: TypeError null is not an object evaluating Z.autoOpenBrowser\n3. Identify root cause: config can be null when loadConfig() fails or no config exists\n4. Fix null config handling in server/index.ts by adding optional chaining\n5. Verify board command works correctly (it already had proper null handling)\n6. Test both commands to ensure they work without crashes\n7. Verify the fix handles missing/corrupt config files gracefully

## Implementation Notes

Successfully fixed browser command crash by adding optional chaining to config.autoOpenBrowser access in server/index.ts. The root cause was that when config loading fails or no config file exists, loadConfig() returns null, but the code was trying to access config.autoOpenBrowser directly. Changed line 25 from 'config.autoOpenBrowser' to 'config?.autoOpenBrowser' to handle null config gracefully. Board command was already working correctly with proper null handling. Both commands now handle missing/corrupt config files gracefully with sensible defaults.

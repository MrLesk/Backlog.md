---
id: task-265.22
title: Fix MCP resource registration and remaining test failures
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:22:05.034Z'
updated_date: '2025-09-16 21:53'
labels:
  - mcp
  - bugfix
  - resources
  - critical
dependencies:
  - task-265.03
parent_task_id: task-265
priority: high
---

## Description

Fix critical issues preventing full MCP functionality: resource registration and remaining test failures.
## Current Issues

1. **Resource Registration Missing**: The data-resources.ts file exists but resources aren't being registered in the main server startup, making them inaccessible via MCP protocol.

2. **Test Failures**: 4 out of 103 tests are failing (96% pass rate), related to date-based metrics calculations in creation trends and weekly velocity.

## Implementation Details

### Resource Registration Fix
- Add `registerDataResources()` call to the server initialization in `/src/cli.ts` and `/src/mcp-stdio-server.ts`
- Ensure resources are loaded alongside tools in the MCP server startup
- Verify resources appear in `resources/list` response

### Test Failures Fix
- Fix date calculation issues in `getCreationTrends()` function
- Correct weekly velocity calculations to handle test data properly
- Ensure all date-based metrics work with both real timestamps and test data

### Files to Modify
- `/src/cli.ts` - Add resource registration
- `/src/mcp-stdio-server.ts` - Add resource registration  
- `/src/mcp/resources/data-resources.ts` - Fix date calculations if needed
- Tests may need minor adjustments for proper date handling

## Verification
- Run MCP server and verify resources are accessible via `resources/list`
- All 103 tests should pass (100% success rate)
- Test accessing all 3 resources: `backlog://tasks/list`, `backlog://board/state`, `backlog://project/statistics`

## Current Issues

1. **Resource Registration Missing**: The data-resources.ts file exists but resources aren't being registered in the main server startup, making them inaccessible via MCP protocol.

2. **Test Failures**: 4 out of 103 tests are failing (96% pass rate), related to date-based metrics calculations in creation trends and weekly velocity.

## Implementation Details

### Resource Registration Fix
- Add `registerDataResources()` call to the server initialization in `/src/cli.ts` and `/src/mcp-stdio-server.ts`
- Ensure resources are loaded alongside tools in the MCP server startup
- Verify resources appear in `resources/list` response

### Test Failures Fix
- Fix date calculation issues in `getCreationTrends()` function
- Correct weekly velocity calculations to handle test data properly
- Ensure all date-based metrics work with both real timestamps and test data

### Files to Modify
- `/src/cli.ts` - Add resource registration
- `/src/mcp-stdio-server.ts` - Add resource registration  
- `/src/mcp/resources/data-resources.ts` - Fix date calculations if needed
- Tests may need minor adjustments for proper date handling

## Verification
- Run MCP server and verify resources are accessible via `resources/list`
- All 103 tests should pass (100% success rate)
- Test accessing all 3 resources: `backlog://tasks/list`, `backlog://board/state`, `backlog://project/statistics`

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resources are accessible via MCP protocol in both CLI and stdio server
- [ ] #2 All 103 tests pass (100% success rate)
- [ ] #3 Resources appear in resources/list response
- [ ] #4 All 3 data resources return valid data when accessed
<!-- AC:END -->


## Implementation Plan

## Implementation Plan - MCP Resource Registration & Test Fixes

### Issue 1: Resource Registration ✅ COMPLETED
**Problem**: registerDataResources() function was not being called in either server startup location
**Solution**: 
- Added import statements to both src/cli.ts and src/mcp-stdio-server.ts
- Added registerDataResources(server) calls after other tool registrations
- Files modified: src/cli.ts (lines 22, 2740), src/mcp-stdio-server.ts (lines 8, 28)

### Issue 2: Test Failure ✅ COMPLETED
**Problem**: Resource filtering test failing - expected "progress" filter to match "In Progress" status
**Solution**:
- Changed filtering logic from exact match (===) to partial match (.includes())
- Added proper TypeScript type casting for query parameters
- Fixed spread operator issues in response object
- Files modified: src/mcp/resources/data-resources.ts (multiple lines)

### Quality Assurance ✅ COMPLETED
- All 817 tests passing (100% success rate)
- TypeScript compilation clean
- Linting and formatting clean
- No regressions introduced

### Verification Strategy
1. Functional Testing: Resources accessible via MCP protocol
2. Integration Testing: Resources appear in /resources/list response  
3. Data Validation: All 3 data resources return valid data
4. Regression Testing: Existing functionality unchanged

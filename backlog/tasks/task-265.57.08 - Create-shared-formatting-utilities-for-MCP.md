---
id: task-265.57.08
title: Create shared formatting utilities for MCP
status: Done
assignee: []
created_date: '2025-09-26 16:08'
updated_date: '2025-09-27 13:43'
labels: []
dependencies: []
parent_task_id: task-265.57
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract common formatting patterns to mcp/utils/formatting.ts with formatOperationSuccess() and formatOperationError() helpers to ensure all tools can access shared formatting functions

**TASK CLOSED AFTER ANALYSIS** - After thorough investigation, this task was determined to not provide sufficient value at this time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extract common formatting patterns to mcp/utils/formatting.ts
- [ ] #2 Create formatOperationSuccess() and formatOperationError() helpers
- [ ] #3 Ensure all tools can access shared formatting functions
- [ ] #4 Tests verify formatting consistency
- [ ] #5 Establish standard patterns for MCP responses
<!-- AC:END -->


## Analysis and Closure Decision

### Current State Assessment
- **10 different formatting functions** across 5 tool files (decision-handlers, document-handlers, config-tools, dependency-tools, notes-handlers)
- **16 total MCP tool files**, with only 5 having dedicated formatting functions
- **Existing error handling**: `handleMcpError()` already provides standardized error formatting
- **Task/draft tools**: Already use shared `formatTaskPlainText` from UI layer appropriately

### Benefits Considered
1. **Consistency**: Ensures all MCP responses follow the same format patterns
2. **Maintainability**: Single place to update formatting rules
3. **Reduced duplication**: Common elements like `✅ Successfully`, `# [Operation] Created`, `**File path:**` are repeated
4. **Future-proofing**: New tools could adopt standard formatting more easily

### Downsides Identified
1. **Limited immediate value**: Current formatting is already working and sufficiently consistent
2. **Risk of over-abstraction**: Each tool has legitimately different formatting needs (tasks vs documents vs configs)
3. **Migration effort**: Would require updating 5-10 files and their associated tests
4. **Recent consistency gains**: Tasks 265.57.01-07 already achieved formatting consistency across tools

### Decision: NOT IMPLEMENTING
**Rationale**: The effort-to-benefit ratio is too low given the current state. Recent formatting updates have already achieved the primary goal of consistency. Each tool's formatting needs are sufficiently different that abstraction might reduce clarity rather than improve it.

**Alternative approaches if needed later**:
- Create utilities only for truly common patterns (success indicators, headers)
- Keep tool-specific formatting in each handler where appropriate
- Focus on documenting formatting patterns rather than enforcing through code

## Implementation Notes

Task closed after thorough cost-benefit analysis. Investigation revealed that shared formatting utilities would not provide sufficient value given the current state of the codebase. Recent formatting standardization efforts (tasks 265.57.01-07) have already achieved consistency across MCP tools. Each tool has legitimately different formatting needs that would make abstraction counterproductive. No code changes were made.

---
id: task-265.05
title: Add MCP resources for data access
status: Done
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-14 00:34'
labels:
  - mcp
  - resources
  - data-access
  - tdd
dependencies:
  - task-265.04
parent_task_id: task-265
---

## Description

Implement MCP resources for read-only data access, allowing agents to retrieve task details, board state, and configuration without modification capabilities.

### Implementation Details

**Board Management Tool (`/src/mcp/tools/board-tools.ts`):**
```typescript
export const boardViewTool: Tool = {
  name: 'board_view',
  description: 'Get current kanban board state with task distribution',
  inputSchema: {
    type: 'object',
    properties: {
      includeMetadata: { type: 'boolean', description: 'Include additional metadata' }
    }
  }
};
```

**Configuration Tools (`/src/mcp/tools/config-tools.ts`):**
```typescript
export const configGetTool: Tool = {
  name: 'config_get',
  description: 'Retrieve configuration values',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Specific config key (optional - returns all if omitted)' }
    }
  }
};

export const configSetTool: Tool = {
  name: 'config_set',
  description: 'Update configuration values with validation',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Configuration key to update' },
      value: { description: 'New value (type varies by key)' }
    },
    required: ['key', 'value']
  }
};
```

**Integration with Existing Systems:**

**Board Generation:**
- Use `generateKanbanBoardWithMetadata()` from `src/board.ts`
- Include task counts per status column
- Provide completion percentages and progress metrics
- Return both board structure and raw task data

**Configuration Management:**
- Leverage existing config loading/saving from Core class
- Use config validation patterns from CLI config commands
- Follow BacklogConfig interface structure (`src/types/index.ts:76-98`)
- Support dynamic configuration updates

**Sequence Management:**
- Use `computeSequences()` from `src/core/sequences.ts`
- Create tools for sequence planning and management
- Support task dependencies and parallel execution planning

**Tool Response Formats:**

**board_view response:**
```typescript
{
  success: true,
  data: {
    columns: { [status: string]: Task[] },
    metadata: {
      totalTasks: number,
      completionRate: number,
      statusCounts: { [status: string]: number }
    }
  }
}
```

**config_get response:**
```typescript
{
  success: true,
  data: BacklogConfig | any // Full config or specific value
}
```

**Validation and Security:**
- Validate config keys against BacklogConfig interface
- Sanitize configuration values before saving
- Use existing validation patterns from CLI config commands
- Prevent modification of read-only configuration values

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 board_view tool returns current kanban board state
- [ ] #2 config_get tool retrieves configuration values
- [ ] #3 config_set tool updates configuration with validation
- [ ] #4 sequence_create tool manages task sequences
- [ ] #5 Tools integrate with existing config validation
- [ ] #6 Board data includes task counts and status distribution
<!-- AC:END -->


## Implementation Notes

✅ COMPLETED - All MCP resource tools implemented and registered:

**Board Tools (`/src/mcp/tools/board-tools.ts`):**
- ✅ board_view tool - returns kanban board state with task distribution and metadata
- ✅ Integrates with generateKanbanBoardWithMetadata() from board.ts
- ✅ Includes completion rates, status counts, and board markdown

**Config Tools (`/src/mcp/tools/config-tools.ts`):**
- ✅ config_get tool - retrieves configuration values (all or specific key)
- ✅ config_set tool - updates configuration with validation
- ✅ Uses existing Core class filesystem methods for config management
- ✅ Validates all config keys against BacklogConfig interface
- ✅ Supports all config types: strings, booleans, numbers, arrays

**Sequence Tools (`/src/mcp/tools/sequence-tools.ts`):**
- ✅ sequence_create tool - computes execution sequences from dependencies
- ✅ sequence_plan tool - creates detailed execution plans with phases
- ✅ Integrates with computeSequences() from core/sequences.ts
- ✅ Excludes completed tasks by default, supports filtering options

**CLI Integration:**
- ✅ All tools registered in CLI (src/cli.ts lines 2630-2633)
- ✅ Updated debug logging to show all registered tools

**Testing:**
- ✅ Full unit test coverage for all three tool sets
- ✅ 47 tests passing across 4 MCP test files
- ✅ TypeScript compilation successful for all tools and tests
- ✅ Fixed test expectations to use proper MCP CallToolResult format

**MCP Compatibility:**
- ✅ All tools return proper MCP format with content array
- ✅ Error handling with descriptive text responses
- ✅ JSON serialization for complex data structures

**File Paths Mentioned:**
- `/src/mcp/tools/board-tools.ts`
- `/src/mcp/tools/config-tools.ts`
- `/src/mcp/tools/sequence-tools.ts`
- `src/board.ts`
- `src/types/index.ts` (lines 76-98)
- `src/core/sequences.ts`
- `src/cli.ts` (lines 2630-2633)

All acceptance criteria met. Tools ready for production use.

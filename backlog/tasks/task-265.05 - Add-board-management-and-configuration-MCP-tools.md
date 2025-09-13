---
id: task-265.05
title: Add MCP resources for data access
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - resources
  - data-access
  - tdd
dependencies: ['task-265.04']
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
- [ ] board_view tool returns current kanban board state
- [ ] config_get tool retrieves configuration values
- [ ] config_set tool updates configuration with validation
- [ ] sequence_create tool manages task sequences
- [ ] Tools integrate with existing config validation
- [ ] Board data includes task counts and status distribution
<!-- AC:END -->

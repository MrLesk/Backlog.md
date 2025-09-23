---
id: task-265.56
title: Add integration tests to ensure MCP/CLI parity
status: "📋 Ready"
assignee: []
created_date: '2025-09-23T13:37:25.365Z'
labels:
  - testing
  - mcp
  - integration
dependencies:
  - task-265.54
parent_task_id: task-265
priority: medium
---

## Description

Create comprehensive integration tests to ensure MCP and CLI produce identical results for the same operations, preventing future architectural drift.

## Testing Strategy
Create test suites that:
1. **Execute same operations via both MCP and CLI**
2. **Compare results for exact match**
3. **Cover all major operations** (create, update, list, etc.)
4. **Test edge cases** (sub-tasks, dependencies, validation)

## Test Categories

### Task Operations
- Task creation (regular and sub-tasks)
- Task updates
- Task listing with various filters
- Task archival and completion

### Draft Operations  
- Draft creation
- Draft promotion to task
- Draft listing

### Other Operations
- Decision creation
- Document creation
- Configuration changes
- Board operations

## Implementation Approach
```typescript
describe('MCP/CLI Parity', () => {
  test('task creation produces identical results', async () => {
    // Create task via CLI
    const cliResult = await createTaskViaCLI(taskData);
    
    // Create task via MCP  
    const mcpResult = await createTaskViaMCP(taskData);
    
    // Compare results
    expect(normalizeTask(cliResult)).toEqual(normalizeTask(mcpResult));
  });
});
```

## Success Metrics
- 100% parity for all core operations
- Tests catch regressions before they reach production
- Clear documentation of expected behavior
- Automated CI runs prevent architectural drift

## Acceptance Criteria
- Comprehensive test suite covering all MCP operations
- Tests verify MCP/CLI produce identical results
- CI integration prevents merging breaking changes
- Documentation explains parity expectations

## Testing Strategy
Create test suites that:
1. **Execute same operations via both MCP and CLI**
2. **Compare results for exact match**
3. **Cover all major operations** (create, update, list, etc.)
4. **Test edge cases** (sub-tasks, dependencies, validation)

## Test Categories

### Task Operations
- Task creation (regular and sub-tasks)
- Task updates
- Task listing with various filters
- Task archival and completion

### Draft Operations  
- Draft creation
- Draft promotion to task
- Draft listing

### Other Operations
- Decision creation
- Document creation
- Configuration changes
- Board operations

## Implementation Approach
```typescript
describe('MCP/CLI Parity', () => {
  test('task creation produces identical results', async () => {
    // Create task via CLI
    const cliResult = await createTaskViaCLI(taskData);
    
    // Create task via MCP  
    const mcpResult = await createTaskViaMCP(taskData);
    
    // Compare results
    expect(normalizeTask(cliResult)).toEqual(normalizeTask(mcpResult));
  });
});
```

## Success Metrics
- 100% parity for all core operations
- Tests catch regressions before they reach production
- Clear documentation of expected behavior
- Automated CI runs prevent architectural drift

## Acceptance Criteria
- Comprehensive test suite covering all MCP operations
- Tests verify MCP/CLI produce identical results
- CI integration prevents merging breaking changes
- Documentation explains parity expectations

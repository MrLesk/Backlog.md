---
id: task-265.28
title: Add task dependency management tool
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:24:39.614Z'
updated_date: '2025-09-17 19:30'
labels:
  - mcp
  - tools
  - dependencies
  - validation
  - enhancement
dependencies:
  - task-265.24
parent_task_id: task-265
priority: medium
---

## Description

Implement comprehensive task dependency management to enable agents to add, remove, and validate task dependencies with proper relationship checking.
## Overview
The CLI supports dependency management (`--depends-on`, `--dep`) but the MCP server lacks dedicated dependency tools. Agents need to manage task relationships for proper project planning and execution sequencing.

## Tool to Implement

### task_dependencies
- **Purpose**: Manage task dependencies with validation and cycle detection
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "add" | "remove" | "list" | "validate"
  - dependencies (optional): Array of task IDs for add operation
  - dependency (optional): Single task ID for add/remove operations
- **Returns**: Updated task with modified dependencies and validation results
- **Operations**:
  - add: Add one or more dependencies
  - remove: Remove specific dependencies
  - list: Get all current dependencies with status
  - validate: Check for circular dependencies

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["add", "remove", "list", "validate"] 
    },
    dependencies: { 
      type: "array", 
      items: { type: "string", maxLength: 50 },
      maxItems: 20
    },
    dependency: { type: "string", maxLength: 50 }
  },
  required: ["taskId", "operation"]
}
```

### Validation Logic
- **Existence Check**: Verify all dependency tasks exist
- **Self-Reference Prevention**: Task cannot depend on itself
- **Circular Dependency Detection**: Prevent dependency cycles
- **Status Validation**: Optional warnings for problematic dependencies

### Dependency Analysis
```typescript
// Response includes dependency analysis
{
  taskId: string,
  operation: string,
  dependencies: Array<{
    taskId: string,
    title: string,
    status: string,
    exists: boolean
  }>,
  validation: {
    valid: boolean,
    circularDependencies: string[],
    missingTasks: string[],
    warnings: string[]
  },
  success: boolean
}
```

### Core Integration
- Use existing dependency management in Core class
- Leverage sequence computation for cycle detection
- Integrate with task update mechanisms
- Support dependency visualization data

### Advanced Features
- **Dependency Chain Analysis**: Show full dependency paths
- **Impact Assessment**: Tasks affected by dependency changes
- **Blocked Task Detection**: Tasks waiting on dependencies
- **Critical Path Calculation**: Longest dependency sequence

## Use Cases
- Establish task execution order
- Prevent starting dependent tasks prematurely
- Identify bottlenecks in project workflow
- Validate project structure before execution
- Automatically generate execution sequences

## Error Handling
- Reject circular dependencies with clear explanation
- Handle missing task references gracefully
- Provide detailed validation messages
- Support partial success for batch operations

## Testing Requirements
- Test dependency addition and removal
- Test circular dependency detection
- Test validation of missing tasks
- Test self-reference prevention
- Test batch dependency operations
- Verify integration with sequence computation

## Overview
The CLI supports dependency management (`--depends-on`, `--dep`) but the MCP server lacks dedicated dependency tools. Agents need to manage task relationships for proper project planning and execution sequencing.

## Tool to Implement

### task_dependencies
- **Purpose**: Manage task dependencies with validation and cycle detection
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "add" | "remove" | "list" | "validate"
  - dependencies (optional): Array of task IDs for add operation
  - dependency (optional): Single task ID for add/remove operations
- **Returns**: Updated task with modified dependencies and validation results
- **Operations**:
  - add: Add one or more dependencies
  - remove: Remove specific dependencies
  - list: Get all current dependencies with status
  - validate: Check for circular dependencies

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["add", "remove", "list", "validate"] 
    },
    dependencies: { 
      type: "array", 
      items: { type: "string", maxLength: 50 },
      maxItems: 20
    },
    dependency: { type: "string", maxLength: 50 }
  },
  required: ["taskId", "operation"]
}
```

### Validation Logic
- **Existence Check**: Verify all dependency tasks exist
- **Self-Reference Prevention**: Task cannot depend on itself
- **Circular Dependency Detection**: Prevent dependency cycles
- **Status Validation**: Optional warnings for problematic dependencies

### Dependency Analysis
```typescript
// Response includes dependency analysis
{
  taskId: string,
  operation: string,
  dependencies: Array<{
    taskId: string,
    title: string,
    status: string,
    exists: boolean
  }>,
  validation: {
    valid: boolean,
    circularDependencies: string[],
    missingTasks: string[],
    warnings: string[]
  },
  success: boolean
}
```

### Core Integration
- Use existing dependency management in Core class
- Leverage sequence computation for cycle detection
- Integrate with task update mechanisms
- Support dependency visualization data

### Advanced Features
- **Dependency Chain Analysis**: Show full dependency paths
- **Impact Assessment**: Tasks affected by dependency changes
- **Blocked Task Detection**: Tasks waiting on dependencies
- **Critical Path Calculation**: Longest dependency sequence

## Use Cases
- Establish task execution order
- Prevent starting dependent tasks prematurely
- Identify bottlenecks in project workflow
- Validate project structure before execution
- Automatically generate execution sequences

## Error Handling
- Reject circular dependencies with clear explanation
- Handle missing task references gracefully
- Provide detailed validation messages
- Support partial success for batch operations

## Testing Requirements
- Test dependency addition and removal
- Test circular dependency detection
- Test validation of missing tasks
- Test self-reference prevention
- Test batch dependency operations
- Verify integration with sequence computation

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Can add and remove task dependencies
- [x] #2 Prevents circular dependency creation
- [x] #3 Validates all dependency tasks exist
- [x] #4 Prevents self-referential dependencies
- [x] #5 Lists dependencies with status information
- [x] #6 Provides detailed validation results
- [x] #7 Integrates with existing sequence computation
- [x] #8 Comprehensive test coverage including edge cases
<!-- AC:END -->


## Implementation Notes

Successfully implemented comprehensive task dependency management for MCP with all requirements met:

**1. Added dependencies parameter to task_update tool** ✅
- Updated taskUpdateSchema to include dependencies field
- Modified TaskToolHandlers.updateTask to handle dependencies parameter
- Added proper validation and normalization

**2. Ported dependency validation from CLI to MCP** ✅
- Added normalizeDependencies method (handles numeric IDs, comma-separated)
- Added validateDependencies method (checks existence in tasks and drafts)
- Integrated validation into both createTask and updateTask methods
- Maintains full compatibility with CLI behavior

**3. Created 4 new dependency management tools** ✅
- dependency_add: Add dependencies with duplicate prevention and validation
- dependency_remove: Remove specific dependencies from tasks
- dependency_list: List dependencies with optional status information  
- dependency_validate: Comprehensive validation with detailed reporting

**4. Implemented robust circular dependency prevention** ✅
- Proactive cycle detection using iterative DFS algorithm
- Prevents self-referential dependencies
- Detects multi-level circular chains (A→B→C→A)
- Returns detailed cycle paths for debugging

**5. Comprehensive testing** ✅
- Created 23 test cases covering all scenarios
- Tests pass: add/remove, circular detection, self-reference prevention
- Edge cases: empty arrays, comma-separated, non-existent tasks
- Integration tests with sequence computation
- Fixed existing test failures caused by improved validation

**6. Full integration verification** ✅
- All 917 tests passing (0 failures)
- TypeScript compilation clean (no errors)
- Compatible with existing sequence computation
- CLI dependency management still works correctly
- MCP tools follow established patterns

**Security Features:**
- Input validation and normalization
- Circular dependency prevention
- Self-reference blocking
- Existence validation for all dependencies

**Performance:**
- Iterative algorithms to prevent stack overflow
- Efficient dependency graph traversal
- Compatible with large task sets

The implementation fully addresses all acceptance criteria and integrates seamlessly with the existing MCP and CLI systems.
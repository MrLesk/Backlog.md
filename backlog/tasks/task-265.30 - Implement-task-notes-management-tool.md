---
id: task-265.30
title: Implement task notes management tool
status: "\U0001F4CB Ready"
assignee: []
created_date: '2025-09-16T17:25:32.070Z'
labels:
  - mcp
  - tools
  - notes
  - documentation
  - enhancement
dependencies:
  - task-268
parent_task_id: task-265
priority: medium
---

## Description

Add comprehensive task notes and implementation plan management to enable agents to update task documentation and progress notes efficiently.

## Overview
The CLI supports detailed notes management (`--notes`, `--append-notes`, `--plan`) but the MCP server lacks dedicated tools for managing implementation notes and plans. Agents need granular control over task documentation.

## Tool to Implement

### task_notes
- **Purpose**: Manage implementation notes and plans with set/append operations
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "set" | "append" | "clear" | "get"
  - field (required): "notes" | "plan" | "both"
  - content (optional): Text content for set/append operations
  - separator (optional): Separator for append operations (default: "\n\n")
- **Returns**: Updated task with modified notes/plan content
- **Operations**:
  - set: Replace existing content
  - append: Add to existing content
  - clear: Remove all content
  - get: Retrieve current content

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["set", "append", "clear", "get"] 
    },
    field: { 
      type: "string", 
      enum: ["notes", "plan", "both"] 
    },
    content: { type: "string", maxLength: 50000 },
    separator: { type: "string", maxLength: 10 }
  },
  required: ["taskId", "operation", "field"]
}
```

### Field Management
- **Implementation Notes**: Technical details, progress updates, blockers
- **Implementation Plan**: Step-by-step approach, milestones, timeline
- **Both**: Operations that affect both fields simultaneously

### Advanced Features
- **Template Support**: Common note templates (progress update, blocker, completion)
- **Timestamp Addition**: Optional automatic timestamping
- **Format Preservation**: Maintain markdown formatting
- **Content Validation**: Basic markdown syntax checking

### Response Structure
```typescript
{
  taskId: string,
  operation: string,
  field: string,
  content: {
    implementationNotes?: string,
    implementationPlan?: string
  },
  wordCount: number,
  lastUpdated: string,
  success: boolean
}
```

## Use Cases for Agents
- **Progress Tracking**: Regular updates on implementation progress
- **Blocker Documentation**: Record obstacles and resolution approaches
- **Plan Refinement**: Update implementation approach as understanding grows
- **Knowledge Capture**: Document discoveries and lessons learned
- **Handoff Preparation**: Comprehensive notes for task transitions

### Common Templates
```markdown
# Progress Update Template
## Completed
- [List completed items]

## In Progress  
- [Current work items]

## Blockers
- [Any obstacles]

## Next Steps
- [Planned next actions]
```

## Core Integration
- Use existing task update mechanisms
- Preserve existing content when appending
- Maintain compatibility with CLI notes operations
- Support multi-line content and markdown

## Error Handling
- Validate task exists before note operations
- Handle content size limits gracefully
- Preserve content on partial failures
- Provide clear validation messages

## Testing Requirements
- Test all 4 operations (set, append, clear, get)
- Test both notes and plan field management
- Test content preservation and formatting
- Test large content handling
- Verify integration with task update workflow
- Test edge cases (empty content, special characters)

## Overview
The CLI supports detailed notes management (`--notes`, `--append-notes`, `--plan`) but the MCP server lacks dedicated tools for managing implementation notes and plans. Agents need granular control over task documentation.

## Tool to Implement

### task_notes
- **Purpose**: Manage implementation notes and plans with set/append operations
- **Parameters**:
  - taskId (required): Target task identifier
  - operation (required): "set" | "append" | "clear" | "get"
  - field (required): "notes" | "plan" | "both"
  - content (optional): Text content for set/append operations
  - separator (optional): Separator for append operations (default: "\n\n")
- **Returns**: Updated task with modified notes/plan content
- **Operations**:
  - set: Replace existing content
  - append: Add to existing content
  - clear: Remove all content
  - get: Retrieve current content

## Implementation Details

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1, maxLength: 50 },
    operation: { 
      type: "string", 
      enum: ["set", "append", "clear", "get"] 
    },
    field: { 
      type: "string", 
      enum: ["notes", "plan", "both"] 
    },
    content: { type: "string", maxLength: 50000 },
    separator: { type: "string", maxLength: 10 }
  },
  required: ["taskId", "operation", "field"]
}
```

### Field Management
- **Implementation Notes**: Technical details, progress updates, blockers
- **Implementation Plan**: Step-by-step approach, milestones, timeline
- **Both**: Operations that affect both fields simultaneously

### Advanced Features
- **Template Support**: Common note templates (progress update, blocker, completion)
- **Timestamp Addition**: Optional automatic timestamping
- **Format Preservation**: Maintain markdown formatting
- **Content Validation**: Basic markdown syntax checking

### Response Structure
```typescript
{
  taskId: string,
  operation: string,
  field: string,
  content: {
    implementationNotes?: string,
    implementationPlan?: string
  },
  wordCount: number,
  lastUpdated: string,
  success: boolean
}
```

## Use Cases for Agents
- **Progress Tracking**: Regular updates on implementation progress
- **Blocker Documentation**: Record obstacles and resolution approaches
- **Plan Refinement**: Update implementation approach as understanding grows
- **Knowledge Capture**: Document discoveries and lessons learned
- **Handoff Preparation**: Comprehensive notes for task transitions

### Common Templates
```markdown
# Progress Update Template
## Completed
- [List completed items]

## In Progress  
- [Current work items]

## Blockers
- [Any obstacles]

## Next Steps
- [Planned next actions]
```

## Core Integration
- Use existing task update mechanisms
- Preserve existing content when appending
- Maintain compatibility with CLI notes operations
- Support multi-line content and markdown

## Error Handling
- Validate task exists before note operations
- Handle content size limits gracefully
- Preserve content on partial failures
- Provide clear validation messages

## Testing Requirements
- Test all 4 operations (set, append, clear, get)
- Test both notes and plan field management
- Test content preservation and formatting
- Test large content handling
- Verify integration with task update workflow
- Test edge cases (empty content, special characters)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Can set and append to implementation notes and plans
- [ ] #2 Supports both individual field and combined operations
- [ ] #3 Preserves markdown formatting and content structure
- [ ] #4 Provides clear/get operations for content management
- [ ] #5 Handles large content efficiently
- [ ] #6 Integrates with existing task update mechanisms
- [ ] #7 Supports configurable separators for append operations
- [ ] #8 Comprehensive test coverage for all note operations
<!-- AC:END -->

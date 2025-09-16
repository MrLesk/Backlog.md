---
id: task-265.33
title: Add remaining MCP resources
status: To Do
assignee: []
created_date: '2025-09-16T17:26:52.992Z'
labels:
  - mcp
  - resources
  - data-access
  - enhancement
dependencies:
  - task-266
  - task-267
  - task-269
  - task-270
parent_task_id: task-265
priority: medium
---

## Description

Implement additional MCP resources to provide comprehensive read-only data access for drafts, documents, decisions, and enhanced project overview information.

## Overview
The MCP server currently has 3 data resources (tasks/list, board/state, project/statistics), but needs additional resources to match the expanded tool capabilities and provide complete data access for agents.

## Resources to Implement

### 1. backlog://drafts/list
- **Purpose**: List all draft tasks with filtering capabilities
- **Parameters**: status, assignee, labels, search, limit
- **Returns**: Filtered draft list with metadata
- **Format**: Similar to tasks/list but for draft items

### 2. backlog://docs/list
- **Purpose**: List all project documentation
- **Parameters**: category, tags, search, limit
- **Returns**: Document summaries with metadata
- **Content**: Title, ID, created date, tags, brief summary

### 3. backlog://decisions/list
- **Purpose**: List all decision records (ADRs)
- **Parameters**: status, tags, search, limit
- **Returns**: Decision summaries with metadata
- **Content**: Decision ID, title, status, date, tags, summary

### 4. backlog://project/overview
- **Purpose**: Enhanced project overview with comprehensive metrics
- **Parameters**: includeVelocity, includeTrends, timePeriod
- **Returns**: Complete project analysis and insights
- **Content**: Enhanced version of existing project/statistics with additional analytics

## Implementation Details

### File Structure
```
/src/mcp/resources/additional-resources.ts
/src/mcp/__tests__/unit/additional-resources.test.ts
```

### Resource Structure Pattern
```typescript
function createDraftsListResource(server: McpServer): McpResourceHandler {
  return {
    uri: "backlog://drafts/list",
    name: "Drafts List",
    description: "Filtered list of draft tasks with metadata",
    mimeType: "application/json",
    handler: async (uri: string): Promise<ReadResourceResult> => {
      // Implementation
    }
  };
}
```

### Query Parameter Handling
- Parse URL parameters for filtering
- Support multiple filter combinations
- Maintain consistency with existing patterns
- Handle invalid parameters gracefully

### Response Formats

#### Drafts List
```json
{
  "drafts": [...],
  "metadata": {
    "totalDrafts": number,
    "filters": {...}
  }
}
```

#### Docs List
```json
{
  "documents": [...],
  "metadata": {
    "totalDocs": number,
    "categories": [...],
    "filters": {...}
  }
}
```

#### Decisions List
```json
{
  "decisions": [...],
  "metadata": {
    "totalDecisions": number,
    "statusCounts": {...},
    "filters": {...}
  }
}
```

#### Project Overview
```json
{
  "overview": {
    "summary": {...},
    "metrics": {...},
    "insights": {...},
    "recommendations": [...]
  },
  "generatedAt": string
}
```

## Integration Points
- Use existing filesystem operations for data access
- Leverage filtering logic from tools
- Maintain consistency with existing resources
- Follow established error handling patterns

## Registration
- Add resources to main server registration
- Ensure resources are loaded in both CLI and stdio server
- Update resource listing functionality
- Verify accessibility via MCP protocol

## Performance Considerations
- Implement efficient filtering for large datasets
- Consider caching for frequently accessed data
- Optimize query performance for complex filters
- Handle large result sets appropriately

## Testing Requirements
- Test all 4 new resources individually
- Test filtering capabilities for each resource
- Test integration with existing resource system
- Test performance with various dataset sizes
- Verify proper error handling
- Test registration and accessibility via MCP

## Overview
The MCP server currently has 3 data resources (tasks/list, board/state, project/statistics), but needs additional resources to match the expanded tool capabilities and provide complete data access for agents.

## Resources to Implement

### 1. backlog://drafts/list
- **Purpose**: List all draft tasks with filtering capabilities
- **Parameters**: status, assignee, labels, search, limit
- **Returns**: Filtered draft list with metadata
- **Format**: Similar to tasks/list but for draft items

### 2. backlog://docs/list
- **Purpose**: List all project documentation
- **Parameters**: category, tags, search, limit
- **Returns**: Document summaries with metadata
- **Content**: Title, ID, created date, tags, brief summary

### 3. backlog://decisions/list
- **Purpose**: List all decision records (ADRs)
- **Parameters**: status, tags, search, limit
- **Returns**: Decision summaries with metadata
- **Content**: Decision ID, title, status, date, tags, summary

### 4. backlog://project/overview
- **Purpose**: Enhanced project overview with comprehensive metrics
- **Parameters**: includeVelocity, includeTrends, timePeriod
- **Returns**: Complete project analysis and insights
- **Content**: Enhanced version of existing project/statistics with additional analytics

## Implementation Details

### File Structure
```
/src/mcp/resources/additional-resources.ts
/src/mcp/__tests__/unit/additional-resources.test.ts
```

### Resource Structure Pattern
```typescript
function createDraftsListResource(server: McpServer): McpResourceHandler {
  return {
    uri: "backlog://drafts/list",
    name: "Drafts List",
    description: "Filtered list of draft tasks with metadata",
    mimeType: "application/json",
    handler: async (uri: string): Promise<ReadResourceResult> => {
      // Implementation
    }
  };
}
```

### Query Parameter Handling
- Parse URL parameters for filtering
- Support multiple filter combinations
- Maintain consistency with existing patterns
- Handle invalid parameters gracefully

### Response Formats

#### Drafts List
```json
{
  "drafts": [...],
  "metadata": {
    "totalDrafts": number,
    "filters": {...}
  }
}
```

#### Docs List
```json
{
  "documents": [...],
  "metadata": {
    "totalDocs": number,
    "categories": [...],
    "filters": {...}
  }
}
```

#### Decisions List
```json
{
  "decisions": [...],
  "metadata": {
    "totalDecisions": number,
    "statusCounts": {...},
    "filters": {...}
  }
}
```

#### Project Overview
```json
{
  "overview": {
    "summary": {...},
    "metrics": {...},
    "insights": {...},
    "recommendations": [...]
  },
  "generatedAt": string
}
```

## Integration Points
- Use existing filesystem operations for data access
- Leverage filtering logic from tools
- Maintain consistency with existing resources
- Follow established error handling patterns

## Registration
- Add resources to main server registration
- Ensure resources are loaded in both CLI and stdio server
- Update resource listing functionality
- Verify accessibility via MCP protocol

## Performance Considerations
- Implement efficient filtering for large datasets
- Consider caching for frequently accessed data
- Optimize query performance for complex filters
- Handle large result sets appropriately

## Testing Requirements
- Test all 4 new resources individually
- Test filtering capabilities for each resource
- Test integration with existing resource system
- Test performance with various dataset sizes
- Verify proper error handling
- Test registration and accessibility via MCP

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 4 new resources (drafts/list, docs/list, decisions/list, project/overview) are accessible
- [ ] #2 Resources support filtering similar to existing patterns
- [ ] #3 Proper integration with main server registration
- [ ] #4 Consistent response formats across all resources
- [ ] #5 Performance optimized for various dataset sizes
- [ ] #6 Comprehensive test coverage for all resources
- [ ] #7 Resources appear in resources/list response
- [ ] #8 Error handling follows established patterns
<!-- AC:END -->

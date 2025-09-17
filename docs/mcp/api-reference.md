# MCP API Reference

Complete reference for all tools, resources, and prompts available in the Backlog.md MCP server.

## Tools

### Task Management

#### `task_create`

Create a new task in the backlog with optional metadata.

**Parameters:**
```json
{
  "title": "string (required, max 200 chars)",
  "description": "string (optional, max 10000 chars)",
  "labels": ["string (optional, max 50 chars each)"],
  "assignee": ["string (optional, max 100 chars each)"],
  "priority": "high|medium|low (optional)",
  "status": "string (optional, max 100 chars)",
  "parentTaskId": "string (optional, max 50 chars)",
  "acceptanceCriteria": ["string (optional, max 500 chars each)"],
  "dependencies": ["string (optional, max 50 chars each)"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Task title",
    "status": "To Do",
    "createdDate": "2025-09-15T10:30:00Z",
    "filePath": "backlog/tasks/task-123.md"
  }
}
```

**Example:**
```javascript
{
  "title": "Implement OAuth2 authentication",
  "description": "Add OAuth2 support for Google and GitHub login",
  "priority": "high",
  "labels": ["backend", "security", "authentication"],
  "assignee": ["john.doe"],
  "acceptanceCriteria": [
    "Users can login with Google account",
    "Users can login with GitHub account",
    "OAuth tokens are stored securely",
    "Existing users can link OAuth accounts"
  ]
}
```

#### `task_update`

Update an existing task's properties.

**Parameters:**
```json
{
  "id": "string (required, max 50 chars)",
  "title": "string (optional, max 200 chars)",
  "description": "string (optional, max 10000 chars)",
  "labels": ["string (optional)"],
  "assignee": ["string (optional)"],
  "priority": "high|medium|low (optional)",
  "status": "string (optional)",
  "acceptanceCriteria": ["string (optional)"],
  "dependencies": ["string (optional)"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Updated title",
    "updatedDate": "2025-09-15T11:30:00Z"
  }
}
```

#### `task_list`

List tasks with optional filtering.

**Parameters:**
```json
{
  "status": "string (optional, filter by status)",
  "assignee": "string (optional, filter by assignee)",
  "labels": ["string (optional, filter by labels)"],
  "search": "string (optional, search in title/description)",
  "limit": "number (optional, 1-1000, default: 50)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-123",
        "title": "Task title",
        "status": "To Do",
        "assignee": ["john.doe"],
        "labels": ["backend"],
        "priority": "high",
        "createdDate": "2025-09-15T10:30:00Z"
      }
    ],
    "total": 1,
    "filtered": 1
  }
}
```

#### `task_view`

Get detailed information about a specific task.

**Parameters:**
```json
{
  "id": "string (required, task ID)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Complete task title",
    "description": "Full task description...",
    "status": "To Do",
    "assignee": ["john.doe"],
    "labels": ["backend", "security"],
    "priority": "high",
    "createdDate": "2025-09-15T10:30:00Z",
    "updatedDate": "2025-09-15T11:30:00Z",
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
    "dependencies": ["task-456"],
    "parentTaskId": "task-789"
  }
}
```

#### `task_delete`

Archive or delete a task.

**Parameters:**
```json
{
  "id": "string (required, task ID)",
  "permanent": "boolean (optional, default: false)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "action": "archived",
    "timestamp": "2025-09-15T12:00:00Z"
  }
}
```

### Board Management

#### `board_view`

Get the current kanban board state.

**Parameters:**
```json
{
  "includeMetadata": "boolean (optional, default: true)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "board": {
      "To Do": [
        {
          "id": "task-123",
          "title": "Task title",
          "assignee": ["john.doe"],
          "priority": "high"
        }
      ],
      "In Progress": [],
      "Done": []
    },
    "metadata": {
      "totalTasks": 1,
      "completionRate": 0.0,
      "statusCounts": {
        "To Do": 1,
        "In Progress": 0,
        "Done": 0
      },
      "lastUpdated": "2025-09-15T12:00:00Z"
    }
  }
}
```

#### `board_create`

Create a new board configuration.

**Parameters:**
```json
{
  "name": "string (required, max 100 chars)",
  "description": "string (optional, max 500 chars)",
  "columns": ["string (required, status names)"],
  "defaultColumn": "string (optional, default status)"
}
```

#### `board_update`

Update board configuration.

**Parameters:**
```json
{
  "id": "string (required, board ID)",
  "name": "string (optional)",
  "description": "string (optional)",
  "columns": ["string (optional)"],
  "defaultColumn": "string (optional)"
}
```

#### `board_list`

List all available boards.

**Parameters:**
```json
{}
```

### Configuration Management

#### `config_get`

Retrieve configuration values.

**Parameters:**
```json
{
  "key": "string (optional, specific config key)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "defaultAssignee": "john.doe",
    "defaultLabels": ["feature"],
    "mcp": {
      "enabled": true,
      "rateLimiting": {
        "maxRequestsPerMinute": 100
      }
    }
  }
}
```

#### `config_set`

Update configuration values.

**Parameters:**
```json
{
  "key": "string (required, config key)",
  "value": "any (required, config value)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "defaultAssignee",
    "value": "jane.doe",
    "previousValue": "john.doe"
  }
}
```

#### `config_list`

List all available configuration options.

**Parameters:**
```json
{}
```

### Decision Management

#### `decision_create`

Create a new Architecture Decision Record (ADR) with structured content and frontmatter.

**Parameters:**
```json
{
  "title": "string (required, max 200 chars)",
  "context": "string (optional, max 10000 chars)",
  "decision": "string (optional, max 10000 chars)",
  "consequences": "string (optional, max 10000 chars)",
  "alternatives": "string (optional, max 10000 chars)",
  "status": "proposed|accepted|rejected|superseded (optional, default: proposed)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "decision-001",
    "title": "Use PostgreSQL for primary database",
    "filePath": "/decisions/decision-001 - use-postgresql-for-primary-database.md"
  }
}
```

**Example:**
```json
{
  "title": "Adopt TypeScript for Frontend Development",
  "context": "We need better type safety and IDE support for our growing frontend codebase",
  "decision": "Migrate all JavaScript files to TypeScript over the next sprint",
  "consequences": "Better developer experience, compile-time error catching, but requires team training",
  "alternatives": "Flow type checker was considered but has less community support",
  "status": "accepted"
}
```

### Sequence Management

#### `sequence_start`

Begin a new task sequence.

**Parameters:**
```json
{
  "name": "string (required, sequence name)",
  "tasks": ["string (required, task IDs)"],
  "description": "string (optional)"
}
```

#### `sequence_continue`

Progress to the next task in a sequence.

**Parameters:**
```json
{
  "sequenceId": "string (required, sequence ID)",
  "currentTaskId": "string (required, current task ID)"
}
```

#### `sequence_complete`

Mark a sequence as completed.

**Parameters:**
```json
{
  "sequenceId": "string (required, sequence ID)"
}
```

## Resources

Resources provide read-only access to project data.

### Task Resources

#### `task/{id}`

Get individual task details in JSON format.

**URI Pattern:** `task/123` or `task/123.01` (for sub-tasks)

**Response:**
```json
{
  "contents": [{
    "uri": "task/123",
    "mimeType": "application/json",
    "text": "{\"id\":\"task-123\",\"title\":\"...\",\"status\":\"...\"}"
  }]
}
```

#### `tasks/status/{status}`

Get all tasks with a specific status.

**URI Pattern:** `tasks/status/To Do`

#### `tasks/assignee/{assignee}`

Get all tasks assigned to a specific person.

**URI Pattern:** `tasks/assignee/john.doe`

### Board Resources

#### `board/current`

Get current active board state with task distribution.

**Response includes:**
- Tasks organized by status columns
- Task counts per status
- Completion metrics
- Board metadata

#### `board/{id}`

Get specific board configuration.

**URI Pattern:** `board/default`

#### `boards/list`

Get all available boards.

### Configuration Resources

#### `config/current`

Get complete project configuration.

#### `config/section/{section}`

Get specific configuration section.

**URI Pattern:** `config/section/mcp`

## Prompts

Workflow templates that provide guided assistance.

### `task_creation_workflow`

Guided task creation with context gathering and structured output.

**Arguments:**
```json
{
  "projectContext": "string (optional, current project state)",
  "userRequirement": "string (required, requirement description)"
}
```

**Usage:**
```
Use the task creation workflow to analyze this requirement:
"Users need to be able to export their data in PDF format"
```

### `sprint_planning`

Sprint planning assistance with capacity management.

**Arguments:**
```json
{
  "boardState": "string (optional, current board state)",
  "capacity": "string (optional, team capacity)",
  "priorities": "string (optional, priority guidance)"
}
```

**Usage:**
```
Help me plan a 2-week sprint with the sprint planning workflow.
We have 3 developers available for 40 hours each.
```

### `code_review_integration`

Code review workflow integration.

**Arguments:**
```json
{
  "taskId": "string (optional, related task ID)",
  "prUrl": "string (optional, pull request URL)",
  "changes": "string (optional, description of changes)"
}
```

### `daily_standup`

Generate standup reports and updates.

**Arguments:**
```json
{
  "date": "string (optional, specific date)",
  "assignee": "string (optional, specific team member)"
}
```

## Error Handling

All tools return structured error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed: Required field 'title' is missing",
    "details": {
      "field": "title",
      "value": null,
      "constraint": "required"
    },
    "timestamp": "2025-09-15T12:00:00Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Requested resource not found
- `PERMISSION_DENIED` - Insufficient permissions
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Rate Limiting

Default limits (configurable):
- 100 requests per minute per client
- 1000 requests per hour per client
- Burst limit: 10 requests per second

Rate limit headers are included in HTTP responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Validation

All tool inputs are validated against JSON schemas:

- **String lengths**: Enforced as specified
- **Required fields**: Must be present and non-null
- **Enum values**: Must match allowed options
- **Array items**: Each item validated individually
- **Date formats**: ISO 8601 format required

Invalid inputs return `VALIDATION_ERROR` with specific field information.
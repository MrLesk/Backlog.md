# API Reference

The Backlog.md web server provides a RESTful API for managing tasks, boards, and configuration.

## Base URL

When running locally: `http://localhost:3000/api`

## Authentication

No authentication is required. The API is designed for local use.

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* Response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* Additional error details */ }
  }
}
```

## Endpoints

### Health Check

Check if the server is running.

**GET** `/health`

#### Response
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-06-24T10:30:00.000Z",
    "server": "Backlog.md HTTP Server"
  }
}
```

---

### Tasks

#### List Tasks

Retrieve all tasks with optional filtering.

**GET** `/api/tasks`

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by task status | `?status=To Do` |
| `assignee` | string | Filter by assignee | `?assignee=@alice` |
| `labels` | string | Filter by labels (comma-separated) | `?labels=bug,urgent` |

#### Example Request
```bash
curl "http://localhost:3000/api/tasks?status=To Do&assignee=@alice"
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "task-1",
      "title": "Fix login bug",
      "description": "Users can't log in with special characters",
      "status": "To Do",
      "assignee": ["@alice"],
      "labels": ["bug", "urgent"],
      "createdDate": "2024-06-24",
      "updatedDate": "2024-06-24",
      "priority": "high",
      "dependencies": []
    }
  ]
}
```

#### Get Single Task

Retrieve a specific task by ID.

**GET** `/api/tasks/{taskId}`

#### Example Request
```bash
curl "http://localhost:3000/api/tasks/task-1"
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task-1",
    "title": "Fix login bug",
    "description": "Users can't log in with special characters",
    "status": "To Do",
    "assignee": ["@alice"],
    "labels": ["bug", "urgent"],
    "createdDate": "2024-06-24",
    "updatedDate": "2024-06-24",
    "priority": "high",
    "dependencies": []
  }
}
```

#### Create Task

Create a new task.

**POST** `/api/tasks`

#### Request Body
```json
{
  "title": "Implement OAuth",
  "description": "Add OAuth authentication system",
  "status": "To Do",
  "assignee": ["@bob"],
  "labels": ["feature", "auth"],
  "priority": "medium"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task-42",
    "title": "Implement OAuth",
    "description": "Add OAuth authentication system",
    "status": "To Do",
    "assignee": ["@bob"],
    "labels": ["feature", "auth"],
    "createdDate": "2024-06-24",
    "priority": "medium",
    "dependencies": []
  }
}
```

#### Update Task

Update an existing task.

**PUT** `/api/tasks/{taskId}`

#### Request Body
```json
{
  "status": "In Progress",
  "assignee": ["@charlie"]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task-1",
    "title": "Fix login bug",
    "description": "Users can't log in with special characters",
    "status": "In Progress",
    "assignee": ["@charlie"],
    "labels": ["bug", "urgent"],
    "createdDate": "2024-06-24",
    "updatedDate": "2024-06-24",
    "priority": "high",
    "dependencies": []
  }
}
```

#### Archive Task

Archive (soft delete) a task.

**DELETE** `/api/tasks/{taskId}`

#### Response
```json
{
  "success": true,
  "data": {
    "taskId": "task-1",
    "archived": true
  }
}
```

---

### Board

#### Get Board Data

Retrieve board data including tasks and status columns.

**GET** `/api/board`

#### Response
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-1",
        "title": "Fix login bug",
        "status": "To Do",
        /* ... other task properties */
      }
    ],
    "statuses": ["To Do", "In Progress", "Done"]
  }
}
```

---

### Drafts

#### List Drafts

Retrieve all draft tasks.

**GET** `/api/drafts`

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "task-100",
      "title": "Draft task",
      "description": "This is a draft task",
      "status": "",
      "assignee": [],
      "labels": [],
      "createdDate": "2024-06-24"
    }
  ]
}
```

#### Promote Draft

Promote a draft to an active task.

**POST** `/api/drafts/{draftId}/promote`

#### Response
```json
{
  "success": true,
  "data": {
    "id": "task-100",
    "title": "Draft task",
    "description": "This is a draft task",
    "status": "To Do",
    "assignee": [],
    "labels": [],
    "createdDate": "2024-06-24"
  }
}
```

---

### Configuration

#### Get Configuration

Retrieve project configuration.

**GET** `/api/config`

#### Response
```json
{
  "success": true,
  "data": {
    "statuses": ["To Do", "In Progress", "Done"],
    "defaultStatus": "To Do",
    "defaultAssignee": "",
    "dateFormat": "yyyy-mm-dd",
    "maxColumnWidth": 30
  }
}
```

#### Update Configuration

Update project configuration.

**PUT** `/api/config`

#### Request Body
```json
{
  "statuses": ["Backlog", "In Progress", "Review", "Done"],
  "defaultStatus": "Backlog"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "statuses": ["Backlog", "In Progress", "Review", "Done"],
    "defaultStatus": "Backlog",
    "defaultAssignee": "",
    "dateFormat": "yyyy-mm-dd",
    "maxColumnWidth": 30
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `TASK_NOT_FOUND` | Task with specified ID not found |
| `DRAFT_NOT_FOUND` | Draft with specified ID not found |
| `INVALID_INPUT` | Request validation failed |
| `INTERNAL_ERROR` | Server internal error |
| `PROMOTION_FAILED` | Failed to promote draft to task |

## HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Created successfully |
| `400` | Bad request (validation error) |
| `404` | Resource not found |
| `422` | Unprocessable entity (validation error) |
| `500` | Internal server error |

## Example Usage

### JavaScript/TypeScript

```typescript
// Fetch all tasks
async function getTasks() {
  const response = await fetch('http://localhost:3000/api/tasks');
  const result = await response.json();
  
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error.message);
  }
}

// Create a new task
async function createTask(taskData) {
  const response = await fetch('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });
  
  const result = await response.json();
  
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error.message);
  }
}

// Update task status
async function updateTaskStatus(taskId, status) {
  const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error.message);
  }
}
```

### cURL Examples

```bash
# List all tasks
curl "http://localhost:3000/api/tasks"

# Get specific task
curl "http://localhost:3000/api/tasks/task-1"

# Create new task
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "description": "Task description",
    "status": "To Do"
  }'

# Update task
curl -X PUT "http://localhost:3000/api/tasks/task-1" \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress"}'

# Archive task
curl -X DELETE "http://localhost:3000/api/tasks/task-1"
```

### Python

```python
import requests

BASE_URL = "http://localhost:3000/api"

def get_tasks():
    response = requests.get(f"{BASE_URL}/tasks")
    result = response.json()
    
    if result["success"]:
        return result["data"]
    else:
        raise Exception(result["error"]["message"])

def create_task(task_data):
    response = requests.post(
        f"{BASE_URL}/tasks",
        json=task_data
    )
    result = response.json()
    
    if result["success"]:
        return result["data"]
    else:
        raise Exception(result["error"]["message"])
```

## Rate Limiting

Currently, there are no rate limits implemented. This may change in future versions.

## Versioning

The API is currently unversioned. Breaking changes will be clearly documented in release notes.

## CORS

CORS is configured to allow requests from any origin for local development. In production deployments, configure CORS appropriately for your use case.
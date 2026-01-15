---
id: BACK-100.2
title: Create HTTP server module
status: Done
assignee: []
created_date: '2025-06-22'
updated_date: '2025-07-05'
labels: []
dependencies:
  - task-100.1
parent_task_id: task-100
---

## Description

Implement Bun HTTP server that serves API and static files. This server will be embedded in the CLI executable and serve both the React frontend and API endpoints.

## Implementation Details

### Server Architecture

The server module will use Bun's native `Bun.serve()` API to create a high-performance HTTP server. It will handle:

1. **Static File Serving**: Serve the bundled React app from memory
2. **API Routes**: RESTful endpoints for task operations
3. **Single Origin**: Serve both frontend and API from the same localhost origin

### Server Module Requirements

**Core Functionality:**

- Create a `BacklogServer` class in `src/server/index.ts`
- Accept configuration options: port, host, development mode
- Integrate with existing Core class for task operations
- Provide start/stop lifecycle methods

**Request Routing:**

- Handle API routes under `/api/*` prefix
- Serve static files for all other routes
- Support health check endpoint for monitoring

**Port Management:**

- Start with user-specified port
- Automatically find alternative port if requested port is busy
- Try up to 10 sequential ports before failing
- Notify caller of actual port used

### Static Asset Requirements

**Production Asset Serving:**

- Serve HTML, CSS, and JS files from memory (embedded in executable)
- Handle proper MIME types for different file extensions
- Implement appropriate caching headers for performance
- Support SPA routing (serve index.html for non-API routes)

### Port Failover Requirements

**Behavior:**

- Start with user-specified port (e.g., 3000)
- Try sequential ports (3001, 3002, etc.) if original port is busy
- Attempt up to 10 ports before failing
- Notify caller of actual port used
- Show clear messaging when port differs from requested

### Error Handling Requirements

- Return proper HTTP status codes for different scenarios
- Provide clear JSON error responses with helpful messages
- Handle file system errors gracefully
- Validate and sanitize all incoming requests
- Implement clear error messaging for port conflicts

## Acceptance Criteria

- [x] Server module created at src/server/index.ts
- [x] Server can be started on configurable port
- [x] Port failover automatically finds available port if requested port is busy
- [x] User is notified of actual port when different from requested port
- [x] Serves static files from memory
- [x] Handles both API routes and static files from single origin
- [x] Basic health check endpoint works
- [x] Graceful error handling when no ports are available

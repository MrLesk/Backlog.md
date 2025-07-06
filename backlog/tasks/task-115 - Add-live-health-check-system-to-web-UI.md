---
id: task-115
title: Add live health check system to web UI
status: To Do
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-06'
labels: []
dependencies: []
---

## Description

Implement periodic health checks that ping the server and show modern UI notifications (banner/toast/overlay) when connection is lost or restored. Should detect API failures and provide user feedback about server status.

## Acceptance Criteria

- [ ] Add periodic health check endpoint (`/api/health`) to server
- [ ] Implement client-side health monitoring with regular pings
- [ ] Show visual indicator (banner/toast) when connection is lost
- [ ] Show success notification when connection is restored
- [ ] Handle API failures gracefully with user-friendly error messages
- [ ] Allow users to manually retry connection
- [ ] Persist health status across page refreshes

## Implementation Plan

1. Add health check endpoint (/api/health) to the web server
2. Implement client-side health monitoring with periodic pings
3. Create visual indicator components (banner/toast) for connection status
4. Add connection status state management in React
5. Implement retry functionality and error handling
6. Persist health status across page refreshes using localStorage
7. Test health check functionality with server disconnection scenarios

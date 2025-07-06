---
id: task-115
title: Add live health check system to web UI
status: To Do
assignee: []
created_date: '2025-07-06'
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

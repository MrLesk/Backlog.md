---
id: BACK-115
title: Add live health check system to web UI
status: Done
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-07'
labels: []
dependencies: []
---

## Description

Implement periodic health checks that ping the server and show modern UI notifications (banner/toast/overlay) when connection is lost or restored. Should detect API failures and provide user feedback about server status.

## Acceptance Criteria

- [x] Add periodic health check endpoint (`/api/health`) to server
- [x] Implement client-side health monitoring with regular pings
- [x] Show visual indicator (banner/toast) when connection is lost
- [x] Show success notification when connection is restored
- [x] Handle API failures gracefully with user-friendly error messages
- [x] Allow users to manually retry connection
- [x] Persist health status across page refreshes

## Implementation Plan

1. Add health check endpoint (/api/health) to the web server
2. Implement client-side health monitoring with periodic pings
3. Create visual indicator components (banner/toast) for connection status
4. Add connection status state management in React
5. Implement retry functionality and error handling
6. Persist health status across page refreshes using localStorage
7. Test health check functionality with server disconnection scenarios

## Implementation Notes

Successfully implemented a comprehensive live health check system for the web UI.

## Approach taken
- Added `/api/health` endpoint to the server with filesystem and config checks
- Created custom React hook `useHealthCheck` for managing health monitoring state
- Implemented visual indicator components with modern UI design
- Added persistence layer using localStorage for cross-session health status
- Integrated health monitoring seamlessly into the main App component

## Features implemented
- **Health Check Endpoint**: Returns detailed health status including response time and system checks
- **Periodic Monitoring**: Automatic health checks every 30 seconds with configurable intervals
- **Visual Indicators**: Red banner for connection loss, green toast for restoration
- **Manual Retry**: Users can manually retry connection when offline
- **Error Handling**: Graceful handling of API failures with user-friendly messages
- **Persistence**: Health status persists across page refreshes using localStorage
- **Consecutive Failures**: Tracks multiple connection attempts for better user feedback

## Technical decisions
- Used 30-second intervals for health checks to balance responsiveness with server load
- Implemented server health checks for filesystem and config accessibility
- Used React hooks pattern for clean state management and reusability
- Added CSS animations for smooth toast notifications
- Persisted only essential state (isOnline, lastCheck, consecutiveFailures) to localStorage
- Made health indicators non-intrusive - only show when there are issues

## Modified files
- src/server/index.ts - Added /api/health endpoint with system checks
- src/web/lib/api.ts - Added checkHealth method to ApiClient
- src/web/hooks/useHealthCheck.tsx - Custom hook for health monitoring state
- src/web/components/HealthIndicator.tsx - UI components for health status
- src/web/styles/globals.css - Added slide-in animation for toasts  
- src/web/App.tsx - Integrated health monitoring into main application

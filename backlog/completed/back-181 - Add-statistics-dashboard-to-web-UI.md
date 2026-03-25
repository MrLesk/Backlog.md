---
id: BACK-181
title: Add statistics dashboard to web UI
status: Done
assignee: []
created_date: '2025-07-12'
updated_date: '2025-08-03 17:20'
labels: []
dependencies:
  - task-180
priority: medium
---

## Description

Create a Statistics/Dashboard page in the web UI that displays project overview, task statistics, priority breakdowns, and activity metrics in a visual dashboard format with charts and interactive elements.

## Acceptance Criteria

- [x] Add Statistics/Dashboard page route to web UI
- [x] Create /api/statistics endpoint for project metrics
- [x] Display status distribution with visual charts
- [x] Show priority breakdown with color-coded sections
- [x] Include completion percentage and progress indicators
- [x] Display recent activity timeline
- [x] Add interactive charts and data visualizations
- [x] Show project health metrics and trends
- [x] Include export functionality for statistics
- [x] Add navigation link in side menu
- [x] Use responsive design for mobile and desktop
- [x] Handle loading states and empty project gracefully

## Implementation Notes

### What's New
- Added `/api/statistics` endpoint that reuses CLI logic
- Created `Statistics.tsx` dashboard component with interactive elements
- Added navigation link with trending-up icon
- Tasks in recent activity and project health are clickable to open edit popup

### Key Features
- **Metrics**: Total/completed tasks, completion %, drafts count
- **Visualizations**: Progress bar, status/priority distributions with mini charts
- **Recent Activity**: Clickable recently created/updated tasks
- **Project Health**: Compact summary with avg age, stale/blocked task indicators
- **Loading**: Realistic progress messages (2s intervals) matching CLI experience

### Technical Implementation
- **Shared Logic**: `Core.loadAllTasksForStatistics()` eliminates CLI/web duplication
- **Data Consistency**: Same task loading, cross-branch checking, conflict resolution as CLI
- **Performance**: Single API call with parallel processing
- **UX**: Responsive design, dark/light theme support, proper error handling

### Files Changed
- `src/server/index.ts` - API endpoint
- `src/web/components/Statistics.tsx` - main dashboard
- `src/core/backlog.ts` - shared statistics loading logic
- `src/commands/overview.ts` - refactored to use shared logic

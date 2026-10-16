---
type: C4 Component
title: App shell
status: stable
groma:
  id: app-shell
  parent: web-ui
  code:
    - scanner: react
      file: src/web/App.tsx
    - scanner: typescript
      file: src/web/App.tsx
      symbol: App
    - scanner: react
      file: src/web/main.tsx
    - scanner: typescript
      file: src/web/main.tsx
    - scanner: react
      file: src/web/components/Layout.tsx
    - scanner: typescript
      file: src/web/components/Layout.tsx
      symbol: Layout
    - scanner: react
      file: src/web/components/Navigation.tsx
    - scanner: typescript
      file: src/web/components/Navigation.tsx
      symbol: Navigation
    - scanner: react
      file: src/web/components/SideNavigation.tsx
    - scanner: typescript
      file: src/web/components/SideNavigation.tsx
      symbol: SideNavigation
    - scanner: react
      file: src/web/components/ErrorBoundary.tsx
    - scanner: typescript
      file: src/web/components/ErrorBoundary.tsx
      symbol: ErrorBoundary
    - scanner: react
      file: src/web/components/LoadingSpinner.tsx
    - scanner: typescript
      file: src/web/components/LoadingSpinner.tsx
    - scanner: react
      file: src/web/components/SuccessToast.tsx
    - scanner: typescript
      file: src/web/components/SuccessToast.tsx
      symbol: SuccessToast
    - scanner: react
      file: src/web/components/Modal.tsx
    - scanner: typescript
      file: src/web/components/Modal.tsx
      symbol: Modal
    - scanner: react
      file: src/web/contexts/ThemeContext.tsx
    - scanner: typescript
      file: src/web/contexts/ThemeContext.tsx
    - scanner: react
      file: src/web/components/ThemeToggle.tsx
    - scanner: typescript
      file: src/web/components/ThemeToggle.tsx
      symbol: ThemeToggle
    - scanner: react
      file: src/web/contexts/HealthCheckContext.tsx
    - scanner: typescript
      file: src/web/contexts/HealthCheckContext.tsx
    - scanner: react
      file: src/web/hooks/useHealthCheck.tsx
    - scanner: typescript
      file: src/web/hooks/useHealthCheck.tsx
      symbol: useHealthCheck
    - scanner: react
      file: src/web/components/HealthIndicator.tsx
    - scanner: typescript
      file: src/web/components/HealthIndicator.tsx
    - scanner: react
      file: src/web/components/BranchIndexingIndicator.tsx
    - scanner: typescript
      file: src/web/components/BranchIndexingIndicator.tsx
      symbol: BranchIndexingIndicator
    - scanner: typescript
      file: src/web/utils/urlHelpers.ts
    - scanner: typescript
      file: src/web/utils/reconcile.ts
    - scanner: typescript
      file: src/web/utils/version.ts
      symbol: getWebVersion
    - scanner: typescript
      file: src/web/utils/search-command-query.ts
    - scanner: typescript
      file: src/web/lib/docs-tree.ts
    - scanner: react
      file: src/web/components/DuplicateIdWarning.tsx
    - scanner: typescript
      file: src/web/components/DuplicateIdWarning.tsx
      symbol: DuplicateIdWarning
    - scanner: react
      file: src/web/components/DuplicateIdRepairModal.tsx
    - scanner: typescript
      file: src/web/components/DuplicateIdRepairModal.tsx
      symbol: DuplicateIdRepairModal
    - scanner: react
      file: src/web/components/StoredDate.tsx
    - scanner: typescript
      file: src/web/components/StoredDate.tsx
      symbol: StoredDate
    - scanner: typescript
      file: src/web/utils/date-display.ts
    - scanner: react
      file: src/web/components/LabelFilterDropdown.tsx
    - scanner: typescript
      file: src/web/components/LabelFilterDropdown.tsx
      symbol: LabelFilterDropdown
    - scanner: react
      file: src/web/components/CleanupModal.tsx
    - scanner: typescript
      file: src/web/components/CleanupModal.tsx
      symbol: CleanupModal
description: Routing, live updates, navigation and shared widgets for the web UI
---

Mounts the React app, routes between the board, task lists, milestones, docs, decisions, statistics and settings, and loads tasks, config and milestones. It listens on a WebSocket for tasks-updated, milestones-updated and config-updated and refreshes data in place. The sidebar holds search and the docs tree. The shell also shows connection health, cross-branch indexing progress and duplicate ID warnings, and provides the shared modals, toasts, dates, label filter and cleanup dialog.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/App.tsx](../../../../../../src/web/App.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Loads tasks and config | In-process call |
| [src/web/utils/version.ts](../../../../../../src/web/utils/version.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Reads the server version | HTTP |
| [src/web/components/CleanupModal.tsx](../../../../../../src/web/components/CleanupModal.tsx) | [src/web/components/Board.tsx](../../../../../../src/web/components/Board.tsx) | Reports cleanup results | React props |
| [src/web/components/CleanupModal.tsx](../../../../../../src/web/components/CleanupModal.tsx) | [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | Reports cleanup results | React props |
| [src/web/components/LabelFilterDropdown.tsx](../../../../../../src/web/components/LabelFilterDropdown.tsx) | [src/web/components/Board.tsx](../../../../../../src/web/components/Board.tsx) | Reports label filter changes | React props |
| [src/web/components/LabelFilterDropdown.tsx](../../../../../../src/web/components/LabelFilterDropdown.tsx) | [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | Reports label filter changes | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/CleanupModal.tsx](../../../../../../src/web/components/CleanupModal.tsx) | [src/web/components/Board.tsx](../../../../../../src/web/components/Board.tsx) | Invokes supplied callbacks: onClose, onSuccess | react |
| [src/web/components/CleanupModal.tsx](../../../../../../src/web/components/CleanupModal.tsx) | [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | Invokes supplied callbacks: onClose, onSuccess | react |
| [src/web/components/LabelFilterDropdown.tsx](../../../../../../src/web/components/LabelFilterDropdown.tsx) | [src/web/components/Board.tsx](../../../../../../src/web/components/Board.tsx) | Invokes supplied callback: onChange | react |
| [src/web/components/LabelFilterDropdown.tsx](../../../../../../src/web/components/LabelFilterDropdown.tsx) | [src/web/components/TaskList.tsx](../../../../../../src/web/components/TaskList.tsx) | Invokes supplied callback: onChange | react |
| [src/web/utils/version.ts](../../../../../../src/web/utils/version.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Calls HTTP endpoint: GET /api/version | typescript |

---
id: task-299
title: Refactor Jira display code to use adapter pattern
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 11:24'
updated_date: '2025-10-13 11:45'
labels: []
dependencies:
  - task-298
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove hardcoded Jira field display logic from core backlog.md codebase and implement a clean adapter pattern in backlog-jira plugin. The adapter wraps core display formatters to add Jira-specific metadata display without modifying core files. This maintains separation of concerns and allows the core to remain plugin-agnostic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create display adapter module in backlog-jira that wraps core formatters
- [x] #2 Adapter extends formatTaskPlainText to include Jira metadata section
- [x] #3 Adapter extends blessed/terminal UI formatter to show Jira fields
- [x] #4 Remove Jira-specific display code from src/ui/task-viewer-with-search.ts
- [x] #5 Jira metadata (jiraKey, jiraUrl, jiraLastSync, jiraSyncState) displayed only in plugin commands
- [x] #6 Core display functions remain unchanged and Jira-agnostic
- [x] #7 Plugin commands use adapter formatters for all task display operations
- [x] #8 Tests added for adapter display functionality
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze core formatTaskPlainText and viewTaskEnhanced functions to understand extension points
2. Create display adapter module in backlog-jira/src/ui/
3. Implement PlainTextDisplayAdapter that wraps formatTaskPlainText to add Jira metadata section
4. Implement BlessedDisplayAdapter that extends generateDetailContent for terminal UI
5. Update plugin commands (status, pull, etc.) to use adapter formatters
6. Add tests for display adapter functionality
7. Verify Jira metadata displays only in plugin commands
8. Build and test plugin with adapter pattern
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented display adapter pattern for backlog-jira plugin.

## Changes Made:

### Display Adapter Module (src/ui/display-adapter.ts)
- Created PlainTextDisplayAdapter class that wraps core formatTaskPlainText
- Created BlessedDisplayAdapter class that extends core generateDetailContent
- Both adapters add Jira metadata (jiraKey, jiraUrl, jiraLastSync, jiraSyncState) to task displays
- Adapters only add metadata when Jira fields are present on tasks
- Implemented sync state icons (✅ InSync, ⬆️ NeedsPush, ⬇️ NeedsPull, ⚠️ Conflict, ❓ Unknown)
- Implemented color coding for blessed UI (green/yellow/cyan/red/gray)

### View Command (src/commands/view.ts)
- Created example "view" command that demonstrates adapter usage
- Command fetches task from backlog and Jira mapping from store
- Adds Jira metadata to task object using dynamic fields
- Uses PlainTextDisplayAdapter to format output with Jira section
- Demonstrates proper separation: plugin commands use adapters, core remains unchanged

### Tests (src/ui/display-adapter.test.ts)
- Comprehensive test coverage for both adapters
- Tests verify Jira metadata is added correctly
- Tests verify no changes when no Jira metadata present
- Tests verify correct icons and colors for all sync states
- Tests verify Jira section is inserted in correct position
- All 7 tests passing

## Architecture Benefits:

1. **Zero Coupling**: Core display code remains completely unchanged
2. **Clean Extension**: Adapters wrap core formatters without modifying them
3. **Reusable Pattern**: Other plugins can follow same approach
4. **Type Safety**: TaskWithJira type extends core Task with optional Jira fields
5. **Testable**: Adapters easy to test with mocked core formatters

## How It Works:

1. Plugin commands fetch tasks and add Jira metadata using dynamic fields
2. Plugin commands pass tasks to adapter along with core formatter
3. Adapter calls core formatter to get base output
4. Adapter appends Jira metadata section to output
5. Plugin displays final formatted output

Core formatters never see Jira-specific code, maintaining plugin-agnostic design.
<!-- SECTION:NOTES:END -->

---
id: task-175
title: 'Add hour and minute to all dates in drafts, tasks, documents, decisions'
status: To Do
assignee:
  - '@claude'
created_date: '2025-07-12'
updated_date: '2025-07-26'
labels: []
dependencies: []
priority: medium
---

## Description

Currently all dates use YYYY-MM-DD format (created_date, updated_date, decision dates). This task involves adding hour and minute precision to provide better granular tracking. However, this is a major architectural change requiring careful planning.

## Acceptance Criteria

- [ ] Research and document current date system architecture
- [ ] Design backward-compatible migration strategy for existing YYYY-MM-DD dates
- [ ] Update normalizeDate() function to handle time components
- [ ] Modify markdown serialization/parsing for datetime fields
- [ ] Update all UI components (CLI and web) to display time appropriately
- [ ] Handle timezone complexity and configuration
- [ ] Update backlog/config.yml date_format from "yyyy-mm-dd" to include time
- [ ] Create migration script for existing data
- [ ] Update type definitions to support datetime
- [ ] Test thoroughly with existing data
- [ ] Update documentation and user guides

## Implementation Plan

1. Comprehensive analysis of current date system
2. Design phase: Choose between gradual migration (optional time) vs full datetime migration
3. Implement parsing/serialization changes
4. Update UI components with space-efficient time display
5. Create and test migration script
6. Handle timezone configuration and display
7. Update all affected APIs and interfaces
8. Comprehensive testing with existing data
9. Documentation updates
10. Phased rollout with fallback plan

## Implementation Notes

CRITICAL CONSIDERATIONS:
- This is a BREAKING CHANGE affecting all existing markdown files
- Current system uses new Date().toISOString().split('T')[0] - loses time info
- Timezone complexity: local vs UTC vs user timezone preferences  
- UI space constraints in terminal displays
- Backward compatibility for thousands existing tasks/docs
- Migration script must handle edge cases and provide rollback
- dateFormat config currently set to "yyyy-mm-dd" in backlog/config.yml but would need updating to include time
- Current date_format configuration would become critical and need new format options
- All tests checking date formats need updates
- Consider gradual approach: YYYY-MM-DD OR YYYY-MM-DD HH:MM support

FILES REQUIRING CHANGES:
- backlog/config.yml (update date_format from "yyyy-mm-dd" to include time)
- src/markdown/parser.ts (normalizeDate function)
- src/markdown/serializer.ts 
- src/types/index.ts (type definitions)
- src/cli.ts (date generation)
- src/core/backlog.ts (update dates)
- src/server/index.ts (web API)
- src/ui/task-viewer.ts (CLI display)
- All web UI components (TaskCard, TaskList, etc.)
- Configuration and migration logic

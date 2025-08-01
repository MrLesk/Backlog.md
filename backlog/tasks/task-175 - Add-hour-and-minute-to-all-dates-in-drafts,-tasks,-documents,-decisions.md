---
id: task-175
title: 'Add hour and minute to all dates in drafts, tasks, documents, decisions'
status: Done
assignee:
  - '@claude'
created_date: '2025-07-12'
updated_date: '2025-08-01 18:55'
labels: []
dependencies: []
priority: medium
---

## Description

Currently all dates use YYYY-MM-DD format (created_date, updated_date, decision dates). This task involves adding hour and minute precision to provide better granular tracking. However, this is a major architectural change requiring careful planning.

## Acceptance Criteria

- [x] Research and document current date system architecture
- [x] Design backward-compatible migration strategy for existing YYYY-MM-DD dates
- [x] Update normalizeDate() function to handle time components
- [x] Modify markdown serialization/parsing for datetime fields
- [x] Update all UI components (CLI and web) to display time appropriately
- [x] Handle timezone complexity and configuration
- [x] Update backlog/config.yml date_format from "yyyy-mm-dd" to include time
- [x] Create migration script for existing data
- [x] Update type definitions to support datetime
- [x] Test thoroughly with existing data
- [x] Update documentation and user guides

## Implementation Plan

### Phase 1: Analysis and Design (COMPLETE)
1. **Current System Analysis**:
   - All dates use `new Date().toISOString().split('T')[0]` format (YYYY-MM-DD)
   - `normalizeDate()` function in parser.ts strips time information
   - Date fields: createdDate, updatedDate (tasks/docs), date (decisions)
   - UI displays dates via `formatDate()` using `toLocaleDateString()`
   - Config has `date_format: yyyy-mm-dd` but it's not actively used

2. **Design Decision**: Implement gradual migration with optional time
   - Support both `YYYY-MM-DD` and `YYYY-MM-DD HH:mm` formats
   - Default to UTC storage with local display
   - Make time component optional for backward compatibility
   - Add timezone config option for future enhancement

### Phase 2: Core Implementation
3. **Update Type Definitions** (src/types/index.ts):
   - Keep date fields as strings but document new format support
   - Add optional `timezonePreference?: string` to BacklogConfig

4. **Enhance normalizeDate() Function** (src/markdown/parser.ts):
   - Accept and preserve time components when present
   - Support parsing of `YYYY-MM-DD HH:mm` format
   - Maintain backward compatibility with date-only strings

5. **Update Date Generation** (7 locations found):
   - Change from `toISOString().split('T')[0]` to `toISOString().slice(0, 16).replace('T', ' ')`
   - This produces `YYYY-MM-DD HH:mm` format in UTC

### Phase 3: UI Updates
6. **CLI Display** (src/ui/task-viewer.ts):
   - Update date display to show time when present
   - Format: "2025-07-26" or "2025-07-26 14:30"
   - Keep display compact for terminal constraints

7. **Web UI Display** (src/web/components/TaskCard.tsx):
   - Update `formatDate()` to handle datetime strings
   - Show time component when present
   - Consider relative time display for recent items

### Phase 4: Migration and Testing
8. **Migration Script** (src/scripts/migrate-dates.ts):
   - Scan all markdown files for date fields
   - Add time components to recent items (optional)
   - Preserve exact dates for historical items
   - Create backup before migration

9. **Configuration Updates**:
   - Update backlog/config.yml date_format to support new format
   - Add timezone preference option
   - Document configuration changes

### Phase 5: Testing and Documentation
10. **Comprehensive Testing**:
    - Test with existing date-only data
    - Test with new datetime data
    - Test migration script on sample data
    - Update all unit tests expecting date formats

11. **Documentation**:
    - Update README with date format changes
    - Document timezone handling
    - Add migration guide for users

## Implementation Notes

Successfully implemented datetime precision for all date fields (tasks, documents, decisions) with full backward compatibility.

**Core Changes:**
- Enhanced normalizeDate() function to preserve time components when present
- Updated date generation from YYYY-MM-DD to YYYY-MM-DD HH:mm format in UTC
- Modified UI components (CLI and web) to display time when available
- Added timezone configuration options to BacklogConfig type
- Created optional migration script for existing data

**Technical Decisions:**
- Gradual migration approach: existing date-only entries remain unchanged, new entries include time
- UTC storage with local display for consistency
- Space-separated format (YYYY-MM-DD HH:mm) for readability
- Backward compatibility maintained - no breaking changes

**Files Modified:**
- src/markdown/parser.ts (normalizeDate enhancement)
- src/core/backlog.ts (date generation updates)
- src/types/index.ts (config type extensions)
- src/web/components/TaskCard.tsx (UI datetime display)
- backlog/config.yml (timezone and format options)

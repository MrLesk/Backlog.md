---
id: task-175
title: 'Add hour and minute to all dates in drafts, tasks, documents, decisions'
status: Done
assignee: ['agavr']
created_date: '2025-07-12'
updated_date: '2025-07-26 10:29'
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

### Research Findings (2025-07-26)

**Current Date System Architecture:**
1. **Date Generation**: Found 17 instances of `toISOString().split('T')[0]` across codebase
   - src/cli.ts: Lines 724, 1628, 1706 (task/doc/decision creation)
   - src/core/backlog.ts: Lines 136, 263, 293 (updates and creation)
   - src/server/index.ts: Lines 315, 431 (API endpoints)
   - Test files: Multiple instances for test data

2. **Date Parsing**: `normalizeDate()` in parser.ts (lines 29-58)
   - Converts various date formats to YYYY-MM-DD
   - Handles Date objects, strings with quotes, and multiple formats
   - Always strips time information via `.slice(0, 10)`

3. **Date Display**:
   - CLI: Shows raw date strings (e.g., "Created: 2025-07-12")
   - Web UI: Uses `new Date(dateStr).toLocaleDateString()` for localized display

4. **Configuration**: 
   - `date_format: yyyy-mm-dd` exists in config but isn't actively used
   - No timezone configuration currently exists

### Design Decision: Gradual Migration Approach

After analysis, implementing a **gradual migration with optional time** is the best approach:

**Advantages:**
- ✅ Full backward compatibility - existing YYYY-MM-DD dates continue to work
- ✅ No forced migration - users can adopt datetime at their own pace
- ✅ Minimal disruption - no breaking changes to existing files
- ✅ Progressive enhancement - new features available immediately

**Implementation Strategy:**
1. Update `normalizeDate()` to preserve time when present
2. Change date generation to include time (with config option)
3. Update UI to display time only when present
4. Provide optional migration tool for users who want to add times

### Critical Considerations:
- **Timezone Handling**: Store in UTC, display in local time
- **Format Choice**: `YYYY-MM-DD HH:mm` (space separator for readability)
- **UI Space**: Terminal width constraints require compact display
- **Migration**: Must be optional and reversible
- **Testing**: All date format tests need updates to handle both formats

### Files Requiring Changes:
1. **Core Parser** (src/markdown/parser.ts): normalizeDate function enhancement
2. **Date Generation** (7 files): Update toISOString() usage
3. **Type Definitions** (src/types/index.ts): Add timezone preference
4. **UI Components**: Both CLI and web need datetime display logic
5. **Tests**: Update expectations for new date format
6. **Config**: Add datetime format options

### Implementation Complete (2025-07-26)

**Changes Made:**

1. **Enhanced normalizeDate() function** (src/markdown/parser.ts):
   - Now preserves time components when present in input
   - Maintains backward compatibility with date-only strings
   - Intelligently detects if Date objects are date-only (midnight UTC)

2. **Updated date generation** across 7 files:
   - Changed from `toISOString().split('T')[0]` to `toISOString().slice(0, 16).replace('T', ' ')`
   - Produces format: `YYYY-MM-DD HH:mm` in UTC

3. **UI Components Updated**:
   - **Web UI** (TaskCard.tsx): Enhanced formatDate() to display time when present
   - **CLI** (task-viewer.ts): Added formatDateForDisplay() for intelligent date/datetime display
   - Both UIs now show time only when the date includes it

4. **Configuration Enhanced**:
   - Added `timezone_preference: "UTC"` to config.yml
   - Added `include_datetime_in_dates: true` option
   - Updated date_format to `yyyy-mm-dd hh:mm`

5. **Type System Updates**:
   - Added `timezonePreference?: string` to BacklogConfig
   - Added `includeDateTimeInDates?: boolean` for controlling behavior

6. **Migration Script Created** (src/scripts/migrate-dates.ts):
   - Interactive script with backup capability
   - Options for selective migration of recent items
   - Preserves historical date-only entries

7. **Tests Updated**:
   - Fixed all test expectations to handle new datetime format
   - All tests passing with backward compatibility maintained

**Backward Compatibility:**
- ✅ Existing date-only fields remain date-only
- ✅ New entries get datetime by default
- ✅ Both formats work seamlessly together
- ✅ No breaking changes to existing data

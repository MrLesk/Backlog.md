---
id: task-183
title: Add ordinal field for custom task ordering in web UI
status: To Do
assignee: []
created_date: '2025-07-13'
updated_date: '2025-07-16'
labels: []
dependencies: []
priority: medium
---

## Description

Enable drag-and-drop task reordering within columns in the web UI. When a user drags a task to a new position within the same column, automatically assign ordinal values to maintain the custom order. The system needs: 1) Frontend drag-and-drop within columns, 2) Server API to handle reordering and persist changes, 3) CLI command for setting ordinal values, 4) Automatic ordinal assignment for all tasks in affected column, 5) File system updates to save ordinal values in task frontmatter.
## Acceptance Criteria

- [x] Add ordinal field to task frontmatter schema
- [x] Implement drag-and-drop reordering within same column in web UI
- [x] Create server API endpoint to handle task reordering requests
- [x] Add CLI command 'backlog task edit --ordinal <number>' for manual ordinal setting
- [x] Automatically assign ordinal values to all tasks in column when drag occurs
- [x] Update task sorting logic: ordinal first then fallback to current ordering
- [x] Save ordinal values to task markdown files via CLI from server
- [x] Tasks with ordinal appear at top in numerical order
- [x] Tasks without ordinal maintain current ordering as fallback
- [x] Drag-and-drop works smoothly with visual feedback during drag

## Implementation Plan

1. **Add ordinal field to task schema** (Backend foundation)
   - Update TaskFrontmatter interface to include optional ordinal field
   - Update task validation schema to accept ordinal numbers
   - Ensure backward compatibility with existing tasks

2. **Implement drag-and-drop UI** (Frontend)
   - Add drag-and-drop library (react-beautiful-dnd or similar)
   - Create draggable task cards within columns
   - Add visual feedback during drag operations
   - Handle drop events and calculate new ordinal values

3. **Create reordering API endpoint** (Backend)
   - POST /api/tasks/reorder endpoint
   - Accept taskId, newOrdinal, and columnTasks
   - Validate request and update ordinal values
   - Return updated task list

4. **Add CLI ordinal support** (CLI)
   - Extend task edit command with --ordinal parameter
   - Validate ordinal values (positive numbers)
   - Update task file with new ordinal value

5. **Implement ordinal assignment logic** (Core)
   - When dropping between tasks: average their ordinals
   - When dropping at start: half of first task's ordinal
   - When dropping at end: last task's ordinal + 1000
   - Handle edge cases and collisions

6. **Update sorting logic** (Frontend & Backend)
   - Sort by ordinal first (if present)
   - Fallback to existing sort order for tasks without ordinals
   - Maintain stable sorting for equal values

7. **File persistence** (Backend)
   - Update task files with ordinal values via CLI integration
   - Ensure atomic updates to prevent data loss
   - Handle concurrent edit scenarios

8. **Testing & Polish**
   - Unit tests for ordinal calculation logic
   - Integration tests for API endpoints
   - E2E tests for drag-and-drop functionality
   - Performance testing with many tasks

## Implementation Notes

### Completed Implementation

1. **Ordinal Field Added**
   - Added `ordinal?: number` to Task interface in `src/types/index.ts`
   - Updated parser to read ordinal from frontmatter in `src/markdown/parser.ts`
   - Updated serializer to save ordinal to frontmatter in `src/markdown/serializer.ts`

2. **CLI Support**
   - Added `--ordinal <number>` option to task edit command
   - Validates ordinal as non-negative number
   - Updates task file with new ordinal value

3. **Drag-and-Drop Reordering**
   - Enhanced TaskColumn component to support within-column drops
   - Added drop position indicators (blue line) for visual feedback
   - TaskCard passes status in drag data to differentiate between column changes and reordering
   - Calculates new ordinal based on drop position:
     - Drop at start: half of first task's ordinal (or 1000)
     - Drop at end: last task's ordinal + 1000
     - Drop between: average of surrounding tasks' ordinals

4. **Server API Endpoint**
   - Created POST `/api/tasks/reorder` endpoint
   - Accepts taskId, newOrdinal, and optional columnTasks
   - Updates task ordinal and saves via CLI integration
   - Handles batch updates to prevent ordinal collisions

5. **Sorting Logic**
   - Created `sortByOrdinal` and `sortByOrdinalAndPriority` functions
   - Tasks with ordinals always appear before tasks without
   - Within same ordinal level, falls back to priority or date sorting
   - Board component uses ordinal-aware sorting for all columns

### Technical Details

- Ordinal values use spacing of 1000 to allow many insertions between tasks
- Drag-and-drop uses HTML5 drag API with visual feedback
- Server uses CLI's updateTask method to ensure consistent file updates
- All changes respect auto-commit configuration

### Testing Results

- Build successful with `bun run build`
- All 439 tests passing
- Linting shows some pre-existing issues unrelated to this implementation

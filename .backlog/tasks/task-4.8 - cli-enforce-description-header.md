---
id: task-4.8
title: 'CLI: enforce description header'
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-08
labels: []
dependencies: []
parent_task_id: task-4
---
## Description

Ensure new tasks have a Description header. Update docs to require acceptance criteria and tests.

## Acceptance Criteria
- [x] CLI automatically adds "## Description" when creating a task if missing.
- [x] Documentation updated in AGENTS.md, CLAUDE.md, and .cursorrules to mandate acceptance criteria and relevant tests when necessary.

## Implementation Notes

**Task 4.8 Implementation Summary:**

1. **Core Functionality (`src/core/backlog.ts`):**
   - Implemented `ensureDescriptionHeader()` function that automatically adds "## Description" header to task descriptions if missing
   - Integrated this function into all task creation and update methods: `createTask()`, `createDraft()`, and `updateTask()`
   - Function intelligently handles empty descriptions and prevents duplicate headers

2. **Test Coverage:**
   - Existing tests for description header functionality were found in `src/test/core.test.ts`
   - Tests verify both adding headers when missing and not duplicating existing headers
   - Updated CLI integration tests to expect the new description header format in task descriptions

3. **Documentation Updates:**
   - Updated AGENTS.md, CLAUDE.md, and .cursorrules to explicitly mandate writing relevant tests when implementing new functionality or fixing bugs
   - All three files already contained requirements for Description sections and Acceptance Criteria checklists

4. **Merge Resolution:**
   - Successfully resolved merge conflicts between task 4.8 (description header) and task 4.6 (assignee normalization)
   - Both features now work together in all task creation/update methods

5. **Quality Assurance:**
   - All 104 tests pass, including the updated expectations for description headers
   - Code passes all Biome linting and formatting checks
   - Features work correctly across task creation, updating, and draft management

The CLI now automatically ensures all tasks have proper "## Description" headers, improving consistency across the project's task management system.

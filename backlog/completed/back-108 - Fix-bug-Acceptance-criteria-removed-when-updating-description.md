---
id: BACK-108
title: 'Fix bug: Acceptance criteria removed when updating description'
status: Done
assignee: []
created_date: '2025-07-03'
updated_date: '2025-07-04'
labels: []
dependencies: []
---

## Description

When using backlog task edit commands to update specific sections (description, acceptance criteria, implementation plan, implementation notes), other sections are being removed or affected. Each section should be updated independently without affecting other sections of the task file.

## Acceptance Criteria

- [x] Updating task description preserves all other sections
- [x] Updating acceptance criteria preserves all other sections
- [x] Updating implementation plan preserves all other sections
- [x] Updating implementation notes preserves all other sections
- [x] Task edit commands only modify the specified section
- [x] Tests verify all sections are preserved during individual updates
- [x] Bug is reproducible and then fixed

## Implementation Notes

**Root cause identified:**
The bug was in the CLI task edit implementation where `task.description = String(options.description)` completely overwrote the entire task description (which contains all markdown sections) instead of updating only the Description section.

**Approach taken:**
- Created a new `updateTaskDescription` function in `markdown/serializer.ts` that follows the same pattern as the existing `updateTaskAcceptanceCriteria`, `updateTaskImplementationPlan`, and `updateTaskImplementationNotes` functions
- Modified the CLI task edit command to use this new function when updating descriptions
- The function properly preserves all other sections while updating only the Description section

**Features implemented:**
- New `updateTaskDescription` function that updates only the Description section of a task's markdown content
- Proper section preservation for all task edit operations (description, acceptance criteria, implementation plan, implementation notes)
- Comprehensive test coverage to prevent regression

**Technical decisions and trade-offs:**
- **Section-specific updates**: Used regex-based section parsing to identify and replace only the specific section being updated
- **Consistency**: Followed the same pattern as existing section update functions for maintainability
- **Backward compatibility**: The fix doesn't change the CLI interface, only the internal implementation
- **Test coverage**: Added both unit tests and integration tests to ensure the fix works correctly

**Modified files:**
- `src/markdown/serializer.ts`: Added `updateTaskDescription` function
- `src/cli.ts`: Updated task edit command to use the new function for description updates
- `src/test/task-edit-preservation.test.ts`: Added comprehensive integration tests for section preservation
- `src/test/update-task-description.test.ts`: Added unit tests for the new function

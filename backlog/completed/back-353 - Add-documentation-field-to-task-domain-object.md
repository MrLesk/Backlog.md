---
id: BACK-353
title: Add documentation field to task domain object
status: Done
assignee:
  - '@codex'
created_date: '2025-12-26 17:39'
updated_date: '2026-01-16 20:22'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a new `documentation` field to the task domain object that stores an array of strings. Each entry can be:
- External URLs (e.g., design docs, API specs, service manuals)
- Local file paths relative to the repo root (e.g., `src/core/auth.ts`, `docs/architecture.md`)

This field helps AI agents (who have no prior context) quickly access relevant reference materials when picking up a task. It supports the "swarm of agents" execution model where each task must be self-contained.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task type includes optional `documentation: string[]` field
- [x] #2 CLI supports --doc flag for task create/edit (can be used multiple times)
- [x] #3 MCP task_create and task_edit schemas include documentation field
- [x] #4 task_view output displays documentation links
- [x] #5 Documentation persists in task markdown files
- [x] #6 Unit tests cover CRUD operations for documentation field
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

Follow the exact pattern established by BACK-356 (references field).

### Files to Modify

1. **`src/types/index.ts`** - Add `documentation?: string[]` to:
   - `Task` interface (line ~37)
   - `TaskCreateInput` interface (line ~90)
   - `TaskUpdateInput` interface (line ~112) - including `addDocumentation` and `removeDocumentation`

2. **`src/markdown/parser.ts`** - Parse `documentation` from frontmatter (1-line addition)

3. **`src/markdown/serializer.ts`** - Include `documentation` in frontmatter output (1-line addition)

4. **`src/core/backlog.ts`** - Handle documentation in create/update operations:
   - Normalize in `createTaskFromInput` (around line 658)
   - Handle set/add/remove in `updateTaskFromInput` (around line 952)

5. **`src/cli.ts`** - Add `--doc` flag to:
   - `task create` command (around line 1265)
   - `task edit` command (around line 1838)

6. **`src/mcp/utils/schema-generators.ts`** - Add documentation fields to:
   - `generateTaskCreateSchema` - add `documentation` array
   - `generateTaskEditSchema` - add `documentation`, `addDocumentation`, `removeDocumentation`

7. **`src/formatters/task-plain-text.ts`** - Display documentation in CLI output (after references, around line 100)

8. **`src/test/documentation.test.ts`** - New test file, copy structure from `references.test.ts`:
   - Create task with documentation
   - Create task without documentation
   - Handle empty documentation array
   - Set documentation on existing task
   - Add documentation to existing task
   - Prevent duplicate documentation entries
   - Remove documentation from existing task
   - Replace documentation when setting directly
   - Persist documentation in markdown frontmatter
   - Not include empty documentation in frontmatter

### Design Decisions
- `--doc` flag (repeatable, like `--ref`)
- No validation of documentation entries (can be URLs or file paths)
- Display pattern follows references conventions (comma-separated in plain text output)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

Added `documentation` field to tasks following the exact pattern established by BACK-356 (references field).

### Changes Made

**Types (`src/types/`):**
- Added `documentation?: string[]` to Task, TaskCreateInput, TaskUpdateInput interfaces
- Added `documentation`, `addDocumentation`, `removeDocumentation` to TaskEditArgs

**Parser/Serializer (`src/markdown/`):**
- Parse documentation from frontmatter in parser.ts
- Include documentation in frontmatter output in serializer.ts

**Core (`src/core/backlog.ts`):**
- Normalize and store documentation in createTaskFromInput
- Handle set/add/remove operations in updateTaskFromInput (same pattern as references)

**CLI (`src/cli.ts`):**
- Added `--doc` flag to task create command
- Added `--doc` flag to task edit command
- Updated buildTaskFromOptions to handle documentation

**MCP (`src/mcp/`):**
- Added documentation to task_create schema
- Added documentation, addDocumentation, removeDocumentation to task_edit schema
- Updated TaskCreateArgs type in handlers.ts
- Updated task-edit-builder.ts to handle documentation fields

**Formatter (`src/formatters/task-plain-text.ts`):**
- Added documentation display after references

**Workflow Documentation:**
- Updated task-execution.md to include step 3: "Review task references and documentation"
- Updated agent-guidelines.md with section 5.2 for checking references and documentation

**Tests (`src/test/documentation.test.ts`):**
- 10 unit tests covering CRUD operations (same structure as references.test.ts)

### Test Results
- Documentation tests: 10 pass
- References tests: 10 pass (no regression)
- Core tests: 29 pass
- CLI tests: 54 pass
- MCP tests: 5 pass
- TypeScript: compiles cleanly
<!-- SECTION:NOTES:END -->

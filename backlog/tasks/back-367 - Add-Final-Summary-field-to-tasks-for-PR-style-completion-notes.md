---
id: BACK-367
title: Add Final Summary field to tasks for PR-style completion notes
status: Done
assignee:
  - '@codex'
created_date: '2026-01-18 12:16'
updated_date: '2026-01-19 19:16'
labels:
  - enhancement
  - core
  - cli
  - mcp
  - workflow
dependencies: []
references:
  - >-
    backlog/completed/back-353 -
    Add-documentation-field-to-task-domain-object.md
  - backlog/completed/back-356 - Add-references-field-to-task-domain-object.md
documentation:
  - src/markdown/structured-sections.ts
  - src/markdown/section-titles.ts
  - src/guidelines/mcp/task-finalization.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Problem

Currently, `implementationNotes` serves a dual purpose:
1. Progress logging during implementation (decisions, blockers, learnings)
2. Final PR-style summary at task completion

This causes confusion - agents write incremental progress logs during implementation, then the final summary gets mixed in or agents don't know where to put the clean PR description.

### Solution

Add a new **Final Summary** field (`finalSummary`) as a markdown section (not frontmatter) where agents write a clean, structured summary suitable for PR descriptions. This separates the concerns:

| Field | Purpose | When to write |
|-------|---------|---------------|
| `implementationNotes` | Progress log, blockers, learnings | During implementation |
| `finalSummary` | PR description, what changed and why | At task completion only |

### Scope (Parent Task)

This parent task covers the **core infrastructure** only:
- Type definitions
- Markdown section parsing and serialization
- Core business logic in `backlog.ts`

Interface integrations are handled by subtasks:
- BACK-367.01: CLI and plain text formatter
- BACK-367.02: MCP tools and schemas
- BACK-367.03: Web UI
- BACK-367.04: TUI task viewer

### Technical Approach

The field should follow the **markdown section pattern** used by Description, Implementation Plan, and Implementation Notes - NOT the frontmatter pattern used by references/documentation (BACK-353, BACK-356).

**Section format:**
```markdown
## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### Changes Made
- Added authentication middleware to API routes
- Updated user model with email verification field

### Technical Decisions
- Chose JWT over session-based auth for stateless scaling
<!-- SECTION:FINAL_SUMMARY:END -->
```

**Section ordering:** Final Summary should be the last section (after Implementation Notes).

### Reference Files

- `src/types/index.ts` - Task, TaskCreateInput, TaskUpdateInput interfaces
- `src/types/task-edit-args.ts` - CLI edit argument types
- `src/markdown/structured-sections.ts` - Section extraction, building, ordering logic
- `src/markdown/section-titles.ts` - Section title variants and markers
- `src/markdown/parser.ts` - How sections are parsed into Task objects
- `src/markdown/serializer.ts` - How Task objects are serialized back to markdown
- `src/core/backlog.ts` - `createTaskFromInput` and `updateTaskFromInput` methods

### Similar Tasks for Reference
- BACK-353 (documentation field) and BACK-356 (references field) show the pattern for adding new fields, but they use frontmatter. This task uses markdown sections instead.
- Look at how `implementationNotes` and `implementationPlan` are implemented for the correct section-based pattern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task type has `finalSummary?: string` field in Task, TaskCreateInput, and TaskUpdateInput interfaces
- [x] #2 Task edit args include `finalSummary`, `appendFinalSummary`, and `clearFinalSummary` options in `src/types/task-edit-args.ts`
- [x] #3 Section config added to `src/markdown/section-titles.ts` with title "Final Summary" and `FINAL_SUMMARY` key
- [x] #4 Markdown section uses `## Final Summary` header with `<!-- SECTION:FINAL_SUMMARY:BEGIN/END -->` markers
- [x] #5 Final Summary section is ordered last (after Implementation Notes) in `src/markdown/structured-sections.ts`
- [x] #6 Parser extracts finalSummary from markdown sections in `src/markdown/parser.ts`
- [x] #7 Serializer writes finalSummary as a markdown section (not frontmatter) in `src/markdown/serializer.ts`
- [x] #8 Core class handles finalSummary in `createTaskFromInput` and `updateTaskFromInput` (set, append, clear operations)
- [x] #9 Unit tests in `src/test/final-summary.test.ts` cover: create, set/append/clear edit operations, markdown persistence with correct section format, section ordering
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Type Definitions

1. **Update type definitions** (`src/types/index.ts`)
   - Add `finalSummary?: string` to `Task` interface
   - Add `finalSummary?: string` to `TaskCreateInput` interface
   - Add to `TaskUpdateInput` interface:
     - `finalSummary?: string`
     - `appendFinalSummary?: string[]`
     - `clearFinalSummary?: boolean`

2. **Update task edit args** (`src/types/task-edit-args.ts`)
   - Add `finalSummary`, `appendFinalSummary`, `clearFinalSummary` fields

## Phase 2: Markdown Infrastructure

3. **Update section configuration** (`src/markdown/section-titles.ts`)
   - Add `FINAL_SUMMARY` section config with:
     - Title: "Final Summary"
     - Key: `finalSummary`
     - Markers: `<!-- SECTION:FINAL_SUMMARY:BEGIN/END -->`

4. **Update structured sections** (`src/markdown/structured-sections.ts`)
   - Add `finalSummary` to the `StructuredSections` type
   - Update `SECTION_ORDER` to place Final Summary after Implementation Notes
   - Update `extractStructuredSection` to handle the new section
   - Update `buildSectionBlock` to handle the new section
   - Update `updateStructuredSections` to include finalSummary in ordering logic

5. **Update parser** (`src/markdown/parser.ts`)
   - Extract `finalSummary` section using `extractStructuredSection`
   - Add to returned Task object

6. **Update serializer** (`src/markdown/serializer.ts`)
   - Add `finalSummary` to `updateStructuredSections` call
   - Ensure it serializes as markdown section (not frontmatter)

## Phase 3: Core Business Logic

7. **Update Core class** (`src/core/backlog.ts`)
   - In `createTaskFromInput`: Handle `finalSummary` field (pass through to task object)
   - In `updateTaskFromInput`: Handle `finalSummary`, `appendFinalSummary`, `clearFinalSummary`
     - Follow the same pattern as `implementationNotes` handling
     - Clear operation: delete field if `clearFinalSummary` is true
     - Set operation: replace with new value
     - Append operation: append to existing content with double newline separator

## Phase 4: Testing

8. **Create tests** (`src/test/final-summary.test.ts`)
   - Test create with finalSummary
   - Test edit set operation (replace)
   - Test edit append operation
   - Test edit clear operation
   - Test markdown persistence (verify section format with markers)
   - Test empty field not persisted
   - Test section ordering (Final Summary appears after Implementation Notes)

## Verification

```bash
bunx tsc --noEmit
bun run check .
bun test src/test/final-summary.test.ts
```

### Team Lead Approval (2026-01-19)

- Approved plan above; proceed sequentially: BACK-367 (core) → BACK-367.01 (CLI/plain) → BACK-367.02 (MCP) → BACK-367.03 (Web UI) → BACK-367.04 (TUI)
- Owner: @codex for all tasks
- Notes: Follow existing `implementationNotes` patterns for append/clear semantics; omit empty Final Summary sections in serialization and views.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added Final Summary field to task types, structured section parsing/serialization, and core update logic (set/append/clear) with ordering after Implementation Notes. Added core tests for create/edit/ordering and wired new section into serializer helpers.

Tests: bun test src/test/final-summary.test.ts
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
Added a first-class Final Summary section to tasks and surfaced it across CLI, MCP, web UI, and TUI so agents can write PR-style completion notes.

## Changes
| Surface | What changed |
| --- | --- |
| Core | Added `finalSummary` to task types, parsing, and serialization with section ordering after Notes. |
| CLI | Added create/edit flags and plain-text rendering for Final Summary. |
| MCP | Extended task schemas and wired create handler support. |
| Web | Added Final Summary edit/preview in Task Details modal and wired server create/update. |
| TUI | Rendered Final Summary in the task viewer. |

- Added targeted tests across core parsing/serialization, CLI, MCP, web UI, and TUI.
- Updated README and agent/MCP guidelines to explain Final Summary usage and expectations.

## Testing
- `bunx tsc --noEmit`
- `bun run check .`
- `bun test`

## Notes
Final Summary is intended to be a PR-style description. Avoid one-line summaries; include key changes, rationale, and test results.
<!-- SECTION:FINAL_SUMMARY:END -->

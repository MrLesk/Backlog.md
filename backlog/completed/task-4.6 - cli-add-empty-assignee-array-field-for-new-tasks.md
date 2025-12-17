---
id: task-4.6
title: "CLI: Add empty assignee array field for new tasks"
status: Done
assignee: @MrLesk
reporter: @MrLesk
created_date: 2025-06-08
updated_date: 2025-06-08
labels: ["cli", "command"]
milestone: m-1
dependencies: ["task-4.1"]
parent_task_id: task-4
---

## Description

Ensure every task created via the CLI includes an empty `assignee` array in its frontmatter. Investigate the current parsing and serialization logic which uses a single string value. If assignees are not handled as an array, update the code to support `string[]`.

## Acceptance Criteria

- [x] New tasks contain `assignee: []` by default.
- [x] Parsing and serialization read and write the assignee field as an array.
- [x] Documentation provides instructions to migrate existing logic if needed.

## Implementation Notes

**YAML Flexibility Support**: Implemented proper YAML specification support where assignee field accepts both string and array formats. The parser (`src/markdown/parser.ts:19-23`) automatically normalizes single strings to arrays using `Array.isArray()` check.

**Core Normalization**: Added assignee normalization in `createTask`, `createDraft`, and `updateTask` methods (`src/core/backlog.ts`) with biome-ignore comments for TypeScript `any` usage required for YAML flexibility.

**CLI Integration**: Updated `buildTaskFromOptions` function (`src/cli.ts:108`) to create arrays by default, and edit command to handle array assignment properly.

**Comprehensive Testing**: Fixed all 99 tests by adding missing `assignee: []` fields and updating expectations from `.toBe("string")` to `.toEqual(["string"])` to match array format.

**Type Safety**: Maintained `Task` interface with `assignee: string[]` type while supporting both input formats through runtime normalization.

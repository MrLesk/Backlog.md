---
id: task-4.7
title: "CLI: Parse unquoted created_date"
status: Done
assignee: []
reporter: @MrLesk
created_date: 2025-06-08
updated_date: 2025-06-08
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-4.4"]
parent_task_id: task-4
---

## Description

Support unquoted `created_date` values in task frontmatter. Accept multiple date formats:

- `created_date: 2025-06-08`
- `created_date: '2025-06-08'`
- `created_date: 08-06-25`
- `created_date: 08/06/25`
- `created_date: 08.06.25`

Allow configuration of the expected `date_format` in `.backlog/config.yml` with default `yyyy-mm-dd`.

## Acceptance Criteria

- [x] Unquoted dates are parsed correctly when viewing tasks.
- [x] `date_format` option is documented in `config.yml`.

## Implementation Notes

**Date Normalization Function**: Implemented `normalizeDate` function in `src/markdown/parser.ts:4-33` that handles multiple date formats including unquoted values. The function supports `yyyy-mm-dd`, `dd-mm-yy`, `dd/mm/yy`, and `dd.mm.yy` formats with automatic normalization to ISO format.

**Parser Integration**: The `parseTask` function uses `normalizeDate(frontmatter.created_date)` at line 56 to process date fields, ensuring consistent date handling across all task parsing operations.

**Configuration Documentation**: Added `date_format` field documentation in `.backlog/docs/readme.md:15` and included `dateFormat: string` in the `BacklogConfig` interface for future extensibility.

**Comprehensive Testing**: Added test cases in `src/test/markdown.test.ts:133-155` covering both unquoted dates (`created_date: 2025-06-08`) and short format dates (`created_date: 08-06-25`) with proper normalization verification.

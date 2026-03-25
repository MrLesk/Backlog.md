---
id: BACK-290
title: Improve MCP status field to use enum dropdown with config values
status: Done
assignee:
  - '@codex'
created_date: '2025-10-15 18:31'
updated_date: '2025-10-15 19:29'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, the MCP task_create and task_edit tools define status as a string field with valid values listed in the description. This means MCP clients like MCP Inspector show a plain text input instead of a dropdown.

The browser UI already reads valid statuses from config and displays them as kanban columns. We should do the same for MCP tools - use an enum with values from config.statuses so MCP clients can display a proper dropdown.

Current implementation (src/mcp/utils/schema-generators.ts:12-20):
```typescript
export function generateStatusFieldSchema(config: BacklogConfig): JsonSchema {
	const statuses = config.statuses || DEFAULT_STATUSES;
	return {
		type: "string",
		maxLength: 100,
		description: `Status value (case-insensitive). Valid values: ${statuses.join(", ")}`,
	};
}
```

The comment explains enum isn't used because status needs case-insensitive normalization. However, the priority field successfully uses enum (lines 39-42), so we can use enum for status too and handle normalization in the validation layer.

References:
- Browser UI pattern: src/web/components/Board.tsx receives statuses as prop
- Server endpoint: src/server/index.ts /api/statuses
- Priority enum example: src/mcp/utils/schema-generators.ts:39-42
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status field in task_create schema uses enum with values from config.statuses
- [x] #2 Status field in task_edit schema uses enum with values from config.statuses
- [x] #3 First status in config is set as default value (if MCP schema supports defaults)
- [x] #4 Case-insensitive normalization still works in validation layer
- [x] #5 MCP Inspector displays status as dropdown with valid options
- [x] #6 Tests verify enum values match config.statuses
- [x] #7 Tests verify case-insensitive normalization still works (e.g., 'done' normalizes to 'Done')
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Status schema now exposes enum values and defaults sourced from Backlog config while keeping case-insensitive normalization in the validator. Added unit tests covering schema enum exposure and normalization. Ran `bun test src/test/mcp-tasks.test.ts`, `bun test src/test/mcp-server.test.ts`, `bunx tsc --noEmit`, and `bun run check .`.
<!-- SECTION:NOTES:END -->

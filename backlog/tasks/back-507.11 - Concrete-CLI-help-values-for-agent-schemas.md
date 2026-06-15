---
id: BACK-507.11
title: Concrete CLI help values for agent schemas
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 22:06'
updated_date: '2026-06-13 22:13'
labels: []
dependencies: []
modified_files:
  - src/commands/help-schema.ts
  - src/mcp/utils/schema-generators.ts
  - src/commands/instructions.ts
  - src/cli.ts
  - src/test/cli.test.ts
  - src/test/cli-milestone-management.test.ts
parent_task_id: BACK-507
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update CLI help schema output so agent-facing input schemas show concrete accepted values instead of abstract type labels where the CLI knows the values. Mirror the MCP status enum behavior by showing configured statuses plus Draft for status fields, and show exact values for fixed choice fields such as priority, search type, document type, instruction guide, task handling, sort fields, and integration mode. Keep behavior unchanged; this is help/instruction surface clarity for agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status fields in CLI help show exact accepted configured statuses plus Draft, matching MCP status schema behavior.
- [x] #2 Fixed choice fields in CLI help show exact accepted values directly in the type or description, so agents do not need to infer abstract types.
- [x] #3 The helper approach avoids duplicating status enum logic across command help blocks.
- [x] #4 Tests cover task create/edit/list/search help output with concrete status values and representative fixed choice values.
- [x] #5 No command behavior changes are introduced.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented concrete accepted-value rendering for CLI help schemas. Status help now renders configured statuses plus Draft using the shared MCP status enum helper, and fixed choice fields render explicit values for priority, search/document types, instruction guides, init integration options, milestone task handling, config keys, and list sorting. Verified targeted help schema tests, milestone/doc parity tests, TypeScript, and Biome.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated CLI help schema output so agent-facing input schemas show concrete accepted values instead of abstract labels. Status fields now use the same enum construction as MCP schemas, rendering configured statuses plus Draft. Fixed choice fields now display explicit values for priority, search types, document types, instruction guides, init integration options, milestone task handling, config keys, and task list sorting.

Verification:
- `bun test src/test/cli.test.ts --test-name-pattern "command help input schemas"`
- `bun test src/test/cli-milestone-management.test.ts src/test/cli-doc-search.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

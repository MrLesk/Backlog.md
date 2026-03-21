---
id: BACK-408
title: Consolidate MCP workflow guide tools into get_backlog_instructions
status: Done
assignee:
  - '@codex'
created_date: '2026-03-21 13:59'
updated_date: '2026-03-21 14:05'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
Backlog.md currently exposes four separate MCP tools for workflow guidance: overview, task creation, task execution, and task finalization. The desired outcome is a simpler tool surface that lets MCP clients retrieve any of these instruction sets through one tool instead of four separate entries.

## Desired Outcome
Provide a single MCP tool named `get_backlog_instructions` that returns the requested workflow instructions and defaults to the overview when no selection is provided. Keep the interaction clear for MCP clients that render schema enums as dropdown selectors.

## Scope Notes
This change is focused on the MCP tool surface for workflow instructions. Existing workflow resource URIs should continue to work unless implementation discovery shows a documented reason to change them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A single MCP tool named `get_backlog_instructions` is exposed for workflow instructions and returns the overview when called without arguments.
- [x] #2 The tool schema exposes a selectable instruction type covering overview, task creation, task execution, and task finalization in a form MCP clients can render as a selector.
- [x] #3 The previous four workflow guide tools are no longer registered in the MCP tool list, and related tests and shipped guidance are updated to match the new tool contract.
- [x] #4 Existing workflow resource URIs continue to return the corresponding markdown content unchanged.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the current workflow tool registration with a single `get_backlog_instructions` MCP tool that accepts an optional enum selector for `overview`, `task-creation`, `task-execution`, and `task-finalization`, defaulting to `overview` when omitted.
2. Keep the existing workflow resources and central guide definitions intact so `backlog://workflow/...` URIs remain unchanged; add any small helper needed to resolve guide entries by selector.
3. Update shipped MCP-facing guidance that currently names the four old tools so it points to the consolidated tool and explains the selector usage for tool-only clients.
4. Update MCP server and roots-discovery tests to assert the new single tool name, selector behavior, and unchanged resource behavior.
5. Run targeted tests for MCP workflow surfaces, then run typecheck and repo checks if the touched files require it; simplify any unnecessary branching discovered during implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the four workflow guide MCP tools with a single `get_backlog_instructions` tool that uses an optional enum `instruction` selector and defaults to `overview`.

Kept the existing `backlog://workflow/...` resources unchanged and reused the existing guide registry by adding key-based lookup for the consolidated tool handler.

Updated shipped tool-oriented guidance and agent nudge copy to reference `get_backlog_instructions` and selector usage, and refreshed MCP bootstrap/roots-discovery tests to assert the new contract.

Verification: `bun test src/test/mcp-server.test.ts src/test/mcp-roots-discovery.test.ts`, `bunx tsc --noEmit`, and `bun run check .` all passed. Included the existing Biome formatter output for `package.json` so the repo-wide check is clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated the MCP workflow guide tool surface into a single `get_backlog_instructions` endpoint. The new tool exposes an optional enum-backed `instruction` selector for `overview`, `task-creation`, `task-execution`, and `task-finalization`, and it defaults to the tool-oriented overview when omitted.

The underlying workflow resources remain unchanged, and the implementation still uses the shared workflow guide registry for content selection. Updated the shipped MCP guidance (`AGENTS.md`, agent nudge copy, and tool-oriented overview text) so tool-only clients are instructed to call the consolidated tool with the selector when they need a specific guide.

Tests were updated to cover the new tool list, selector schema, default overview behavior, selected guide behavior, and unchanged resource registration through normal bootstrap and roots discovery. Verification run: `bun test src/test/mcp-server.test.ts src/test/mcp-roots-discovery.test.ts`, `bunx tsc --noEmit`, and `bun run check .`. Also applied the existing Biome formatting output to `package.json` so the repo-wide check passes cleanly.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

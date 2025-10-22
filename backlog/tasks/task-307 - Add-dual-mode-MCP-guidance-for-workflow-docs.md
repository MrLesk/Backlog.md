---
id: task-307
title: Add dual-mode MCP guidance for workflow docs
status: In Progress
assignee:
  - '@codex'
created_date: '2025-10-22 19:18'
updated_date: '2025-10-22 19:24'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
We need to support both modern MCP clients (with resource support) and legacy/simple clients (tools-only) when providing the Backlog workflow documentation.

Implementation sketch:
- Mirror the existing workflow resources with tool handlers (e.g. `get_workflow_overview`, `get_task_creation_guide`, etc.) so clients that cannot call `resources/read` can still access the content.
- Update the MCP agent nudge copy so it tells agents to prefer `backlog://workflow/overview` when their client supports resources, and to call the new tools otherwise.
- Keep the existing resources in place for modern clients.
- Ensure the new tools share the same content as the resource handlers and are discoverable through `tools/list`.

This keeps guidance consistent and makes the connector work for a broader set of agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP server registers tool handlers that return the same markdown as the existing workflow resources (overview, task creation, task execution, task completion).
- [ ] #2 Agent nudge text references both the resource URIs and the fallback tools, clarifying when to use each.
- [ ] #3 Existing resource handlers remain available and their content continues to match the tool output.
- [ ] #4 Tests or docs are updated if needed to reflect the dual-mode behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add workflow documentation tools that mirror the existing resources.
2. Refactor resource registration to share content with the new tools.
3. Update the MCP agent nudge text to mention resource URIs and tool fallbacks.
4. Adjust or add tests/docs to cover the dual-mode behavior.
<!-- SECTION:PLAN:END -->

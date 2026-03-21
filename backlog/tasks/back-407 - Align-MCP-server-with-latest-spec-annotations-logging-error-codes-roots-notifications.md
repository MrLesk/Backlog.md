---
id: BACK-407
title: >-
  Align MCP server with latest spec (annotations, logging, error codes, roots
  notifications)
status: Done
assignee:
  - '@claude'
created_date: '2026-03-21 13:15'
updated_date: '2026-03-21 13:34'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit of the MCP server against the 2025-11-25 spec revealed several gaps. This task addresses all P0 and P1 findings:

**P0 - Spec violations:**
- Server handlers throw plain `Error` instead of SDK `McpError` with JSON-RPC error codes
- Custom `McpError` class name collides with SDK's `McpError`

**P1 - Missing features:**
- No tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `title`)
- No `logging` capability (using console.error instead of MCP logging protocol)
- No handler for `notifications/roots/list_changed`
- Missing `sendPromptListChanged()` in `upgradeToProject()`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server handlers (callTool, readResource, getPrompt) throw SDK McpError with correct ErrorCode values for not-found cases
- [ ] #2 Custom error class renamed to avoid collision with SDK McpError
- [ ] #3 All tools declare annotations (readOnlyHint, destructiveHint, idempotentHint, title) appropriate to their behavior
- [ ] #4 McpToolHandler interface includes optional annotations field, listTools() includes annotations in response
- [ ] #5 Server declares logging capability and uses sendLoggingMessage for roots discovery debug output
- [ ] #6 Server handles notifications/roots/list_changed to re-run roots discovery when client workspace changes
- [ ] #7 upgradeToProject sends sendPromptListChanged alongside tool/resource notifications
- [ ] #8 All existing tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

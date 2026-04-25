---
id: BACK-434
title: Use request-scoped MCP roots discovery
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2026-04-25 16:49'
labels: []
dependencies: []
references:
  - >-
    backlog/tasks/back-406 -
    Use-MCP-roots-for-project-root-discovery-when-cwd-fails.md
  - >-
    backlog/tasks/back-407 -
    Align-MCP-server-with-latest-spec-annotations-logging-error-codes-roots-notifications.md
documentation:
  - 'https://modelcontextprotocol.io/specification/2025-06-18/client/roots'
  - >-
    https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md#roots
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog MCP fallback mode should use the current MCP roots protocol as the authoritative way to recover a project root when the server was launched outside the user's repository. Prior completed work added roots discovery around initialization, but current clients and SDK support request-scoped server-to-client roots/list calls and roots/list_changed notifications.

This task turns that adaptation into a focused PR: preserve explicit cwd behavior, recover from client roots when fallback mode is active, and keep cache invalidation aligned with the protocol. Existing completed tasks BACK-406 and BACK-407 are historical context, not active tracking for this follow-up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fallback/init-required MCP mode can recover a Backlog project from client-provided file roots.
- [ ] #2 Explicit --cwd, BACKLOG_CWD, and valid process.cwd() resolution keep precedence and do not perform roots discovery on the normal path.
- [ ] #3 Root list changes from the client are handled so later requests use updated roots.
- [ ] #4 Unsupported, invalid, or inaccessible roots leave the server in safe fallback mode without crashing.
- [ ] #5 Tests cover fallback recovery, cache reuse, root-change invalidation, file-root normalization, and normal-mode behavior.
- [ ] #6 The SDK/package changes needed for the protocol support are included without unrelated dependency or web UI changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the current MCP roots contract and TypeScript SDK API from primary docs.
2. Port only the MCP roots fallback/server changes onto a clean branch from origin/main.
3. Include the minimal SDK/package artifacts needed for request-scoped roots support, excluding Mermaid/web UI dependency bump noise.
4. Add or adapt MCP tests for fallback recovery, roots cache reuse, list_changed invalidation, file root normalization, and normal-mode no-op behavior.
5. Run targeted tests plus typecheck/check as practical, then open a PR titled with the task ID.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

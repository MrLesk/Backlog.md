---
id: BACK-434
title: Use request-scoped MCP roots discovery
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 16:49'
updated_date: '2026-04-25 16:54'
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
- [x] #1 Fallback/init-required MCP mode can recover a Backlog project from client-provided file roots.
- [x] #2 Explicit --cwd, BACKLOG_CWD, and valid process.cwd() resolution keep precedence and do not perform roots discovery on the normal path.
- [x] #3 Root list changes from the client are handled so later requests use updated roots.
- [x] #4 Unsupported, invalid, or inaccessible roots leave the server in safe fallback mode without crashing.
- [x] #5 Tests cover fallback recovery, cache reuse, root-change invalidation, file-root normalization, and normal-mode behavior.
- [x] #6 The SDK/package changes needed for the protocol support are included without unrelated dependency or web UI changes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the current MCP roots contract and TypeScript SDK API from primary docs.
2. Port only the MCP roots fallback/server changes onto a clean branch from origin/main.
3. Include the minimal SDK/package artifacts needed for request-scoped roots support, excluding Mermaid/web UI dependency bump noise.
4. Add or adapt MCP tests for fallback recovery, roots cache reuse, list_changed invalidation, file root normalization, and normal-mode no-op behavior.
5. Run targeted tests plus typecheck/check as practical, then open a PR titled with the task ID.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Researched MCP roots against the 2025-11-25 spec, draft schema notes, and TypeScript SDK v1.x behavior. The implementation uses request-scoped roots/list via RequestHandlerExtra.sendRequest, treats roots/list_changed as cache invalidation, and keeps explicit cwd/env/process cwd resolution ahead of roots recovery. Non-file roots are rejected by the SDK result schema; malformed or inaccessible file roots are skipped by Backlog before later valid roots are considered.

Validation: focused MCP roots/fallback tests passed, typecheck passed, Biome check passed. A full bun test run completed with one transient timeout in server-search-endpoint; rerunning that exact test and the whole server-search-endpoint file passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Reworked fallback-mode MCP roots discovery to run from request-scoped handlers using RequestHandlerExtra.sendRequest({ method: "roots/list" }, ListRootsResultSchema), aligning Backlog with current roots protocol guidance.
- Replaced initialization-time readiness gating with cached roots resolution that is invalidated by notifications/roots/list_changed and refreshed on the next request.
- Normalized file roots, skipped malformed/inaccessible file roots, and preserved fallback mode when roots are unsupported or do not contain a Backlog project.
- Bumped @modelcontextprotocol/sdk to 1.29.0 without pulling in the unrelated Mermaid/web UI dependency refresh.

Validation:
- bun test src/test/mcp-roots-discovery.test.ts src/test/mcp-fallback.test.ts
- bunx tsc --noEmit
- bun run check .
- bun test src/test/server-search-endpoint.test.ts -t "returns newly created tasks immediately after POST"
- bun test src/test/server-search-endpoint.test.ts

Note: a full bun test pass was attempted and hit a transient timeout in one server-search-endpoint test; the exact test and file passed immediately when rerun.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

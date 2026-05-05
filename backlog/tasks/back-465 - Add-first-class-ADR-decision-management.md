---
id: BACK-465
title: Add first-class ADR decision management
status: Done
assignee:
  - '@abbyssoul'
created_date: '2026-05-05 01:12'
updated_date: '2026-05-05 01:13'
labels:
  - feature
  - decisions
  - mcp
  - cli
dependencies: []
modified_files:
  - src/cli.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/file-system/operations.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/mcp/tools/decisions/handlers.ts
  - src/mcp/tools/decisions/index.ts
  - src/mcp/tools/decisions/schemas.ts
  - src/mcp/utils/decision-response.ts
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md needs public support for Architectural Decision Records so users and agents can manage decisions through the documented CLI and MCP surfaces instead of relying on file-system conventions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can create, list, and view decisions from the CLI using persisted decision files.
- [x] #2 MCP clients can list, view, create, update, and search decisions with schema validation and formatted responses.
- [x] #3 Decision records are indexed for shared search/content-store flows and preserve metadata and markdown content.
- [x] #4 Agent-facing MCP guidance documents decisions as a supported public surface.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add decision CLI and MCP commands. 2. Reuse core filesystem persistence and search indexing. 3. Cover create/list/view/update/search behavior with tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented first-class ADR/decision support on this branch, then fixed content/path regressions found during review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added first-class ADR/decision management across CLI, MCP, core persistence, and search. Decisions can now be created, listed, viewed, updated, and searched through public surfaces; supplied markdown content and metadata are preserved, including nested decision paths. Added MCP/filesystem/remote-ID regression coverage.
<!-- SECTION:FINAL_SUMMARY:END -->

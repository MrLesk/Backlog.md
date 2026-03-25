---
id: BACK-301
title: 'Feature: MCP document tools'
status: Done
assignee:
  - '@codex'
created_date: '2025-10-17 19:35'
updated_date: '2025-10-17 23:37'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents can only manipulate tasks through the MCP server today. The web experience (`src/web/components/DocumentationDetail.tsx`) supports creating, editing/renaming, and viewing documentation, and the CLI (`src/cli.ts` doc create/list/view sections plus search results) exposes similar flows. Bring the MCP surface to parity by adding document-focused tools layered on the existing Core APIs (e.g. `createDocumentWithId`, `updateDocument`, `filesystem.listDocuments`). Follow the existing task tool patterns for schema validation and response formatting so document tools surface useful metadata (id, title, timestamps, tags) and stay consistent with the rest of the MCP surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expose a `document_list` tool that returns each document's id, title, type, createdDate, updatedDate, and tags, supports an optional substring filter, and emits a friendly "No documents found" message when empty.
- [x] #2 Expose a `document_view` tool that loads a document by id (with or without the `doc-` prefix) and returns its content together with the canonical metadata.
- [x] #3 Expose a `document_create` tool that accepts a title and content, creates the document via `Core.createDocumentWithId`, and returns the generated id plus the persisted metadata.
- [x] #4 Expose a `document_update` tool that accepts an id, new content, and an optional title to handle renames, updates the document via `Core.updateDocument`, and returns the updated metadata.
- [x] #5 Expose a `document_search` tool that delegates to the shared search service for documentation queries, returning score + id/title data and handling empty results gracefully.
- [x] #6 Ensure all document tools are registered in the MCP server, covered by tests alongside schema validation, and documented in `src/mcp/README.md` (or companion docs) with a usage example.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm existing Core and filesystem helpers for document CRUD and search to reuse within MCP handlers.
2. Implement MCP document tool schemas and handlers (list, view, create, update, search) with validation and consistent text responses.
3. Register the new document tools in the MCP server and ensure schema generation aligns with config defaults.
4. Document the new tools in MCP README (usage overview) to guide agent integrations.
5. Expand MCP test coverage to exercise each document tool and update snapshots if needed.
6. Run formatting/linting/tests to validate the implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `DocumentHandlers` backed by existing core CRUD/search helpers, sharing a formatter utility so tools return consistent metadata and content summaries.
- Registered all five document tools through the validation wrapper and exposed schemas/exports so the MCP surface mirrors task tooling structure.
- Created focused MCP document tests to cover list filtering, id normalization, rename updates, and score output; tightened the core rename test to keep TypeScript strict.
- Documented the new commands in `src/mcp/README.md` with agent-friendly language about server-assigned ids.
- Simplified the implementation by centralizing response formatting in `formatDocumentCallResult`, avoiding duplicated string assembly across handlers.
<!-- SECTION:NOTES:END -->

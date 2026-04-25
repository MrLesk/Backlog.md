---
id: BACK-436
title: 'Align document management across CLI, Web UI, and MCP'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-25 21:01'
updated_date: '2026-04-25 22:53'
labels:
  - docs
  - core
  - cli
  - web
  - mcp
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/598'
  - src/cli.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/DocumentationDetail.tsx
  - src/mcp/tools/documents
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/guidelines/mcp/overview.md
  - src/guidelines/agent-guidelines.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document management is currently inconsistent across public interfaces. CLI supports creating docs in a subpath with `backlog doc create -p`, but Web UI/server and MCP create/update flows do not expose the same path capability, and MCP responses do not expose persisted document paths. This blocks merging guidance like PR #598 because agents need a stable public way to create, locate, update, and reference docs without relying on source-only implementation details or direct file writes.

Align the document domain contract so core owns document ID generation, path normalization, safe subdirectory handling, metadata/frontmatter persistence, rename/move/update behavior, and returned document metadata. Then make CLI, Web UI/server APIs, and MCP document tools expose the same supported document-management behavior as thin adapters over that core contract.

Keep the public surface explicit: external agents may rely on CLI help, MCP tool schemas/descriptions, MCP workflow resources/instruction files, Web/server API behavior used by the Web UI, and shipped docs. Do not require agents to inspect `/src` internals to know how docs paths work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A single core document-management path handles create, list, view, update/rename, search metadata, path/subdirectory normalization, safe path validation, ID generation, and persisted metadata for docs.
- [x] #2 CLI, Web UI/server API, and MCP expose equivalent document-management functionality for supported operations, including creating docs in a docs subdirectory/path and returning the persisted document path or file location.
- [x] #3 Document update/rename behavior is consistent across interfaces, preserves or intentionally changes the document path according to an explicit public contract, and rejects unsafe paths such as traversal or absolute paths.
- [x] #4 MCP document tool schemas, descriptions, and formatted responses include the same document metadata needed by agents: id, title, type, path, created/updated dates, tags, and content where appropriate.
- [x] #5 CLI help/output, Web API behavior, and MCP resource/instruction guidance document the same docs path rules and do not instruct agents to depend on direct file writes as the primary workflow.
- [x] #6 Regression tests cover core document path handling plus interface parity for CLI, Web/server API, and MCP document tools, including nested paths and unsafe-path rejection.
- [x] #7 PR #598's proposed agent guidance can be revised to reference the aligned public APIs instead of documenting incomplete or interface-specific behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a single core document-management contract for create/update operations: typed input objects, shared ID generation, type/content/title normalization, persisted `path` metadata, and safe docs subpath normalization.
2. Make filesystem document persistence reject unsafe paths such as absolute paths and traversal instead of silently dropping path segments.
3. Update CLI document commands to call the core contract and print generated document path metadata so agents can locate created docs without inspecting internals.
4. Update Web/server document APIs and Web UI document creation/editing to expose the same path capability for create, preserve path on edit by default, and return full document metadata.
5. Update MCP document schemas, handlers, descriptions, and formatted responses to accept/return the same metadata and path behavior as CLI/Web.
6. Update shipped guidance/resources so docs path rules are public and consistent, and PR #598 can be revised against stable public APIs.
7. Add focused regression coverage for core/filesystem path validation, CLI output, server API create/update behavior, and MCP document path metadata; run scoped tests plus typecheck/check as appropriate.

Review follow-up plan for unresolved Codex comments on PR #610: fix docs subpath normalization to trim individual path segments, add Web/server document metadata validation for create/update payloads, preserve HTTP 500 for unexpected create/update failures while keeping explicit validation errors as 400, and add regression coverage in the focused document tests before pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-25: Took over task in new worktree `/Users/alex/projects/Backlog.md-back-436` on branch `tasks/back-436-align-document-management`, based on `origin/main` at `3901c4b`. Pending implementation plan approval before code changes.

2026-04-25: Implementation plan approved by user. Discovery classified this as L2 because it touches core data semantics, filesystem persistence, CLI, Web/server, MCP schemas/responses, shipped guidance, and tests. Closest pattern is task create/update parity: adapters should map public payloads into typed core inputs while persistence stays in FileSystem.

2026-04-25: Implemented shared document path normalization and core document create/update input methods. CLI, Web/server API, Web UI, and MCP document tools now route create/update behavior through core, expose docs-relative path metadata, preserve paths by default on update, support explicit moves, and reject unsafe absolute/traversal paths.

2026-04-25: Updated public guidance/resources for CLI, MCP, agent instructions, and docs readme so agents can rely on shipped CLI/MCP/Web behavior instead of direct file writes or source-only conventions.

2026-04-25: Validation: `bunx tsc --noEmit` passed; `bun run check .` passed; scoped docs/interface tests passed with 150 pass / 0 fail; `src/test/remote-id-conflict.test.ts` passes after aligning its stale lowercase expectation with normalized uppercase task output; `src/test/server-search-endpoint.test.ts` passes in isolation. A full `bun test` rerun hit order/load-sensitive server-search hook timeouts/socket failures after the remote-id expectation was fixed, while the same server-search file passed separately.

2026-04-25: CI follow-up for PR #610: macOS `lint-and-unit-test` failed in `ContentStore > removes decisions when files are deleted` because the file watcher deletion path only treated missing files as removals for `rename` events. The fix broadens cached removal handling to any watcher event where the watched path no longer exists, keeping task/document/decision watcher behavior consistent.

CI follow-up: after the watcher fix, macOS and Ubuntu passed; Windows still failed in the full unit suite with a Bun 1.3.9 segmentation fault near `src/test/mcp-milestones.test.ts` and no test assertion failure. Bumped the GitHub workflow Bun pin to 1.3.11 and centralized the workflow cache version so CI uses the same patch level validated locally.

CI follow-up: Bun 1.3.11 removed the Windows segfault and exposed Windows portability failures in the full suite. Fixed docs path assertions/cleanup to normalize recursive glob separators, preserved document path metadata when ContentStore handles document watcher events directly, normalized MCP roots fixture paths with `join`, and quoted POSIX-style callback output paths while disabling unrelated branch scanning in status-callback fixtures.

CI follow-up: Ubuntu full-suite failure on PR #610 was isolated to `src/test/server-assets.test.ts` beforeEach/afterEach hook timeouts. The asset server readiness probe now uses bounded `/api/status` requests, and asset fetches are timeout-wrapped so failures stay within the CI hook timeout. Local validation now passes with `bun test --timeout=10000` using the same timeout as Ubuntu CI.

Review follow-up: PR #610 has five unresolved Codex review threads covering document subpath segment trimming, document metadata validation on server create/update, and preserving 500 responses for unexpected document create/update failures. Reopened the task while addressing these PR comments.

Review follow-up complete: addressed all five unresolved Codex review threads on PR #610. Document subpath normalization now trims each path segment before traversal checks; server document create/update handlers reject invalid type/tags/path metadata instead of coercing malformed values; unexpected operational failures from core document create/update now remain HTTP 500 while explicit validation errors stay 400 and missing documents stay 404. Validation passed with focused document interface tests, typecheck, Biome, and the full local suite using the CI timeout.

Validation correction for review follow-up: after the last server metadata test addition, focused server document tests, typecheck, Biome, the document interface suite, and `src/test/server-search-endpoint.test.ts` in isolation pass. A full-suite rerun hit two pre-existing/order-sensitive `server-search-endpoint` hook timeouts; the same file passed in isolation immediately afterward.

Additional review follow-up: after pushing the first review-fix commit, GitHub reported a newer unresolved Codex thread on `src/mcp/tools/documents/schemas.ts` asking to constrain MCP document `type` values to the supported enum. Reopened the task to address that remaining MCP schema parity issue.

Addressed the remaining active Codex review thread by sharing the document type enum across types/core/server/MCP schema, constraining MCP `document_create`/`document_update` type inputs, and adding MCP/core regression tests. Verified with focused MCP/core tests, TypeScript, Biome, and the broader document suite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Added shared document path normalization and core document create/update inputs so document ID generation, persisted path metadata, path preservation/moves, and unsafe-path rejection live in core/filesystem behavior.
- Routed CLI document creation, Web/server document APIs/UI, and MCP document tools through the aligned core contract, including path metadata in list/view/search/update responses where agents need it.
- Updated shipped CLI/MCP/agent guidance and regression tests for nested docs paths, path metadata, and unsafe-path rejection.

Validation:
- `bunx tsc --noEmit` passed.
- `bun run check .` passed.
- `bun test src/test/filesystem.test.ts src/test/core.test.ts src/test/cli.test.ts src/test/mcp-documents.test.ts src/test/server-documents-endpoint.test.ts` passed: 150 pass / 0 fail.
- `bun test src/test/remote-id-conflict.test.ts` passed after correcting the stale task-ID casing expectation.
- `bun test src/test/server-search-endpoint.test.ts` passed in isolation.
- Full `bun test` was attempted after the casing fix; it no longer fails at `remote-id-conflict`, but one long-run attempt hit server-search hook timeouts/socket failures that passed when isolated.

CI follow-up: Updated content-store watcher deletion handling so missing watched task/document/decision files remove cached entries regardless of whether the platform reports the event as `rename` or `change`. Verified with `bun test src/test/content-store.test.ts`, `bun test src/test/server-search-endpoint.test.ts`, `bunx tsc --noEmit`, and `bun run check .`.

CI follow-up: fixed the remaining Windows CI runtime crash by moving GitHub workflows from Bun 1.3.9 to 1.3.11 and keeping cache keys tied to the workflow Bun version.

CI follow-up: addressed the Windows-only portability failures revealed after the Bun bump. Targeted core/server docs, MCP roots, status-callback, content-store, filesystem, and MCP document tests pass locally with typecheck and Biome.

Stabilized the server asset tests by switching readiness checks from `/` to bounded `/api/status` probes and timeout-wrapping asset fetches; verified the full suite with `bun test --timeout=10000` passes locally.

Review follow-up: resolved Codex feedback by trimming document path segments, validating server document metadata payloads, and preserving HTTP 500 for unexpected document create/update failures. Verified with `bun test src/test/filesystem.test.ts src/test/core.test.ts src/test/cli.test.ts src/test/mcp-documents.test.ts src/test/server-documents-endpoint.test.ts --timeout=15000`, `bunx tsc --noEmit`, `bun run check .`, and full `bun test --timeout=10000` (1159 pass, 2 skip, 0 fail).

Validation note: after the final metadata test addition, focused document tests, typecheck, Biome, and the document interface suite passed. A full-suite rerun hit the known `server-search-endpoint` hook timeout flake; `bun test src/test/server-search-endpoint.test.ts --timeout=15000` passed in isolation immediately afterward.

Additional review follow-up: constrained `document_create` and `document_update` MCP schemas to the shared supported document type enum, exposed the same enum in CLI help, and added core/runtime validation so invalid document types are not persisted through domain methods. Validation passed with `bun test src/test/mcp-documents.test.ts src/test/core.test.ts --timeout=15000`, `bunx tsc --noEmit`, `bun run check .`, and `bun test src/test/filesystem.test.ts src/test/core.test.ts src/test/cli.test.ts src/test/mcp-documents.test.ts src/test/server-documents-endpoint.test.ts --timeout=15000`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

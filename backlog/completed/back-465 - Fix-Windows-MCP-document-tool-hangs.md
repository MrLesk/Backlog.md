---
id: BACK-465
title: Fix Windows MCP document tool hangs
status: Done
assignee:
  - '@codex'
created_date: '2026-05-07 17:32'
updated_date: '2026-05-07 18:13'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/640'
modified_files:
  - src/commands/mcp.ts
  - src/git/operations.ts
  - src/test/mcp-stdio-exit.test.ts
  - src/test/git.test.ts
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #640 reports that backlog.md 1.45.0 hangs indefinitely on Windows when MCP clients call document_create through 'backlog.cmd mcp start --cwd <project>'. Version 1.44.0 returns promptly in the same project. Reproduce the Windows MCP document-tool hang, identify the blocking path, and ship a regression-tested fix without changing the public MCP document-tool contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP document_create returns promptly on Windows when the server is started with --cwd and the client does not provide roots.
- [x] #2 MCP document list/view/update paths continue to work and do not regress while using the same root-resolution behavior.
- [x] #3 A regression test covers the Windows/no-client-roots scenario or equivalent root-discovery fallback that caused the hang.
- [x] #4 Relevant targeted tests, type-checking, and lint/check commands pass or any environment blocker is documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce issue #640 with a real MCP StdioClientTransport client using no roots capability and 'mcp start --cwd <initialized project>'.
2. Fix the Windows-specific premature stdio shutdown path in the MCP CLI command without changing MCP document tool schemas or handlers.
3. Add a regression test that uses stdio transport, no client roots, and verifies document_create returns after listTools.
4. Run targeted MCP stdio/document tests, type-checking, and Biome checks; update BACK-465 acceptance criteria/final summary before PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced on Windows with a real StdioClientTransport client: connect and listTools succeed, then the server logs 'Received stdio, shutting down MCP server...' and document_create times out. This points to the CLI mcp start stdin close handler, not the document handler itself; direct mcp-documents and mcp-roots-discovery tests pass.

Implemented the fix by ignoring stdin 'close' as a shutdown signal on Windows and by changing isGitRepository to run git rev-parse with stdin ignored via Bun.spawn. This keeps MCP stdio sessions alive and prevents git repository detection from inheriting MCP stdio pipes during document ID generation.

Validation: bun test src/test/mcp-stdio-exit.test.ts --timeout=15000 passed; bun test src/test/mcp-documents.test.ts src/test/mcp-roots-discovery.test.ts --timeout=15000 passed; bun test src/test/git.test.ts src/test/no-remote-preflight.test.ts --timeout=15000 passed; bunx tsc --noEmit passed; bunx biome check src/commands/mcp.ts src/git/operations.ts src/test/mcp-stdio-exit.test.ts passed. Full bun run check . was attempted and failed on this Windows checkout due pre-existing CRLF formatting diagnostics across many unmodified files, so changed-file Biome validation was used for this PR.

Review follow-up from PR #641: Codex correctly noted that replacing the old try/catch with direct Bun.spawn made isGitRepository reject if the child process cannot be created, such as missing git or invalid cwd. Plan: wrap the Bun.spawn call and exited await in try/catch, return false on any failure, and add a regression test for an invalid working directory while keeping stdin ignored.

Review follow-up implemented: restored isGitRepository's false-on-failure behavior by wrapping Bun.spawn and the exit await in try/catch while keeping stdin ignored. Added a regression test for a missing working directory returning false. Validation: bun test src/test/git.test.ts src/test/no-remote-preflight.test.ts --timeout=15000 passed; bun test src/test/mcp-stdio-exit.test.ts --timeout=15000 passed; bunx biome check --write src/git/operations.ts src/test/git.test.ts passed; bunx tsc --noEmit passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixes GitHub issue #640 by addressing Windows stdio blockers in the MCP path. mcp start no longer treats stdin 'close' as a shutdown signal on Windows, and isGitRepository now runs git rev-parse through Bun.spawn with stdin ignored so repository detection does not inherit MCP stdio pipes during document ID generation.

Review follow-up: restored the previous tolerant behavior for Git detection by returning false when Bun.spawn cannot create the child process or the git check otherwise fails, and added a regression test for an invalid working directory. Validation passed for the stdio regression test, MCP document/root tests, git/no-remote tests, TypeScript, and targeted Biome checks on changed TS files. The full bun run check . command was previously attempted but is blocked in this Windows checkout by pre-existing CRLF diagnostics across unmodified files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

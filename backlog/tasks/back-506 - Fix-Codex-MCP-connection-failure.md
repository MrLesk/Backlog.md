---
id: BACK-506
title: Fix Codex MCP connection failure
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:01'
updated_date: '2026-06-13 14:09'
labels:
  - mcp
  - codex
dependencies: []
documentation:
  - 'https://developers.openai.com/codex/mcp'
  - 'https://www.npmjs.com/package/@modelcontextprotocol/sdk'
modified_files:
  - README.md
  - src/cli.ts
  - src/core/init.ts
  - src/utils/mcp-client-setup.ts
  - src/test/build.test.ts
  - src/test/mcp-client-setup.test.ts
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate why current Codex cannot connect to the Backlog.md MCP server, determine whether Backlog is relying on non-standard MCP behavior or needs an SDK/server compatibility update, and ship the smallest fix on the public CLI/MCP surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Codex-compatible MCP startup is reproduced with an SDK/client-level test or local smoke harness.
- [x] #2 Backlog MCP startup does not depend on non-standard stdout/stderr behavior or obsolete SDK assumptions.
- [x] #3 If an SDK update is needed, dependency changes are minimal and justified; otherwise no dependency churn is introduced.
- [x] #4 Targeted MCP tests pass and cover the regression path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing Codex/MCP setup docs, prior tasks, and current SDK usage.
2. Reproduce the connection failure through a local MCP client or Codex-equivalent stdio handshake.
3. Identify whether failure is startup output, transport lifecycle, roots discovery, schema compatibility, or dependency drift.
4. Apply the smallest server/CLI/dependency fix and add regression coverage.
5. Run targeted MCP validation and simplify the final implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation found that the SDK itself is already current at @modelcontextprotocol/sdk 1.29.0, so no dependency bump is needed. The source MCP path (`bun src/cli.ts mcp start --debug`) initialized correctly and exposed tools/resources through the SDK client. The reproduced failure was on the packaged command path Codex launches: the local `backlog` command resolved to a stale/broken `dist/backlog` binary that closed during MCP initialization. Rebuilding fixed the local binary, and the code now adds compiled-binary MCP smoke coverage so this path is tested.

Implementation simplified MCP client setup into one shared helper used by CLI and core init. Codex setup now emits the current stdio separator form (`codex mcp add backlog -- backlog mcp start`), and setup commands now fail on non-zero exit instead of printing success. README manual setup was updated to match.

Validation passed: `bun test src/test/mcp-client-setup.test.ts src/test/build.test.ts src/test/mcp-stdio-exit.test.ts`, `bunx tsc --noEmit`, `bun run check .`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Added a shared MCP client setup helper for Claude, Codex, Gemini, and Kiro setup commands.
- Updated Codex setup to the current `--` stdio command separator and README docs.
- Fixed setup command execution so non-zero client setup exits are reported instead of treated as success.
- Added a compiled executable MCP stdio smoke test to cover the binary path Codex launches.

Root cause:
- Backlog MCP source startup was standards-compliant and did not require an SDK bump; the local failure reproduced through a stale/broken compiled `dist/backlog` binary, while source startup succeeded. The missing regression coverage was that compiled binaries were smoke-tested for `--help`/`--version`, but not MCP stdio initialization.

Validation:
- bun test src/test/mcp-client-setup.test.ts src/test/build.test.ts src/test/mcp-stdio-exit.test.ts
- bunx tsc --noEmit
- bun run check .
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

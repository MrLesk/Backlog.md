---
id: BACK-391
title: Add CWD override support for MCP start and CLI root resolution
status: Done
assignee:
  - '@codex'
created_date: '2026-02-20 23:07'
updated_date: '2026-02-20 23:11'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a shared runtime CWD override so Backlog MCP and CLI commands can resolve the correct Backlog project when host IDEs launch with the wrong process working directory. Add BACKLOG_CWD env support across CLI root resolution and --cwd support for `backlog mcp start`, while preserving fallback behavior for non-initialized directories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog mcp start --cwd <path>` resolves project root from that path (or nested path) and starts normally
- [x] #2 `BACKLOG_CWD` is honored by CLI project-root resolution logic when no --cwd is provided
- [x] #3 Invalid override paths fail fast with clear error messages
- [x] #4 MCP fallback mode (`backlog://init-required`) still works when resolved path has no Backlog project
- [x] #5 README MCP manual config documents BACKLOG_CWD usage for IDEs that do not pass project cwd
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented runtime CWD override support via new `src/utils/runtime-cwd.ts` shared helper.

`backlog mcp start` now accepts `--cwd` and resolves Backlog root from override/env/process cwd with fallback mode preserved.

CLI root resolution now respects `BACKLOG_CWD` via `requireProjectRoot()` and early root checks used by splash/migration.

README MCP manual configuration now documents `BACKLOG_CWD` and `--cwd` workaround patterns for IDEs that do not pass workspace cwd.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented runtime CWD override support for IDEs that launch MCP with an incorrect process directory. Added shared resolver (`BACKLOG_CWD`) for CLI root detection, `--cwd` support for `backlog mcp start` (precedence over env), preserved MCP fallback mode for non-initialized paths, documented manual MCP config overrides in README, and added focused unit tests for precedence/path validation behavior. PR: https://github.com/MrLesk/Backlog.md/pull/536
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

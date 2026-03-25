---
id: BACK-304
title: Update MCP integration documentation and CLI client commands
status: Done
assignee:
  - '@codex'
created_date: '2025-10-20 19:10'
updated_date: '2025-10-20 19:11'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clarify how `backlog init` configures MCP client integrations and adjust the CLI automation so generated commands match the latest client expectations. Remove leftover code related to interactive mode guidance while keeping existing workflows intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README MCP section explains that rerunning `backlog init` configures MCP automatically and includes a direct link to agent instructions for manual setup.
- [x] #2 `backlog init` generates the correct commands for Claude (`-s user`), Codex (server name positioned before client command), and Gemini (server argument order matches other clients).
- [x] #3 Unused `_needsInteractiveIntegration` flag removed without breaking existing initialization flows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review README MCP guidance to align with automated init behavior.
2. Document manual MCP setup reminder and link to agent instructions.
3. Update CLI MCP client commands (Claude/Codex/Gemini) and remove unused integration flag.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changes applied on current branch touching `README.md` and `src/cli.ts`. No automated tests or linting were run yet.
<!-- SECTION:NOTES:END -->

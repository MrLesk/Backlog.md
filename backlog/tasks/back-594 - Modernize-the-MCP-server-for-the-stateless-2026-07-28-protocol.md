---
id: BACK-594
title: Modernize the MCP server for the stateless 2026-07-28 protocol
status: To Do
assignee: []
created_date: '2026-08-07 21:26'
labels:
  - mcp
dependencies: []
priority: medium
type: enhancement
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MCP core revision 2026-07-28 removed the initialize handshake, added server/discover, and deprecated Roots, Sampling, and Logging with a 12-month minimum deprecation window that started on 2026-07-28. Backlog.md's MCP server must move onto that revision before the window closes, without breaking how agents locate the project they are working in.

Current state:
- `src/mcp/server.ts` depends on the deprecated Roots capability for project discovery (`resolveFromRoots`, ~line 159).
- The server declares and uses the deprecated `logging` capability (~line 106).
- The server is pinned to `@modelcontextprotocol/sdk` 1.29.0 (protocol 2025-11-25), two revisions behind.
- Task, milestone, and document tools return prose text with no `outputSchema` and no `structuredContent`, so clients cannot consume results as data.

CRITICAL REQUIREMENT from the maintainer, recorded verbatim:

"one user-scoped backlog MCP configuration must work in ANY project folder without configuring one MCP entry with a custom cwd per project"

That history matters: cwd was used originally, clients dropped reliable cwd, Backlog moved to roots, and roots is now deprecated. Any design that regresses to one MCP entry per project is not acceptable.

Candidate design to research (a candidate, NOT a mandate - a better design may be proposed):
- an optional `projectRoot` tool parameter on every tool, with the instruction surface telling agents to pass their workspace root;
- roots honored as a fallback for the whole deprecation window;
- `BACKLOG_CWD` / `--cwd` kept as the explicit escape hatch.

Before choosing a design, the implementer must first verify what cwd each supported client (Claude Code, Codex, Gemini CLI, Kiro, VS Code/Copilot) actually gives stdio servers today, and record those findings in the task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The MCP SDK dependency is current and the server runs against the stateless 2026-07-28 core revision (no reliance on the removed initialize handshake; server/discover supported)
- [ ] #2 Task, milestone, and document read tools declare outputSchema and return structuredContent alongside human-readable text
- [ ] #3 Each deprecated capability still in use (Roots, Logging) either has its replacement implemented, or has an exit plan explicitly staged with dates inside the deprecation window that ends 2027-07-28
- [ ] #4 The cwd actually provided to stdio MCP servers is verified and recorded for Claude Code, Codex, Gemini CLI, Kiro, and VS Code/Copilot
- [ ] #5 A single user-scoped backlog MCP configuration resolves the correct project from any project folder, demonstrated per supported client, with no per-project cwd entry required
- [ ] #6 The chosen project-resolution design, its fallbacks, and the BACKLOG_CWD/--cwd escape hatch are documented in the shipped instruction and README surfaces
- [ ] #7 CLI, TUI, and web surfaces show no behavior change; only the MCP surface changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

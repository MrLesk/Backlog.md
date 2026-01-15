---
id: BACK-300
title: Fix backlog init MCP registration flags for Claude and Gemini
status: Done
assignee:
  - '@codex'
created_date: '2025-10-17 20:53'
updated_date: '2025-10-17 21:03'
labels:
  - mcp
  - init
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
- `backlog init` currently registers Claude and Gemini MCP servers without forcing user scope or by passing command arguments in the positions their CLIs expect.
- Claude and Gemini default to project/local scope, so registrations performed outside the target project land in the wrong settings file and duplicate entries per repo.
- Claude/Gemini CLIs also reject the `--command/--args` pattern we were using, so the automated setup reports success but never actually registers the server.
- Users who relied on the automation now have to re-run multiple CLI commands manually to fix their environment.

## What
- Update the MCP auto-registration flow to match the syntax each CLI documents and manually validated (e.g., `claude mcp add backlog --scope user -- backlog mcp start`, `gemini mcp add backlog -s user backlog mcp start`).
- Ensure Codex registration keeps working with the same shared `backlog` server name but with corrected positional ordering.
- Refresh README/Development docs (and any task documentation) so they show the exact commands for each agent.
- Run the focused MCP fallback tests (and any relevant CLI suites) to confirm nothing regresses.
- Verify the new commands against the installed CLI versions or published reference docs so we can cite them in release notes.

## How (initial approach)
1. Adjust the `runMcpClientCommand` calls inside `backlog init` to use the correct positional syntax and scope options for each CLI.
2. Update documentation snippets (`README.md`, `backlog/tasks/task-299` summary, developer guide) to match the new syntax and highlight that a single global `backlog` server is registered.
3. Validate manually (optional but recommended): run each CLI’s `mcp add`/`remove` with `--help` (or reference docs) to confirm scope flags and argument ordering.
4. Run `bun test src/test/mcp-fallback.test.ts` (or broader suites if needed) to ensure existing behavior still passes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog init` registers Claude with `claude mcp add backlog --scope user -- backlog mcp start` and succeeds without manual follow-up.
- [x] #2 `backlog init` registers Codex with `codex mcp add backlog mcp start backlog` and succeeds.
- [x] #3 `backlog init` registers Gemini with `gemini mcp add backlog -s user backlog mcp start` and succeeds, placing config in user scope.
- [x] #4 README and developer guides display the corrected commands for Claude, Codex, and Gemini.
- [x] #5 Focused MCP tests (at minimum `bun test src/test/mcp-fallback.test.ts`) pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Adjust `backlog init` MCP registration commands to use documented positional arguments and user scope flags for Claude, Codex, and Gemini.
- Refresh README and development docs so setup instructions reflect the updated commands and shared global server name.
- Validate via CLI help/docs and run the MCP fallback test suite to confirm behaviour.
<!-- SECTION:PLAN:END -->

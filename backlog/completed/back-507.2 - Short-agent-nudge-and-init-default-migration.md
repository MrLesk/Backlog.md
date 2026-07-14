---
id: BACK-507.2
title: Short agent nudge and init default migration
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:13'
updated_date: '2026-06-13 20:37'
labels: []
milestone: m-7
dependencies: []
parent_task_id: BACK-507
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the long CLI instruction-file install with a short CLI bootstrap nudge. `backlog init` should recommend CLI instructions for AI integration by default, including non-interactive `--defaults`, and create or append to `AGENTS.md` with the short nudge unless the user explicitly selects MCP or no AI integration.

The nudge should be similar in shape to the current MCP nudge: short, idempotent, surrounded by Backlog markers, and safe to insert into existing files without overwriting user content. It should tell agents to run the CLI instruction entry point before creating or executing tasks and to use command help before unfamiliar commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog init` labels CLI instructions as the recommended AI integration path and keeps MCP/no-AI as explicit alternatives.
- [x] #2 `backlog init --defaults` creates or appends a short CLI nudge to `AGENTS.md`.
- [x] #3 Existing CLI and MCP Backlog blocks are replaced cleanly when switching integration modes, while unrelated file content is preserved.
- [x] #4 The old 757-line CLI guide is no longer installed into AGENTS.md, CLAUDE.md, GEMINI.md, Copilot instructions, or README.md.
- [x] #5 Tests cover idempotency, selected instruction files, switching from MCP to CLI instructions, switching from CLI instructions to MCP, and non-interactive defaults.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan

1. Add a short CLI nudge constant that tells agents to run `backlog instructions` and use command help before unfamiliar operations.
2. Update the agent instruction writer so CLI-mode files receive the short nudge instead of the old long CLI guide, while preserving marker replacement and idempotency.
3. Change `backlog init` defaults so CLI instructions are the recommended/default AI integration and non-interactive defaults create or append `AGENTS.md`.
4. Keep explicit MCP mode and no-AI mode behavior available.
5. Update instruction/init tests to assert the new nudge contract rather than the old long guide content.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented short CLI nudge content and switched CLI-mode instruction installation to use it for AGENTS.md, CLAUDE.md, GEMINI.md, Copilot instructions, and README guidance. Updated init defaults so `backlog init --defaults` uses CLI instructions and creates AGENTS.md unless the user explicitly selects MCP or no AI integration. Focused verification passed: `bun test src/test/agent-instructions.test.ts`, `bun test src/test/cli.test.ts --test-name-pattern "agent instructions|MCP integration|default to CLI|skipping AI"`, and `bunx tsc --noEmit`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the long generated CLI guide with a short CLI nudge for agent instruction files, made CLI instructions the default init path, and kept MCP/no-AI modes explicit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

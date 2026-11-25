---
id: BACK-794
title: Read the Backlog overview only when a conversation touches tracked work
status: Done
assignee:
  - '@simonamtoft'
created_date: '2026-10-26T11:34:00Z'
updated_date: '2026-10-27T08:24:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/998
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since BACK-664 the shipped agent nudge asks agents to run `backlog instructions overview` at the beginning of every conversation. Agents obey it literally, so conversations that only ask a question, debug, review, or commit still spend a tool call and ~600 tokens on the guide; in 150 sessions across five repos, 20 sessions that never consulted a task still read a guide, 12 piping it to the null device. A controlled comparison showed the nudge itself drives the read (6/6 with the 1.51.0 wording, 0/6 without). The overview already says to skip task creation for questions and exploration, so the nudge is stricter than the guide it points to. The `backlog instructions` listing and MCP workflow guide description repeat the per-request framing ("Required first read before answering any user request").
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The agent nudge asks for `backlog instructions overview` once per conversation, before the first action that touches tracked work, and names that trigger (naming a task, or being about to create, plan, update, or finalize one)
- [x] #2 The nudge states that questions, code explanations, debugging, reviews, and commits need no Backlog command until the conversation turns into tracked work
- [x] #3 The `backlog instructions` listing and MCP workflow guide description of the overview no longer frame it as required before any user request
- [x] #4 The repository AGENTS.md nudge block matches the shipped nudge
- [x] #5 CLI guidance and init tests assert the new wording
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the nudge's bold line in src/guidelines/cli-agent-nudge.md with the tracked-work trigger from issue #998, minus the 'asks about task state' trigger.
2. Change the overview description in src/commands/instructions.ts and src/mcp/workflow-guides.ts to 'Required first read before working on tracked tasks'.
3. Sync the repository AGENTS.md block (CLAUDE.md is a symlink).
4. Update cli-guidance and cli-init-create assertions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Issue #998 also asked to rename the overview's 'Start Every Request Here' heading. That heading is already gone on main, so that part needed no change. The issue's 'asks about task state' trigger was dropped as too broad. Typecheck used tsc --noEmit because local Bun 1.4.2 predates the 1.4.4 'bun --check' script. Full suite: 22 failures that also happen without this change. 3 update-nix tests fail on upstream main as well. The decision/document archive and create tests pass when run alone, so they failed only under full-suite load. 'assigns unique ids when two task demotions race' is flaky on upstream main too (2 of 5 runs passed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The shipped agent nudge now asks for 'backlog instructions overview' once per conversation, before the first action that touches tracked work. It names that trigger (naming a task, or being about to create, plan, update, or finalize one). It also says that questions, code explanations, debugging, reviews, and commits need no Backlog command. The overview's description in the 'backlog instructions' index and the MCP workflow guide changed from 'before answering any user request' to 'before working on tracked tasks'. The repository AGENTS.md block was updated to match. Verification: tsc --noEmit and biome check passed. The guidance, init, agent-instructions, root-entry, and MCP suites passed (264 tests). The other full-suite failures also happen on main or only under full-suite load. Risk: agents that previously read the overview eagerly may now skip it in conversations that later turn into task work. The nudge tells them to read it at that point.
<!-- SECTION:FINAL_SUMMARY:END -->

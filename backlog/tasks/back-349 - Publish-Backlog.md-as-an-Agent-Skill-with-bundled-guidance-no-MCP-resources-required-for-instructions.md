---
id: BACK-349
title: >-
  Publish Backlog.md as an Agent Skill with bundled guidance (no MCP resources
  required for instructions)
status: To Do
assignee:
  - '@codex'
  - '@lenucksi'
created_date: '2025-12-18 21:59'
updated_date: '2026-05-17 20:20'
labels:
  - agent-skills
  - mcp
  - docs
  - distribution
milestone: m-11
dependencies: []
references:
  - BACK-200
  - BACK-310
priority: medium
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md is installed by users (npm/brew/etc.) and agents already use the Backlog MCP tools for task operations. We want a first‑class Agent Skill that packages *all* agent guidance so skills‑compatible agents can learn the Backlog workflow without reading `backlog://…` resources. MCP tools remain the execution layer; the skill only supplies instructions. This should include everything currently in the MCP guidance set (agent nudge, workflow overview, task creation/execution/completion, init‑required) and be self‑contained (no `backlog://` references). The skill should be the canonical guidance to avoid drift; review the `backlog init` flow/agent‑nudge injection so it aligns with the skill‑based guidance.

Reference: https://agentskills.io/llms.txt
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An Agent Skill package for Backlog.md exists with `SKILL.md` plus supporting markdown files covering: agent nudge, workflow overview, task creation, task execution, task completion, and init-required guidance.
- [ ] #2 Skill guidance is self-contained and does not reference `backlog://` resources; it still instructs agents to use Backlog MCP tools for all task operations and to never edit markdown files directly.
- [ ] #3 Agents can follow the skill guidance to understand when to create/search tasks and how to work with Backlog.md without needing MCP resources for instructions.
- [ ] #4 `backlog init`/agent‑instruction messaging is updated to align with skill‑based guidance (no instructions that rely on `backlog://` resources).
- [ ] #5 Skill guidance is treated as the canonical source so the MCP guidance content (if still present) remains consistent with it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guidance-space relationships: BACK-200 (Claude Code init integration) shares the `backlog init` guidance-injection flow — align generated Claude Code commands with this skill's content. BACK-310 (strengthen MCP workflow overview) improves the MCP resource this skill intends to supersede as canonical guidance; if BACK-349 ships first, BACK-310's scope should narrow to keeping the MCP resource in sync with the skill rather than improving it independently.
<!-- SECTION:NOTES:END -->

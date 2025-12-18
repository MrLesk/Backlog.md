---
id: task-349
title: >-
  Publish Backlog.md as an Agent Skill with bundled guidance (no MCP resources
  required for instructions)
status: To Do
assignee:
  - '@codex'
created_date: '2025-12-18 21:59'
updated_date: '2025-12-18 22:03'
labels:
  - agent-skills
  - mcp
  - docs
  - distribution
dependencies: []
priority: medium
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

---
id: task-13
title: 'CLI: Add Agent Instruction Prompt'
status: "To Do"
created_date: 2025-06-08
labels: [cli, agents]
dependencies: []
---

## Description

Add an interactive step to `backlog init` that asks the user if they want to include instructions for AI agents such as Codex, Claude Code, or Google Jules. When confirmed, the command should create the appropriate guideline files (`AGENTS.md`, `.CLAUDE.md`, `.cursorrules`) if they do not exist, or append the instructions if they are already present.

## Acceptance Criteria

- [ ] `backlog init` prompts: "Add instructions for AI agents? [y/N]".
- [ ] On confirmation, guideline files are created or updated with Backlog usage instructions.
- [ ] Existing files are appended rather than overwritten.
- [ ] Declining the prompt leaves the repository unchanged.
- [ ] Feature covered by automated tests.

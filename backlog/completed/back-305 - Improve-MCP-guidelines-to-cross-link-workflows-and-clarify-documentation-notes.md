---
id: BACK-305
title: Improve MCP guidelines to cross-link workflows and clarify documentation notes
status: Done
assignee:
  - '@codex'
created_date: '2025-10-21 19:07'
updated_date: '2025-10-21 19:07'
labels:
  - retroactive
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- Update `src/guidelines/mcp/overview.md` to point agents to the task-execution and task-creation workflows while reinforcing the "search first" process.
- Clarify the numbering and structure in `src/guidelines/mcp/task-completion.md`, adding explicit guidance for implementation notes used as PR summaries.
- Emphasize in `src/guidelines/mcp/task-execution.md` that tasks must act as the canonical storage for plans and notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overview workflow references are up to date and direct agents to the proper creation/execution docs.
- [x] #2 Task completion guidelines explain how implementation notes should act as a PR-style summary.
- [x] #3 Task execution guidelines stress that tasks store the canonical plan and notes.
<!-- AC:END -->

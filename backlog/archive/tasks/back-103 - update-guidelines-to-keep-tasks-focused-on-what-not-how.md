---
id: BACK-103
title: Update guidelines to keep tasks focused on "what" not "how"
status: To Do
assignee: []
created_date: '2025-06-23'
labels:
  - documentation
  - agents
dependencies: []
---

## Description

Clarify in the canonical `AGENT_GUIDELINES.md` file that tasks should describe the desired outcome and acceptance criteria without delving into implementation steps. AI agents often begin writing code inside tasks instead of defining the work for someone else. Update the guidelines to emphasize writing tasks that focus on **what** needs to be achieved and leave the **how** for implementation plans or the actual assignee.

## Acceptance Criteria

- [ ] `src/guidelines/AGENT_GUIDELINES.md` explains that tasks should only define outcomes and expectations, not implementation details or code snippets.
- [ ] `src/guidelines/AGENT_GUIDELINES.md` reinforces separating the "what" (task description and acceptance criteria) from the "how" (implementation plan).

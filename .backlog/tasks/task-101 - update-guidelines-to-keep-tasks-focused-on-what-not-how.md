---
id: task-101
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

Clarify across all agent instruction files that tasks should describe the desired outcome and acceptance criteria without delving into implementation steps. AI agents often begin writing code inside tasks instead of defining the work for someone else. Update the guidelines to emphasize writing tasks that focus on **what** needs to be achieved and leave the **how** for implementation plans or the actual assignee.

## Acceptance Criteria

- [ ] `CLAUDE.md` explains that tasks should only define outcomes and expectations, not implementation details or code snippets.
- [ ] `AGENTS.md` reinforces separating the "what" (task description and acceptance criteria) from the "how" (implementation plan).
- [ ] `.cursorrules` contains the same instruction for agents.
- [ ] The guideline versions in `src/guidelines/` mirror these updates.
- [ ] Task committed to repository.

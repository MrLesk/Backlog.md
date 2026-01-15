---
id: BACK-351
title: Strengthen MCP task creation guidance for standalone tasks
status: To Do
assignee: []
created_date: '2025-12-25 20:04'
updated_date: '2025-12-26 17:40'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the MCP workflow instructions to explicitly address the AI agent lifecycle reality: each task is executed by an independent agent session with no memory of previous sessions or other tasks.

**Core Problem:**
Agents create tasks like they're building a personal todo list, not realizing:
1. They won't exist to work on the other tasks they create
2. A fresh agent with zero context will pick up each task
3. Context must be *in* the task, not in the agent's "memory"

**Changes Required:**

1. **task-creation.md** - Add "Agent Lifecycle Reality" section after scope assessment:
   - Explicitly state agents will NOT work on all tasks they create
   - Each task handled by separate agent session with no memory
   - Design tasks as work orders for strangers
   - Never assume executing agent knows "what we discussed"
   - Dependencies must state what the other task provides
   - Include links to relevant code/docs in task description

2. **overview.md** - Add "Execution Model" to Core Principle section:
   - Brief statement that tasks are executed by independent AI agents
   - Each agent sees only its assigned task, not conversation history
   - Write tasks that a developer with no prior context could start immediately

3. **task-execution.md** - Strengthen handoff language:
   - Change "future agents" to be more explicit about replacement/interruption
   - Emphasize tasks as permanent storage because agent may be replaced at any point

This prevents agents from creating tightly-coupled task batches that only make sense with shared context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task-creation.md includes 'Agent Lifecycle Reality' section explaining agents won't work on all tasks they create
- [ ] #2 task-creation.md guidance requires tasks be written as work orders for strangers with full context
- [ ] #3 overview.md includes 'Execution Model' statement about independent agent sessions

- [ ] #4 task-execution.md strengthens language about agent replacement/interruption and handoff
- [ ] #5 Task-creation guidance requires tests and documentation expectations per task (no deferring to later tasks)
- [ ] #6 Guide includes anti-pattern example (deferred tests/docs) vs correct example (standalone tasks)
<!-- AC:END -->

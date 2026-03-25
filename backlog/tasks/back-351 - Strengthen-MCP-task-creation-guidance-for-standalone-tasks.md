---
id: BACK-351
title: Strengthen MCP task creation guidance for standalone tasks
status: Done
assignee:
  - '@codex'
created_date: '2025-12-25 20:04'
updated_date: '2026-01-16 18:44'
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
- [x] #1 task-creation.md includes 'Agent Lifecycle Reality' section explaining agents won't work on all tasks they create
- [x] #2 task-creation.md guidance requires tasks be written as work orders for strangers with full context
- [x] #3 overview.md includes 'Execution Model' statement about independent agent sessions

- [x] #4 task-execution.md strengthens language about agent replacement/interruption and handoff
- [x] #5 Task-creation guidance requires tests and documentation expectations per task (no deferring to later tasks)
- [x] #6 Guide includes anti-pattern example (deferred tests/docs) vs correct example (standalone tasks)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update src/guidelines/mcp/task-creation.md with an "Agent Lifecycle Reality" section after scope assessment, covering independent agent sessions, writing tasks as work orders for strangers, explicit dependency outputs, and linking relevant code/docs.
2. Strengthen task-creation guidance to require per-task testing/documentation expectations and add an anti-pattern vs correct example for deferred tests/docs.
3. Add an "Execution Model" statement in src/guidelines/mcp/overview.md under Core Principle to emphasize independent agent sessions and standalone task context.
4. Tighten handoff/replacement language in src/guidelines/mcp/task-execution.md to stress tasks as the permanent record when agents are replaced or interrupted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: added Agent Lifecycle Reality guidance to task-creation workflow, including explicit dependency/context rules and standalone tests/docs expectations with anti-pattern vs correct examples.

Summary: added Execution Model statement in overview and strengthened task-execution handoff language to stress agent replacement.

Tests: not run (documentation-only changes).
<!-- SECTION:NOTES:END -->

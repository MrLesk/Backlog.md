---
name: backlog-technical-project-manager
description: >-
  Technical project management for Backlog.md workstreams using coordinated
  sub-agents. Use only when the user explicitly asks Codex to take over one or
  more existing Backlog.md tasks (for example: "act as TPM", "coordinate these
  tasks", "delegate to sub-agents"). Orchestrate planning, implementation, and
  finalization; manage dependencies and overlapping code areas; review and
  approve sub-agent plans before implementation.
---

# Backlog.md Technical Project Manager

## Overview

Act as a coordinator and approver for complex Backlog.md task delivery. Avoid deep code implementation work directly; delegate discovery and coding to sub-agents, then validate business outcomes and acceptance criteria.

## Activation Rule

Activate this skill only after explicit user intent to delegate coordination, such as:
- "Act as TPM"
- "Take over these tasks"
- "Coordinate implementation with sub-agents"

If intent is not explicit, ask for confirmation before activating.

## TPM Operating Constraints

1. Read Backlog.md workflow guidance first:
   - `backlog://workflow/overview`
   - `backlog://workflow/task-creation`
   - `backlog://workflow/task-execution`
   - `backlog://workflow/task-finalization`
2. Treat the workflow resources above as authoritative for Backlog.md process behavior.
3. Keep TPM token usage focused:
   - Do not perform broad codebase research yourself
   - Delegate implementation research, blast-radius analysis, and coding to sub-agents
4. Verify requirements and outcomes:
   - Confirm each approved plan maps to task acceptance criteria and Definition of Done
   - Enforce scope boundaries and dependency-safe sequencing
5. Unblock verification aggressively when needed:
   - TPM is authorized to install required tooling/dependencies for agents
   - TPM is authorized to troubleshoot the environment (including stopping stuck processes) so verification can run
   - TPM should not accept "done" without verifiable evidence

## Coordination Workflow

1. Build a task map:
   - Load each requested task with `task_view`
   - Identify explicit dependencies from task metadata
   - Infer implicit overlap risk from task descriptions/references/components
2. Create execution lanes:
   - Run tasks in parallel only when overlap risk is low
   - Serialize tasks that might touch the same components/files
3. Assign ownership:
   - One sub-agent owns one task at a time
   - One task should produce exactly one PR
4. Manage questions:
   - Answer sub-agent questions quickly
   - Resolve direction conflicts and ambiguity before implementation continues

## Sub-Agent Workspace Rules

For each task `<taskId>` (example `BACK-123`), use a dedicated clone:

```bash
mkdir -p ../Backlog.md-copies
if [ ! -d "../Backlog.md-copies/backlog-<taskId>/.git" ]; then
  git clone "$(pwd)" "../Backlog.md-copies/backlog-<taskId>"
fi
cd "../Backlog.md-copies/backlog-<taskId>"
bun i
```

Then require a task branch with project naming convention:
- `tasks/<taskId>-<short-slug>`

Never share a working directory across concurrently active tasks.

## Sub-Agent Brief Template

Use this as the default brief for each spawned implementation agent:

1. Read all four authoritative Backlog.md workflow resources before planning or coding.
2. Read the assigned task fully (description, AC, DoD, dependencies, notes, references).
3. Move task to `In Progress` and assign to yourself (`-a @{your-name}`).
4. Plan before coding:
   - Research blast radius and touched components
   - Check latest official documentation for external libraries/APIs involved
   - Do not rely on stale memory when docs can be verified
5. Write implementation plan into the task record.
6. Return plan summary to TPM and wait for approval.
7. Implement only after TPM approval.
8. During implementation:
   - Append implementation notes in task record
   - Check off AC/DoD items as completed
   - Keep scope strict; escalate scope changes to TPM
9. Finalize:
   - Verify the change as a Backlog.md user, from the user point of view:
     - Run impacted end-to-end user flows (CLI/MCP/Web/TUI as applicable)
     - Run relevant automated checks/tests for touched scope
     - Record concrete verification evidence (commands + outcomes) in notes/final summary
   - Confirm all AC and DoD items are checked
   - Write final summary
   - Set status to `Done` only after successful verification evidence exists
   - Open one PR for this task (title: `<taskId> - <taskTitle>`)
   - If verification is blocked, do not set `Done`; escalate to TPM immediately
10. Report back with:
   - PR link
   - Verification steps run (including user-flow checks)
   - Risks/follow-ups

Enforce isolation: each worker agent must operate only in its own dedicated clone and task branch, so cross-agent file interference should not occur.

## Plan Approval Gate

Before authorizing implementation:
1. Review every sub-agent plan against AC/DoD and stated business intent.
2. Check for hidden overlap with other active tasks.
3. Request plan revisions when scope, sequencing, or risk is unclear.
4. Approve implementation only when plan is recorded and coherent.

## Finalization Gate

Before considering a task complete:
1. Confirm one task maps to one PR.
2. Confirm task status is `Done` and Final Summary is present.
3. Confirm AC/DoD checklists are complete.
4. Confirm implementation notes and verification evidence are documented.
5. Reject completion claims that lack executable proof from user-perspective validation.
6. Deliver a concise TPM report back to the user:
   - Completed tasks and PRs
   - Remaining blockers
   - Suggested next approvals/decisions (without creating new tasks autonomously)

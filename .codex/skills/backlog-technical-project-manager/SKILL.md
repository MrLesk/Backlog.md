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
6. Maintain the skill's operational memory:
   - Keep the `## Common Agent Mistakes (Keep Updated)` section current
   - At the end of each takeover, add newly observed repeatable failure patterns
   - Remove or rewrite stale entries when process or tooling changes make them obsolete
7. Improve quality gates with explicit user approval:
   - When recurring verification gaps appear, propose DoD updates to the user
   - Suggest concrete new DoD checklist items when they would prevent repeat failures
   - Do not silently change task DoD scope; present recommendation and wait for user decision

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
7. Include DoD recommendations when relevant:
   - If execution exposed missing/weak DoD checks, propose specific DoD additions or edits
   - Ask the user whether to apply those DoD changes now or defer them

## Common Agent Mistakes (Keep Updated)

This section is a living checklist for future TPMs. Update it after each multi-task takeover.

1. **Setting task `Done` when DoD is externally blocked**
   - Symptom: AC is complete, but DoD command(s) fail due to baseline or unrelated repo errors.
   - TPM guardrail: keep task `In Progress`, explicitly uncheck blocked DoD items, and document dependency on the blocker.

2. **Using local-path git remotes in dedicated clones**
   - Symptom: `gh pr create` fails with "no git remotes ... known GitHub host".
   - TPM guardrail: standardize clone remote before PR steps:
     - `git remote set-url origin https://github.com/MrLesk/Backlog.md.git`

3. **Mis-attributing regressions to the wrong task/PR**
   - Symptom: bug report gets sent to wrong branch, causing rework and delay.
   - TPM guardrail: run a quick ownership check (changed files + commit/PR history) before assigning fix work.

4. **Corrupting PR notes with raw command output**
   - Symptom: PR body contains terminal escape sequences or huge copied logs.
   - TPM guardrail: keep PR notes concise (summary, verification commands, scoped notes) and never paste full terminal dumps.

5. **Introducing undeclared transitive dependencies**
   - Symptom: local tests pass, but CI/compile fails with "Cannot find module ...".
   - TPM guardrail: when importing new packages (including transitive/internal modules), ensure explicit dependency declarations and lockfile updates, then run a compile smoke check.

6. **Assuming CI is healthy after local pass**
   - Symptom: local verification passes but PR checks fail later.
   - TPM guardrail: inspect PR check status after each push and act on first failing job/log immediately.

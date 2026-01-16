## Task Execution Guide

### Planning Workflow

> **Non-negotiable:** Capture an implementation plan in the Backlog task _before_ writing any code or running commands. The plan must live in the task record prior to implementation and remain up to date when you close the task.

1. **Mark task as In Progress** via `task_edit` with status "In Progress"
2. **Assign to yourself** via `task_edit` with assignee field
3. **Draft the implementation plan** - Think through the approach, review code, identify key files
4. **Present plan to user** - Show your proposed implementation approach
5. **Wait for explicit approval** - Do not start coding until user confirms or asks you to skip review
6. **Record approved plan** - Use `task_edit` with planSet or planAppend to capture the agreed approach in the task
7. **Document the agreed breakdown** - In the parent task's plan, capture the final list of subtasks, owners, and sequencing so future agents see the structure the user approved

**IMPORTANT:** Use tasks as a permanent storage for everything related to the work. Implementation plan and notes are essential to resume work in case of interruptions or handoffs.

### Planning Guidelines

- Keep the Backlog task as the single plan of record: capture the agreed approach with `task_edit` (planSet field) before writing code
- Use `task_edit` (planAppend field) to refine the plan when you learn more during implementation
- Verify prerequisites before committing to a plan: confirm required tools, access, data, and environment support are in place
- Keep plans structured and actionable: list concrete steps, highlight key files, call out risks, and note any checkpoints or validations
- Ensure the plan reflects the agreed user outcome and acceptance criteria; if expectations are unclear, clarify them before proceeding
- When additional context is required, review relevant code, documentation, or external references so the plan incorporates the latest knowledge
- Treat the plan and acceptance criteria as living guides - update both when the approach or expectations change so future readers understand the rationale
- If you need to add or remove tasks or shift scope later, pause and run the "present → approval" loop again before editing the backlog; never change the breakdown silently

### Working with Subtasks (Planning)

- If working on a parent task with subtasks, create a high-level plan for the parent that outlines the overall approach
- Each subtask should have its own detailed implementation plan when you work on it
- Ensure subtask plans are consistent with the parent task's overall strategy

### Execution Workflow

- **IMPORTANT**: Do not touch the codebase until the implementation plan is approved _and_ recorded in the task via `task_edit`
- The recorded plan must stay accurate; if the approach shifts, update it first and get confirmation before continuing
- If feedback requires changes, revise the plan first via `task_edit` (planSet or planAppend fields)
- Work in short loops: implement, run the relevant tests, and immediately check off acceptance criteria with `task_edit` (acceptanceCriteriaCheck field) when they are met
- Log progress with `task_edit` (notesAppend field) to document decisions, blockers, or learnings
- Keep task status aligned with reality via `task_edit`

### Handling Scope Changes

If new work appears during implementation that wasn't in the original acceptance criteria:

**STOP and ask the user**:
"I discovered [new work needed]. Should I:
1. Add acceptance criteria to the current task and continue, or
2. Create a follow-up task to handle this separately?"

**Never**:
- Silently expand the scope without user approval
- Create new tasks on your own initiative
- Add acceptance criteria without user confirmation

### Staying on Track

- Stay within the scope defined by the plan and acceptance criteria
- Update the plan first if direction changes, then get user approval for the revised approach
- If you need to deviate from the plan, explain why and wait for confirmation

### Working with Subtasks (Execution)

- When user assigns you a parent task "and all subtasks", work through each subtask sequentially without asking for permission to move to the next one
- When completing a single subtask (without explicit instruction to continue), present progress and ask: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- Each subtask should be fully completed (all acceptance criteria met, tests passing) before moving to the next

### Finalizing the Task

When implementation is finished, follow the **Task Finalization Guide** (`backlog://workflow/task-finalization`) to finalize your work. This ensures acceptance criteria are verified, implementation is documented, and the task is properly closed.

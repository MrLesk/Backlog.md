## Task Execution Guide

### Planning Workflow

> **Non-negotiable:** Capture an implementation plan in the Backlog task _after_ taking the task into progress and
> researching the current system, but before implementation. The plan must live in the task record prior to implementation
> and remain up to date when you close the task. CLI instructions are canonical; this legacy MCP guide preserves parity.

1. **Read before mutating** - Use `task_view` to inspect the current status, description, acceptance criteria, dependencies, references, and documentation
2. **Confirm eligibility and scope** - Verify the task is eligible to start, its dependencies permit work, and it remains within the requested scope
3. **Mark task as In Progress** via `task_edit` with status "In Progress"
4. **Assign to yourself** via `task_edit` with assignee field
5. **Research the current system** - Inspect relevant code, tests, conventions, and recent changes rather than relying on an approach proposed when the task was created
6. **Draft and record the implementation plan** - Use `task_edit` with planSet or planAppend to capture the current approach in the task
7. **Apply proportional review** - If the plan contains a material product, architecture, or workflow decision, or the project or user requires plan review, present it and wait for explicit approval before implementation. Routine plans can proceed when no review was requested and they stay within confirmed scope
8. **Document the agreed breakdown** - In the parent task's plan, capture any approved list of subtasks, owners, and sequencing so a replacement agent can resume with the current structure

**IMPORTANT:** Use tasks as permanent storage for everything related to the work. You may be interrupted or replaced at any point, so the task record must contain everything needed for a clean handoff.

### Planning Guidelines

- Keep the Backlog task as the single plan of record: capture the current approach with `task_edit` (planSet field) before writing code
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

- **IMPORTANT**: Do not start implementation until the current implementation plan is recorded in the task via `task_edit` and any review required by the proportional-review rule above is complete
- The recorded plan must stay accurate. Update routine plan adjustments in the task and continue without mandatory human confirmation when they stay within confirmed scope and introduce no material decision
- If feedback requires changes, revise the plan first via `task_edit` (planSet or planAppend fields)
- Work in short loops: implement, run the relevant tests, and record progress. Do not check acceptance criteria, write the final summary, or move the task to Done from this guide alone; first follow the Task Finalization Guide and verify each acceptance criterion with objective evidence.
- Log progress with `task_edit` (notesAppend field) to document decisions, blockers, or learnings
- Use `task_edit` (`commentsAppend` with optional `commentAuthor`) for task discussion, review questions, or handoff notes that are not part of the execution log
- Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters
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
- Update the plan before following a changed approach
- If a deviation introduces a material product, architecture, or workflow decision, or the project explicitly requires review, explain it and wait for approval. Otherwise record the routine adjustment and continue within confirmed scope

### Working with Subtasks (Execution)

- When user assigns you a parent task "and all subtasks", work through each subtask sequentially without asking for permission to move to the next one
- When completing a single subtask (without explicit instruction to continue), present progress and ask: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- Each subtask should be fully completed (all acceptance criteria met, tests passing) before moving to the next

### Finalizing the Task

When implementation is finished, follow the **Task Finalization Guide** (`backlog://workflow/task-finalization`) to finalize your work. This ensures acceptance criteria are verified with behavior-level evidence, implementation is documented, and the task is properly closed.

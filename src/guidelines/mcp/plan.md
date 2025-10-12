## 2. Plan the work (How)

### Planning workflow
1. **Mark task as In Progress** via `task_update` with status "In Progress"
2. **Assign to yourself** via `task_update` with assignee field
3. **Draft the implementation plan** - Think through the approach, review code, identify key files
4. **Present plan to user** - Show your proposed implementation approach
5. **Wait for explicit approval** - Do not start coding until user confirms or asks you to skip review
6. **Record approved plan** - Use `plan_set` to capture the agreed approach in the task
7. **Document the agreed breakdown** – In the parent task’s plan, capture the final list of subtasks, owners, and sequencing so future agents see the structure the user approved.

### Planning guidelines
- Keep the Backlog task as the single plan of record: capture the agreed approach with `plan_set` before writing code
- Use `plan_append` to refine the plan when you learn more during implementation
- Verify prerequisites before committing to a plan: confirm required tools, access, data, and environment support are in place
- Keep plans structured and actionable: list concrete steps, highlight key files, call out risks, and note any checkpoints or validations
- Ensure the plan reflects the agreed user outcome and acceptance criteria; if expectations are unclear, clarify them before proceeding
- When additional context is required, review relevant code, documentation, or external references so the plan incorporates the latest knowledge
- Treat the plan and acceptance criteria as living guides - update both when the approach or expectations change so future readers understand the rationale
- If you need to add or remove tasks or shift scope later, pause and run the “present → approval” loop again before editing the backlog; never change the breakdown silently.

### Working with subtasks
- If working on a parent task with subtasks, create a high-level plan for the parent that outlines the overall approach
- Each subtask should have its own detailed implementation plan when you work on it
- Ensure subtask plans are consistent with the parent task's overall strategy

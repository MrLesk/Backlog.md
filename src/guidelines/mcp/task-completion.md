## Task Completion Guide

### Completion Workflow

1. **Verify all acceptance criteria** - Confirm every criterion is satisfied (use `task_view` to see current status)
2. **Run the Definition of Done checklist** (see below)
3. **Summarize the work** - Use `task_edit` (notesAppend field) to document what changed and why (treat it like a PR description)
4. **Confirm the implementation plan is captured and current** - Update the plan in Backlog if the executed approach deviated
5. **Update task status** - Set status to "Done" via `task_edit`
6. **Propose next steps** - Never autonomously create or start new tasks

**Note:** Tasks stay in "Done" status until periodic cleanup. Moving to the completed folder (`task_complete` or CLI cleanup) is a batch operation run occasionally, not part of finishing each task.

**Important:** Do not use `task_archive` for completed work. Archive is only for tasks that should not be completed (duplicate, canceled, invalid).

### Definition of Done Checklist

- Implementation plan exists in the task record (`task_edit` planSet/planAppend) and reflects the final solution
- Acceptance criteria are all checked via `task_edit` (acceptanceCriteriaCheck field)
- Automated and relevant manual tests pass; no new warnings or regressions introduced
- Documentation or configuration updates completed when required
- Implementation notes capture what changed and why via `task_edit` (notesAppend field)
- Status transitions to "Done" via `task_edit`

### After Completion

**Never autonomously create or start new tasks.** Instead:

- **If follow-up work is needed**: Present the idea to the user and ask whether to create a follow-up task
- **If this was a subtask**:
  - Check if user explicitly told you to work on "parent task and all subtasks"
    - If YES: Proceed directly to the next subtask without asking
    - If NO: Ask user: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- **If all subtasks in a series are complete**: Update parent task status if appropriate, then ask user what to do next

### Working with Subtasks

- When completing a subtask, check all its acceptance criteria individually
- Update subtask status to "Done" via `task_edit`
- Document subtask-specific outcomes in the subtask's notes
- Only update parent task status when ALL subtasks are complete (or when explicitly instructed)

### Implementation notes (PR summary)

The implementation notes are often used as the summary of changes made, similar to a pull request description.

Use `task_edit` (notesAppend field) to record:
- Implementation decisions and rationale
- Blockers encountered and how they were resolved
- Technical debt or future improvements identified
- Testing approach and results

These notes help future developers (including AI agents) understand the context.
Do not repeat the same information that is clearly understandable from the code.

Write a structured summary that highlights the key points of the implementation.

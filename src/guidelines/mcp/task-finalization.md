## Task Finalization Guide

### Finalization Workflow

1. **Review all acceptance criteria and Definition of Done items** - Use `task_view` to see current status and identify what evidence each unchecked item needs.
2. **Run objective verification before checking acceptance criteria** - Use automated tests, command output, scripted UI checks, or explicit manual verification of the behavior. For UI or interactive work, exercise the behavior through a browser, DOM script, test runner, or documented manual interaction result. Do not check acceptance criteria from code presence, grep output, or implementation intent alone.
3. **Check only proven acceptance criteria and Definition of Done items** - Use `task_edit` with `acceptanceCriteriaCheck` and `definitionOfDoneCheck/Uncheck` as needed.
4. **Run the Definition of Done checklist** (see below)
5. **Write the Final Summary** - Use `task_edit` (`finalSummary` field) to capture a PR-style summary of what changed and why. Avoid one-line summaries unless the change is trivial; include tests and key scope for reviewers.
6. **Confirm the implementation plan is captured and current** - Update the plan in Backlog if the executed approach deviated
7. **Update task status** - Set status to "Done" via `task_edit`
8. **Propose next steps** - Never autonomously create or start new tasks

**Note:** Tasks stay in "Done" status until periodic cleanup. Moving to the completed folder (`task_complete` or CLI cleanup) is a batch operation run occasionally, not part of finishing each task.

**Important:** Do not use `task_archive` for completed work. Archive is only for tasks that should not be completed (duplicate, canceled, invalid).

### Definition of Done Checklist

- Implementation plan exists in the task record (`task_edit` planSet/planAppend) and reflects the final solution
- Acceptance criteria are all checked via `task_edit` (acceptanceCriteriaCheck field) only after objective verification evidence proves the behavior
- Definition of Done items are all checked via `task_edit` (definitionOfDoneCheck field)
- Automated and relevant manual tests pass; no new warnings or regressions introduced
- Documentation or configuration updates completed when required
- Implementation notes capture progress during work via `task_edit` (notesAppend field)
- Final Summary captures the PR-style completion summary via `task_edit` (`finalSummary` field). Include what changed, why, tests run, and any risks/follow-ups when relevant.
- Status transitions to "Done" via `task_edit`

### After Finalization

**Never autonomously create or start new tasks.** Instead:

- **If follow-up work is needed**: Present the idea to the user and ask whether to create a follow-up task
- **If this was a subtask**:
  - Check if user explicitly told you to work on "parent task and all subtasks"
    - If YES: Proceed directly to the next subtask without asking
    - If NO: Ask user: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- **If all subtasks in a series are complete**: Update parent task status if appropriate, then ask user what to do next

### Working with Subtasks

- When finalizing a subtask, check all its acceptance criteria individually
- Update subtask status to "Done" via `task_edit`
- Document subtask-specific outcomes in the subtask's notes
- Only update parent task status when ALL subtasks are complete (or when explicitly instructed)

### Comments vs Implementation Notes vs Final Summary

Comments are for task discussion, review questions, and collaboration notes. Implementation notes are for progress logging during execution (decisions, blockers, learnings). The Final Summary is for the PR-style completion summary when the task is done.

Use `task_edit` (notesAppend field) to record:
- Implementation decisions and rationale
- Blockers encountered and how they were resolved
- Technical debt or future improvements identified
- Testing approach and results

These notes help future developers (including AI agents) understand the context.
Do not repeat the same information that is clearly understandable from the code.

Use `task_edit` (`finalSummary`) to write a structured PR-style summary that highlights the key points of the implementation.

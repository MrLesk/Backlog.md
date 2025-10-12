## 4. Review and learn

### Completion workflow
1. **Verify all acceptance criteria** - Confirm every criterion is satisfied via `criteria_list`
2. **Run the Definition of Done checklist** (see below)
3. **Summarize the work** - Use `notes_append` to document what changed and why (treat it like a PR description)
4. **Update task status** - Set status to "Done" via `task_update`
5. **Propose next steps** - Never autonomously create or start new tasks

### Definition of Done checklist
- Acceptance criteria are all checked via `criteria_check` / `criteria_list`
- Automated and relevant manual tests pass; no new warnings or regressions introduced
- Documentation or configuration updates completed when required
- Implementation notes capture what changed and why via `notes_append`
- Status transitions to "Done" via `task_update`

### After completion
**Never autonomously create or start new tasks.** Instead:

- **If follow-up work is needed**: Present the idea to the user and ask whether to create a follow-up task
- **If this was a subtask**:
  - Check if user explicitly told you to work on "parent task and all subtasks"
    - If YES: Proceed directly to the next subtask without asking
    - If NO: Ask user: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- **If all subtasks in a series are complete**: Update parent task status if appropriate, then ask user what to do next

### Working with subtasks
- When completing a subtask, check all its acceptance criteria individually
- Update subtask status to "Done" via `task_update`
- Document subtask-specific outcomes in the subtask's notes
- Only update parent task status when ALL subtasks are complete (or when explicitly instructed)

### Capturing learnings
- Use `notes_append` to record:
  - Implementation decisions and rationale
  - Blockers encountered and how they were resolved
  - Technical debt or future improvements identified
  - Testing approach and results
- These notes help future developers (including AI agents) understand the context

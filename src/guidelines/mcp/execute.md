## 3. Execute the task

### Execution workflow
- **IMPORTANT**: Before writing code, wait for the user to confirm the implementation plan (or to explicitly waive the review)
- If feedback requires changes, revise the plan first via `plan_set` or `plan_append`
- Work in short loops: implement, run the relevant tests, and immediately tick acceptance criteria with `criteria_check` when they are met
- Log progress with `notes_append` to document decisions, blockers, or learnings
- Keep task status aligned with reality via `task_update`

### Handling scope changes
If new work appears during implementation that wasn't in the original acceptance criteria:

**STOP and ask the user**:
"I discovered [new work needed]. Should I:
1. Add acceptance criteria to the current task and continue, or
2. Create a follow-up task to handle this separately?"

**Never**:
- Silently expand the scope without user approval
- Create new tasks on your own initiative
- Add acceptance criteria without user confirmation

### Staying on track
- Stay within the scope defined by the plan and acceptance criteria
- Update the plan first if direction changes, then get user approval for the revised approach
- If you need to deviate from the plan, explain why and wait for confirmation

### Working with subtasks
- When user assigns you a parent task "and all subtasks", work through each subtask sequentially without asking for permission to move to the next one
- When completing a single subtask (without explicit instruction to continue), present progress and ask: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- Each subtask should be fully completed (all acceptance criteria met, tests passing) before moving to the next

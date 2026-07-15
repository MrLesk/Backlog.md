## Task Execution Guide

Use this guide when you are working on an existing Backlog task.

### Planning Workflow

Before writing code for non-trivial work:

1. Read the task before mutating it:
   - `backlog task view {{TASK_ID:123}} --plain`
2. Review its current status, description, acceptance criteria, dependencies, references, and documentation. Confirm the
   task is eligible to start and remains within the requested scope.
3. Mark it in progress and assign yourself:
   - Inspect accepted statuses if needed: `backlog task edit {{TASK_ID:123}} --help`
   - `backlog task edit {{TASK_ID:123}} -s "<active status>" -a @your-name`
4. Research the current system, including relevant code, tests, conventions, and recent changes. Do not rely on an
   implementation approach proposed when the task was created.
5. Draft an implementation plan.
6. Record the current plan in the task before implementation:
   - `backlog task edit {{TASK_ID:123}} --plan "1. ..."`
7. If the plan contains a material product, architecture, or workflow decision, or the project or user requires plan
   review, present it and wait for explicit approval before implementation. Routine plans need not block when no review
   was requested and they stay within confirmed scope.

Keep the Backlog task as the plan of record. If the approach changes, update the plan through `backlog task edit` before continuing.

### Execution Workflow

Work in short loops:

1. Implement a focused slice.
2. Run relevant tests or checks.
3. Record useful progress:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Implemented parser and added tests."`
4. Add comments for discussion or review questions:
   - `backlog task edit {{TASK_ID:123}} --comment "Question for review" --comment-author @your-name`

Use `backlog task edit {{TASK_ID:123}} --help` before changing unfamiliar fields.

Do not check acceptance criteria, write the final summary, or move the task to the terminal status from this guide alone. When implementation appears complete, read the finalization guide and verify each acceptance criterion with objective evidence before checking it.

### Scope Changes

If you discover work that is outside the task's acceptance criteria, stop and ask the user whether to add scope to the current task or create follow-up work. Do not silently expand the task.

### Working With Subtasks

If the user assigns a parent task and all subtasks, complete subtasks one at a time. Each subtask should have its own plan, notes, checked acceptance criteria, and final summary.

If the user assigns only one subtask, finish that subtask and ask before moving to the next one.

### Reading and Writing Backlog Data

Use CLI commands for Backlog changes:

- Read: `backlog task view {{TASK_ID:123}} --plain`
- Search: `backlog search "query" --plain`
- List with task filters: `backlog task list --status "<active status>" --assignee @your-name --labels backend --search "auth" --limit 20 --plain`
- Update: `backlog task edit {{TASK_ID:123}} ...`
- Create docs: `backlog doc create "Title"`
- Update docs: `backlog doc update doc-1 --content "Markdown"`

For programmatic reads, `task list`, `task view`, `task <id>`, and `search` accept `--json`. JSON mode is noninteractive, versioned, and cannot be combined with `--plain`.

Do not edit Backlog markdown files directly. The CLI preserves metadata, IDs, filenames, relationships, and structured sections.

### Finishing

When implementation is complete, continue with:

```bash
backlog instructions task-finalization
```

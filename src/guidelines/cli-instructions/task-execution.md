## Task Execution Guide

Use this guide when you are working on an existing Backlog task.

### Planning Workflow

Before writing code for non-trivial work:

1. Read the task before mutating it:
   - `backlog task view {{TASK_ID:123}} --plain`
2. Review its current status, description, acceptance criteria, dependencies, references, and documentation. Confirm the
   task is eligible to start and remains within the requested scope.
   - The `Dependency Graph` section reads the whole context: `Depends on` is what this task transitively waits on,
     `Dependents` is what transitively waits on it. Outermost entries are direct, indented entries are transitive.
   - `unknown task ID` and `ambiguous task ID` are unresolved identities, never satisfied dependencies. The graph stops
     at one instead of guessing, so treat that branch as unknown and run `backlog doctor` before relying on it.
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

Keep the Backlog task as the plan of record. If the approach changes, replace it with `--plan` or extend it with one
or more repeatable `--append-plan` values. When both options are provided, `--plan` replaces the existing plan first,
then each `--append-plan` value is appended in CLI order:

- `backlog task edit {{TASK_ID:123}} --append-plan "5. Verify the revised approach"`
- `backlog task edit {{TASK_ID:123}} --plan "1. Revised approach" --append-plan "2. Verify it"`

### Execution Workflow

Work in short loops:

1. Implement a focused slice.
2. Run relevant tests or checks.
3. Record useful progress:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Implemented parser and added tests."`
4. Add comments for discussion or review questions:
   - `backlog task edit {{TASK_ID:123}} --comment "Question for review" --comment-author @your-name`

Use `backlog task edit {{TASK_ID:123}} --help` before changing unfamiliar fields.

Replacing or clearing a legacy description, plan, notes, or final summary without section markers is refused if another
level-two heading makes its boundary ambiguous. The file stays unchanged. Stop and ask the user to add the BEGIN and
END markers named in the error around the intended section body without removing any content. Do not edit task or
draft files directly. The user should place the END marker before a separate section, or after headings that belong
to the body. Retry the CLI edit after the user repairs the boundary. Appends remain supported and keep ambiguous
sections unmarked, so later replacements remain protected.

Do not check acceptance criteria, write the final summary, or move the task to the terminal status from this guide alone. When implementation appears complete, read the finalization guide and verify each acceptance criterion with objective evidence before checking it.

### Scope Changes

If you discover work that is outside the task's acceptance criteria, stop and ask the user whether to add scope to the current task or create follow-up work. Do not silently expand the task.

### Replacing Acceptance Criteria

`--acceptance-criteria` replaces the full list; repeat it for each item. Matching trimmed text keeps its check state,
even after reordering. Duplicate text matches old entries in order, once per entry. New or reworded entries start
unchecked, and omitted entries are removed. Use `--check-ac` or `--uncheck-ac` in a separate edit to change check states.

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
- Archive docs: `backlog doc archive doc-1` moves the file to `backlog/archive/docs/`. The ID stays reserved. The document stays viewable with `backlog doc view` and is read-only. Tasks and drafts whose documentation names the file are printed, not changed.
- Restore docs: `backlog doc restore doc-1` moves an archived document back to `backlog/docs/` with the same ID.
- Delete docs: archive first, then `backlog doc delete doc-1`. Delete asks no question, removes the file and releases the ID. Tasks and drafts whose documentation names the file are printed, not changed.
- Decisions follow the same steps: `backlog decision archive decision-1` moves the file to `backlog/archive/decisions/`, keeps the ID reserved and makes the decision read-only; `backlog decision restore decision-1` brings it back; `backlog decision delete decision-1` removes an archived decision without a question and releases the ID. Tasks and drafts whose documentation names the file are printed, not changed.

For documentation links on tasks or drafts, `task edit` and `draft edit` use `--doc` to replace the full list. Use
`--add-doc` or `--remove-doc` to change individual entries; both accept repeated flags or comma-separated values.
Use `--clear-docs` to remove all entries. Do not combine replacement or clear flags with add/remove flags.

For programmatic reads, `task list`, `task view`, `task <id>`, `draft list`, `decision list`, and `search` accept `--json`. JSON mode is noninteractive, versioned, and cannot be combined with `--plain`.

Do not edit Backlog markdown files directly. The CLI preserves metadata, IDs, filenames, relationships, and structured sections.

### Finishing

When implementation is complete, continue with:

```bash
backlog instructions task-finalization
```

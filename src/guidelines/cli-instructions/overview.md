## Backlog.md Overview (CLI)

Backlog.md tracks committed work: what will be built, fixed, or changed.

### When to Use Backlog

Create a task when work requires planning, decisions, or handoff notes. Search for an existing task first. Skip task creation for questions, exploration, and obvious mechanical edits.

### Find and Read Work

- `backlog search "query" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
- `backlog task view {{TASK_ID:123}} --plain`

For long lists, use `--max-count` and `--skip`, follow the printed `Next` command, or use `--count` for the total; command help covers the details.

For scripts, `task list`, `task view`, `task <id>`, `draft list`, `decision list`, and `search` accept versioned `--json` output instead of `--plain`. `task list --json --watch` emits complete replacement responses; read successive JSON values, not individual lines. Filters and local scope are unchanged; intermediate edits may be coalesced. Restart for a fresh snapshot.

### Required Guides

Read the matching guide before taking these actions; this overview does not replace it:

- `backlog instructions task-creation` — before creating or splitting tasks
- `backlog instructions task-execution` — before planning, changing status or assignee, adding notes, or implementing
- `backlog instructions task-finalization` — before checking acceptance criteria, writing final summaries, or marking work finished

Use `backlog <command> --help` before unfamiliar operations. Help describes fields, output, and examples.

### Task Lifecycle

Mark finished work Done (or the configured final status) and leave it on the board until periodic cleanup.

Archive (`backlog task archive {{TASK_ID:123}}`) moves a task in any status off the board: finished work during cleanup, and canceled, duplicate, or invalid work at any time. An archived task keeps its ID, its record, and every dependency and reference to it. It stays readable with `backlog task view` and is read-only. A dependency on an archived task counts as satisfied only when that task is in the final status.

Restore (`backlog task restore {{TASK_ID:123}}`) moves an archived task back to the board with the same ID and the status it had. Restore a task before changing it: editing an archived task fails and names this command.

Deleting a task takes two steps: archive it, then run `backlog task delete {{TASK_ID:123}}`. Delete permanently removes the archived task and releases its ID once no other branch or worktree still holds the task. It removes the dependencies and references other tasks and drafts hold to it and names the tasks and drafts it changed. A task whose subtasks still exist, as tasks or as drafts, is not deleted.

Use the CLI for Backlog changes. Never edit task, draft, document, decision, or milestone markdown files directly; commands preserve metadata, relationships, and history.

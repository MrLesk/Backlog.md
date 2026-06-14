## Backlog.md Overview (CLI)

This project uses Backlog.md to track features, bugs, and structured work as tasks.

### When to Use Backlog

Create a task when the work requires planning, decisions, or handoff notes.

Ask: "Do I need to think about HOW to do this?"

- Yes: search for an existing task first, then create one if needed.
- No: do the small mechanical change directly.

Create tasks for work like bug fixes that need investigation, feature work, API changes, refactors, or anything that should be reviewed as a commitment. Skip task creation for questions, explanations, quick lookups, and obvious mechanical edits.

### Typical CLI Workflow

1. Search first:
   - `backlog search "query" --plain`
   - `backlog task list --status "To Do" --plain`
   - `backlog task list --status "In Progress" --plain`
   - `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
2. Read the relevant task:
   - `backlog task view {{TASK_ID:123}} --plain`
3. Create a task only when no suitable task exists:
   - `backlog task create "Title" -d "Description" --ac "Acceptance criterion"`
4. Execute through the task:
   - `backlog task edit {{TASK_ID:123}} -s "In Progress" -a @your-name`
   - `backlog task edit {{TASK_ID:123}} --plan "Implementation plan"`
   - `backlog task edit {{TASK_ID:123}} --notes "Progress note"`
5. Finalize:
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
   - `backlog task edit {{TASK_ID:123}} --check-dod 1`
   - `backlog task edit {{TASK_ID:123}} --final-summary "Summary"`
   - Inspect accepted statuses if needed: `backlog task edit {{TASK_ID:123}} --help`
   - `backlog task edit {{TASK_ID:123}} -s "<terminal status>"`

### Detailed Guides

Always read the relevant guide before that part of the workflow:

- `backlog instructions task-creation`
  -> Read before creating tasks: how to search, scope, and create tasks
- `backlog instructions task-execution`
  -> Read before planning or updating task work: how to plan, update, and work through tasks
- `backlog instructions task-finalization`
  -> Read before finishing tasks: how to verify, summarize, and finish tasks

Use `backlog <command> --help` before unfamiliar operations. Command help includes input fields, read/write behavior, output shape, and examples.

### Core Principle

Backlog tracks committed work: what will be built, fixed, or changed. Use the CLI for Backlog changes so metadata, file names, relationships, and history stay consistent.

### CLI Quick Reference

- `backlog search "text" --plain` - search tasks, documents, and decisions
- `backlog task list --plain` - list tasks; filter with `--status`, `--assignee`, `--parent`, `--priority`, `--labels`, `--search`, and `--limit`
- `backlog task view {{TASK_ID:123}} --plain` - read full task context
- `backlog task create "Title" -d "Description" --ac "Criterion"` - create a task
- `backlog task edit {{TASK_ID:123}} ...` - update task metadata and structured sections
- `backlog doc list --plain` / `backlog doc view doc-1` - inspect docs
- `backlog doc create "Title"` / `backlog doc update doc-1 --content "Markdown"` - manage docs
- `backlog milestone list --plain` - list milestones
- `backlog milestone add "Release"` - create a milestone file
- `backlog milestone rename "Release" "Release 2"` - rename a milestone and update local tasks
- `backlog milestone remove "Release" --task-handling clear` - remove a milestone and handle matching tasks
- `backlog cleanup` - periodically move terminal-status tasks to completed

Important: Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use Backlog commands so automatic metadata stays complete.

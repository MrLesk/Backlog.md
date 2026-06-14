## Backlog.md Overview (CLI)

This project uses Backlog.md to track features, bugs, and structured work as tasks.

### When to Use Backlog

Create a task when the work requires planning, decisions, or handoff notes.

Ask: "Do I need to think about HOW to do this?"

- Yes: search for an existing task first, then create one if needed.
- No: do the small mechanical change directly.

Create tasks for work like bug fixes that need investigation, feature work, API changes, refactors, or anything that should be reviewed as a commitment. Skip task creation for questions, explanations, quick lookups, and obvious mechanical edits.

### Start Every Request Here

Use this overview to decide what to read or run next. The detailed guides contain the procedure for creating, executing, and finalizing tasks.

Search and read before changing anything:

- `backlog search "query" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
- `backlog task view {{TASK_ID:123}} --plain`

### Detailed Guides

Always read the relevant guide before that part of the workflow. Do not rely on this overview alone for these actions:

- `backlog instructions task-creation`
  -> Read before creating tasks: how to search, scope, and create tasks
- `backlog instructions task-execution`
  -> Read before planning or updating task work: how to plan, update, and work through tasks
- `backlog instructions task-finalization`
  -> Read before finishing tasks: how to verify, summarize, and finish tasks

Use `backlog <command> --help` before unfamiliar operations. Command help includes input fields, read/write behavior, output shape, and examples.

### Core Principle

Backlog tracks committed work: what will be built, fixed, or changed. Use the CLI for Backlog changes so metadata, file names, relationships, and history stay consistent.

Important: Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use Backlog commands so automatic metadata stays complete.

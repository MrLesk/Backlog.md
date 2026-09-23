## Backlog.md Overview (CLI)

This project uses Backlog.md to track features, bugs, and structured work as tasks.

### When to Use Backlog

Create a task when the work requires planning, decisions, or handoff notes.

Ask: "Do I need to think about HOW to do this?"

- Yes: search for an existing task first, then create one if needed.
- No: do the small mechanical change directly.

Create tasks for work like bug fixes that need investigation, feature work, API changes, refactors, or anything that should be reviewed as a commitment. Skip task creation for questions, explanations, quick lookups, and obvious mechanical edits.

### Start Every Request Here

Use this overview to decide what to read or run next.

Search and read before changing anything:

- `backlog search "query" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
- `backlog task view {{TASK_ID:123}} --plain`

Lists print every match by default. To read a long list in windows, add `--max-count <n>` and `--skip <n>` to `task list`, `search`, `draft list`, `milestone list`, `doc list`, `doc search`, or `decision list`. Windows apply after filtering, sorting, and `--limit`, in the order the output prints, so consecutive windows of an unchanged backlog join into the complete output. Output cut by a window ends with `Showing <first>-<last> of <total> items. Next: <command>`; run that command for the following items. The last window has no `Next:` part, and a `--skip` past the end prints `Showing 0 of <total> items.` `--count` prints only the number of items the same command would list; it cannot be combined with `--json`. With `--json`, a cut list adds `total` and `nextSkip` (`null` after the last window).

Use `--json` instead of `--plain` on `task list`, `task view`, `task <id>`, or `search` when a script needs stable versioned fields. Do not combine the two flags. For a live task list, use `backlog task list --json --watch`: it emits the same complete, pretty-printed JSON response initially and whenever the result changes. Read successive JSON values and replace the previous list with each response; do not parse individual lines. Filters and local task scope are unchanged. Intermediate edits may be coalesced; restart for a fresh snapshot. The watch ends when the process that started it ends.

### Detailed Guides

**Required: read the matching guide below before creating, executing, or finalizing tasks. Do not rely on this overview alone for these actions.** The overview only tells you when to act; the guides define the required procedure, and skipping them produces inconsistent tasks and metadata.

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

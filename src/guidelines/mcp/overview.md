## Backlog.md Overview (MCP)

This project is backed by the Backlog.md project management tool. Every feature, bug, or refactor must be tracked as a Backlog task via MCP tools unless the user explicitly says otherwise. Before you write code or touch files, consult the workflow resource and task tools to confirm whether the request already has coverage or if you need to create a new task.

Backlog.md turns a Git repository into a structured project workspace built using Markdown files.

Helpers can:
- Inspect work: list tasks, view details, search, and read docs/decisions.
- Shape intent: create tasks, refine descriptions, define acceptance criteria.
- Guide execution: capture plans, track notes, maintain dependencies, manage status.
- Close work: validate acceptance criteria and definition of done, update statuses, and surface follow-up discussion.

### MCP task tool quick reference
- `task_list` — scan columns to confirm current scope and status.
- `task_view` — read the full task context (description, plan, notes, acceptance criteria).
- `task_search` — locate related work before creating anything new.
- `task_create` — register new work when the user agrees it should enter the backlog.
- `task_edit` / `task_update` — adjust status, metadata, and lifecycle fields.
- `criteria_check` / `criteria_list` — track acceptance criteria progress.
- `plan_set` / `plan_append` — capture or refine your implementation approach.
- `notes_append` — summarize progress, decisions, and review outcomes.

Always operate through the MCP tools—never edit files directly—so relationships, metadata, and history stay consistent.
**Always confirm the task context via MCP before touching code or files.**

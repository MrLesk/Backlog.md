## Backlog.md Overview (Tools)

Backlog.md tracks committed work. Create a task when work requires planning, decisions, or handoff notes. Skip task creation for questions, exploration, and obvious mechanical edits.

Search first with `task_search` or `task_list`, then read matching work with `task_view`. Use the existing task, or follow the creation guide if none fits.

### Required Guides

Call `get_backlog_instructions` and read the matching `instruction` before acting:

- `task-creation` — before creating or splitting tasks
- `task-execution` — before planning, changing status or assignee, adding notes, or implementing
- `task-finalization` — before checking acceptance criteria, writing final summaries, or marking work finished

These are the same guides exposed at `backlog://workflow/...`. Omit `instruction` or use `overview` for this overview; it does not replace the detailed guides.

### Task Lifecycle

Mark finished work Done (or the configured final status). Leave it on the board until periodic cleanup with `task_complete`. Use `task_archive` only for canceled, duplicate, or invalid work.

### MCP Tools Quick Reference

- `get_backlog_instructions`
- `task_list`, `task_search`, `task_view`, `task_create`, `task_edit`
- `task_complete` — move finished work off the board to completed storage during periodic cleanup; preserves its record and dependency links
- `task_archive` — archive canceled, duplicate, or invalid work; removes incoming dependencies and task references. Archived task IDs can be reused.
- `task_list` and `task_search` accept configured task types with OR semantics; `task_search` also accepts `modifiedFiles` for case-insensitive substring filtering against project-root-relative modified file paths
- `task_list` and `task_search` also accept configured `project` values with OR semantics for monorepo-style backlogs; the field is absent from both tool schemas when no `projects:` list is configured
- `task_edit` accepts `commentsAppend` and optional `commentAuthor` to append task discussion or review comments
- Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters
- `document_list`, `document_view`, `document_create`, `document_update`, `document_search`
- `document_create` and `document_update` support docs-directory-relative `path` values such as `guides/setup`; absolute paths and `..` traversal are rejected
- `definition_of_done_defaults_get`, `definition_of_done_defaults_upsert`

**Definition of Done support**
- `definition_of_done_defaults_get` reads project-level DoD defaults from config
- `definition_of_done_defaults_upsert` updates project-level DoD defaults in config
- `task_create` accepts `definitionOfDoneAdd` and `disableDefinitionOfDoneDefaults` for **exceptional** task-level DoD overrides only
- `task_edit` accepts `definitionOfDoneAdd`, `definitionOfDoneRemove`, `definitionOfDoneCheck`, `definitionOfDoneUncheck` for **exceptional** task-level DoD updates only
- DoD is a completion checklist, not acceptance criteria: keep scope/behavior in acceptance criteria, not DoD fields
- `task_view` output includes the Definition of Done checklist with checked state

**Always operate through the MCP tools above. Never edit markdown files directly; use the tools so relationships, metadata, and history stay consistent.**

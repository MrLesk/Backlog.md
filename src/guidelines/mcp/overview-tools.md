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

Mark finished work Done (or the configured final status) and leave it on the board until periodic cleanup. `task_archive` moves a task in any status off the board: finished work during cleanup, and canceled, duplicate, or invalid work at any time.

### MCP Tools Quick Reference

- `get_backlog_instructions`
- `task_list`, `task_search`, `task_view`, `task_create`, `task_edit`
- `task_archive` — move a task in any status off the board into the archive; keeps its ID, record, dependencies, and references. Archived tasks are read-only, stay viewable with `task_view`, and are marked `archived` in `task_search` results. A dependency on an archived task counts as satisfied only when that task is in the final status.
- `task_restore` — move an archived task back to the board with the same ID and the status it had. Restore a task before changing it: `task_edit` on an archived task fails.
- `task_delete` — permanently delete an archived task and release its ID once no other branch or worktree still holds the task. Deleting takes two steps: `task_archive`, then `task_delete`. It removes the dependencies and references other tasks and drafts hold to the task and names the tasks and drafts it changed. A task that is not archived, or whose subtasks still exist as tasks or as drafts, is not deleted.
- `task_list` and `task_search` accept configured task types with OR semantics; `task_search` also accepts `modifiedFiles` for case-insensitive substring filtering against project-root-relative modified file paths
- `task_list` and `task_search` also accept configured `project` values with OR semantics for monorepo-style backlogs; the field is absent from both tool schemas when no `projects:` list is configured
- `task_edit` accepts `commentsAppend` and optional `commentAuthor` to append task discussion or review comments
- Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters
- `document_list`, `document_view`, `document_create`, `document_update`, `document_search`
- `document_create` and `document_update` support docs-directory-relative `path` values such as `guides/setup`; absolute paths and `..` traversal are rejected
- `document_archive` moves a document's file unchanged to the same relative path under `backlog/archive/docs/`. The ID stays reserved. An archived document leaves `document_list` and `document_search`, stays viewable with `document_view`, and is read-only: `document_update` on it fails until it is restored. No task is changed; the result names the tasks and drafts whose documentation list names the moved file.
- `document_restore` moves an archived document's file back, unchanged, to the same relative path under `backlog/docs/`. The document keeps its ID and can be updated again. A file already at that path is never replaced.
- `document_delete` permanently removes an archived document's file and releases its ID once no other file and no committed file on any branch uses the number. Removing a document takes two steps: `document_archive`, then `document_delete`. Delete works only on an archived document and asks no question. No task is changed; the result names the tasks and drafts whose documentation list names the removed file, by its archive path or by the path it had before it was archived.
- `definition_of_done_defaults_get`, `definition_of_done_defaults_upsert`

**Definition of Done support**
- `definition_of_done_defaults_get` reads project-level DoD defaults from config
- `definition_of_done_defaults_upsert` updates project-level DoD defaults in config
- `task_create` accepts `definitionOfDoneAdd` and `disableDefinitionOfDoneDefaults` for **exceptional** task-level DoD overrides only
- `task_edit` accepts `definitionOfDoneAdd`, `definitionOfDoneRemove`, `definitionOfDoneCheck`, `definitionOfDoneUncheck` for **exceptional** task-level DoD updates only
- DoD is a completion checklist, not acceptance criteria: keep scope/behavior in acceptance criteria, not DoD fields
- `task_view` output includes the Definition of Done checklist with checked state

**Always operate through the MCP tools above. Never edit markdown files directly; use the tools so relationships, metadata, and history stay consistent.**

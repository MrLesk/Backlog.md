## Backlog.md Overview (MCP)

Backlog.md tracks committed work: what will be built, fixed, or changed.

### When to Use Backlog

Create a task when work requires planning, decisions, or handoff notes. Skip task creation for questions, exploration, and obvious mechanical edits.

Search first with `task_search` or `task_list`, then read matching work with `task_view`. Use the existing task, or follow the creation guide if none fits. Tasks must include enough context for someone without the current conversation to start work.

### Required Guides

Read the matching resource before taking these actions; this overview does not replace it:

- `backlog://workflow/task-creation` — before creating or splitting tasks
- `backlog://workflow/task-execution` — before planning, changing status or assignee, adding notes, or implementing
- `backlog://workflow/task-finalization` — before checking acceptance criteria, writing final summaries, or marking work finished

### Task Lifecycle

Mark finished work Done (or the configured final status) and leave it on the board until periodic cleanup. `task_archive` moves a task in any status off the board: finished work during cleanup, and canceled, duplicate, or invalid work at any time.

### MCP Tools Quick Reference

- `task_list` — list tasks with optional filtering by status, configured task type, configured project, assignee (or `unassigned: true`), milestone, labels, search, `ready: true` for unblocked tasks, or limit
- `task_search` — search tasks by title and description, or filter by configured task type, configured project, and project-root-relative `modifiedFiles` path substrings
- `task_view` — read full task context (description, plan, notes, comments, final summary, acceptance criteria, Definition of Done)
- `definition_of_done_defaults_get` — read project-level Definition of Done defaults from config
- `definition_of_done_defaults_upsert` — replace project-level Definition of Done defaults in config
- `document_list` — list documents, including type, path, timestamps, and tags
- `document_view` — view document metadata and markdown content
- `document_create` — create a document with title, content, optional type/tags, and optional docs-directory-relative path
- `document_update` — update document content, optional title/type/tags, and optional docs-directory-relative path
- `document_archive` moves a document's file unchanged to the same relative path under `backlog/archive/docs/`. The ID stays reserved. An archived document leaves `document_list` and `document_search`, stays viewable with `document_view`, and is read-only: `document_update` on it fails until it is restored. No task is changed; the result names the tasks and drafts whose documentation list names the moved file.
- `document_restore` moves an archived document's file back, unchanged, to the same relative path under `backlog/docs/`. The document keeps its ID and can be updated again. A file already at that path is never replaced.
- `document_delete` permanently removes an archived document's file and releases its ID once no other file and no committed file on any branch uses the number. Removing a document takes two steps: `document_archive`, then `document_delete`. Delete works only on an archived document and asks no question. No task is changed; the result names the tasks and drafts whose documentation list names the removed file, by its archive path or by the path it had before it was archived.
- `document_search` — search documents using the shared fuzzy index
- `task_create` — create new tasks with description and acceptance criteria; DoD fields are for **exceptional** task-level overrides only (`definitionOfDoneAdd`, `disableDefinitionOfDoneDefaults`)
- `task_edit` — update task metadata, status, plan, notes, comments (`commentsAppend` with optional `commentAuthor`), final summary, acceptance criteria, task-level Definition of Done (`definitionOfDoneAdd/Remove/Check/Uncheck`) for **exceptional** per-task updates, and dependencies
- DoD is not acceptance criteria: acceptance criteria define scope/behavior, while DoD tracks completion hygiene
- Comments are for discussion and review notes; Implementation Notes are for execution progress; Final Summary is the PR-style completion summary. Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters.
- `task_archive` — move a task in any status off the board into the archive; keeps its ID, record, dependencies, and references. Archived tasks are read-only, stay viewable with `task_view`, and are marked `archived` in `task_search` results. A dependency on an archived task counts as satisfied only when that task is in the final status.
- `task_restore` — move an archived task back to the board with the same ID and the status it had. Restore a task before changing it: `task_edit` on an archived task fails.
- `task_delete` — permanently delete an archived task and release its ID once no other branch or worktree still holds the task. Deleting takes two steps: `task_archive`, then `task_delete`. It removes the dependencies and references other tasks and drafts hold to the task and names the tasks and drafts it changed. A task that is not archived, or whose subtasks still exist as tasks or as drafts, is not deleted.

**Document path rules:** document paths are relative to the docs directory. Use `path` values like `guides/setup`; absolute paths and `..` traversal are rejected.

**Always operate through MCP tools. Never edit markdown files directly so relationships, metadata, and history stay consistent.**

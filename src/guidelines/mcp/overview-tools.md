## Backlog.md Overview (Tools)

Your client is using Backlog.md via tools. Use the following MCP tools to retrieve guidance and manage tasks.

### When to Use Backlog

**Create a task if the work requires planning or decision-making.** Ask yourself: "Do I need to think about HOW to do this?"

- **YES** → Search for existing task first, create if needed
- **NO** → Just do it (the change is trivial/mechanical)

**Examples of work that needs tasks:**
- "Fix the authentication bug" → need to investigate, understand root cause, choose fix
- "Add error handling to the API" → need to decide what errors, how to handle them
- "Refactor UserService" → need to plan new structure, migration path

**Examples of work that doesn't need tasks:**
- "Fix typo in README" → obvious mechanical change
- "Update version number to 2.0" → straightforward edit
- "Add missing semicolon" → clear what to do

**Always skip tasks for:** questions, exploratory requests, or knowledge transfer only.

### Core Workflow Tools

Use this tool to retrieve the required Backlog.md guidance in markdown form:

- `get_backlog_instructions` — Returns workflow guidance. Leave `instruction` empty for the overview, or select `task-creation`, `task-execution`, or `task-finalization`.

The tool returns the same content that resource-capable clients read via `backlog://workflow/...` URIs. The overview response is tool-oriented when `instruction` is omitted or set to `overview`.

### Typical Workflow (Tools)

1. **Search first:** call `task_search` or `task_list` with filters to find existing work
2. **If found:** read details via `task_view`; follow execution/plan guidance from the retrieved markdown
3. **If not found:** call `get_backlog_instructions` with `instruction="task-creation"`, then create tasks with `task_create`
4. **Execute & finalize:** call `get_backlog_instructions` with `instruction="task-execution"` or `instruction="task-finalization"` to manage status, plans, notes, and acceptance criteria via `task_edit`

**Note:** "Done" tasks stay in Done until periodic cleanup. Moving to the completed folder (`task_complete`) is a batch operation run occasionally, not part of finishing each task. Do not use `task_archive` for completed work—archive is only for duplicate, canceled, or invalid tasks.

### Core Principle

Backlog tracks **commitments** (what will be built). Use your judgment to distinguish between "help me understand X" (no task) vs "add feature Y" (create tasks).

### MCP Tools Quick Reference

- `get_backlog_instructions`
- `task_list`, `task_search`, `task_view`, `task_create`, `task_edit`, `task_complete`, `task_archive`
- `task_search` accepts `modifiedFiles` for case-insensitive substring filtering against project-root-relative modified file paths
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

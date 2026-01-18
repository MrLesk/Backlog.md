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

Use these tools to retrieve the required Backlog.md guidance in markdown form:

- `get_workflow_overview` — Overview of when and how to use Backlog
- `get_task_creation_guide` — Detailed instructions for creating tasks (scope, acceptance criteria, structure)
- `get_task_execution_guide` — Planning and executing tasks (implementation plans, approvals, scope changes)
- `get_task_finalization_guide` — Definition of Done, finalization workflow, next steps

Each tool returns the same content that resource-capable clients read via `backlog://workflow/...` URIs.

### Typical Workflow (Tools)

1. **Search first:** call `task_search` or `task_list` with filters to find existing work
2. **If found:** read details via `task_view`; follow execution/plan guidance from the retrieved markdown
3. **If not found:** consult `get_task_creation_guide`, then create tasks with `task_create`
4. **Execute & finalize:** use the execution/finalization guides to manage status, plans, notes, and acceptance criteria via `task_edit`

**Note:** "Done" tasks stay in Done until periodic cleanup. Moving to the completed folder (`task_complete`) is a batch operation run occasionally, not part of finishing each task. Do not use `task_archive` for completed work—archive is only for duplicate, canceled, or invalid tasks.

### Core Principle

Backlog tracks **commitments** (what will be built). Use your judgment to distinguish between "help me understand X" (no task) vs "add feature Y" (create tasks).

### MCP Tools Quick Reference

- `get_workflow_overview`, `get_task_creation_guide`, `get_task_execution_guide`, `get_task_finalization_guide`
- `task_list`, `task_search`, `task_view`, `task_create`, `task_edit`, `task_complete`, `task_archive`
- `document_list`, `document_view`, `document_create`, `document_update`, `document_search`

**Definition of Done support**
- `task_create` accepts `definitionOfDoneAdd` and `disableDefinitionOfDoneDefaults`
- `task_edit` accepts `definitionOfDoneAdd`, `definitionOfDoneRemove`, `definitionOfDoneCheck`, `definitionOfDoneUncheck`
- `task_view` output includes the Definition of Done checklist with checked state

**Always operate through the MCP tools above. Never edit markdown files directly; use the tools so relationships, metadata, and history stay consistent.**

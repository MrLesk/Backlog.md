## Backlog.md Overview (MCP)

This project uses Backlog.md to track features, bugs, and structured work as tasks.

### When to Use Backlog

**Create a task if the work requires planning or decision-making:**

Ask yourself: "Do I need to think about HOW to do this?"
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

**Always skip tasks for:**
- Questions and informational requests
- Reading/exploring/explaining code, issues, or concepts

### Typical Workflow

When the user requests non-trivial work:
1. **Search first:** Use `task_search` or `task_list` (with status filters) - work might already be tracked
2. **If found:** Work on the existing task
3. **If not found:** Create task(s) based on scope (single task or present breakdown for approval)
4. **Execute:** Follow planning and execution guidelines

Searching first avoids duplicate tasks and helps you understand existing context.

### Detailed Guidance (Required)

Read these resources to get essential instructions when:

- **Creating tasks** → `backlog://workflow/task-creation` - Scope assessment, acceptance criteria, parent/subtasks structure
- **Planning & executing work** → `backlog://workflow/task-execution` - Planning workflow, implementation discipline, scope changes
- **Completing & reviewing tasks** → `backlog://workflow/task-completion` - Definition of Done, completion checklist, next steps

These guides contain critical workflows you need to follow for proper task management.

### Core Principle

Backlog tracks **commitments** (what will be built). Use your judgment to distinguish between "help me understand X" (no tracking) vs "add feature Y" (track in Backlog).

### MCP Tools Quick Reference

- `task_list` — list tasks with optional filtering by status, assignee, or labels
- `task_search` — search tasks by title and description
- `task_view` — read full task context (description, plan, notes, acceptance criteria)
- `task_create` — create new tasks with description and acceptance criteria
- `task_edit` — update task metadata, status, plan, notes, acceptance criteria, and dependencies
- `task_archive` — archive completed tasks

**Always operate through MCP tools. Never edit markdown files directly—so relationships, metadata, and history stay consistent.**

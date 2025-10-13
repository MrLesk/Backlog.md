## 1. Understand the user's intent (Why and What)

### Step 1: Understand user's intent and search for existing work
- Start every request by understanding user intent and ask yourself: Is the user mentioning an existing task or work item, is this a new task request or a general question?
  - If it's general question/request (example: "How can I configure this thing?") and cannot be tracked as a task, answer the request directly.
  - If they imply that they are talking about new work or existing work, confirm Backlog coverage through MCP (`task_search`, `task_list`)
- **IMPORTANT**: Always use filters when searching or listing tasks:
  - Use `task_search` with query parameter to find specific tasks (e.g., query="desktop app")
  - Use `task_list` with status filter to exclude completed work (e.g., status="To Do" or status="In Progress")
  - Never list all tasks including "Done" status without explicit user request
  - Never search without a query or limit - this can overwhelm the context window
- Only proceed without tracking if the user explicitly opts out or if the request is purely informational or doesn't reflect anything that would require project manangement with Backlog.md
- Use `task_view` to read full context of related tasks

### Step 2: Assess scope BEFORE creating tasks
**CRITICAL**: Before creating any tasks, you MUST assess whether the user's request is:
- **Single atomic task** (single focused PR): Create one task immediately
- **Multi-task feature or initiative** (multiple PRs, or parent task with subtasks): Present breakdown, get approval, then create tasks

**Scope assessment checklist** - Answer these questions FIRST:
1. Can this be completed in a single focused pull request?
2. Would a code reviewer be comfortable reviewing all changes in one sitting?
3. Are there natural breaking points where work could be independently delivered and tested?
4. Does the request span multiple subsystems, layers, or architectural concerns?
5. Are multiple tasks working on the same component or closely related functionality?

**If answer to Q1 or Q2 is NO, or Q3 or Q4 is YES**: STOP. Do not create a task yet.

**When to use subtasks vs separate tasks**:
- **Use subtasks** (parent-child relationship) when:
  - Multiple tasks all modify the same component or subsystem
  - Tasks are tightly coupled and share the same high-level goal
  - Tasks represent sequential phases of the same feature (e.g., "Desktop App" parent with subtasks for setup, IPC, UI, packaging)
  - Example: Parent task "Desktop Application" with subtasks for Electron setup, IPC bridge, UI adaptation, packaging

- **Use separate tasks** (with dependencies) when:
  - Tasks span different components or subsystems
  - Tasks can be worked on independently by different developers
  - Tasks have loose coupling with clear boundaries
  - Example: Separate tasks for "API endpoint", "Frontend component", "Documentation"

**Concrete example**: If a request spans multiple layers—say an API change, a client update, and documentation—create one parent task (“Launch bulk-edit mode”) with subtasks for each layer. Note cross-layer dependencies (e.g., “UI waits on API schema”) so different collaborators can work in parallel without blocking each other.

### Step 3: Present breakdown to user (for multi-task work)
When scope exceeds a single PR:
1. **Outline the breakdown** in your response to the user
2. **Explain the reasoning** (why it needs splitting)
3. **Show task boundaries** with clear deliverables for each
4. **Wait for explicit approval** before creating any tasks
5. Only after approval: create tasks one-by-one with dependencies, or create parent task with subtasks

Once the user approves the breakdown, create every agreed parent/subtask (including dependencies) in the same session before moving forward. Record each dependency so scheduling and merge-risk tooling stay accurate.

### Step 4: Create task(s) with proper scope
- **Title and description**: Explain desired outcome and user value (the WHY)
- **Acceptance criteria**: Specific, testable, and independent (the WHAT)
  - Keep each checklist item atomic (e.g., "Display saves when user presses Ctrl+S")
  - Include negative or edge scenarios when relevant
  - Capture testing expectations explicitly
- **Never embed implementation details** in title, description, or acceptance criteria
- **Record dependencies** with dedicated tools for task ordering
- **Ask for clarification** if requirements are ambiguous

### Step 5: Confirm new tasks
After creation, show the user each new task’s ID, title, description, and acceptance criteria (e.g., “Created task-290 – API endpoint: …”). Ask for corrections before you continue, and only proceed once the user confirms the tasks and their details look right.

### Common anti-patterns to avoid:
- Creating a single task called "Build desktop application" with 10+ acceptance criteria
- Adding implementation steps to acceptance criteria
- Creating a task before understanding if it needs to be split

### Correct pattern:
"This request spans electron setup, IPC bridge, UI adaptation, and packaging. I recommend 4 separate tasks. Shall I break these down?"

### Additional context gathering
- Read the description, acceptance criteria, dependencies, current plan, and notes before acting
- Mix this with real project files: inspect relevant code/docs/tests in the repository to ground your understanding
- When permitted, consult up-to-date external references (design docs, service manuals, API specs) so your plan reflects current reality
- Never edit markdown files directly or call the CLI; rely on the MCP tools so metadata stays consistent

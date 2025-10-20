## Task Creation Guide

This guide provides detailed instructions for creating well-structured tasks. You should already know WHEN to create tasks (from the overview).

### Step 1: Search for existing work

**IMPORTANT - Always use filters when searching:**
- Use `task_search` with query parameter (e.g., query="desktop app")
- Use `task_list` with status filter to exclude completed work (e.g., status="To Do" or status="In Progress")
- Never list all tasks including "Done" status without explicit user request
- Never search without a query or limit - this can overwhelm the context window

Use `task_view` to read full context of related tasks.

### Step 2: Assess scope BEFORE creating tasks

**CRITICAL**: Before creating any tasks, assess whether the user's request is:
- **Single atomic task** (single focused PR): Create one task immediately
- **Multi-task feature or initiative** (multiple PRs, or parent task with subtasks): Create appropriate task structure

**Scope assessment checklist** - Answer these questions FIRST:
1. Can this be completed in a single focused pull request?
2. Would a code reviewer be comfortable reviewing all changes in one sitting?
3. Are there natural breaking points where work could be independently delivered and tested?
4. Does the request span multiple subsystems, layers, or architectural concerns?
5. Are multiple tasks working on the same component or closely related functionality?

If the work requires multiple tasks, proceed to choose the appropriate task structure (subtasks vs separate tasks).

### Step 3: Choose task structure

**When to use subtasks vs separate tasks:**

**Use subtasks** (parent-child relationship) when:
- Multiple tasks all modify the same component or subsystem
- Tasks are tightly coupled and share the same high-level goal
- Tasks represent sequential phases of the same feature
- Example: Parent task "Desktop Application" with subtasks for Electron setup, IPC bridge, UI adaptation, packaging

**Use separate tasks** (with dependencies) when:
- Tasks span different components or subsystems
- Tasks can be worked on independently by different developers
- Tasks have loose coupling with clear boundaries
- Example: Separate tasks for "API endpoint", "Frontend component", "Documentation"

**Concrete example**: If a request spans multiple layers—say an API change, a client update, and documentation—create one parent task ("Launch bulk-edit mode") with subtasks for each layer. Note cross-layer dependencies (e.g., "UI waits on API schema") so different collaborators can work in parallel without blocking each other.

### Step 4: Create multi-task structure

When scope requires multiple tasks:
1. **Create the task structure**: Either parent task with subtasks, or separate tasks with dependencies
2. **Explain what you created** to the user after creation, including the reasoning for the structure
3. **Document relationships**: Record dependencies using `task_edit` so scheduling and merge-risk tooling stay accurate

Create all tasks in the same session to maintain consistency and context.

### Step 5: Create task(s) with proper scope

**Title and description**: Explain desired outcome and user value (the WHY)

**Acceptance criteria**: Specific, testable, and independent (the WHAT)
- Keep each checklist item atomic (e.g., "Display saves when user presses Ctrl+S")
- Include negative or edge scenarios when relevant
- Capture testing expectations explicitly

**Never embed implementation details** in title, description, or acceptance criteria

**Record dependencies** using `task_edit` for task ordering

**Ask for clarification** if requirements are ambiguous

### Step 6: Report created tasks

After creation, show the user each new task's ID, title, description, and acceptance criteria (e.g., "Created task-290 – API endpoint: …"). This provides visibility into what was created and allows the user to request corrections if needed.

### Common Anti-patterns to Avoid

- Creating a single task called "Build desktop application" with 10+ acceptance criteria
- Adding implementation steps to acceptance criteria
- Creating a task before understanding if it needs to be split

### Correct Pattern

"This request spans electron setup, IPC bridge, UI adaptation, and packaging. I'll create 4 separate tasks to break this down properly."

Then create the tasks and report what was created.

### Additional Context Gathering

- Use `task_view` to read the description, acceptance criteria, dependencies, current plan, and notes before acting
- Inspect relevant code/docs/tests in the repository to ground your understanding
- When permitted, consult up-to-date external references (design docs, service manuals, API specs) so your plan reflects current reality

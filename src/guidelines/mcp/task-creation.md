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

### Agent Lifecycle Reality

**Assume the agent who creates tasks will NOT execute them.** Each task is handled by an independent agent session with no memory of prior conversations or other tasks.

- Write tasks as work orders for strangers: include all required context inside the task
- Never reference "what we discussed" without restating the essential decisions and constraints
- Dependencies must explicitly state what the other task provides (e.g., output, schema, artifact)
- Use the `references` field for external references such as GitHub issues, PRs, tickets, or URLs
- Use the `documentation` field for design docs, API specs, manuals, or other reference materials that help understand the task context
- Only include minimal local code context in the description when omitting it would make the task ambiguous or unsafe for a future implementer

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

Use `parentTaskId` only with an existing task ID returned by `task_create`, `task_list`, or `task_view`. Do not pass milestone IDs such as `m-0` as `parentTaskId`; assign a task to a milestone with the `milestone` field.

### Step 4: Create multi-task structure

When scope requires multiple tasks:
1. **Create the task structure**: Either parent task with subtasks, or separate tasks with dependencies
2. **Explain what you created** to the user after creation, including the reasoning for the structure
3. **Document relationships**: Record dependencies using `task_edit` so scheduling and merge-risk tooling stay accurate

**Follow-up work on an existing task:** Create it as a **subtask** of that parent task (not a new top-level task).

Create all tasks in the same session to maintain consistency and context.

### Step 5: Create task(s) with proper scope

**Title and description**: Shape the description by work kind (see below). For features, explain outcome and user value (the WHY). For bugs and friction, record observation, how it was hit, and mark open questions or unverified fix ideas as such. Keep handoff context inside the task; do not rely on "as we discussed."

**Shape by work kind** (set `type` when configured types fit: bug, feature, enhancement, chore, docs, spike, task):

| Kind | Description | Acceptance criteria |
| --- | --- | --- |
| bug / friction | What failed or hurt, how found, error or output when known; mark hypotheses as untested | Optional. Prefer 1–3 testable "done when" items if known. One decision/spike criterion if the finish line is a decision. Empty criteria beat invented ones. |
| feature / enhancement | Outcome and why it matters | Required: specific, testable, independent stakeholder success conditions |
| chore / docs / task | Outcome | Optional; add only when "done" would otherwise be ambiguous |
| spike | Question to answer | What decision, note, or artifact must exist when the spike ends |

Do not force a feature-shaped work order onto a bug report or friction capture.

**Acceptance criteria**: `acceptanceCriteria` is an array of strings. Each item must be a **legitimate, observable success condition a stakeholder would accept**, not an implementation step and not the agent's preferred build plan.
- Prefer fewer true criteria over a complete-looking list. Do not invent nice-to-haves, speculative edges, tests, docs, or follow-on work unless the user, product decision, or existing task scope requires them.
- Keep each checklist item atomic (e.g., "Display saves when user presses Ctrl+S").
- Include negative or edge scenarios only when they are part of the agreed deliverable.
- When tests or documentation **are** part of the agreed deliverable, put them in this task (do not defer required tests/docs to a vague follow-up). Do not invent test/docs criteria to look thorough.
- If requirements are ambiguous, ask or record an open question — do not paper over uncertainty with confident criteria.

**Definition of Done defaults (optional):**
- Project-level defaults are managed with `definition_of_done_defaults_get` / `definition_of_done_defaults_upsert`
- DoD is not acceptance criteria: AC defines product scope/behavior, DoD defines completion hygiene
- Per-task DoD customization should be exceptional; default to project-level DoD plus appropriate acceptance criteria for the work kind
- Use `definitionOfDoneAdd` only for task-specific DoD items that apply to this one task
- Use `disableDefinitionOfDoneDefaults` to skip project defaults for this task when needed
- Do **not** duplicate project defaults into `definitionOfDoneAdd` unless you are intentionally customizing this task

**Never embed implementation details** in title, description, or acceptance criteria

**Record dependencies** using `task_edit` for task ordering

**Ask for clarification** if requirements are ambiguous

**Do not add implementation research, an implementation plan, or a speculative code approach during creation.** MCP task
creation records only durable intent, context, scope, acceptance criteria, references, and dependencies. The future
worker researches the then-current system and records the plan after taking the task into progress. CLI instructions
remain the canonical workflow; this legacy MCP guide mirrors the same task lifecycle for adapter users.

**Drafts (exceptional):** Default to creating regular tasks (e.g., To Do) for any work you are committing to track. Only create a Draft when the user explicitly requests a draft, or when there is clear uncertainty that makes a commitment inappropriate (e.g., missing requirements and the user wants a placeholder). Use `task_create` with status `Draft` to create a draft, `task_edit` to promote/demote by changing status, and pass status `Draft` to `task_list`/`task_search` to include drafts. Drafts are excluded unless explicitly filtered.

### Step 6: Report created tasks

After creation, show the user each new task's ID, title, description, and acceptance criteria (e.g., "Created task-290 – API endpoint: …"). This provides visibility into what was created and allows the user to request corrections if needed.

If you will continue from task creation into implementation in the same session, stop and read `backlog://workflow/task-execution` before viewing, assigning, planning, editing, or implementing a task. Task creation is complete once the work is tracked; execution uses a separate workflow.

### Common Anti-patterns to Avoid

- Creating a single task called "Build desktop application" with 10+ acceptance criteria
- Adding implementation steps to acceptance criteria
- Inventing acceptance criteria the user or product did not need in order to look thorough
- Forcing feature-shaped acceptance criteria onto a bug or friction capture
- Creating a task before understanding if it needs to be split
- Deferring tests or documentation that **are** part of the agreed deliverable to "later tasks"

### Correct Pattern

"This request spans electron setup, IPC bridge, UI adaptation, and packaging. I'll create 4 separate tasks to break this down properly."

Then create the tasks and report what was created.

**Standalone feature example (includes agreed tests/docs):** "Add API endpoint for bulk updates" with acceptance criteria that include only the tests and documentation that are part of the agreed deliverable for that endpoint.

### Durable Context at Creation

- Use `task_view` on related work only to avoid duplicates and recover durable product decisions, scope, acceptance
  criteria, dependencies, and references.
- Gather the intended outcome, confirmed constraints, acceptance criteria, dependencies, and reference material needed to
  understand the work order. Do not inspect implementation code or tests, or perform external implementation research,
  to draft a plan for future work.
- The execution worker performs current-system research after the task is active and records the plan then. The narrow
  exception is already-started work created directly in an active status: it may preserve a current plan based on
  research already completed, but task creation itself does not trigger that research.

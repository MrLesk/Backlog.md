## Task Creation Guide

Use this guide when `backlog instructions` or the user indicates that new Backlog tasks are needed.

### Step 1: Search First

Always check whether the work is already tracked.

Recommended CLI commands:

- `backlog search "desktop app" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --exclude-status "<terminal status>" --plain`
- `backlog task list --type {{TASK_TYPE:1}} --plain`
- `backlog task list --search "desktop app" --labels frontend,bug --limit 20 --plain`

Avoid broad unfiltered listing when the project may have many tasks. Use `--status`, `--exclude-status`, `--type`, `--assignee`, `--unassigned`, `--parent`, `--priority`, `--labels`, `--search`, or `--limit` where applicable. Repeat `--exclude-status` or pass comma-separated configured statuses to exclude multiple states. Repeat `--type` or pass comma-separated configured task types to include multiple types.

Use `backlog task view {{TASK_ID:123}} --plain` to read full context for likely matches.

### Step 2: Assess Scope Before Creating Tasks

Decide whether the request is:

- A single atomic task that can be completed in one focused PR.
- A multi-task feature or initiative that needs subtasks or dependencies.

Ask:

1. Can this be completed in a single focused pull request?
2. Would a reviewer be comfortable reviewing all changes at once?
3. Are there natural independent delivery points?
4. Does the work span multiple subsystems, layers, or ownership areas?
5. Are multiple tasks likely to touch the same component?

### Step 3: Choose Task Structure

Use subtasks when the work shares one goal and one subsystem:

```bash
backlog task create "Desktop application"
backlog task create -p {{TASK_ID:10}} "Set up shell"
backlog task create -p {{TASK_ID:10}} "Wire IPC"
```

Use `--parent`/`-p` only with an existing task ID returned by `backlog task create`, `backlog task list`, or `backlog task view`. Do not pass milestone IDs such as `m-0` to `--parent`; assign a task to a milestone with `--milestone`/`-m`.

Use separate tasks with dependencies when work spans independent components:

```bash
backlog task create "Add bulk update API"
backlog task create "Add bulk update UI" --dep {{TASK_ID:21}}
```

### Step 4: Create Tasks

Write tasks so a future agent can act on them without prior conversation context.

Include:

- A clear title.
- A description shaped by the work kind (see below).
- Acceptance criteria that express legitimate success conditions (see Acceptance Criteria).
- `--type` when the configured types fit (`bug`, `feature`, `enhancement`, `chore`, `docs`, `spike`, `task`, or project-configured values).
- References or documentation when they are needed for implementation.
- Dependencies when work must happen in order.

For future work, do **not** add an implementation plan or speculative code approach during task creation. Creation
captures the durable intent, context, scope, acceptance criteria, references, and dependencies. The worker researches
the current system and records the plan after picking up and activating the task, because the codebase or constraints may
change before then. The narrow exception is already-started work being created directly in a configured active status
(for example, In Progress); its current researched plan may be supplied at creation.

### Shape by Work Kind

Not every task is a product feature. Match description and acceptance criteria to the kind of work:

| Kind | Description | Acceptance criteria |
| --- | --- | --- |
| bug / friction | What failed or hurt, how it was hit, error or output when known; mark open questions and unverified fix ideas as such | When the failure is observable, name it as done-when (prefer 1–3 testable items). If the finish line is a choice, one decision/spike or WONTFIX criterion. Prefer one honest criterion over none; never invent scope to fill the list. |
| feature / enhancement | Outcome and why it matters to the user or product | Required: specific, testable, independent criteria for stakeholder-accepted success |
| chore / docs / task | Outcome | Add when success is not obvious from the title alone |
| spike | Question to answer | What decision, note, or artifact must exist when the spike ends |

Do not force a feature-shaped work order onto a bug report or friction capture. Do not leave an observable bug without a success condition.

Examples:

```bash
backlog task create "Add project search" \
  --type feature \
  -d "Users can search tasks, docs, and decisions from one CLI command." \
  --ac "Search returns matching tasks by title and description" \
  --ac "Search supports --plain output" \
  --ac "Tests cover task, document, and decision results"
```

```bash
backlog task create "Session start digest shows stale task count" \
  --type bug \
  -d "Observation: after completing TASK-12, the next session start still reported 1 open task until board refresh. Hypothesis (untested): digest cache is not invalidated on status change." \
  --ac "After a task moves to Done, a new session start digest reports the updated open count"
```

```bash
backlog task create "Add settings docs" \
  --type docs \
  --doc docs/settings.md \
  --ref https://example.com/spec
```

### Shell Quoting for Literal Backticks

When task text includes Markdown code spans, quote it so the shell passes the backticks literally. Unescaped backticks in double-quoted or unquoted arguments are command substitution in many shells, and Backlog.md cannot recover the original text after the shell has already executed it.

Use single-quoted CLI arguments for values that contain literal backticks:

```bash
backlog task create 'Document `backlog init` setup' \
  --ac 'Instructions mention `backlog init --defaults` literally'
```

If single quotes are not practical in your shell, escape each literal backtick before running the command. Do not rely on Backlog.md to sanitize accidental command output after substitution.

### Acceptance Criteria

Acceptance criteria define **observable success conditions a stakeholder would accept**, not implementation steps and not an agent's preferred build plan.

**Legitimacy first.** Prefer fewer true criteria over a complete-looking list. Prefer one honest criterion over none when a success condition is observable. Prefer none over invented criteria. Do not invent acceptance criteria for nice-to-haves, speculative edge cases, or follow-on work, and do not invent tests or docs criteria unless the user, product decision, or existing task scope requires them. If requirements are ambiguous, ask, record an open question, or use a decision/spike criterion — do not paper over uncertainty with confident product criteria, and do not omit a finish line when the failure is already observable.

Good criteria:

- Are testable and independent.
- Reflect user or product needs you could defend to the requester (for bugs: the reported failure mode is usually enough).
- Include edge cases, tests, or documentation **that are part of the agreed deliverable**.

Avoid:

- Criteria like "Implement helper function" unless the helper itself is the user-visible deliverable.
- Padding with invented scope ("also support dark mode", "add unit tests for unrelated helpers") to look thorough.
- Turning an unverified implementation idea into a criterion labeled as a user need.
- Filing an observable bug or friction item with no acceptance criteria and no decision criterion.

### Definition of Done

Project-level Definition of Done defaults apply automatically. Add task-specific DoD items only when this task needs extra completion hygiene:

```bash
backlog task create "Ship audit export" --dod "Manual export checked with sample data"
```

### After Creation

Report the created task IDs, titles, and key acceptance criteria to the user. If the user asks for changes, update tasks through `backlog task edit`.

If you will continue from task creation into implementation in the same session, stop and read `backlog instructions task-execution` before viewing, assigning, planning, editing, or implementing a task. Task creation is complete once the work is tracked; execution uses a separate workflow.

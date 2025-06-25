# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `bun install` - Install dependencies
- `bun test` - Run tests
- `bun run format` - Format code with Biome
- `bun run lint` - Lint and auto-fix with Biome  
- `bun run check` - Run all Biome checks (format + lint)

### Testing

- `bun test` - Run all tests
- `bun test <filename>` - Run specific test file

## Project structure

```markdown
backlog.md/ (Root folder for "Backlog.md" project)
└── .backlog/ ("Backlog.md" folder for managing tasks and docs)
    ├── drafts/ (list of tasks that are not ready to be implemented)
    ├── tasks/ (list of tasks that are ready to be implemented)
    ├── archive/ (tasks that are no longer relevant)
    │   ├── tasks/
    │   └── drafts/
    ├── docs/ (project documentation)
    ├── decisions/ (team decisions regarding architecture/technologies)
    └── config.yml ("Backlog.md" configuration file)
```

Instructions for using the Backlog.md tool are available in the `readme.md` file in the root folder.

Each folder contains a `readme.md` file with instructions on how to use the Backlog.md tool for that specific folder.

## Project Architecture

This is the **Backlog.md** project - a lightweight git + markdown project management tool for human-AI collaboration.

### Core Structure

- **CLI Tool**: Built with Bun and TypeScript as a global npm package (`@backlog.md`)
- **Source Code**: Located in `/src` directory with modular TypeScript structure
- **Task Management**: Uses markdown files in `.backlog/` directory structure
- **Workflow**: Git-integrated with task IDs referenced in commits and PRs

### Key Components

- **Task System**: Tasks stored as `task-<id> - <title>.md` files with decimal subtasks (e.g., `task-4.1`)
- **Configuration**: Uses `config.yml` for project settings
- **Status Workflow**: Draft → Active → Archive progression

### AI Agent Integration

- Reference task IDs in commit messages and PR titles when implementing features
- Use `.backlog/tasks/` markdown files to understand implementation requirements
- Include a `## Description` section and a `## Acceptance Criteria` checklist in every task file
- Add an `## Implementation Plan` section before starting work to outline your approach
- Use `--ac` flag when creating tasks to set acceptance criteria directly
- Write relevant tests when implementing new functionality or fixing bugs
- Follow decimal numbering for subtasks
- Maintain clean git status before commits
- Use task-id branch names: `task/<task-id>`
- When you start working on a task, update its status to `In Progress`, assign yourself as the assignee, and push the change.
- After testing a task and completing all Definition of Done items, mark it **Done** with:

```bash
backlog task edit <task-id> --status Done
```

### Writing Effective Acceptance Criteria

When defining `## Acceptance Criteria` for a task, focus on **outcomes, behaviors, and verifiable requirements** rather than step-by-step implementation details. Acceptance Criteria (AC) define *what* the system should do or *what* conditions must be met for the task to be considered complete. They should be testable and confirm that the core purpose of the task is achieved.

**Distinguish ACs from Implementation Plans:**

- **Acceptance Criteria (What/Why):** Describe the desired result from a user's perspective or as a functional requirement. They verify the task's success.
  - *Good Example:* "- [ ] User can successfully log in with valid credentials."
  - *Good Example:* "- [ ] System processes 1000 requests per second without errors."
  - *Bad Example (Implementation Step):* "- [ ] Add a new function `handleLogin()` in `auth.ts`."
- **Implementation Plan (How):** This is a separate section (`## Implementation Plan`) where you outline the steps to achieve the ACs. This is where you detail *how* the work will be done.
  - *Example:* "1. Create `handleLogin()` function in `auth.ts`. 2. Add input validation. 3. Write unit tests for `handleLogin()`."

**Key Principles for Good ACs:**

- **Outcome-Oriented:** Focus on the result, not the method.
- **Testable/Verifiable:** Each criterion should be something that can be objectively tested or verified.
- **Clear and Concise:** Unambiguous language.
- **Complete:** Collectively, ACs should cover the scope of the task.
- **User-Focused (where applicable):** Frame ACs from the perspective of the end-user or the system's external behavior.

If a task requires a detailed breakdown of steps, use the `## Implementation Plan` section. The `## Acceptance Criteria` section should remain focused on the success conditions.

### Before Marking a Task as Done

Always ensure you have:

1. ✅ Marked all acceptance criteria as completed in the task file (change `- [ ]` to `- [x]`)
2. ✅ Added an `## Implementation Notes` section documenting your approach
3. ✅ Run all tests and linting checks (`bun test` and `bun run check`)
4. ✅ Updated relevant documentation

### Code Standards

- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors are found, the commit will be blocked until fixed.

## Definition of Done

A task is **Done** only when **ALL** of the following are complete:

1. **Acceptance criteria** checklist in the task file is fully checked (all `- [ ]` changed to `- [x]`).  
2. **Implementation plan** was followed or deviations were documented in Implementation Notes.  
3. **Automated tests** (unit + integration) cover new logic and CI passes.  
4. **Static analysis**: linter & formatter succeed (run `bun run check`).  
5. **Documentation**:  
   - All relevant docs updated (README, guidelines, etc.).  
   - Task file **MUST** have an `## Implementation Notes` section added summarising:
     - Approach taken
     - Technical decisions and trade-offs
     - Files modified
     - Any follow-up tasks needed
6. **Review**: code reviewed (when working with a team).  
7. **Task hygiene**: status set to **Done** via CLI (`backlog task edit <id> -s Done`).  
8. **No regressions**: performance, security and licence checks green.

⚠️ **IMPORTANT**: Never mark a task as Done without completing ALL items above, especially:

- Marking acceptance criteria checkboxes as complete
- Adding comprehensive Implementation Notes

## Backlog.md Tool - CLI usage

| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth"`                    |
| Create with plan | `backlog task create "Feature" --plan "1. Step one\n2. Step two"` |
| Create with AC | `backlog task create "Feature" --ac "Must work,Must be tested"` |
| Create with deps | `backlog task create "Feature" --dep task-1,task-2` |
| Create sub task | `backlog task create --parent 14 "Add Google auth"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @claude -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Updated implementation approach"` |
| Add AC      | `backlog task edit 7 --ac "New criterion,Another one"`    |
| Add deps    | `backlog task edit 7 --dep task-1 --dep task-2`        |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Backlog.md Tool - Tips for AI Agents

- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave brief **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.

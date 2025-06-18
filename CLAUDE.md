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

```
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
- Write relevant tests when implementing new functionality or fixing bugs
- Follow decimal numbering for subtasks
- Maintain clean git status before commits
- Use task-id branch names: `task/<task-id>`
- When you start working on a task, update its status to `In Progress`, assign yourself as the assignee, and push the change.
- After testing a task, mark it **Done** with:

```bash
backlog task edit <task-id> --status Done
```

### Code Standards
- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors are found, the commit will be blocked until fixed.

## Definition of Done

A task is **Done** only when **all** of the following hold:

1. **Acceptance criteria** checklist in the task file is fully checked.  
2. **Automated tests** (unit + integration) cover new logic and CI passes.  
3. **Static analysis**: linter & formatter succeed (when available).  
4. **Documentation**:  
   - Docs updated.  
   - Task file appended with a `## Implementation Notes` section summarising approach, trade‑offs and follow‑ups.  
5. **Review**: code reviewed.  
6. **Task hygiene**: status set to **Done** via CLI.  
7. **No regressions**: performance, security and licence checks green.

## Backlog.md Tool - CLI usage
| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth"`                    |
| Create sub task | `backlog task create --parent 14 "Add Google auth"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @claude -l auth,backend`       |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Backlog.md Tool - Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.  
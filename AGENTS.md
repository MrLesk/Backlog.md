# Project structure

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

Instructions for using the Backlog.md tool are available in the `readme.md` file in the root folder.

Each folder contains a `readme.md` file with instructions on how to use the Backlog.md tool for that specific folder.

## AI Agent Guidelines

- Use the markdown task files under `.backlog/tasks/` to decide what to implement.
- Reference the task `id` in commit messages and PR titles when closing a task.
- Subtasks use decimal numbering (e.g., `task-4.1`). Reference these IDs the same way.
- Each task must include a `## Description` section followed by a `## Acceptance Criteria` checklist.
- Include relevant tests when implementing new functionality or fixing bugs.
- Keep all project documentation in Markdown format and update the related `readme.md` files when necessary.
- Ensure the working tree is clean (`git status`) before committing changes.
- The branch name should reflect the task being worked on, e.g., `<task-id> feature description`.
- When beginning work on a task, immediately set its status to `In Progress`, assign yourself as the `assignee`, and push the change.
- After implementing and testing a task, mark it as **Done** using the CLI:

```bash
backlog task edit <task-id> --status Done
```

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
| List tasks  | `backlog task list`                                  |
| View detail | `backlog task 7`                                     |
| Edit        | `backlog task edit 7 -a @sara -l auth,backend`       |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Backlog.md Tool - Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.  
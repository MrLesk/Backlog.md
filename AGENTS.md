# Instructions for AI Agents Using Backlog.md CLI Tool

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

Instructions for using the Backlog.md tool are available in the `README.md` file in the root folder.

Each folder contains a `README.md` file with instructions on how to use the Backlog.md tool for that specific folder.

## 1. Source of Truth
- Tasks live under **`.backlog/tasks/`** (drafts under **`.backlog/drafts/`**).
- Each has YAML frontmatter & markdown content.
- The task **markdown file** defines what to implement.

## 2. Your Workflow
```bash
# 1 Read details (use --plain for AI-friendly output)
backlog task 42 --plain

# 2 Start work: assign yourself & move column
backlog task edit 42 -a @AI-Agent -s "In Progress" -d "Implementation Plan"

# 3 Break work down if needed
backlog task create "Refactor DB layer" -p 42 -a @AI-Agent -d "Description + Acceptance Criteria"

# 4 Complete and mark Done
backlog task edit 42 -s Done
```

## 3. Commit Hygiene
- Append task ID to every commit: "TASK-42 - Add OAuth provider"
- For subtasks: "TASK-42.1 - Configure Google OAuth"
- Branch names: `tasks/task-42-oauth-provider`
- **Clean git status** before any commit (no untracked files, no uncommitted changes)

## 4. Task Files Must Have

```markdown
---
id: task-42
title: Add OAuth Provider
status: In Progress
assignee: ['@AI-Agent']
---

## Description
Short, imperative explanation of the work.

## Acceptance Criteria
- [ ] OAuth flow triggers on `/auth`
- [ ] Google & GitHub providers configured
- [ ] Refresh tokens handled
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Notes (only added after working on the task)
- Added `src/graphql/resolvers/user.ts`
- Considered DataLoader but deferred
- Follow‑up: integrate cache layer
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

## Task CLI Reference
| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth System"`                    |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @AI-Agent -l auth,backend`       |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.  
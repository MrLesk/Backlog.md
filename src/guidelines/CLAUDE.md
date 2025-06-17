# Instructions for the usage of Backlog.md CLI Tool

## 1. Source of Truth
- Tasks live under **`.backlog/tasks/`** (drafts under **`.backlog/drafts/`**).
- Every implementation decision starts with reading the corresponding Markdown task file.

## 2. Typical Workflow

```bash
# 1 Identify work
backlog task list --status "To Do" --plain

# 2 Read details
backlog task 42 --plain

# 3 Start work: assign yourself & move column
backlog task edit 42 -a @Claude -s "In Progress" -d "Implementation Plan"

# 4 Break work down if needed
backlog task create "Refactor DB layer" -p 42 -a @Claude -d "Description + Acceptance Criteria"

# 5 Complete and mark Done
backlog task edit 42 -s Done
```

## 3. Definition of Done (DOD)

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

## 4. Recommended Task Anatomy

```markdown
# task‑42 - Add GraphQL resolver

## Description
Short, imperative explanation of the work.

## Acceptance Criteria
- [ ] Resolver returns correct data for happy path
- [ ] Error response matches REST
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Notes (only added after working on the task)
- Added `src/graphql/resolvers/user.ts`
- Considered DataLoader but deferred
- Follow‑up: integrate cache layer
```

## 5. Handy CLI Commands

| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth System"`                    |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @Claude -l auth,backend`       |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## 6. Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.  

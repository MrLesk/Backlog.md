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
backlog task edit 42 -a @AI-Agent -s "In Progress"

# 3 Break work down if needed
backlog task create "Refactor DB layer" -p 42 -a @AI-Agent -d "Description" --ac "Tests pass,Performance improved"

# 4 Add implementation plan before starting
backlog task edit 42 --plan "1. Analyze current implementation\n2. Identify bottlenecks\n3. Refactor in phases"

# 5 Complete and mark Done
backlog task edit 42 -s Done
```

### Before Marking a Task as Done
Always ensure you have:
1. ✅ Marked all acceptance criteria as completed (change `- [ ]` to `- [x]`)
2. ✅ Added an `## Implementation Notes` section documenting your approach
3. ✅ Run all tests and linting checks
4. ✅ Updated relevant documentation

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
**Focus on outcomes, not implementation steps.** Good ACs are testable and verify *what* the system should do.
- *Good Example:* `- [ ] User is redirected to the dashboard after successful login.`
- *Good Example:* `- [ ] An error message is displayed if login fails due to incorrect password.`
- *Bad Example (Implementation Step):* `- [ ] Modify the `loginUser` function in `authController.js`.`
- *Bad Example (Too Vague):* `- [ ] Login works.`

**Detailed steps on *how* to achieve the criteria belong in the `## Implementation Plan` section.** If your task involves a sequence of actions to build the feature, list them in the Implementation Plan. The Acceptance Criteria should validate that the feature behaves as expected once those steps are done.

- [ ] OAuth flow triggers on `/auth`
- [ ] Google & GitHub providers configured
- [ ] Refresh tokens handled
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Plan
**This section outlines *how* you will achieve the acceptance criteria.** It should be created *before* starting significant coding.
1. Research OAuth 2.0 flow requirements
2. Set up provider configurations
3. Implement authentication middleware
4. Add token refresh logic
5. Write integration tests

## Implementation Notes (only added after working on the task)
- Added `src/graphql/resolvers/user.ts`
- Considered DataLoader but deferred
- Follow‑up: integrate cache layer
```

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

## Task CLI Reference
| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth System"`                    |
| Create with plan | `backlog task create "Feature" --plan "Step 1\nStep 2"`     |
| Create with AC | `backlog task create "Feature" --ac "Must work,Must be tested"` |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @AI-Agent -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Implementation approach"`    |
| Add AC      | `backlog task edit 7 --ac "New criterion,Another one"`    |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <id>` |

## Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.
- **Draft an Implementation Plan** before starting work using `--plan` flag to outline your approach.
- Update the plan if significant changes occur during implementation.
- **When to add an Implementation Plan:** Create this section if the task requires multiple steps, complex logic, or if outlining the approach upfront helps in understanding the path to achieving the acceptance criteria. Simple, single-step tasks might not require a detailed implementation plan.
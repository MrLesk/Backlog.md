# Instructions for the usage of Backlog.md CLI Tool

## 1. Source of Truth
- Tasks live under **`.backlog/tasks/`** (drafts under **`.backlog/drafts/`**).
- Every implementation decision starts with reading the corresponding Markdown task file.

## 2. Typical Workflow

```bash
# 1 Identify work
backlog task list --status "To Do" --plain

# 2 Read details
backlog task 42 --plain

# 3 Start work: assign yourself & move column
backlog task edit 42 -a @Claude -s "In Progress"

# 4 Add implementation plan before starting
backlog task edit 42 --plan "1. Analyze current implementation\n2. Identify bottlenecks\n3. Refactor in phases"

# 5 Break work down if needed
backlog task create "Refactor DB layer" -p 42 -a @Claude -d "Description" --ac "Tests pass,Performance improved"

# 6 Complete and mark Done
backlog task edit 42 -s Done
```

### Before Marking a Task as Done
Always ensure you have:
1. ✅ Marked all acceptance criteria as completed (change `- [ ]` to `- [x]`)
2. ✅ Added an `## Implementation Notes` section documenting your approach
3. ✅ Run all tests and linting checks (`bun test` and `bun run check`)
4. ✅ Updated relevant documentation

## 3. Definition of Done (DOD)

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

## 4. Recommended Task Anatomy

```markdown
# task‑42 - Add GraphQL resolver

## Description
Short, imperative explanation of the work.

## Acceptance Criteria
- [ ] Resolver returns correct data for happy path
- [ ] Error response matches REST
- [ ] P95 latency ≤ 50 ms under 100 RPS

## Implementation Plan
1. Research existing GraphQL resolver patterns
2. Implement basic resolver with error handling
3. Add performance monitoring
4. Write unit and integration tests
5. Benchmark performance under load

## Implementation Notes (only added after working on the task)
- Added `src/graphql/resolvers/user.ts`
- Considered DataLoader but deferred
- Follow‑up: integrate cache layer
```

## 5. Handy CLI Commands

| Purpose | Command |
|---------|---------|
| Create task | `backlog task create "Add OAuth System"`                    |
| Create with plan | `backlog task create "Feature" --plan "Step 1\nStep 2"`     |
| Create with AC | `backlog task create "Feature" --ac "Must work,Must be tested"` |
| Create sub task | `backlog task create -p 14 "Add Login with Google"`                    |
| List tasks  | `backlog task list --plain`                                  |
| View detail | `backlog task 7 --plain`                                     |
| Edit        | `backlog task edit 7 -a @Claude -l auth,backend`       |
| Add plan    | `backlog task edit 7 --plan "Implementation approach"`    |
| Add AC      | `backlog task edit 7 --ac "New criterion,Another one"`    |
| Archive     | `backlog task archive 7`                             |
| Draft flow  | `backlog draft create "Spike GraphQL"` → `backlog draft promote 3.1` |
| Demote to draft| `backlog task demote <task-id>` |

## 6. Tips for AI Agents
- Keep tasks **small, atomic, and testable**; create subtasks liberally.  
- Prefer **idempotent** changes so reruns remain safe.  
- Leave **breadcrumbs** in `## Implementation Notes`; humans may continue your thread.  
- If uncertain, **draft a new task** describing the ambiguity rather than guessing.
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output instead of interactive UI.
- **Draft an Implementation Plan** before starting work using `--plan` flag to outline your approach.
- Update the plan if significant changes occur during implementation.
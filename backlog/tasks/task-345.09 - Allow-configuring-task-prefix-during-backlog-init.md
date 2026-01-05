---
id: task-345.09
title: Allow configuring task prefix during backlog init
status: To Do
assignee: []
created_date: '2026-01-05 13:13'
labels:
  - enhancement
  - cli
  - id-generation
dependencies: []
parent_task_id: task-345
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Allow users to configure a custom task prefix (e.g., `JIRA-`, `BUG-`, `ISSUE-`) during `backlog init`. Since prefixes cannot be changed after initialization (would break existing task IDs), this must be set upfront.

### Current Behavior
- `backlog init` creates config with default prefixes: `{ task: "task", draft: "draft" }`
- Users cannot change prefixes after project has tasks

### Proposed Changes

**CLI (`backlog init`):**
- Add interactive prompt: "Task prefix (default: task):"
- Add `--task-prefix` flag for non-interactive use
- Validate prefix: letters only, no special characters

**Example:**
```bash
# Interactive
backlog init
> Task prefix (default: task): JIRA

# Non-interactive
backlog init --task-prefix JIRA
```

### Implementation
1. Update `src/cli.ts` - Add `--task-prefix` flag to init command
2. Update init prompts to include prefix question
3. Pass prefix to config creation

### Why Not Draft Prefix?
Draft prefix is always "draft" and not user-configurable because:
- Drafts are internal/temporary
- Migration assumes draft- prefix
<!-- SECTION:DESCRIPTION:END -->

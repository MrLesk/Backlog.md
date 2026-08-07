---
id: BACK-593
title: Auto-link task IDs in web markdown to task deep links
status: To Do
assignee:
  - '@claude'
created_date: '2026-08-07 21:10'
labels:
  - web
dependencies: []
priority: medium
type: enhancement
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task IDs mentioned in prose (descriptions, plans, implementation notes, comments, final summaries, documents, decisions) render as plain text in the Web UI, so following a reference means copying the ID and searching for it.

This task takes over community PR #812 by @cottrell (https://github.com/MrLesk/Backlog.md/pull/812), which added the feature: bare task IDs in markdown become links to /tasks/<id>, and dependency chips in the task details sidebar become clickable links. The fork PR is stale (base ~100 commits behind), its own Backlog task ID collides with an existing BACK-555 on main, and review found two defects that must be fixed before this can ship:

1. Over-broad detection. The matcher used a generic letters-dash-digits pattern with no check against real tasks, so it linkified UTF-8, ISO-8601, version strings, and the tail of longer identifiers (my-task-123 linked task-123). Detection must be constrained to real task identity, and a leading boundary must prevent partial matches inside longer identifiers.
2. Code blocks were not excluded. The guard counted backticks on the current line only, so fenced code blocks were still linkified even though the PR claimed to exclude them. Inline code and fenced blocks must both be reliably excluded.

Related: BACK-239 covers the same idea for documents and decisions plus backlinks; this task is the task-ID half only and should leave a mechanism BACK-239 can extend.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bare task IDs that match a known task render as links to /tasks/<id> in web markdown fields (description, plan, notes, comments, final summary, documents, decisions)
- [ ] #2 Task IDs inside inline code spans and fenced code blocks are not linkified
- [ ] #3 Non-task tokens such as UTF-8, ISO-8601 and v1.2.3, and longer identifiers whose tail looks like a task ID such as my-task-123, are not linkified
- [ ] #4 Task IDs inside existing markdown links keep their original link target
- [ ] #5 Dependency chips in the task details sidebar link to the referenced task
- [ ] #6 Web component tests cover linking, code-block exclusion, non-task tokens, and dependency chip links
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

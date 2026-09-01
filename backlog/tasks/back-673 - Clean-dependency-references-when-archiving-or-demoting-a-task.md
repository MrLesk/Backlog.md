---
id: BACK-673
title: Clean dependency references when archiving or demoting a task
status: To Do
assignee: []
created_date: '2026-09-01 17:11'
labels: []
dependencies: []
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A user reported a task that mysteriously depended on another task they never linked. This is how it happens, reproduced on current main.

Archiving a task removes its ID from the dependencies of active tasks that reference it, but not from tasks in backlog/completed. Demoting a task to a draft cleans nothing at all: the record is renamed from TASK-N to DRAFT-N and every dependent keeps a reference to TASK-N, which renders as 'unknown task ID'. Both operations also free the numeric slot, so the next created task can be allocated that same ID. At that point the stale reference silently resolves to a different, unrelated task and the graph reports it as resolved rather than failing closed. Reproduced end to end: a completed task depending on TASK-5, archive TASK-5, create an unrelated task that is allocated TASK-5, and the completed task now shows 'TASK-5 - Totally unrelated new task'.

Fix: archiving and demoting must find every task that depends on the affected ID and remove that reference, across both the working copy and the completed corpus, and report which tasks were changed rather than doing it silently. Implement it once in core so every surface that archives or demotes (CLI, TUI, web, MCP) inherits it; do not add per-surface cleanup.

Completing a task must NOT remove references: a completed dependency is exactly what readiness needs to see, and the record stays resolvable in the completed corpus.

Decision recorded for the implementer: on demote, references are removed rather than rewritten to the new DRAFT-N identity. Rewriting would preserve the relationship, and drafts are accepted as dependency targets today, but removal is the behavior the maintainer chose for its simplicity. Do not rewrite.

Not in scope: whether archived or demoted IDs should stop being recycled by the allocator. That touches ID allocation and stays as it is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Archiving a task removes its ID from the dependencies of every referencing task in both the working copy and the completed corpus
- [ ] #2 Demoting a task to a draft performs the same reference cleanup, so no dependent is left pointing at the vacated ID
- [ ] #3 Both operations report which tasks had a reference removed instead of changing them silently
- [ ] #4 Completing a task never removes references to it from other tasks
- [ ] #5 The cleanup lives in core and applies to every surface that archives or demotes, with no per-surface duplication
- [ ] #6 A regression test reproduces the misbinding end to end: reference the task, archive or demote it, allocate the freed ID to a new task, and assert no dependent silently resolves to the new task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

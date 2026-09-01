---
id: BACK-676
title: Make agent task descriptions carry the why
status: To Do
assignee: []
created_date: '2026-09-01 19:38'
labels: []
dependencies: []
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task descriptions written by agents state what to build and omit why the task exists, which leaves the next agent unable to judge scope, alternatives, or whether the task still makes sense. The guidance is not actually silent on this: the CLI guide says a description should explain 'the outcome and why it matters' and the MCP guide says 'Explain desired outcome and user value (the WHY)'. The demonstrated shape contradicts it. The only example description shipped anywhere is the CLI guide's `-d "Users can search tasks, docs, and decisions from one CLI command."`, which is outcome-only with no why, and the MCP guide shows no example description at all. Agents copy examples more reliably than they follow prose, so the example is what gets reproduced. Nearby lines push the same way: 'Keep the description focused on outcome and essential handoff context' reads as an instruction to trim.

Fix the demonstrated shape rather than adding more prose. Both guides get an example whose description carries the need before the change, and the CLI bullet is reworded to name what belongs there and, explicitly, what does not: acceptance criteria already state what will be true when the work is done, and the description must not restate them. The prohibition matters as much as the positive instruction, because a description that duplicates the criteria is the failure mode this wording could otherwise create.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The CLI task-creation guide describes what a description must contain and explicitly says not to restate the acceptance criteria there
- [ ] #2 The CLI guide example shows a description that gives the need or trigger before what changes, and a short contrast noting why the outcome-only version is too thin
- [ ] #3 The MCP task-creation guidance carries an equivalent example, since it currently shows none
- [ ] #4 Guidance that pushes toward trimming descriptions is reconciled with the new wording so the two do not contradict each other
- [ ] #5 Tests asserting on shipped instruction text are updated in the same change and the full suite passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

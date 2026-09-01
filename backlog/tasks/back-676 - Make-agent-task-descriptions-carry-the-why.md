---
id: BACK-676
title: Make agent task descriptions carry the why
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-01 19:38'
updated_date: '2026-09-01 19:53'
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
- [x] #1 The CLI task-creation guide describes what a description must contain and explicitly says not to restate the acceptance criteria there
- [x] #2 The CLI guide example shows a description that gives the need or trigger before what changes, and a short contrast noting why the outcome-only version is too thin
- [x] #3 The MCP task-creation guidance carries an equivalent example, since it currently shows none
- [x] #4 Guidance that pushes toward trimming descriptions is reconciled with the new wording so the two do not contradict each other
- [x] #5 Tests asserting on shipped instruction text are updated in the same change and the full suite passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reword the CLI task-creation description bullet (src/guidelines/cli-instructions/task-creation.md) to name the problem/trigger/user need plus non-recoverable context, and explicitly forbid restating acceptance criteria.
2. Replace the outcome-only `-d` example in the same guide with one that gives the need before the change, and add a two-line 'Too thin' contrast showing the old line and why it fails.
3. Give the MCP guide (src/guidelines/mcp/task-creation.md) the same rewording plus an example description and contrast, in its existing bold-label + dashed-bullet shape.
4. Reconcile the MCP lines that read as 'trim the description' ('Only include minimal local code context', 'Never embed implementation details', 'Keep the description focused') so they explicitly limit implementation detail rather than rationale.
5. Confirm no other shipped surface (agent-guidelines.md, project-manager-backlog.md) contradicts the new wording; leave them alone if already why-first.
6. Pin the new wording with assertions in src/test/cli-guidance.test.ts and src/test/mcp-server.test.ts; check src/test/cli-init-create.test.ts and task-type-filtering.test.ts for affected substring matches.
7. Run bunx tsc --noEmit, bun run check ., and the full bun run test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both shipped task-creation guides now demonstrate the why, not just assert it.

CLI guide (src/guidelines/cli-instructions/task-creation.md):
- Step 4 bullet now reads: 'A description that captures why the task exists: the problem, trigger, or user need behind it, plus any context a future agent cannot recover from the code. The acceptance criteria already state what will be true when the work is done - do not restate them here.' The prohibition is deliberate: without it the new positive wording invites agents to paraphrase the acceptance criteria into the description.
- The example -d value now gives the need before the change, followed by a two-line contrast that labels the old outcome-only line as too thin and says why (states the change but not the need, so a future agent cannot weigh scope or alternatives).

MCP guide (src/guidelines/mcp/task-creation.md):
- Step 5 'Title and description' carries the same requirement and prohibition, plus the first example description shipped in that guide and the same too-thin contrast, in the existing bold-label + dashed-bullet shape.
- Reconciled the lines that read as 'trim the description': 'Only include minimal local code context ...' now ends 'this limits code detail, not the reason the work is needed'; 'Never embed implementation details' now ends 'this excludes how the work will be built, not why it is needed'; the 'keep it focused' sentence now says focus means leaving out implementation detail, not leaving out the why.

Scope: agent-guidelines.md and project-manager-backlog.md already frame the description as 'the why' and contain no competing example description, so they were left unchanged. project-manager-backlog.md's inline CLI-syntax example ('Implement a secure authentication system to allow users to register and login') is outcome-only, but it exists to demonstrate command syntax rather than description quality, and rewriting it is outside this task's acceptance criteria.

No existing test asserted on the changed strings, so new assertions were added to pin the wording: src/test/cli-guidance.test.ts (rendered 'backlog instructions task-creation' output) and src/test/mcp-server.test.ts (new case over MCP_TASK_CREATION_GUIDE).

Also replaced the outcome-only example description in src/guidelines/project-manager-backlog.md and its byte-identical mirror .claude/agents/project-manager-backlog.md (maintainer asked for it while the PR was open). The old value, 'Implement a secure authentication system to allow users to register and login', restated the title as an instruction and carried no need; the new one names the problem (anyone with the URL reaches every page, so the app cannot be shared outside the team) before what changes. The example exists to demonstrate CLI syntax rather than description quality, but by this task's own thesis it was the weakest example shipped. Its comma-separated --ac form was left as is, since that is what the surrounding text is demonstrating.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworded the description requirement in both shipped task-creation guides so it names the problem, trigger, or user need behind a task and explicitly forbids restating the acceptance criteria, and replaced the demonstrated shape: the CLI guide's example -d value now gives the need before the change and is followed by a two-line contrast labelling the old outcome-only line as too thin, while the MCP guide gets its first example description plus the same contrast. Reconciled the MCP lines that read as instructions to trim ('minimal local code context', 'never embed implementation details', 'keep the description focused') so they limit implementation detail rather than rationale. Verified with new assertions in src/test/cli-guidance.test.ts and src/test/mcp-server.test.ts and the full suite: 2812 pass, 8 skip, 0 fail; bunx tsc --noEmit and bun run check . clean.
<!-- SECTION:FINAL_SUMMARY:END -->

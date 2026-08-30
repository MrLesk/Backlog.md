---
id: BACK-664
title: Read the Backlog overview once per conversation instead of per request
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-30 20:59'
updated_date: '2026-08-30 21:00'
labels:
  - cli
  - enhancement
dependencies: []
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The shipped agent nudge (src/guidelines/cli-agent-nudge.md, injected into AGENTS.md at init) instructs agents to run `backlog instructions overview` "for every user request", so agents re-read static content many times per conversation, wasting tokens (maintainer-observed across multiple agents). Change the trigger to once at the beginning of each conversation, re-reading only if it has not been read in the current conversation. The lifecycle guide triggers (task-creation/execution/finalization before those actions) stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The shipped nudge instructs reading the overview at the start of each conversation, not per request
- [x] #2 Existing projects pick up the new wording via the documented instruction-update path
- [x] #3 The init test asserting the old sentence is updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reword the overview trigger sentence in cli-agent-nudge.md, update the init test expectation, check for other copies of the sentence in shipped surfaces.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reworded the overview trigger in src/guidelines/cli-agent-nudge.md (the single source imported by guidelines/index.ts and injected at init/update) from per-request to once per conversation, updated this repo's AGENTS.md instance and the init test expectation. Verified with bunx tsc --noEmit, bun run check ., and src/test/cli-init-create.test.ts (44 pass).
<!-- SECTION:FINAL_SUMMARY:END -->

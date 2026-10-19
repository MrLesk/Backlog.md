---
id: BACK-536
title: Enforce just-in-time implementation planning in workflow guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 21:18'
updated_date: '2026-07-11 21:51'
labels:
  - workflow
  - instructions
  - documentation
dependencies: []
priority: high
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent task creators from freezing an implementation approach before work starts. Creation records durable intent, scope, acceptance criteria, references, and dependencies; the worker researches the current system and records the plan only after taking the task into an active status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The canonical CLI task-creation guide explicitly excludes implementation plans and explains that plans become stale before pickup
- [x] #2 The task-execution guide requires moving and assigning the task before current-state research and plan recording
- [x] #3 Plan approval is required before implementation when the plan contains material product, architecture, or workflow decisions
- [x] #4 Legacy MCP workflow guidance matches the canonical lifecycle without becoming the primary workflow
- [x] #5 Instruction tests cover the creation-versus-execution phase boundary
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the canonical CLI creation guide to capture only durable intent/scope and explicitly defer plans until task pickup.
2. Update the execution guide so the worker first activates and owns the task, researches the current system, records a current plan, and pauses only for material product, architecture, or workflow approval.
3. Align the legacy MCP adapter guidance and the shipped full agent guidance with the same lifecycle while keeping CLI canonical.
4. Add focused instruction contract tests, run the relevant test/type/lint checks, and finalize the task record.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Groma evidence: all 11 To Do tasks GROM-8 through GROM-18 already had implementation plans; GROM-18 was created and updated within one minute while still To Do and unassigned. Updated canonical CLI guidance, legacy MCP parity guidance, and the shipped full agent guide so planning happens only after pickup and current-state research, with proportional approval for material decisions.

Verification: bun test src/test/cli-guidance.test.ts src/test/mcp-server.test.ts (27 pass, 0 fail); bunx tsc --noEmit passed; bun run check . passed across 328 files; git diff --check passed; rendered CLI guides show the intended phase order.

Review repair: removed the remaining unconditional MCP approval and confirmation rules, made routine plan adjustments non-blocking within confirmed scope, and corrected the full agent example to order pickup, task read, fresh research, plan recording, conditional review, then implementation. Added negative assertions for the contradictory phrases and an explicit lifecycle-order test.

Exact repair verification: 46 focused tests passed; full suite 1655 passed, 2 intentional interactive skips, 0 failed with 6808 assertions across 192 files in 248.46s; bunx tsc --noEmit, bun run check . across 328 files, and git diff --check passed.

Consolidated five-comment repair: restored read-and-eligibility review before status/assignee mutation; kept fresh research and plan after activation; limited MCP creation to durable intent/scope/criteria/references/dependencies; removed blanket MCP reapproval; preserved proportional review; documented the direct-active exception for --plan in task create option help and its schema. Added positive, negative, lifecycle-order, and help contract assertions.

Old-head Windows failure classification: the sole failure was this change own MCP test matching a literal LF across a Markdown blockquote; Windows imported CRLF. The corrected assertion is line-ending independent. No old-head rerun. Final local verification: 46 focused tests passed; full suite 1655 passed, 2 intentional interactive skips, 0 failed, 6827 assertions across 192 files in 241.18s; tsc, Biome 328 files, rendered help/guides, and diff hygiene passed.

Third instruction-contradiction review repair: replaced the legacy MCP creation guide Additional Context Gathering section that still encouraged code/test/external research for a plan. Creation now gathers only durable work-order context, explicitly defers implementation research until active execution, and preserves only the already-started/direct-active exception based on research already completed. Regression tests require the new wording and forbid both contradictory phrases.

Final verification after this repair: focused instruction suite 46 passed, 0 failed; full suite 1655 passed, 2 intentional interactive skips, 0 failed, 6833 assertions across 192 files in 204.38s; tsc, Biome 328 files, and diff hygiene passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Established just-in-time task planning across canonical CLI, full agent, and legacy MCP guidance. Creation captures durable work-order context and never triggers implementation research for future work; current-system research and planning happen after eligible work is activated. The narrow already-started/direct-active exception preserves research already completed. Proportional approval, lifecycle order, help wording, and contradictory legacy phrases are protected by cross-platform contract tests; focused and full gates pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

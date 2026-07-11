---
id: BACK-534
title: Eliminate MCP milestone mutation CI timeout
status: In Progress
assignee:
  - '@mcp-milestone-ci'
created_date: '2026-07-11 00:41'
labels:
  - ci
  - mcp
  - concurrency
dependencies: []
priority: high
type: bug
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Linux full-suite CI repeatedly times out the MCP milestone task_create/task_edit regression at 10 seconds while the same test passes quickly in isolation. Find the deterministic wait, leaked resource, or concurrency interaction rather than masking it with a larger timeout. Keep this repair isolated from PR #757.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The full-suite interaction that causes the MCP milestone mutation test to stall is reproduced or localized with deterministic focused coverage
- [ ] #2 The underlying wait, resource leak, or concurrency defect is fixed without increasing the test or CI timeout
- [ ] #3 Focused regression coverage proves task_create milestone assignment and task_edit milestone clearing complete and preserve existing semantics
- [ ] #4 TypeScript, Biome, focused tests, full isolated tests, and compiled build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compare the isolated milestone test with full-suite ordering and inspect MCP server/client teardown and shared process state.
2. Build a deterministic focused reproducer for the blocking interaction and identify the exact unresolved operation or leaked resource.
3. Apply the smallest shared-lifecycle fix without raising timeouts or weakening assertions.
4. Run focused stress plus static, full-suite, and build verification; obtain independent spec and quality approvals before publishing a separate ready PR.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

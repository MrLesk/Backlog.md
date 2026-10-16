---
id: BACK-535.8
title: Thin duplicated MCP semantic test permutations
status: Done
assignee:
  - '@back5358-publish-finalize'
created_date: '2026-07-11 16:41'
updated_date: '2026-07-11 16:57'
labels: []
dependencies: []
modified_files:
  - src/test/mcp-refs-docs.test.ts
parent_task_id: BACK-535
priority: medium
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consolidate only evidence-backed duplicate MCP semantic test permutations in one focused PR. Keep MCP as a supported legacy adapter while treating the CLI workflow and shared product model as canonical. This slice changes tests only and must not change production behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An inventory identifies duplicated MCP semantic cases and the shipped contract protected by each affected MCP test file
- [x] #2 Shipped MCP schema, tool, resource, stdio, CLI-parity, and error-boundary contracts remain directly covered
- [x] #3 Every removed or consolidated MCP test is mapped to retained canonical CLI coverage or shared-domain coverage
- [x] #4 No production behavior or production source file changes
- [x] #5 Focused MCP tests pass repeatedly, full type/lint/build/test gates pass, and Linux/macOS/Windows CI remains required before merge
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory all MCP tests and shipped MCP public surfaces.
2. Classify semantic permutations against canonical CLI/shared-domain replacement coverage.
3. Consolidate only unambiguous duplicates while retaining adapter contract tests.
4. Run repeated focused tests and full local gates; document mappings and leave 3-OS CI as the merge gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Inventory reviewed all 16 MCP test files (124 retained MCP cases after this slice) plus shipped MCP tool schemas/descriptions, workflow and init-required resources, roots/workspace routing, stdio entrypoint, and README guidance. Only mcp-refs-docs.test.ts had an unambiguous bounded consolidation candidate.

Coverage mapping:
- MCP create references, create without references -> cli-refs-docs.test.ts create --ref cases plus references.test.ts present/absent/empty/persistence cases.
- MCP create documentation, create without documentation -> cli-refs-docs.test.ts create --doc cases plus documentation.test.ts present/absent/empty/persistence cases.
- MCP combined create and standalone persistence -> retained combined MCP create/output/persistence round-trip plus canonical CLI combined-create and markdown-persistence cases.
- MCP reference edit set/add/remove -> retained combined MCP edit-routing case plus CLI set/multiple cases and references.test.ts set/add/remove/replace/dedupe cases.
- MCP documentation edit set/add/remove -> retained combined MCP edit-routing case plus CLI set/multiple cases and documentation.test.ts set/add/remove/replace/dedupe cases.

The retained MCP tests directly assert published create/edit schemas for references and documentation, adapter create output and persisted values, and adapter edit routing for set/add/remove. No production files changed. All MCP roots, resources, stdio, schema, parity, validation, and error-boundary suites were otherwise left intact.

Validation: focused MCP file passed 20 consecutive runs (60/60 cases); canonical CLI/shared replacement set passed 37/37; complete MCP suite passed 124/124; bunx tsc --noEmit passed; bun run check . passed (323 files); bun run build passed; bun test passed 1653 with 2 intentional interactive TUI skips and 0 failures. git diff --check passed. Linux/macOS/Windows CI remains the required pre-merge remote gate.

Final exact removal mapping:
- Removed MCP "creates task with references" -> retained MCP combined create/output/persistence; cli-refs-docs "creates task with single reference" and "creates task with multiple references"; references "should create a task with references".
- Removed MCP "creates task without references" -> references "should create a task without references" and "should handle empty references array".
- Removed MCP "creates task with documentation" -> retained MCP combined create/output/persistence; cli-refs-docs "creates task with single documentation" and "creates task with multiple documentation entries"; documentation "should create a task with documentation".
- Removed MCP "creates task without documentation" -> documentation "should create a task without documentation" and "should handle empty documentation array".
- Removed MCP "creates task with both fields" -> retained MCP combined create/output/persistence and cli-refs-docs "creates task with both references and documentation".
- Removed MCP "sets references on existing task" -> retained MCP combined edit-routing; cli-refs-docs "sets references on existing task" and "sets multiple references on existing task"; references "should set references on existing task" and "should replace references when setting directly".
- Removed MCP "adds references to existing task" -> retained MCP combined edit-routing and references "should add references to existing task"/dedupe coverage.
- Removed MCP "removes references from existing task" -> retained MCP combined edit-routing and references "should remove references from existing task".
- Removed MCP "sets documentation on existing task" -> retained MCP combined edit-routing; cli-refs-docs "sets documentation on existing task" and "sets multiple documentation entries on existing task"; documentation set/replace cases.
- Removed MCP "adds documentation to existing task" -> retained MCP combined edit-routing and documentation add/dedupe cases.
- Removed MCP "removes documentation from existing task" -> retained MCP combined edit-routing and documentation remove case.
- Removed MCP "persists references and documentation in task" -> retained MCP combined create/persistence; cli-refs-docs reference/documentation markdown persistence; references/documentation frontmatter persistence cases.
Review evidence: specification review cycle 1 APPROVED; quality review cycle 1 APPROVED; zero findings; circuit-breaker count 0.
Final local evidence: focused MCP file 20 consecutive runs = 60/60; canonical CLI/shared replacement set = 37/37; complete MCP suite = 124/124; full suite = 1653 passed, 2 intentional interactive TUI skips, 0 failed; bunx tsc --noEmit passed; bun run check . passed (323 files); bun run build passed; git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated 12 duplicated one-field MCP reference/documentation semantic permutations into three focused adapter-contract tests for published schemas, combined create/persistence, and combined edit routing. Canonical CLI and shared-domain suites retain every removed semantic case; production behavior and source files are unchanged. Specification and quality reviews both approved in cycle 1 with zero findings. Verified locally with focused 20x (60/60), replacement coverage (37/37), all MCP tests (124/124), full suite (1653 pass, 2 intentional skips, 0 fail), TypeScript, Biome (323 files), build, and diff checks; 3-OS CI remains the merge gate.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

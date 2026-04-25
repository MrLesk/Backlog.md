---
id: BACK-442
title: Prevent DoD defaults config injection
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:31'
updated_date: '2026-04-25 22:54'
labels:
  - security
  - mcp
  - definition-of-done
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/555'
  - BACK-394
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Harden the MCP Definition of Done defaults upsert tool so unsafe user-provided default items cannot inject additional config keys or command-bearing values when persisted to project config. This task tracks PR #555 and is a focused security follow-up to the DoD default management work in BACK-394.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `definition_of_done_defaults_upsert` continues to accept quoted and multiline Definition of Done defaults as user content instead of treating them as validation errors.
- [x] #2 Quoted and multiline payloads round-trip through config persistence without creating or modifying config keys such as `onStatusChange`.
- [x] #3 Existing valid Definition of Done default item behavior remains unchanged, including comma-bearing defaults.
- [x] #4 Regression tests cover newline, double-quote, and apostrophe payloads for MCP Definition of Done defaults.
- [x] #5 Type checking, formatting/linting, the focused MCP Definition of Done defaults test suite, GitHub checks, and Codex review pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebase PR #555 onto current main and fix the task/title mismatch.
2. Verify the actual config persistence path for Definition of Done defaults.
3. Remove the over-restrictive validation approach after confirming the serializer already escapes dangerous content.
4. Add regression coverage for quoted and multiline payloads that look like config key injection.
5. Run local verification, wait for GitHub checks and Codex review, then merge the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR #555 initially tried to reject quote/newline characters in MCP DoD defaults, but review confirmed the current config writer already serializes DoD entries with JSON string escaping. The final solution keeps existing valid input behavior and adds regression coverage proving key-looking payloads remain within `definition_of_done` and do not create `onStatusChange`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #555 as `BACK-442 - Prevent DoD defaults config injection`.

The final PR is regression coverage rather than new validation: `definition_of_done_defaults_upsert` now has tests proving quoted and multiline payloads round-trip safely through config persistence without injecting `onStatusChange`, while apostrophe-bearing defaults remain accepted. Local verification passed with `bun test src/test/mcp-definition-of-done-defaults.test.ts`, `bun run check .`, and `bunx tsc --noEmit`; the GitHub matrix passed and Codex left a thumbs-up on the latest commit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-507.4
title: Self-correcting CLI errors for agents and humans
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:13'
updated_date: '2026-06-13 14:28'
labels: []
milestone: m-7
dependencies: []
parent_task_id: BACK-507
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve common CLI error paths so humans and agents can recover without hallucinating commands. Errors should point to the closest valid command or option, accepted values where relevant, and the exact help command to run next.

Focus on high-impact failures: unknown command, unknown option, missing required argument, invalid status or priority, invalid numeric fields, invalid docs path, MCP/init mode conflicts, and destructive-command guardrails. Use Commander’s existing suggestion/help hooks where possible and Backlog validation messages where command-specific context is needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unknown command and unknown option errors suggest likely valid alternatives and show the relevant help command.
- [x] #2 Invalid enum/value errors include accepted values or the config-derived source of accepted values.
- [x] #3 Missing required inputs identify the missing field and point to command help.
- [x] #4 Validation errors stay concise and do not dump stack traces unless debug mode is enabled.
- [x] #5 Tests cover representative invalid invocations and assert actionable error text.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan

1. Enable Commander suggestion/help-after-error behavior globally so unknown commands/options point users to likely alternatives and help.
2. Add or adjust concise validation messages for common command-specific failures where the CLI already validates values.
3. Add focused tests for unknown command, unknown option, missing required argument, invalid priority/status/value examples, and docs path validation where practical.
4. Keep error output text-first and avoid stack traces in normal mode.
5. Run targeted error tests and TypeScript.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enabled Commander help-after-error globally while preserving close-match suggestions. Added regression coverage for unknown command, unknown option, missing required task ID, invalid priority, and unsafe document path errors. Focused verification passed: `bun test src/test/cli.test.ts --test-name-pattern "self-correcting CLI errors"` and `bunx tsc --noEmit`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enabled Commander suggestion/help-after-error behavior and added regression tests for common invalid invocations so users get accepted values or help pointers instead of opaque failures.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

---
id: BACK-270
title: Prevent command substitution in task creation inputs
status: Done
assignee:
  - '@codex'
created_date: '2025-09-17 21:20'
updated_date: '2026-07-01 18:04'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When creating tasks via the CLI we attempted to reference `backlog init` inside acceptance criteria text. The shell treated the backticks as command substitution and executed `backlog init`, injecting its prompt output into the saved task. We need a safer flow (guidance, escaping utilities, or CLI handling) so users can include literal backticks without corrupting task content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document safe quoting patterns for including literal backticks in CLI task commands.
- [x] #2 Evaluate updating CLI helpers so they escape backticks before submission or offer a flag to bypass shell parsing.
- [x] #3 Verify existing tasks are not affected by stray `backlog init` prompt text and repair any impacted files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect PR #361 patch, checks, comments, and conflicts against current main.
2. Verify whether current public CLI/MCP/instruction surfaces already cover literal backtick safety.
3. Replace the stale sanitizer approach with narrow current guidance for safe shell quoting where needed.
4. Add regression assertions for the shipped instruction surfaces.
5. Search backlog files for prompt-output corruption, run targeted checks, then close/update PRs accordingly.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Inspected PR #361: it is open, conflicts with current main, has stale CI from September 2025, and uses a lossy post-substitution sanitizer. Decided not to merge that branch because Backlog.md cannot reconstruct literal backticks after the shell has already executed command substitution. Added shell-quoting guidance to the shipped CLI task-creation guide, generated agent guidelines, and CLI reference instead, with regression tests. Verified existing backlog task files do not contain stray backlog-init prompt output requiring repair.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added literal-backtick shell quoting guidance to the CLI task-creation workflow guide, generated agent guidelines, and CLI reference. Added regression coverage for the shipped CLI and agent instruction surfaces. Evaluated PR #361 and rejected its post-substitution sanitizer approach as lossy because the shell executes backticks before Backlog.md receives arguments. Verified no existing backlog task files needed repair.
<!-- SECTION:FINAL_SUMMARY:END -->
